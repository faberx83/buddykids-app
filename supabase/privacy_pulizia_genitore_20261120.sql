-- TRAMA — Pulizia dati non necessari: data di nascita e genere del genitore (20/11/2026).
--
-- Perché: revisione legale dell'informativa (bozza v.2 del 19/11): "solo se
-- sono necessari per qualche funzionalità del servizio, altrimenti da non
-- trattare". Nessuna funzione usa profiles.date_of_birth né profiles.gender
-- (il genere che serve è quello dei figli, kids.gender). Dal ramo
-- claude/informativa-privacy-v2 l'app non li chiede e non li scrive più.
--
-- NON è una migrazione: cancella valori (dati) e non tocca la struttura. Le
-- colonne restano, vuote. Va lanciato da Fabrizio DOPO il deploy del ramo
-- (prima, chi salva il profilo dalla vecchia versione potrebbe riscriverli):
--   APPLY_SQL=supabase/privacy_pulizia_genitore_20261120.sql bash deploy.sh
-- oppure nello SQL Editor di Supabase.
--
-- Al 20/11: 6 profili con data di nascita, 6 con genere.
-- Irreversibile per scelta (minimizzazione): nessun rientro dei valori.

-- PRIMA: quanti valori ci sono
select count(*) filter (where date_of_birth is not null) as con_data_nascita,
       count(*) filter (where gender is not null)        as con_genere
from public.profiles;

update public.profiles
set date_of_birth = null, gender = null
where date_of_birth is not null or gender is not null;

-- DOPO: entrambi 0
select count(*) filter (where date_of_birth is not null) as con_data_nascita,
       count(*) filter (where gender is not null)        as con_genere
from public.profiles;
