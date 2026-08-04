import MenuItem from "@/components/MenuItem";

// Menu "Impostazioni": righe che aprono ciascuna una sotto-pagina dedicata
// (Sicurezza/Preferenze/Notifiche/Privacy e account), stile Servizi/Gestione
// già usato altrove nell'app (vedi MenuItem, con icona+titolo+sottotitolo+
// chevron). Sostituisce il precedente blocco con tutte le sottosezioni
// sempre visibili in linea: su richiesta di Fabrizio, che lo trovava troppo
// lungo/poco leggibile su una singola schermata — ora ogni sottosezione vive
// nella propria pagina, con back-button (PageHeader).
//
// Condiviso identico tra profilo genitore (basePath="/profile") e "Il mio
// account" del gestore (basePath="/center/account"), così le sotto-pagine
// restano sempre allineate tra le due app: qualsiasi modifica a questo menu
// si applica automaticamente a entrambe (basta creare le pagine sotto
// ${basePath}/sicurezza, /preferenze, /notifiche, /privacy in ciascuna app).
export default function ProfileSettingsSection({ basePath }: { basePath: string }) {
  return (
    <div className="px-5 pt-3">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-3">Impostazioni</div>

      <MenuItem
        icon="ti-shield-lock"
        iconBg="#E8F6FD"
        iconColor="#4DAFEF"
        main="Sicurezza"
        sub="Password, accesso rapido"
        href={`${basePath}/sicurezza`}
      />
      {/* Notifiche unite qui dentro (richiesto da Fabrizio: "le notifiche le
          metterei dentro le preferenze") — non è più una voce separata,
          /notifiche ora reindirizza qui per eventuali link vecchi.
          Visual Acceptance Gate (§15, DEC-73) — richiesta di Fabrizio: "Nel
          sottotitolo del menu 'Preferenze' va indicato anche tour guidato",
          perché è lì (app/center/account/preferenze/page.tsx,
          WalkthroughRestartButton) che si può riavviare il percorso guidato
          Partner. Menzione SOLO lato Center (basePath="/center/account"):
          quel bottone esiste solo lì (gated da TRAMA_ONE_ENABLED, vedi
          preferenze/page.tsx) — lato genitore (basePath="/profile") non c'è
          ancora alcun tour da riavviare (Spotlight Parent non costruito,
          task #441 ancora pending), il sottotitolo lì resta invariato per
          non promettere una funzione assente (tests/genitori/profilo.spec.ts
          verifica ancora il testo originale). */}
      <MenuItem
        icon="ti-adjustments"
        iconBg="#FFF3E6"
        iconColor="#E08A2D"
        main="Preferenze"
        sub={basePath.startsWith("/center") ? "Lingua, tema, notifiche, tour guidato" : "Lingua, tema, notifiche"}
        href={`${basePath}/preferenze`}
      />
      {/* comingSoon: nessun metodo di pagamento reale è ancora integrato
          (nessun provider tipo Stripe collegato) — placeholder inerte, stessa
          convenzione già usata per "Le mie prenotazioni"/"Preferiti" più in
          alto in questa pagina. */}
      <MenuItem
        icon="ti-credit-card"
        iconBg="#E8F9EE"
        iconColor="#52C87A"
        main="Metodi di pagamento"
        sub="Non ancora attivi"
        comingSoon
      />
      <MenuItem
        icon="ti-lock"
        iconBg="#FCE8EC"
        iconColor="#D6497A"
        main="Privacy e account"
        sub="Consenso, disattivazione"
        href={`${basePath}/privacy`}
      />
    </div>
  );
}
