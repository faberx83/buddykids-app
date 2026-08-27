# TRAMA — Design Input Pack per Onboarding Private Beta Parent

**Questo pack è materiale di riferimento. Non costituisce autorizzazione a modificare il brand TRAMA.**

## Cosa contiene

Il minimo necessario per progettare le 5 schermate di onboarding della Private Beta Parent con continuità reale col prodotto esistente — non un design system completo, non la Product Bible, non documentazione tecnica.

```
docs/trama-one/design-input/onboarding/
├── 01-brand/
│   ├── trama-logo-mark.png          (mark a colori — uso reale: header Parent)
│   ├── trama-logo-mark-navy.png     (mark navy — uso reale: default/login)
│   ├── trama-wordmark.png           (wordmark — sempre accanto al mark)
│   ├── TRAMA_icon_color.svg         (symbol/icona)
│   └── TRAMA_BRAND_SUMMARY_FOR_DESIGN.md
├── 02-product-screens/
│   └── SCREENSHOT_CAPTURE_INSTRUCTIONS.md   (nessuno screenshot reale incluso — vedi sotto)
├── 03-ui-reference/
│   └── TRAMA_PARENT_UI_REFERENCE.md
└── 04-brief/
    └── TRAMA_ONBOARDING_DESIGN_INPUT_README.md  (questo file)
```

## Source of truth

Ogni affermazione in `TRAMA_BRAND_SUMMARY_FOR_DESIGN.md` e `TRAMA_PARENT_UI_REFERENCE.md` è tratta da codice reale del repository (`tailwind.config.ts`, `app/globals.css`, `app/layout.tsx`, componenti in `app/` e `components/`), non da interpretazione o memoria. Dove il repository non formalizza una regola, il documento lo dice esplicitamente ("NOT FORMALLY DEFINED") invece di inventarla.

## Screenshot: cosa è reale e cosa manca

**Nessuno screenshot dell'app è incluso in questo pack.** Generarli richiede eseguire l'app con un browser contro dati reali/demo — un'azione che in questa fase resta a Fabrizio, non eseguita per suo conto in questa sessione. `02-product-screens/SCREENSHOT_CAPTURE_INSTRUCTIONS.md` contiene la lista precisa delle 6 catture richieste (route esatta, prerequisiti, dati da usare) perché Fabrizio possa produrle in pochi minuti. Questo è l'unico gap materiale del pack.

## Cosa NON deve essere reinterpretato dal designer

- I 4 colori-mark del logo e le rispettive regole d'uso (colori su sfondo chiaro Parent, navy default, bianco solo su Admin/sfondo scuro).
- La palette `trama.*` (in particolare `trama-violet` come unico colore CTA primaria).
- I font: Poppins solo per titoli/hero, Inter per tutto il resto.
- Il concetto di "settimana" come unità di pianificazione primaria nel Planner.
- Il fatto che l'app sia mobile-first dentro un contenitore a larghezza fissa, non un layout desktop esteso.

## Gap del materiale disponibile

1. Nessuno screenshot reale (vedi sopra) — sostituito da istruzioni di cattura precise.
2. Nessun design system formalizzato in un unico documento nel repository: palette/font/radius sono ricavati da `tailwind.config.ts` e commenti nel codice, non da un file "design tokens" dedicato — per questo il Brand Summary cita la fonte riga per riga invece di un unico link.
3. Spacing e alcune ombre non sono tokenizzati: nel Brand Summary sono segnalati come "NOT FORMALLY DEFINED" invece di essere inventati.

## Cosa è escluso di proposito

SQL, migration, test, documentazione tecnica, roadmap, Product Bible, risk register, dati reali di utenti, credenziali. Questo pack è solo materiale visivo/di continuità prodotto.
