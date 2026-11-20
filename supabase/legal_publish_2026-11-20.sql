-- TRAMA — Pubblicazione dell'informativa privacy, versione 2026-11-20.
--
-- NON è una migrazione: inserisce 1 riga in legal_documents (dati). La lancia
-- Fabrizio DOPO il deploy del ramo claude/informativa-privacy-v2:
--   APPLY_SQL=supabase/legal_publish_2026-11-20.sql bash deploy.sh
--
-- Effetti: /privacy mostra la versione 2026-11-20 (senza l'avviso "Bozza");
-- con "Consensi al primo accesso" acceso, alle famiglie viene chiesta di nuovo
-- la presa visione. I Termini restano alla bozza 1.
-- L'impronta è quella esatta del testo nel codice (lib/legal/texts/privacy-2026-11-20.ts).
--
-- ROLLBACK (si torna a mostrare la bozza 1), solo se nessuno l'ha ancora accettata:
--   update public.legal_documents set published_at = null
--   where document_type = 'privacy_notice' and version = '2026-11-20';

insert into public.legal_documents (document_type, version, sha256, published_at)
values
  ('privacy_notice', '2026-11-20', 'cdf31399931cf4209f5937fc469d7599ee3d81689a3fc0156f8f10ef05af1526', now())
on conflict (document_type, version) do nothing;

-- POST-CHECK: la riga c'è ed è pubblicata
select document_type, version, left(sha256, 12) as sha, published_at
from public.legal_documents
where document_type = 'privacy_notice'
order by published_at desc nulls last;
