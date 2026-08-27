# TRAMA — Brand Summary for Design

Fonte: repository `buddykids-app_v1` (codice reale, non interpretazione). Ogni voce cita il file di origine. Dove il repository non formalizza una regola, è scritto esplicitamente **NOT FORMALLY DEFINED**.

## Logo usage (evidenza da uso reale nel codice)

Quattro varianti esistono in `public/brand/`, ciascuna con un uso reale distinto:

| Variante | File | Dove viene usata realmente |
|---|---|---|
| Mark a colori | `trama-logo-mark.png` | Header inline pagine Parent (Home, Community, Gruppi) — icona piccola accanto al titolo pagina |
| Mark navy | `trama-logo-mark-navy.png` | Login (default), Dashboard Partner/Admin (tema chiaro), pagine pubbliche candidatura Partner |
| Mark bianco | `trama-logo-mark-white.png` | Login/Dashboard quando il tenant è Admin (sfondo scuro `navy`) |
| Wordmark | `trama-wordmark.png` / `trama-wordmark-white.png` | Login, conferma candidatura Partner — sempre accanto al mark, mai da solo |
| Symbol/icona | `public/brand/svg/TRAMA_icon_color.svg` (+ varianti `_navy`, `_white_on_navy`) | Icone PWA, favicon |

**Regola reale osservata**: il mark a colori si usa SOLO su sfondi chiari lato Parent; navy è il default generico; bianco è riservato a sfondi scuri (tenant Admin). Non esiste un utilizzo isolato della wordmark senza il mark.

## Palette reale

Fonte: `tailwind.config.ts`. Due namespace coesistono nel codice:

**Namespace `trama.*` (rebrand attuale, "TRAMA Design Handoff")** — quello rilevante per nuovo lavoro visivo:
- `trama-navy` `#172A4D` — testo/primario
- `trama-coral` `#F66B5E` — categoria Sport
- `trama-green` `#2DBA8C` — categoria Natura / stato successo
- `trama-violet` `#6F63C5` — categoria Arte / **CTA primaria**
- `trama-orange` `#F6A623` — categoria Formazione / attenzione
- `trama-lilac` `#B7A4E3` — Socialità
- `trama-error` `#E8543E` / `trama-error-light` `#FFEBE8`
- `trama-card` `#F7F9FC` — sfondo card
- `trama-page` `#FDFCFA` — sfondo pagina

**Namespace legacy `sky/aqua/orange/purple/yellow/green/ink/navy`** — ancora presente e in uso in schermate non ancora restylate; NON usare per nuovo lavoro salvo continuità esplicita con schermate esistenti non-TRAMA.

## Typography reale

Fonte: `tailwind.config.ts` + `app/layout.tsx` (Google Fonts).
- **Inter** — font di default, tutto il corpo testo. Pesi caricati: 400/500/600/700.
- **Poppins** — titoli/hero del rebrand TRAMA, 18–34px secondo il codice. Pesi caricati: 500/600/700/800.

## Button / CTA language

NOT FORMALLY DEFINED come design system a sé — osservato per convenzione ricorrente nel codice: CTA primaria = `bg-trama-violet`, testo bianco, `rounded-full`, font-bold. Esempio reale: bottone "Continua a pianificare" in Home NEXTGEN.

## Card style

- Radius standard card: `rounded-[22px]` (vedi `borderRadius.lg` sotto) per card "hero"; card generiche spesso `rounded-2xl` (Tailwind nativo, 16px).
- Sfondo card: `trama-card` (#F7F9FC) o bianco.
- Ombre: NOT in un token Tailwind centralizzato — valori inline ricorrenti, es. `shadow-[0_8px_24px_rgba(111,99,197,0.12)]` per la Hero Card, `.nextgen-warm-shadow` (`app/globals.css`) `0 8px 24px rgba(212,98,42,0.08)`.

## Border radius (token reali, `tailwind.config.ts`)

| Token | Valore |
|---|---|
| `sm` | 10px |
| `md` | 16px |
| `lg` | 22px |
| `xl` | 28px |

## Spacing

NOT FORMALLY DEFINED come scala dedicata — il codice usa la scala nativa Tailwind (4px base).

## Icon system

Fonte: `app/layout.tsx`. **Tabler Icons Webfont v3.19.0**, caricato via CDN (`@tabler/icons-webfont`), classi `ti ti-*` (es. `ti-calendar-exclamation`, `ti-circle-check-filled`, `ti-map-pin-filled`). Non è una libreria di icone custom: è la libreria open-source Tabler usata direttamente, senza fork né sottoinsieme esportato.

## UI personality (osservata, non dichiarata formalmente)

Dai commenti reali nel codice (richieste dirette di Fabrizio): "non un effetto dashboard aziendale", "ha perso parte della personalità e del coinvolgimento emotivo", prodotto rivolto a genitori — tono caldo, non enterprise. Palette calda riservata agli elementi "cuore" dell'esperienza (Hero Card, Check-in), il resto resta più neutro.

## Do / Don't (derivati da evidenza reale, non inventati)

**Do:**
- Riusare `trama-violet` come unico colore CTA primaria.
- Riusare Poppins solo per titoli/hero, Inter per tutto il resto.
- Riusare il mark a colori solo su sfondo chiaro lato Parent.

**Don't:**
- Non introdurre una quinta variante di logo.
- Non mescolare la palette legacy (`sky/aqua/...`) con `trama.*` nella stessa schermata nuova.
- Non inventare un radius/ombra fuori dai token elencati sopra senza validarlo con il repository.

---
*Fonti: `tailwind.config.ts`, `app/globals.css`, `app/layout.tsx`, uso reale in `app/`, `components/`. Nessun asset o regola inventati.*
