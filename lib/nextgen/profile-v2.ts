// TRAMA — PROFILO V2 (14/10/2026). Logica pura del Profilo V2: le voci,
// raggruppate in Famiglia / Le tue attività / App, con le stesse
// destinazioni del Profilo attuale. Nessuna query.
// Usata da app/nextgen/profile/ProfileV2Client.tsx, testata in
// tests/one/profile-v2.spec.ts.

export type ProfileTint = "violet" | "green" | "orange" | "coral" | "navy";

export const PROFILE_TINT: Record<ProfileTint, { bg: string; fg: string }> = {
  violet: { bg: "#F4F2FC", fg: "#6F63C5" },
  green: { bg: "#E6F6F0", fg: "#1F9A72" },
  orange: { bg: "#FFF4E0", fg: "#B87400" },
  coral: { bg: "#FFEFEC", fg: "#D9483B" },
  navy: { bg: "#F1F3F6", fg: "#172A4D" },
};

export interface ProfileRowItem {
  key: string;
  icon: string;
  tint: ProfileTint;
  title: string;
  subtitle?: string;
  href?: string;
  onClick?: () => void;
  badge?: number;
  soon?: boolean;
}

/** Le voci del Profilo V2, raggruppate. */
export function profileV2Sections(input: {
  unreadReplies: number;
  classicFallbackEnabled: boolean;
  onFeedback: () => void;
  onClassic: () => void;
}): { title: string; items: ProfileRowItem[] }[] {
  return [
    {
      title: "Famiglia",
      items: [
        { key: "famiglia", icon: "ti-users", tint: "violet", title: "Famiglia", subtitle: "Invita l'altro genitore, condividete tutto", href: "/nextgen/planner/famiglia" },
        { key: "gruppi", icon: "ti-users-group", tint: "violet", title: "Gruppi", subtitle: "Altri genitori della classe e delle attività", href: "/nextgen/groups" },
        { key: "indirizzi", icon: "ti-map-pin", tint: "green", title: "Indirizzi", subtitle: "Casa, lavoro e altri punti di partenza", href: "/nextgen/planner/indirizzi" },
        { key: "condivisione", icon: "ti-share", tint: "green", title: "Condivisione piano", subtitle: "Un link di sola lettura per settimana o mese", href: "/nextgen/planner?mode=calendario" },
        { key: "promemoria", icon: "ti-bell", tint: "orange", title: "Promemoria e avvisi", subtitle: "Avvisami prima di partire", href: "/nextgen/planner/promemoria" },
      ],
    },
    {
      title: "Le tue attività",
      items: [
        { key: "salvati", icon: "ti-bookmark", tint: "violet", title: "Salvati", subtitle: "Le attività che hai salvato", href: "/nextgen/preferiti" },
        { key: "presenze", icon: "ti-clipboard-check", tint: "green", title: "Presenze", subtitle: "Presenze, ritardi e assenze", href: "/nextgen/presenze" },
        { key: "richieste", icon: "ti-message-circle", tint: "navy", title: "Messaggi ai centri", subtitle: "Richieste e risposte", href: "/nextgen/richieste", badge: input.unreadReplies },
        { key: "suggerimenti", icon: "ti-map-pin-plus", tint: "coral", title: "Centri che hai suggerito", subtitle: "Non ancora su TRAMA", href: "/nextgen/center-leads" },
        { key: "ricevute", icon: "ti-file-invoice", tint: "navy", title: "Ricevute e fatture", soon: true },
      ],
    },
    {
      title: "App",
      items: [
        { key: "impostazioni", icon: "ti-settings", tint: "navy", title: "Impostazioni", subtitle: "Sicurezza, preferenze, privacy", href: "/nextgen/profile/impostazioni" },
        { key: "trama", icon: "ti-info-circle", tint: "violet", title: "Cos'è TRAMA", subtitle: "Come funziona, contatti, privacy", href: "/nextgen/trama" },
        { key: "feedback", icon: "ti-bulb", tint: "orange", title: "Aiutaci a migliorare TRAMA", subtitle: "Un'idea, un problema, qualcosa che manca", onClick: input.onFeedback },
        { key: "segnalazioni", icon: "ti-message-report", tint: "coral", title: "Le mie segnalazioni", subtitle: "Cosa hai inviato durante la beta", href: "/nextgen/profile/segnalazioni" },
        ...(input.classicFallbackEnabled
          ? [{ key: "classica", icon: "ti-history", tint: "navy" as ProfileTint, title: "Torna alla versione classica", subtitle: "Usa per un po' la versione precedente", onClick: input.onClassic }]
          : []),
      ],
    },
  ];
}
