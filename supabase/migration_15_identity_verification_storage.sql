-- Migrazione 15 — Gap P0 MVP (PT-MVP-02, DEC-22): bucket storage per il
-- documento reale della Verifica identità del Centro.
--
-- QUESTO FILE NON È STATO APPLICATO AL DATABASE. Va eseguito manualmente da
-- Fabrizio nello SQL Editor di Supabase. Nessuna dipendenza da altre
-- migrazioni: la colonna public.center_identity_verifications.document_url
-- esiste già da migration_09 (era stata predisposta ma mai collegata a un
-- upload reale — vedi commento sulla tabella e DECISION_LOG.md DEC-22).
--
-- ════════════════════════════════════════════════════════════════
-- Cosa fa
-- ════════════════════════════════════════════════════════════════
-- Crea un bucket PRIVATO dedicato "buddykids-identity-verifications" (NON lo
-- stesso bucket delle Certificazioni servizio — sono documenti diversi, con
-- proprietari e regole diverse, meglio isolarli) con le stesse identiche
-- policy di storage.objects già in produzione per "buddykids-certifications"
-- (vedi supabase/schema.sql, sezione "Bucket PRIVATO per i documenti di
-- supporto delle Certificazioni servizio"): convenzione di path
-- "<center_id>/<file>", lettura/scrittura solo per il centro proprietario
-- (via public.current_center_id(), helper già esistente) o platform_admin
-- (via public.is_platform_admin(), helper già esistente).
--
-- Nessuna nuova funzione, nessuna nuova tabella: solo il bucket e le policy
-- di storage mancanti perché il codice applicativo (lib/storage.ts,
-- app/actions/onboarding.ts, vedi commit collegato) possa effettivamente
-- caricare e leggere il documento.
-- ════════════════════════════════════════════════════════════════

begin;

insert into storage.buckets (id, name, public)
values ('buddykids-identity-verifications', 'buddykids-identity-verifications', false)
on conflict (id) do nothing;

create policy "Verifica identita: lettura solo dal centro proprietario e dall'admin"
  on storage.objects for select
  using (
    bucket_id = 'buddykids-identity-verifications'
    and (
      (storage.foldername(name))[1] = public.current_center_id()::text
      or public.is_platform_admin()
    )
  );

create policy "Verifica identita: upload solo nella propria cartella centro"
  on storage.objects for insert
  with check (
    bucket_id = 'buddykids-identity-verifications'
    and (storage.foldername(name))[1] = public.current_center_id()::text
  );

create policy "Verifica identita: aggiornamento solo dei propri documenti"
  on storage.objects for update
  using (
    bucket_id = 'buddykids-identity-verifications'
    and (storage.foldername(name))[1] = public.current_center_id()::text
  );

create policy "Verifica identita: eliminazione dei propri documenti o da admin"
  on storage.objects for delete
  using (
    bucket_id = 'buddykids-identity-verifications'
    and (
      (storage.foldername(name))[1] = public.current_center_id()::text
      or public.is_platform_admin()
    )
  );

commit;

-- ════════════════════════════════════════════════════════════════
-- Tutto ciò che segue è FUORI dalla transazione sopra (già chiusa da
-- COMMIT): pre-check, post-check, rollback. Mai eseguiti insieme al blocco
-- sopra.
-- ════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════
-- PRE-CHECK — NON ESEGUITO AUTOMATICAMENTE
-- Da eseguire manualmente, una query alla volta, PRIMA del blocco
-- begin;/commit; sopra. Solo lettura.
-- ════════════════════════════════════════════════════════════════

-- 1. Gli helper riusati esistono già (creati da migration_07/09):
-- select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and proname in ('current_center_id', 'is_platform_admin');
-- -- atteso: 2 righe.

-- 2. Il bucket non esiste già (su un ambiente pulito):
-- select id from storage.buckets where id = 'buddykids-identity-verifications';
-- -- atteso: 0 righe. Se già presente, l'insert sopra è comunque sicuro
-- -- (on conflict do nothing) ma le policy potrebbero già esistere: verificare
-- -- punto 3 del POST-CHECK prima di eseguire le create policy, o rimuovere
-- -- manualmente quelle duplicate se il blocco fallisce per "already exists".

-- ════════════════════════════════════════════════════════════════
-- POST-CHECK — eseguire DOPO il COMMIT sopra, separatamente, una query
-- alla volta.
-- ════════════════════════════════════════════════════════════════

-- 3. Il bucket esiste ed è privato:
-- select id, public from storage.buckets where id = 'buddykids-identity-verifications';
-- -- atteso: 1 riga, public = false.

-- 4. Le 4 policy esistono:
-- select policyname from pg_policies
--   where schemaname = 'storage' and tablename = 'objects'
--   and policyname like 'Verifica identita:%';
-- -- atteso: 4 righe.

-- 5. Test funzionale (dopo il deploy del codice collegato): un center_admin
-- carica un documento dal form "Verifica identità" in /center/one/onboarding,
-- poi un platform_admin lo apre da /admin/one/onboarding — entrambi devono
-- riuscire; un center_admin di un ALTRO centro non deve riuscire a leggerlo.

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK — sicuro, nessuna tabella/colonna esistente referenzia questi
-- oggetti (document_url su center_identity_verifications resta intatta,
-- semplicemente punterebbe a path non più leggibili se il bucket viene
-- rimosso: nessun errore di integrità referenziale, solo un link rotto lato
-- applicativo se ci sono già documenti caricati).
-- ════════════════════════════════════════════════════════════════
-- begin;
-- drop policy if exists "Verifica identita: eliminazione dei propri documenti o da admin" on storage.objects;
-- drop policy if exists "Verifica identita: aggiornamento solo dei propri documenti" on storage.objects;
-- drop policy if exists "Verifica identita: upload solo nella propria cartella centro" on storage.objects;
-- drop policy if exists "Verifica identita: lettura solo dal centro proprietario e dall'admin" on storage.objects;
-- delete from storage.objects where bucket_id = 'buddykids-identity-verifications';
-- delete from storage.buckets where id = 'buddykids-identity-verifications';
-- commit;
