# TRAMA BETA v1.1.1 — Planner UI Refinement — Implementazione

Documento di implementazione per la revisione "TRAMA BETA v1.1.1 — PLANNER UI REFINEMENT / VISUAL POLISH + RESPONSIBILITY PEOPLE CONSISTENCY", eseguita dopo TRAMA BETA v1.1 (`TRAMA_PLANNER_BETA_V1.1_IMPLEMENTATION.md`). Wave puramente visiva: nessuna riprogettazione dell'architettura o della logica già implementata in v1.1. Principio guida: **REUSE > ADAPT > WRAP > NEW > REPLACE**. Nessuna migration DB applicata, nessun deploy eseguito, nessuna modifica a Scopri/Gruppi/Legacy/bottom nav/auth/Legal/Notifications/Carpool/logica child-day.

## 1. Overview — hero reale, meno "card dentro card" (punti 2-6, commit `7aad9ef`)

Il box descrittivo iniziale ("La timeline completa della tua famiglia per l'estate") è stato rimosso dalla tab Organizzazione: il vero hero (copertura stagionale + barra di progresso + "Prossimo passo") era già presente subito sotto e ora è il primo contenuto reale. L'alert "Mostra tutti (N)" è diventato "Altri N avvisi/o" — testo contestuale invece di un contatore scollegato, nessuna nuova card. Il teaser "Suggerimenti per te · N" è passato da card lilla piena larghezza a link testuale terziario (icona discreta, nessun container). Nella Timeline completa, la CTA "Riempi" per riga è stata rimossa: resta un'unica CTA dominante a livello Overview ("Riempi settimana"), la Timeline è ora consultazione pura (click sulla riga apre il Dettaglio Settimana); "Non mi serve"/"Ripristina" restano, non essendo state esplicitamente in scope di rimozione e senza equivalente nel Dettaglio Settimana.

## 2. Week Detail — meno spazi, meno ripetizioni (punti 7-8, commit `a560b33`)

L'header non ripete più "Settimana N" due volte; spaziatura verticale ridotta (`p-4`→`p-3.5`, `mb-4`→`mb-3`) per portare le informazioni operative above-the-fold. Nuovo componente `PlannerActivityCardCompact` (riga singola: match, titolo, centro, distanza, prezzo, chevron — h-10 icona invece della copertina 140px di Scopri) sostituisce `ActivityCard` sia per il suggerimento principale sia per le alternative. `ActivityCard`/Scopri non toccati.

## 3. Palette, Calendario compatto, Chi fa cosa compatto, bulk collassato, Condividi secondario (punti 9-13, commit `81b7e44`)

- **Palette (punto 9):** i due bottoni "Condividi" (mese e settimana) sono passati da CTA piena larghezza a chip piccole allineate a destra — la primary action del Calendario resta organizzare le responsabilità. Il container "Applica a tutta la settimana" è passato da `bg-trama-lilac/20` a `bg-bg` (neutro): il lilla pieno resta riservato a stato selezionato/CTA primaria, non a decorazione di sezione.
- **Calendario compatto (punto 10):** legenda bambini e header del mese con padding/gap ridotti; meno spazio verticale prima della griglia.
- **Bulk assign collassato (punto 12):** "Applica a tutta la settimana" è ora dietro un toggle (`bulkOpen`, default `false`) con chevron; stesse identiche opzioni (bambini/momento/responsabile), nessuna logica toccata.
- **Chi fa cosa compatto (punto 11, il refinement principale):** la card precedente (un riquadro `bg-bg` per giorno con due bottoni a piena etichetta "Andata"/"Ritorno") è sostituita da una riga per giorno: etichetta giorno (`Lun 31`) a sinistra, poi le due chip Andata→Ritorno affiancate da una freccia, ciascuna con icona + emoji/nome della persona assegnata o "+ Assegna". Le etichette "Andata"/"Ritorno" restano nell'albero di accessibilità (`sr-only`) invece che visibili — il contesto è dato dall'ordine/freccia, come nel mockup fornito. **Nessuna modifica a `handleAssign`/`handleClear`/`assigningKey`/`localResp`/`respKey`** (punto 17): solo il layout JSX è cambiato.
- **Fix collaterale:** i bottoni per cella ora espongono un `title` con lo stato reale di assegnazione (`"Nessuno assegnato"` o il nome del responsabile), correggendo un gap già documentato in `GATE_C_TRIAGE_20260728.md` dove i selettori dei test esistenti (TC-N59/60/61/65/70/72) si aspettavano questo attributo ma non era mai stato implementato.

## 4. Persone — Mamma/Papà contestuale (punto 15, commit `7aad9ef`)

`profiles.parent_role` (`padre`/`madre`/`tutore`, schema preesistente) era già letto da `getParentProfile()` in `app/nextgen/planner/page.tsx` ma non passato oltre `profile.seasonBudgetTarget`. **Zero nuove query**: il valore già disponibile è ora passato a `PlannerClient` → `PlannerCalendarView`.

Nuova funzione pura `resolveResponsibleOptions(parentRole)` (`lib/nextgen/responsibility-options.ts`, ADAPT non NEW — stessi valori tecnici di `RESPONSIBLE_OPTIONS`, solo la label/emoji della voce `"partner"` viene sostituita):

| `parentRole` | Label mostrata | Emoji |
|---|---|---|
| `"padre"` | Mamma | 👩 |
| `"madre"` | Papà | 👨 |
| `"tutore"` / `null` | Partner | ❤️ |

Nessuna inferenza da nome/avatar/sesso presunto/email — solo il ruolo esplicito nel profilo. **PARENT ROLE AVAILABLE** (`profiles.parent_role` esiste ed è popolato dal flusso di onboarding esistente); quando assente o `"tutore"`, fallback esplicito a "Partner" (comportamento identico a prima, nessuna regressione).

`resolveResponsibleOptions` è ora l'unico punto di rendering della lista responsabili nel Calendario Planner (`PlannerCalendarView.tsx`, 3 usi migrati). `TodayResponsibilityReminder.tsx` (Home — reminder giornaliero "Vado io, ritira nonna") usa ancora `RESPONSIBLE_OPTIONS` direttamente per etichettare un valore `"partner"` già assegnato: mostra quindi "Partner" generico invece di "Mamma"/"Papà" contestuali in quella superficie. **Non corretto in questa wave**: Home non è una delle superfici in scope del punto 1 ("Overview/Dettaglio Settimana/Calendario"), e la mega-prompt elenca esplicitamente le superfici da NON toccare includendo implicitamente tutto ciò che è fuori dal Planner stesso. Segnalato qui come miglioramento di coerenza a basso rischio per una wave futura, non come gap bloccante.

## 5. Selettore persone — source of truth unica (punto 16)

`resolveResponsibleOptions` è la sola funzione che produce la lista opzioni per la UI; `RESPONSIBLE_OPTIONS` (l'array di base) resta usato solo per: (a) il valore tecnico persistito (`week_responsibilities.responsible`, invariato), (b) lookup di label/emoji su valori già assegnati in `TodayResponsibilityReminder.tsx` (Home, fuori scope, vedi sopra), (c) test. Nessuna duplicazione di "lista responsabili" nel Planner. Ordine attuale (verificato via test puro `PEOPLE-06b`): **Io → Partner/Mamma/Papà → Nonno → Nonna → Tata → Altro** — coincide con l'ordine raccomandato dal punto 16 (Io, Mamma/Papà o Partner, *[custom people — non disponibile, vedi §6]*, Nonno, Nonna, Tata, Altro). Nessun duplicato per label o id.

## 6. Persone — persistenza "Altro" (punto 14) — **BLOCKED — PERSISTENT FAMILY PERSON MODEL REQUIRED**

**Problema:** una persona custom aggiunta tramite "Altro" (es. "Zia Carla") in una cella giorno/momento non è, nello schema attuale, una scelta persistente a livello di famiglia — è testo libero scoped esattamente alla riga `(parent_id, kid_id, week_start_date, weekday, moment)` che l'ha creata.

**Verifica del modello esistente (prima di proporre qualunque estensione, come richiesto dal punto 14):**

- `week_responsibilities.responsible_label` (`supabase/schema.sql`, riga ~1571): colonna `text`, nessun vincolo di unicità, nessuna relazione con altre righe — confermato NON riusabile come anagrafica.
- `families` / `family_members` (`supabase/schema.sql`, righe ~1714-1732): collegano account genitore **realmente registrati** (`parent_id references profiles`) a una famiglia condivisa, con ruolo Creatore/Admin/Membro. Modellano co-genitori con account BuddyKids, non persone senza account come nonni/tate/zie. Confermato NON adatto: usarlo forzerebbe la creazione di un profilo/account per ogni persona custom, cambiando la UX in modo non richiesto da questa wave.

**Conclusione:** non esiste, nello schema attuale, alcuna primitiva persistente per "persona di famiglia senza account". Implementarla richiederebbe una nuova tabella — **non applicata in questa wave** (nessuna migration eseguita, come da governance). Una persistenza solo client-side (`localStorage`) è stata esplicitamente esclusa dal punto 14 come "source of truth definitiva" e non è stata implementata.

**Proposta minima additiva (NON applicata — solo proposta):**

```sql
-- Anagrafica leggera di persone di famiglia senza account (nonni, tate,
-- zii...), scoped al genitore proprietario (stesso pattern RLS di
-- week_responsibilities). Additiva: nessuna modifica a tabelle esistenti.
create table if not exists public.family_people (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles(id) on delete cascade,
  label text not null,               -- es. "Zia Carla"
  emoji text not null default '👤',
  created_at timestamptz not null default now(),
  unique (parent_id, label)          -- evita duplicati per lo stesso genitore
);

alter table public.family_people enable row level security;

create policy "Family people: il genitore gestisce le proprie persone"
  on public.family_people for all
  using (parent_id = auth.uid())
  with check (parent_id = auth.uid());

-- week_responsibilities.responsible resterebbe invariato (enum fisso:
-- 'io'|'partner'|'nonno'|'nonna'|'tata'|'altro'); una riga con
-- responsible='altro' potrebbe opzionalmente referenziare
-- family_people.id oltre al testo libero responsible_label esistente
-- (retrocompatibile, nessuna colonna esistente rimossa):
alter table public.week_responsibilities
  add column if not exists family_person_id uuid references public.family_people(id) on delete set null;
```

Con questa estensione, `resolveResponsibleOptions` (già la source of truth unica, punto 16) potrebbe accettare una lista aggiuntiva di `family_people` del genitore corrente e inserirla nella posizione raccomandata (dopo Mamma/Papà/Partner, prima di Nonno) senza ulteriori modifiche architetturali — stesso principio ADAPT già usato per il punto 15.

**Stato:** BLOCKED — PERSISTENT FAMILY PERSON MODEL REQUIRED. Nessun workaround committato. Il resto della wave (punti 1-13, 15-19) è stato completato regolarmente.

## 7. Responsive 390px e preservazione child-day (punti 17-18)

**Punto 17 (child-day):** nessuna funzione di calcolo toccata in questa wave. `respKey`, `handleAssign`, `handleClear`, `assigningKey`, `localResp` (in `PlannerCalendarView.tsx`) e `computeRolesToCover` (in `lib/nextgen/week-roles.ts`, invariato da v1.1) sono identici bit-per-bit a prima del refinement — solo il JSX attorno è cambiato. Verificato via test puro `PEOPLE-07` (composizione chiave `kidId__week__weekday__moment`, indipendenza confermata per Sofia/Niccolò sullo stesso giorno/momento) e via i test preesistenti PLN11-T01..T08 (v1.1, invariati, non toccati da questa wave).

**Punto 18 (390px):** verifica di codice (nessun accesso a browser live in questo ambiente sandbox — governance: Claude non esegue deploy/test e2e live). Le classi usate nel refinement seguono gli stessi pattern responsive già presenti nel resto del Planner: `truncate`/`min-w-0`/`flex-wrap` su ogni riga a densità variabile (righe Timeline, righe Chi fa cosa, ActivityCard compact), nessun elemento a larghezza fissa oltre l'etichetta giorno (`w-[54px]`, sufficiente per "Lun 31"/"Mer 3" a qualunque densità di font di sistema). Test e2e `UI111-07` scritto (verifica che nessun elemento `position: fixed` sovrapponga la CTA primaria a 390px) ma non eseguibile in questo sandbox (richiede un deploy reale + browser Chromium, non disponibili qui). **Verifica visiva su dispositivo/deploy reale resta necessaria** prima del rilascio, come per l'intera wave v1.1.1.

## 8. Test

Nuovo file `tests/nextgen/planner-beta-v1-1-1-ui-refinement.spec.ts`:

- **Eseguiti realmente in questo sandbox (5/5 PASS)**: PEOPLE-04, PEOPLE-05, PEOPLE-06, PEOPLE-06b, PEOPLE-07 — tutti puri (`resolveResponsibleOptions` e la composizione della chiave `respKey` non hanno dipendenze Supabase/DOM).
- **Scritti, non eseguibili in questo sandbox (richiedono deploy reale + browser)**: UI111-01..07.
- **Scritti come documentazione del limite noto, skip esplicito**: PEOPLE-01, PEOPLE-02, PEOPLE-03 (persistenza "Altro" — BLOCKED, vedi §6).

Test preesistenti aggiornati per restare coerenti con i cambi di questa wave (`tests/nextgen/family-planner-5-3.spec.ts`, TC-N70/71/72 — apertura del nuovo toggle bulk-assign prima di interagire con le chip; selettore del pannello spostato su `data-testid="bulk-assign-panel"`, più robusto del vecchio selettore per classe colore già disallineato dal markup reale).

## 9. Cosa NON è cambiato

Scopri, Gruppi, Legacy, bottom nav, auth, Legal, Notifications, Carpool: non toccati. Logica child-day (`computeRolesToCover`, `respKey`, formula Andata/Ritorno): non toccata. Nessuna migration eseguita. Nessun deploy eseguito. Nessun nuovo feature flag globale.
