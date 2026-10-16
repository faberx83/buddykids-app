-- TRAMA — Pubblicazione dei testi legali, BOZZA 1 (16/10/2026).
--
-- NON è una migrazione: inserisce 2 righe in legal_documents (dati, non
-- struttura). Va eseguito da Fabrizio nello SQL Editor di Supabase SOLO dopo
-- aver letto le bozze (pagine /privacy e /terms in anteprima, o i file
-- lib/legal/texts/*.ts) e deciso di usarle per la fase di prova.
--
-- Cosa succede dopo:
--   - /privacy e /terms mostrano i testi, con l'avviso "Bozza in revisione legale";
--   - la registrazione può chiedere l'accettazione dei Termini (solo quando
--     LEGAL_TERMS_GATE è acceso dalla card Release "Consensi e informative").
--
-- Le impronte sha256 sono quelle esatte dei testi nel codice: se il testo nel
-- codice cambia senza una nuova versione, le pagine smettono di mostrarlo
-- (protezione voluta). Idempotente: ON CONFLICT non duplica.
--
-- ROLLBACK (togliere la pubblicazione, le pagine tornano "in preparazione"):
--   update public.legal_documents set published_at = null
--   where version = '2026-10-16-bozza1' and document_type in ('terms','privacy_notice');
--   (non possibile se qualcuno ha già accettato: legal_acceptances punta a queste righe)

insert into public.legal_documents (document_type, version, sha256, published_at)
values
  ('privacy_notice', '2026-10-16-bozza1', '6e9bb5fb8ae318eab6f696b4e0faf4d948523364037f3ae82b1534a439ae6d98', now()),
  ('terms',          '2026-10-16-bozza1', 'c0b9e39ba4475b36db945bf8e0d7c3dc6d888d0b0947e9f09366f1b6697a256b', now())
on conflict (document_type, version) do nothing;

-- POST-CHECK: 2 righe, entrambe con published_at valorizzato
select document_type, version, left(sha256, 12) as sha, published_at
from public.legal_documents
where version = '2026-10-16-bozza1'
order by document_type;
