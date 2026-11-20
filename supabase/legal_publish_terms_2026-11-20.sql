-- TRAMA — Pubblicazione dei Termini di servizio, versione 2026-11-20.
--
-- NON è una migrazione: inserisce 1 riga in legal_documents (dati). La lancia
-- Fabrizio DOPO il deploy del ramo claude/termini-definitivi:
--   APPLY_SQL=supabase/legal_publish_terms_2026-11-20.sql bash deploy.sh
--
-- Effetti: /terms mostra la versione 2026-11-20 senza l'avviso "Bozza"; con
-- "Consensi al primo accesso" acceso, alle famiglie viene chiesto di nuovo di
-- accettare i Termini. La registrazione accetta da subito questa versione.
-- L'impronta è quella esatta del testo nel codice (lib/legal/texts/terms-2026-11-20.ts).
--
-- ROLLBACK (si torna alla bozza 1), solo se nessuno l'ha ancora accettata:
--   update public.legal_documents set published_at = null
--   where document_type = 'terms' and version = '2026-11-20';

insert into public.legal_documents (document_type, version, sha256, published_at)
values
  ('terms', '2026-11-20', '28d564f639bc61028ad85ae0769a074d581753cedf2e379ac08b50a11d60ff47', now())
on conflict (document_type, version) do nothing;

-- POST-CHECK: la riga c'è ed è pubblicata
select document_type, version, left(sha256, 12) as sha, published_at
from public.legal_documents
where document_type = 'terms'
order by published_at desc nulls last;
