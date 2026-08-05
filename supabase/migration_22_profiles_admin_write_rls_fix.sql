-- Migrazione 22 — Fix RLS "profiles": WITH CHECK mancante per Admin
-- piattaforma (bug P0 segnalato da Fabrizio, 05/08: "su partner provo ad
-- accedere ma ogni refresh di pagina riporta a quella genitori... mi loggo
-- con faberx83+partnernew (che ho già candidato e approvato lato admin) mi
-- riporta nella home genitori").
--
-- QUESTO FILE NON È STATO APPLICATO AL DATABASE. Va eseguito manualmente da
-- Fabrizio nello SQL Editor di Supabase (nessuna migrazione applicata da
-- Claude, per governance del progetto).
--
-- ════════════════════════════════════════════════════════════════
-- Root cause (verificata dal vivo, in sola lettura, su pg_policies)
-- ════════════════════════════════════════════════════════════════
-- La policy RLS originaria su public.profiles (supabase/schema.sql, riga
-- 94-102, precede TUTTI gli sprint TRAMA):
--
--   create policy "Profiles: un utente vede/modifica il proprio profilo"
--     on public.profiles for all
--     using (auth.uid() = id or public.is_platform_admin())
--     with check (auth.uid() = id);
--
-- USING permette a un Admin piattaforma di TARGETTARE la riga di un altro
-- utente (select/update/delete). WITH CHECK governa invece se la RIGA
-- RISULTANTE dopo la scrittura è permessa — e qui manca l'eccezione
-- is_platform_admin(). Risultato: quando app/actions/admin.ts esegue
--   supabase.from("profiles").update({ role: "center_admin", center_id })
--     .eq("id", profile.id)
-- con un utente Admin piattaforma che aggiorna il profilo di UN ALTRO utente,
-- Postgres valuta USING (passa, è admin) ma poi WITH CHECK (auth.uid() = id)
-- fallisce per la riga risultante — e scarta la scrittura. Il client
-- Supabase/PostgREST NON restituisce un errore in questo caso (0 righe
-- interessate, nessuna eccezione lanciata): l'azione server sembra riuscita
-- ma non scrive nulla.
--
-- Impatto reale confermato: SOLO 1 profilo con role='center_admin' esiste
-- oggi nel DB — la maggior parte delle assegnazioni gestore passa dal
-- trigger handle_new_user() (SECURITY DEFINER, bypassa RLS, funziona sempre)
-- al momento della REGISTRAZIONE. Il bug emerge solo quando il profilo
-- ESISTEVA GIÀ prima dell'approvazione della candidatura (esattamente il
-- caso di faberx83+partnernew: account creato 09:10:31, candidatura
-- approvata/claimed 13:29:39) — createCenterAndAssignAction/
-- assignCenterAdminAction sono le uniche vie che possono colpire questo
-- caso, ed entrambe erano silenziosamente rotte da quando lo schema è
-- stato scritto la prima volta, non da uno sprint recente.
--
-- Fix: aggiungere is_platform_admin() anche al WITH CHECK, simmetrico a
-- USING. Un utente normale continua a poter scrivere SOLO la propria riga
-- (auth.uid() = id resta lì per il caso non-admin); un Admin piattaforma può
-- ora scrivere qualunque riga, in linea con quanto USING già permetteva in
-- lettura/targeting.
-- ════════════════════════════════════════════════════════════════

begin;

drop policy if exists "Profiles: un utente vede/modifica il proprio profilo" on public.profiles;

create policy "Profiles: un utente vede/modifica il proprio profilo"
  on public.profiles for all
  using (auth.uid() = id or public.is_platform_admin())
  with check (auth.uid() = id or public.is_platform_admin());

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

-- 1. Confermare la definizione ATTUALE della policy (atteso: with_check
--    contiene SOLO "(auth.uid() = id)", senza is_platform_admin()):
-- select policyname, cmd, qual, with_check
--   from pg_policies
--   where schemaname = 'public' and tablename = 'profiles'
--   and policyname = 'Profiles: un utente vede/modifica il proprio profilo';

-- 2. Confermare che is_platform_admin() esiste già (riusata, non nuova):
-- select proname from pg_proc where proname = 'is_platform_admin';

-- ════════════════════════════════════════════════════════════════
-- POST-CHECK — eseguire DOPO il COMMIT sopra, separatamente, una query
-- alla volta.
-- ════════════════════════════════════════════════════════════════

-- 3. La nuova policy ha with_check aggiornato (atteso: with_check contiene
--    "is_platform_admin()"):
-- select policyname, cmd, qual, with_check
--   from pg_policies
--   where schemaname = 'public' and tablename = 'profiles'
--   and policyname = 'Profiles: un utente vede/modifica il proprio profilo';

-- 4. Test funzionale end-to-end (richiede il deploy col codice applicativo
--    di questa stessa sprint, in particolare app/actions/admin.ts già
--    aggiornato per rilevare 0-righe come warning invece di falso successo):
--    a) Da Admin, /admin/center-leads -> "Assegna centro admin" (o il flusso
--       equivalente di assegnazione) su un profilo GIÀ esistente -> deve
--       restituire "assigned: true" (non più il warning "0 righe aggiornate").
--    b) select role, center_id from public.profiles where email = '...'
--       deve mostrare role='center_admin' e center_id valorizzato subito
--       dopo, senza bisogno di ri-registrarsi.
--
-- 5. Verifica esplicita che un utente NON admin non possa scrivere la riga
--    di un altro utente (deve continuare a fallire, invariato):
--    - da un profilo 'parent' normale, tentare un update su profiles per un
--      id diverso dal proprio -> deve continuare a fallire (0 righe, come
--      prima — il fix riguarda SOLO il ramo is_platform_admin()).

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ════════════════════════════════════════════════════════════════
-- begin;
-- drop policy if exists "Profiles: un utente vede/modifica il proprio profilo" on public.profiles;
-- create policy "Profiles: un utente vede/modifica il proprio profilo"
--   on public.profiles for all
--   using (auth.uid() = id or public.is_platform_admin())
--   with check (auth.uid() = id);
-- commit;
