-- Migrazione 23 — Fix privacy (segnalato nel piano BuddyKids_Privacy_
-- Compliance_Piano.docx come rischio urgente, dati di minori): bucket
-- storage dedicato e PRIVATO per le foto profilo dei bambini.
--
-- QUESTO FILE NON È STATO APPLICATO AL DATABASE. Va eseguito manualmente da
-- Fabrizio nello SQL Editor di Supabase.
--
-- ════════════════════════════════════════════════════════════════
-- Cosa fa e perché
-- ════════════════════════════════════════════════════════════════
-- Oggi le foto profilo (genitori, bambini, centri, fornitori) condividono
-- tutte lo stesso bucket PUBBLICO "buddykids-images" (vedi lib/storage.ts):
-- chiunque conosca/intercetti l'URL può vedere la foto, per sempre, senza
-- autenticazione — accettabile per un'immagine di un adulto che l'ha
-- caricata volontariamente, non per la foto di un minore.
--
-- Decisione di Fabrizio (06/08/2026): rendere privata SOLO la cartella
-- bambini, lasciando invariato tutto il resto del bucket pubblico
-- (avatars/centers/partner-offers) per non introdurre rischio di rottura
-- su ~10 componenti che già mostrano quelle foto con <img src=...> diretto.
--
-- Nuovo bucket dedicato "buddykids-kids-avatars" (PRIVATO), path
-- "<parent_id>/<file>" (owner = il genitore, non il bambino: kids.parent_id
-- è l'unico riferimento diretto disponibile via auth.uid() senza una query
-- aggiuntiva nella policy). Stesso pattern già in produzione per
-- "buddykids-certifications"/"buddykids-identity-verifications" (vedi
-- migration_15): lettura/scrittura solo tramite URL firmato temporaneo
-- generato lato server/client con la sessione dell'utente, MAI un
-- getPublicUrl().
-- ════════════════════════════════════════════════════════════════

begin;

insert into storage.buckets (id, name, public)
values ('buddykids-kids-avatars', 'buddykids-kids-avatars', false)
on conflict (id) do nothing;

create policy "Foto bambini: lettura solo dal genitore proprietario"
  on storage.objects for select
  using (
    bucket_id = 'buddykids-kids-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Foto bambini: upload solo nella propria cartella"
  on storage.objects for insert
  with check (
    bucket_id = 'buddykids-kids-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Foto bambini: aggiornamento solo delle proprie foto"
  on storage.objects for update
  using (
    bucket_id = 'buddykids-kids-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Foto bambini: eliminazione solo delle proprie foto"
  on storage.objects for delete
  using (
    bucket_id = 'buddykids-kids-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

commit;

-- ════════════════════════════════════════════════════════════════
-- Tutto ciò che segue è FUORI dalla transazione sopra (già chiusa da
-- COMMIT): pre-check, post-check, rollback. Mai eseguiti insieme al blocco
-- sopra.
-- ════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════
-- PRE-CHECK — NON ESEGUITO AUTOMATICAMENTE
-- ════════════════════════════════════════════════════════════════

-- 1. Il bucket non esiste già (su un ambiente pulito):
-- select id from storage.buckets where id = 'buddykids-kids-avatars';
-- -- atteso: 0 righe.

-- ════════════════════════════════════════════════════════════════
-- POST-CHECK — eseguire DOPO il COMMIT sopra, separatamente.
-- ════════════════════════════════════════════════════════════════

-- 2. Il bucket esiste ed è privato:
-- select id, public from storage.buckets where id = 'buddykids-kids-avatars';
-- -- atteso: 1 riga, public = false.

-- 3. Le 4 policy esistono:
-- select policyname from pg_policies
--   where schemaname = 'storage' and tablename = 'objects'
--   and policyname like 'Foto bambini:%';
-- -- atteso: 4 righe.

-- 4. Test funzionale (dopo il deploy del codice collegato): un genitore
-- carica una nuova foto per un bambino da Profilo -> I miei bambini; deve
-- vedersela subito (URL firmato generato al volo) e ritrovarla dopo reload.
-- Un secondo genitore (altro account) non deve poter generare un link
-- firmato per il path del primo (verificabile solo via codice/RLS, non
-- dall'interfaccia).
--
-- NOTA IMPORTANTE: le foto bambini caricate PRIMA di questa migrazione
-- restano nel vecchio bucket pubblico "buddykids-images" con l'URL
-- pubblico già salvato in kids.avatar_url — il codice (lib/data/kids.ts)
-- riconosce questo caso (valore che inizia per "http") e continua a
-- mostrarle cosi come sono, senza generare un link firmato. Non sono quindi
-- rimosse né rotte da questa migrazione, ma restano pubbliche finché non
-- vengono ricaricate. Se si vuole chiudere anche questo residuo, va gestito
-- a parte (migrazione dati, fuori scope di questo file).

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK — sicuro. Le foto già caricate nel nuovo bucket resterebbero
-- solo path non più leggibili (nessun URL firmato generabile), nessun
-- errore di integrità referenziale: kids.avatar_url è testo libero.
-- ════════════════════════════════════════════════════════════════
-- begin;
-- drop policy if exists "Foto bambini: eliminazione solo delle proprie foto" on storage.objects;
-- drop policy if exists "Foto bambini: aggiornamento solo delle proprie foto" on storage.objects;
-- drop policy if exists "Foto bambini: upload solo nella propria cartella" on storage.objects;
-- drop policy if exists "Foto bambini: lettura solo dal genitore proprietario" on storage.objects;
-- delete from storage.objects where bucket_id = 'buddykids-kids-avatars';
-- delete from storage.buckets where id = 'buddykids-kids-avatars';
-- commit;
