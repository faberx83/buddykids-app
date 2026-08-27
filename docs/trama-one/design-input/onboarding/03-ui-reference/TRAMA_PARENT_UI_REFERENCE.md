# TRAMA — Parent UI Reference (per Design Onboarding)

Handoff sintetico per Claude Design. Non è un'analisi tecnica: è una mappa di "cosa esiste già e cosa preservare" mentre si disegnano le 5 schermate di onboarding della Private Beta Parent. La superficie di riferimento è **NEXTGEN** (`/nextgen/*`), la versione attiva del prodotto Parent.

Nota architetturale utile al designer: alcune schermate (Activity Detail, Booking) sono condivise tra LEGACY e NEXTGEN allo stesso URL — non esiste una versione NEXTGEN separata di quelle due, il resto della UI reindirizza lì.

---

## 1. Home — `/nextgen`

**Componente:** `app/nextgen/HomeDashboardClient.tsx`

**Cosa contiene, in ordine:**
1. Saluto + logo TRAMA inline + badge "NEXTGEN"
2. Prompt "completa il profilo" (si autonasconde se già completo)
3. **Hero Card** — il cuore della schermata: sfondo `trama-violet` tinta chiara, radius 22px, ombra diffusa, ~30% dello schermo. Comunica con parole ("Organizzata al X%"), non solo un numero. Due blocchi con iconcina: "Mancano ancora" (settimane scoperte) e "Prossimo impegno".
4. Check-in del giorno (se presente)
5. Prossimo appuntamento (una sola card, non una lista)
6. Suggerimenti attività personalizzati
7. Attività da confermare (solo prenotazioni "pending")
8. CTA finale "Apri Planner"

**Cosa è importante preservare:** la Hero Card è deliberatamente calda/emotiva ("non un effetto dashboard aziendale", richiesta esplicita di Fabrizio) — comunica stato con linguaggio naturale, non con una tabella di numeri. Il resto della Home è sintesi, non elenco completo: il dettaglio vive nel Planner.

## 2. Planner — `/nextgen/planner`

**Componente:** `app/nextgen/planner/PlannerClient.tsx`

**Cosa contiene:** è la feature principale del prodotto ("il cuore dell'esperienza", richiesta esplicita di Fabrizio), organizzata in tab (Organizzazione / Budget / Calendario / Gruppi / Mappa / Logistica):
- Timeline della stagione, settimana per settimana, con stato colorato (coperta/scoperta/parziale/passata/in attesa Partner)
- Bottoni azione per settimana: "Riempi", "Non mi serve"/"Ripristina"
- Copertura per bambino (se più di un figlio)
- Sovrapposizioni tra fratelli nella stessa settimana
- Budget stagionale con soglia impostabile
- Vista Calendario/Mappa/Gruppi come tab secondarie

**Cosa è importante preservare:** il concetto di "settimana" come unità visiva primaria (etichetta "SETT N", intervallo date), e la distinzione visiva netta tra scoperta/coperta/passata — è un pattern già consolidato e testato, non va reinventato nell'onboarding.

## 3. Search ("Scopri") — `/nextgen/search`

**Componente:** `app/nextgen/search/SearchDiscoveryClient.tsx`

**Cosa contiene:** ricerca guidata dal contesto del genitore (non una ricerca generica) — ordinamento con motivazioni leggibili ("vicino a te", "libero nella settimana scoperta di [bambino]"), 6 pannelli filtro (età/prezzo/zona/tipo attività/servizi/data), vista Elenco/Mappa.

**Cosa è importante preservare:** il principio "la ricerca non parte da zero, parte da un bisogno già noto" (settimana scoperta, bambino, vicinanza) — è la differenza dichiarata rispetto a un semplice motore di ricerca.

## 4. Activity Detail — `/activity/[id]`

**Componente:** `app/activity/[id]/DetailClient.tsx` (condiviso LEGACY/NEXTGEN, stesso URL)

**Cosa contiene:** foto di copertina reale, badge (certificazione, accesso disabili, diete), pill categoria colorate, disponibilità per giorno o per settimana intera, prezzo, pulsante preferiti, "Contatta il gestore".

**Cosa è importante preservare:** le pill categoria colorate sono lo stesso sistema colore usato altrove (mappatura categoria→colore in `lib/colors.ts`) — non introdurre una palette categoria diversa nell'onboarding.

## 5. Booking / richiesta — `/booking/[id]`

**Componente:** `app/booking/[id]/BookingClient.tsx` (condiviso LEGACY/NEXTGEN, stesso URL)

**Cosa contiene:** flusso a step con `StepIndicator`, selezione settimana/giorni, selezione bambino/i, sconto famiglia se applicabile, metodo di pagamento.

**Cosa è importante preservare:** il pattern "step indicator" in cima è lo stesso linguaggio visivo usato per qualunque flusso multi-step nel prodotto — riusabile 1:1 per un eventuale onboarding a step.

## 6. Profile (se utile come riferimento) — `/nextgen/profile`

**Componente:** `app/nextgen/profile/ProfileNextgenClient.tsx`

Hub a card (Famiglia, Impostazioni, Logistica) — utile solo come riferimento di stile "hub card", non centrale per l'onboarding.

---

## Componenti riutilizzabili rilevanti per l'onboarding

Da `components/nextgen/`: `DecorativeIntroCard.tsx` (già usato come intro decorativa in altre schermate — probabile riferimento diretto per le card di onboarding), `NextgenBadge.tsx`, `HubCard.tsx`, `NextgenToastProvider.tsx` (micro-feedback).

## Mobile / responsive

Fonte: `app/globals.css`. L'app è progettata **mobile-first, dentro un contenitore fisso**: `.app-shell`, max-width 480px, altezza `100svh` (viewport piccola, per evitare sfarfallio della bottom nav su mobile). Sopra 640px (`sm:`) il contenitore diventa un "phone mockup" centrato con ombra e radius 32px su sfondo chiaro — l'esperienza resta sempre a larghezza telefono anche su desktop, non esiste un layout desktop esteso.

## Cosa NON reinterpretare

- Il mark a colori TRAMA nell'header inline (non sostituirlo con la wordmark o con un'icona diversa).
- Il colore CTA primaria (`trama-violet`) — non introdurre un secondo colore CTA.
- Il concetto "settimana" come unità di pianificazione (non sostituirlo con "giorno" o "mese" come unità primaria).

---
*Fonti: `app/nextgen/*`, `app/activity/[id]/*`, `app/booking/[id]/*`, `components/nextgen/*`, `app/globals.css`. Handoff descrittivo, non analisi tecnica.*
