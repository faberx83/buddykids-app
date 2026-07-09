// Servizi consigliati per i gestori (es. catering, forniture, servizi per il
// centro estivo) — versione "leggera" del marketplace fornitori richiesto da
// Fabrizio: NON è un marketplace aperto con onboarding self-service, è una
// lista curata a mano da BuddyKids. Serve a validare se i gestori la usano
// davvero prima di investire in un vero flusso fornitori (profili, richieste,
// commissioni). Vedi roadmap per il ragionamento completo.
//
// Per aggiungere un contatto reale, aggiungi un oggetto a questo array: nome,
// categoria, breve descrizione, ed etichetta+link del contatto (mailto:,
// tel: o https:// del fornitore). Non inserire fornitori finti: questa lista
// è visibile a tutti i gestori reali.

export interface PartnerOffer {
  id: string;
  category: string;
  emoji: string;
  name: string;
  description: string;
  contactLabel: string;
  contactHref: string;
  // Foto/logo reale del fornitore (Supabase Storage) — se assente si mostra
  // l'emoji come prima.
  imageUrl?: string;
}

export const partnerOffers: PartnerOffer[] = [];
