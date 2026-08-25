-- ═══════════════════════════════════════════════════════════════════════
-- MIGRATION 28 — legal_documents: lettura anonima scoped al documento
-- PUBLISHED corrente (BOZZA, NON APPLICATA)
-- ═══════════════════════════════════════════════════════════════════════
--
-- TRAMA — LEGAL FLOW TECHNICAL CLOSURE BEFORE CONTENT (ordine operativo di
-- Fabrizio, 25/08/2026), punto 1 "Public legal document access". Chiude un
-- gap NOTO e già documentato (non un errore emerso ora) — vedi il blocco di
-- commento in lib/legal/gate.ts (righe 106-120) e la nota nel POST-CHECK di
-- migration_27: la policy SELECT live su legal_documents è
-- "Legal documents: lettura autenticata" (for select to authenticated using
-- (true)) — nessuna policy "to anon" esiste oggi, quindi un visitatore
-- anonimo non può leggere /privacy o /terms via RLS diretta. Il workaround
-- applicativo attuale (resolvePublishedDocumentForPublicRoute() in
-- lib/legal/gate.ts, con createServiceClient()) resta FUNZIONANTE e NON
-- va rimosso finché questa migrazione non è applicata — vedi nota di
-- sequenziamento in fondo a questo file.
--
-- SCELTA: opzione (A) del messaggio operativo — "RLS anon SELECT scoped a
-- PUBLISHED" — invece di (B) query privilegiata lato server. Il contenuto è
-- per definizione pubblico (Termini/Privacy Notice pubblicati servono a
-- essere letti da chiunque, anche senza account) e lo schema di
-- legal_documents (colonna published_at, nullable = bozza) consente una
-- policy precisa in un solo predicato, senza dover distinguere per riga
-- quali colonne sono "sicure" da esporre (l'intera riga di un documento
-- PUBLISHED non contiene alcun dato utente — mai user_id, mai contenuto di
-- legal_acceptances/consent_events/parental_declarations).
--
-- COSA QUESTA POLICY GARANTISCE (i 4 vincoli del punto 1, verificati uno a
-- uno contro il predicato sotto):
--   1. Mai una riga DRAFT (published_at is null)      -> escluso da "published_at is not null"
--   2. Mai una riga SUPERSEDED (superata da una più recente dello stesso
--      tipo) a meno di richiesta esplicita               -> escluso da "= max(published_at) per quel document_type"
--   3. Mai scrittura                                    -> nessuna policy "for insert/update/delete to anon" aggiunta (default: nessuna policy = deny)
--   4. Mai lettura di legal_acceptances/consent_events/parental_declarations
--      per anon                                          -> queste 3 tabelle non sono toccate da questa migrazione; le loro
--                                                            policy esistenti confrontano contro auth.uid(), che è NULL per il
--                                                            ruolo anon (già verificato nel POST-CHECK migration_27 — nessuna
--                                                            modifica necessaria, restano strutturalmente irraggiungibili).
--
-- ADDITIVA AL 100%: una sola nuova policy su una tabella già esistente.
-- Nessuna tabella, colonna, o policy esistente viene toccata, alterata o
-- rimossa. Nessuna nuova tabella.
--
-- STATO CONTENUTO LEGALE: invariato, PENDING EXTERNAL REVIEW /
-- "EXISTING DRAFT — UNDER EXTERNAL LEGAL REVIEW" per la Privacy Notice
-- (rettifica di Fabrizio, 25/08/2026 sera). Questa migrazione non pubblica
-- alcun documento: oggi 0 righe hanno published_at valorizzato, quindi
-- questa policy non espone nulla finché Fabrizio non pubblica un testo
-- reale — vedi POST-CHECK #3 sotto.
--
-- SEQUENZIAMENTO — NON invertire l'ordine:
--   1. Fabrizio applica questa migrazione (SQL Editor, sola azione manuale).
--   2. SOLO DOPO, come passo di follow-up separato (non incluso qui, non
--      ancora richiesto), il codice applicativo POTREBBE smettere di usare
--      resolvePublishedDocumentForPublicRoute() (createServiceClient()) e
--      affidarsi invece a un client anon standard per /privacy e /terms.
--      Farlo PRIMA che questa migrazione sia applicata romperebbe le due
--      pagine pubbliche per ogni visitatore anonimo reale (regressione) —
--      per questo il workaround applicativo resta invariato in questo
--      commit, e questa migrazione è consegnata come SOLO file, non
--      applicata da Claude, in attesa del gate SQL di Fabrizio.
--
-- ═══════════════════════════════════════════════════════════════════════

begin;

-- Un utente anonimo può leggere SOLO la riga più recente PUBLISHED per
-- ciascun document_type ('terms' | 'privacy_notice') — mai una bozza, mai
-- una versione superata. La sottoquery ricalcola il max(published_at) per
-- lo stesso document_type della riga candidata: precisione a livello di
-- singola riga, non serve alcuna vista/materializzazione aggiuntiva.
create policy "Legal documents: lettura pubblica anonima (solo corrente)"
  on public.legal_documents
  for select
  to anon
  using (
    published_at is not null
    and published_at = (
      select max(ld2.published_at)
      from public.legal_documents ld2
      where ld2.document_type = legal_documents.document_type
        and ld2.published_at is not null
    )
  );

commit;

-- ════════════════════════════════════════════════════════════════
-- Tutto ciò che segue è FUORI dalla transazione sopra (già chiusa da
-- COMMIT): blocchi di riferimento (pre-check, verifica, rollback), non
-- parte della migrazione automatica. Eseguiti a parte, manualmente.
-- ════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════
-- PRE-CHECK — NON ESEGUITO AUTOMATICAMENTE
-- Da eseguire manualmente PRIMA del blocco begin;/commit; sopra.
-- ════════════════════════════════════════════════════════════════

-- 1. Conferma che legal_documents esiste con RLS abilitata (dipendenza
--    obbligatoria: migration_27 già LIVE, verificato nel suo POST-CHECK):
-- select relname, relrowsecurity from pg_class where relname = 'legal_documents';
-- -- atteso: 1 riga, relrowsecurity = true.

-- 2. Nessuna policy "to anon" esiste già su legal_documents (evita un
--    doppio-apply/nome duplicato):
-- select policyname, roles from pg_policies
--   where schemaname = 'public' and tablename = 'legal_documents';
-- -- atteso oggi: 2 righe ("Legal documents: lettura autenticata",
--    "Legal documents: solo Admin scrive"), nessuna con roles contenente
--    "anon".

-- 3. Stato contenuto attuale (informativo, non bloccante): quante righe
--    hanno già published_at valorizzato:
-- select document_type, count(*) filter (where published_at is not null) as pubblicate
--   from public.legal_documents group by document_type;
-- -- atteso oggi: 0 in ogni riga (0 documenti pubblicati) — questa
--    migrazione non espone quindi nulla di nuovo finché Fabrizio non
--    pubblica un testo reale.

-- ════════════════════════════════════════════════════════════════
-- POST-CHECK — NON ESEGUITO AUTOMATICAMENTE
-- Da eseguire DOPO il commit sopra.
-- ════════════════════════════════════════════════════════════════

-- 1. La nuova policy esiste, mirata al ruolo anon, comando SELECT:
-- select policyname, cmd, roles from pg_policies
--   where schemaname = 'public' and tablename = 'legal_documents'
--   and policyname = 'Legal documents: lettura pubblica anonima (solo corrente)';
-- -- atteso: 1 riga, cmd = 'SELECT', roles = {anon}.

-- 2. Nessuna riga scrivibile per anon (prova negativa — da una richiesta
--    con la anon key, senza sessione autenticata):
-- insert into public.legal_documents (document_type, version) values ('terms', 'test-anon');
-- -- atteso: errore RLS (nessuna policy "for insert to anon" esiste).

-- 3. (Solo dopo che Fabrizio avrà pubblicato almeno un testo reale) una
--    richiesta anonima legge ESATTAMENTE 1 riga per document_type, quella
--    con published_at massimo, mai una bozza né una versione precedente:
-- select id, document_type, version, published_at from public.legal_documents
--   where document_type = 'terms';
-- -- (eseguita con la anon key, senza sessione) atteso: 1 sola riga, quella
--    corrente — MAI 0 righe se un documento è stato pubblicato, MAI più di
--    1 riga per lo stesso document_type.

-- 4. Le altre 3 tabelle (legal_acceptances, consent_events,
--    parental_declarations) restano irraggiungibili per anon — nessuna
--    modifica di questa migrazione le riguarda, riverifica di non
--    regressione:
-- select policyname, roles, qual from pg_policies
--   where schemaname = 'public'
--   and tablename in ('legal_acceptances', 'consent_events', 'parental_declarations');
-- -- atteso: tutte le policy esistenti confrontano contro auth.uid() (NULL
--    per anon) — nessuna riga con roles contenente "anon" deve comparire
--    per queste 3 tabelle dopo questa migrazione.

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK — eseguire come blocco separato, SOLO se questa migrazione va
-- annullata. Sicuro: rimuove SOLO la policy introdotta qui. Se il codice
-- applicativo è già stato migrato a dipendere da questa policy (passo di
-- follow-up separato, vedi SEQUENZIAMENTO sopra), verificare PRIMA che
-- resolvePublishedDocumentForPublicRoute() (o l'equivalente allora in uso)
-- sia ripristinato, altrimenti il rollback romperebbe /privacy e /terms per
-- gli utenti anonimi.
-- ════════════════════════════════════════════════════════════════

-- begin;
-- drop policy if exists "Legal documents: lettura pubblica anonima (solo corrente)" on public.legal_documents;
-- commit;
