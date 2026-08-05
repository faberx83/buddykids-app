-- Script — Promuovere a "gestore centro" l'account di test creato da
-- Fabrizio dal form "Registrati" del portale Partner
-- (faberx83+partnernew@gmail.com), per capire perché dopo la conferma email
-- finiva sulla home genitori invece che sul portale Partner.
--
-- QUESTO FILE NON È STATO APPLICATO AL DATABASE. Va eseguito manualmente da
-- Fabrizio nello SQL Editor di Supabase, progetto eagsgfxunwyyxwwilldy, SOLO
-- dopo aver letto la SEZIONE 0 qui sotto (non è un bug di cache — è un
-- account senza ruolo).
--
-- ════════════════════════════════════════════════════════════════
-- SEZIONE 0 — Cosa sta succedendo (non è un bug di cache)
-- ════════════════════════════════════════════════════════════════
--
-- Verificato con una query di sola lettura: l'account
-- faberx83+partnernew@gmail.com esiste (id 847bc128-7725-42cb-9dd2-6012360df9a7),
-- l'email è confermata, ma role='parent' e center_id=null.
--
-- Root cause: in questo progetto NON esiste (e non è mai esistita) una
-- registrazione self-service per diventare gestore di un centro. Il form
-- "Registrati" del portale Partner (stessa LoginForm.tsx del tenant
-- famiglia, solo con branding diverso — vedi lib/tenant.ts) crea SEMPRE un
-- profilo con role='parent' di default (supabase/schema.sql, trigger
-- handle_new_user(), commento già presente in schema.sql alla sezione
-- "Come promuovere un utente a center_admin": "1) l'utente si registra
-- normalmente dall'app (ottiene ruolo 'parent') 2) dal SQL Editor, assegna
-- il ruolo"). L'UNICO modo per creare un centro con il suo primo gestore è
-- l'azione Admin createCenterAndAssignAction (app/actions/admin.ts,
-- pagina /admin/centers) — un self-signup sul sottodominio partner.* non è
-- MAI stato collegato a quel meccanismo.
--
-- Quello che Fabrizio ha osservato è quindi il comportamento CORRETTO del
-- gate di ruolo in proxy.ts (righe 139-156): un utente autenticato con
-- role='parent' che prova ad accedere a partner.* non ha accesso
-- (requiredRole='center_admin') e viene rimandato al dominio principale
-- (famiglia) — da lì l'impressione di "non riesco più a raggiungere la
-- pagina partner" (il redirect è deterministico, si ripete a ogni tentativo
-- finché il ruolo resta 'parent'). Con la cache/i cookie cancellati non
-- c'è ancora una sessione: proxy.ts mostra allora il LOGIN del sottodominio
-- partner (comportamento diverso, stesso gate, branch "non autenticato" —
-- righe 149-151) — da cui l'impressione opposta di "vedo di nuovo la home
-- partner".
--
-- Questo script promuove SOLO l'account di test indicato a center_admin,
-- collegandolo al centro di test già esistente "[TEST] Centro BuddyKids"
-- (id 40a64d60-3d45-4851-bac4-1761915ad92e, slug centro-test-buddykids —
-- stesso centro fixture usato da altri script/test in questo repo, vedi
-- script_production_hygiene_cleanup.sql). Se preferisci un centro
-- dedicato solo a questo test, sostituisci l'id nella SEZIONE 2 con quello
-- di un centro creato da /admin/centers.
--
-- ════════════════════════════════════════════════════════════════
-- SEZIONE 1 — PRE-CHECK (sola lettura — esegui e leggi PRIMA di procedere)
-- ════════════════════════════════════════════════════════════════

-- 1a. Riconferma lo stato attuale dell'account: deve restituire ESATTAMENTE
-- 1 riga, con role='parent' e center_id null. Se role è già 'center_admin'
-- o center_id non è null, qualcosa è cambiato dall'ultima verifica —
-- fermarsi e non proseguire alla SEZIONE 2 senza ricontrollare.
select id, email, role, center_id, created_at
from public.profiles
where email = 'faberx83+partnernew@gmail.com';

-- 1b. Riconferma che il centro di destinazione esiste ed è quello giusto
-- (fixture di test, non un centro reale con dati veri).
select id, slug, name, created_at
from public.centers
where id = '40a64d60-3d45-4851-bac4-1761915ad92e';

-- ════════════════════════════════════════════════════════════════
-- SEZIONE 2 — PROMOZIONE (esegui solo se la SEZIONE 1 ha dato l'esito atteso)
-- ════════════════════════════════════════════════════════════════

update public.profiles
set role = 'center_admin',
    center_id = '40a64d60-3d45-4851-bac4-1761915ad92e'
where email = 'faberx83+partnernew@gmail.com';

-- ════════════════════════════════════════════════════════════════
-- SEZIONE 3 — POST-CHECK (sola lettura — verifica che l'update sia andato a buon fine)
-- ════════════════════════════════════════════════════════════════

-- Deve restituire 1 riga con role='center_admin' e center_id =
-- 40a64d60-3d45-4851-bac4-1761915ad92e. A questo punto un login con questo
-- account su partner.<dominio> deve funzionare (proxy.ts, riga 142:
-- identity.role === requiredRole).
select id, email, role, center_id
from public.profiles
where email = 'faberx83+partnernew@gmail.com';

-- ════════════════════════════════════════════════════════════════
-- SEZIONE 4 — ROLLBACK (se necessario tornare indietro)
-- ════════════════════════════════════════════════════════════════

-- update public.profiles
-- set role = 'parent',
--     center_id = null
-- where email = 'faberx83+partnernew@gmail.com';
