# SOURCE_REGISTER — Registro conversioni derivate TRAMA ONE

Metodo generale: `pandoc 2.9.2.1, docx→gfm, pandoc -f docx -t gfm --wrap=none`. Data conversione: 2026-07-20 (UTC). Hash calcolati con SHA-256 sul file `.docx` originale (`sha256sum`), verificati indipendentemente sia in Python (`hashlib.sha256`) sia con `sha256sum` da shell — risultato identico in entrambi i casi per tutti e 5 i file.

| Nome originale | Nome derivato | Versione | Dimensione originale | SHA-256 (originale) | Esito conversione | Contenuti non convertiti correttamente |
|---|---|---|---|---|---|---|
| `TRAMA_MVP_Settembre_2026_Competitive_Intelligence_Italia_v1.1_Trust_Layer.docx` | `TRAMA_MVP_Settembre_2026_Competitive_Intelligence_Italia_v1.1_Trust_Layer.md` | 1.1 (16 luglio 2026 — Piano operativo aggiornato, GO WITH CONDITIONS) | 78.270 byte | `25d840df8f0bfbbc91294603c53dde138af1e3afb39ca36c1eedb8d604d8342e` | OK — exit code 0, nessun warning pandoc | Nessuno rilevato |
| `TRAMA_Product_Architecture_CX_Handbook_Draft_1.2_Referral_Incentives.docx` | `TRAMA_Product_Architecture_CX_Handbook_Draft_1.2_Referral_Incentives.md` | Draft 1.2 (16 luglio 2026 — Referral incentives e Partner Trust alignment) — Handbook Parent | 1.361.694 byte | `f92c40a36b3d413c610a5556c9c052dfb697bbed83d743bd9531c160da139d6c` | OK — exit code 0, nessun warning pandoc | 14 immagini estratte come file separati in `media/media/` (non trascritte in testo — vedi sezione "Contenuti non riportabili in Markdown") |
| `TRAMA_Partner_Product_Architecture_CX_Handbook_Draft_1.1_Trust_Layer.docx` | `TRAMA_Partner_Product_Architecture_CX_Handbook_Draft_1.1_Trust_Layer.md` | Draft 1.1 (Product Requirements Partner integrati) — Handbook Partner | 62.546 byte | `9998f631c1599894a9987d1fecb6e009e04d1e645ea64b62dcac3247852d46b4` | OK — exit code 0, nessun warning pandoc | Nessuno rilevato |
| `TRAMA_Admin_Product_Architecture_CX_Handbook_Draft_1.1_Trust_Control_Room.docx` | `TRAMA_Admin_Product_Architecture_CX_Handbook_Draft_1.1_Trust_Control_Room.md` | Draft 1.1 (Trust Layer e Partner Requirements integrati) — Handbook Admin | 59.508 byte | `3c38d3e8738c3ea241c17bf602712342f1fbc4925a59a297de01eb0c635168d8` | OK — exit code 0, nessun warning pandoc | Nessuno rilevato |
| `TRAMA_ONE_Claude_Implementation_Pack_v1.0.docx` | `TRAMA_ONE_Claude_Implementation_Pack_v1.0.md` | 1.0 (Implementation ready — subject to repository impact assessment) | 44.668 byte | `22f7728f5b63bf07f1e50754f14d065443cbfe6b8d7047582141ea95f6303445` | OK — exit code 0, nessun warning pandoc | Nessuno rilevato |

## Verifiche integrative eseguite (non solo esito pandoc)

Oltre al codice di uscita e agli stderr di pandoc (tutti puliti), per ciascun file derivato è stata controllata la struttura risultante, a campione:

| File derivato | Righe totali | Righe heading (`#`–`######`) | Righe tabella (`|...`) |
|---|---|---|---|
| `TRAMA_MVP_Settembre_2026_Competitive_Intelligence_Italia_v1.1_Trust_Layer.md` | 952 | 81 | 423 |
| `TRAMA_Product_Architecture_CX_Handbook_Draft_1.2_Referral_Incentives.md` | 3.301 | 188 | 933 |
| `TRAMA_Partner_Product_Architecture_CX_Handbook_Draft_1.1_Trust_Layer.md` | 1.480 | 129 | 450 |
| `TRAMA_Admin_Product_Architecture_CX_Handbook_Draft_1.1_Trust_Control_Room.md` | 1.327 | 117 | 399 |
| `TRAMA_ONE_Claude_Implementation_Pack_v1.0.md` | 211 | 11 | 66 |

Verificata inoltre la presenza degli identificativi CR/PCR/ACR/DDL/PDDL/ADDL e delle journey PJ/AJ attesi (vedi `INDEX.md` per i range esatti trovati) — tutti presenti e leggibili nei rispettivi file derivati.

## Nota sulla struttura dei titoli

Nell'Handbook Parent (Draft 1.2), le sezioni di primo livello (es. "1. Executive Summary", "5. Audit completo delle 27 pagine") sono rese come **paragrafi in grassetto**, non come heading Markdown (`#`), perché così sono formattate nel documento Word originale (stile grassetto, non stile "Titolo 1"). Le sotto-sezioni (es. "1.1 Numeri della baseline") usano invece heading veri (`##`). Non è stata corretta né uniformata questa struttura: la conversione riflette fedelmente la formattazione della fonte, come richiesto ("non reinterpretare").

## Contenuti non riportabili in Markdown

**Immagini.** Solo `TRAMA_Product_Architecture_CX_Handbook_Draft_1.2_Referral_Incentives.docx` (Handbook Parent) contiene immagini incorporate: **14 immagini** (`image1.png`…`image14.png`), estratte in `derived/media/media/` e collegate nel Markdown con `![](media/media/imageN.png)`. Un'immagine compare in apertura documento, le altre 13 sono distribuite lungo le sezioni "KPI journey" (una per journey/CR correlata). Le immagini sono file binari copiati as-is dal `.docx`: non sono state descritte, interpretate o trascritte in testo (nessuna didascalia/alt-text era presente nel documento originale da riportare) — chi consulta la copia derivata deve aprire il file immagine per vederne il contenuto, esattamente come nel documento originale.

Prima generazione: la prima esecuzione della conversione aveva estratto le stesse 14 immagini ma con collegamenti a **percorso assoluto della sandbox di esecuzione** (`/sessions/.../derived/media/...`), non validi al di fuori di questo ambiente. Corretto rigenerando la conversione con `--extract-media=media` (percorso relativo): i collegamenti nel file finale sono ora relativi (`media/media/imageN.png`), risolvibili correttamente da chiunque apra il repository.

Gli altri 4 documenti (`TRAMA_MVP_...`, `TRAMA_Partner_...`, `TRAMA_Admin_...`, `TRAMA_ONE_Claude_Implementation_Pack_v1.0.docx`) non contengono immagini incorporate: sono documenti puramente testuali/tabellari, verificato con `grep -c "media/" *.md` = 0 per tutti e quattro.

Nessuna nota a piè di pagina, commento o revisione traccata (`track changes`) rilevata nei 5 `.docx`.

## Stato

Tutti e 5 i documenti richiesti sono stati convertiti con esito **OK**, nessun problema di leggibilità o contenuto non convertito riscontrato.
