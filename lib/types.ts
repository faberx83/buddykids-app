export type PillColor = "aqua" | "orange" | "purple" | "sky" | "green";

export type Role = "parent" | "center_admin" | "platform_admin";

// Tag di categoria/tema — lista estesa, gestibile lato Admin piattaforma
// (vedi lib/mock-data.ts "categories" e /admin/tags).
export interface Tag {
  id: string;
  label: string;
  emoji: string;
  bg: string;
}

export type MealOption = "included" | "packed" | "none";

export interface ServiceOption {
  available: boolean;
  time: string; // orario di inizio (pre) o fine (post), es. "07:30"
  priceExtra: number; // sovrapprezzo a settimana, 0 = incluso
}

// Certificazione servizio (richiesta di Fabrizio): etichetta libera per
// attività (es. "Istruttori certificati FISE per equitazione"), non un
// elenco fisso — verificata da un Admin piattaforma prima di diventare un
// badge visibile ai genitori. document_url è un PATH nel bucket privato
// "buddykids-certifications" (non un URL pubblico), risolto a un link
// temporaneo con getCertificationDocumentUrlAction quando serve visualizzarlo.
export type CertificationStatus = "pending" | "approved" | "rejected";

export interface CertificationItem {
  id: string;
  activityId: string; // Activity.dbId (uuid)
  activityName: string;
  centerName: string;
  label: string;
  status: CertificationStatus;
  documentPath?: string;
  adminNote?: string;
  createdAt: string;
}

export interface Activity {
  id: string;
  name: string;
  emoji: string;
  imgGradient: string;
  centerId: string;
  // BUG CORRETTO (upload certificazioni con "new row violates row-level
  // security policy"): centerId sopra è lo SLUG del centro quando presente
  // (usato per routing/filtri), non l'uuid reale — le policy RLS dello
  // storage bucket "buddykids-certifications" confrontano invece
  // storage.foldername(name)[1] con l'uuid reale (public.current_center_id()).
  // centerDbId preserva quell'uuid per chi ne ha bisogno lato codice.
  centerDbId?: string;
  center: string;
  tagIds: string[]; // id multipli da lib/mock-data categories (sostituisce il vecchio "category")
  address: string;
  lat?: number;
  lng?: number;
  rating: number;
  reviewsCount: number;
  distanceKm: number;
  ageRange: string;
  days?: string;
  hours?: string;
  pricePerWeek: number;
  // Segnalazione di Fabrizio: i tag selezionati nell'editor (activity_tags,
  // vedi tagIds sopra) non comparivano né in card né in dettaglio — i pill
  // qui leggevano da una colonna "pills" separata, mai popolata per le
  // attività reali. Ora per le attività reali questi pill arrivano proprio
  // dai tag selezionati (join activity_tags -> tags), col colore hex
  // libero del tag (bg) invece della palette fissa PillColor — i dati mock
  // continuano a usare "color" come prima (retrocompatibile).
  tags: { label: string; color?: PillColor; bg?: string }[];
  badges: { label: string; icon: string; color: PillColor }[];
  spotsLeft?: number;
  showExactSpots?: boolean; // scelta del gestore: mostrare il numero esatto o solo "Posti disponibili" generico
  description: string;
  schedule: { time: string; label: string; color: string }[];
  weeksAvailable: string;
  shuttlePrice: number;
  reviews: { initials: string; name: string; text: string; color: string }[];
  preService?: ServiceOption; // ingresso anticipato
  postService?: ServiceOption; // uscita posticipata
  mealOption?: MealOption;
  // Diete speciali/intolleranze che il servizio pranzo è attrezzato a
  // gestire (capacità dichiarata dal gestore, non un dato del bambino).
  dietaryOptions?: string[];
  centerHasBar?: boolean; // presenza di un bar/punto ristoro nel centro che ospita l'attività
  centerAccessible?: boolean; // il centro è accessibile (rampe, bagno attrezzato, ecc.)
  centerAccessibleNote?: string; // nota libera facoltativa sull'accessibilità
  // Sconti personalizzati dal gestore del centro che ospita l'attività
  // (fallback ai valori globali di default se assenti — vedi lib/family-discount.ts e lib/groups.ts):
  centerMultiweekDiscountPercent?: number;
  centerFamilyDiscountTiers?: number[]; // [2°figlio%, 3°figlio%, 4°+figlio%]
  centerGroupDiscountTiers?: { minKids: number; percent: number }[];
  dbId?: string; // uuid reale in Supabase — presente solo quando i dati arrivano dal database, non nei dati mock
  // Foto reali caricate dal gestore (Supabase Storage) — se assenti si
  // mostra il gradiente decorativo (imgGradient) come prima. coverImageUrl
  // sostituisce lo sfondo di scheda/copertina; galleryUrls è l'elenco foto
  // mostrato nel dettaglio attività.
  coverImageUrl?: string;
  galleryUrls?: string[];
  // Etichette delle certificazioni APPROVATE (vedi lib/data/certifications.ts)
  // — versione leggera per le card di lista/ricerca, caricata in blocco da
  // getActivities() con una query sola per tutte le attività. Il dettaglio
  // attività (DetailClient.tsx) continua a usare il CertificationItem
  // completo passato come prop separata.
  certificationBadges?: string[];
}

export type KidGender = "M" | "F" | "altro";

export interface Kid {
  id: string;
  name: string;
  age: number;
  birthDate?: string; // ISO yyyy-mm-dd, presente solo per bambini reali
  gender?: KidGender;
  emoji: string;
  color: string;
  note: string;
  grade?: string;
  interests?: string[];
  // Foto profilo reale caricata dal genitore (Supabase Storage) — se
  // assente si mostra l'emoji/colore come prima.
  avatarUrl?: string;
  // Colore di accento (uno dei colori di brand, non un nuovo hex) per la
  // vista "Per bambino" in Home: anello dell'avatar selezionato + badge
  // match% — se assente, derivato deterministicamente dal nome (vedi
  // accentColorForName in lib/data/kids.ts).
  accentColor?: PillColor;
}

export interface Week {
  id: string;
  label: string;
  dates: string;
  spots: number;
  soldOut?: boolean;
  // Allineamento alla griglia stagionale condivisa (lib/season-weeks.ts,
  // stessa usata dal Planner in Home): garantisce che "Settimana 6" indichi
  // sempre lo stesso intervallo di calendario ovunque nell'app.
  seasonIndex?: number; // 1-13
  startDate?: string; // ISO yyyy-mm-dd
  endDate?: string; // ISO yyyy-mm-dd
  offered?: boolean; // questa attività copre questa settimana della stagione (false = non prenotabile, solo per mostrare la griglia completa)
}

export interface GroupItem {
  id: string;
  name: string;
  emoji: string;
  gradient: string;
  location: string;
  dateRange: string;
  members: { initials: string; color: string; bg: string }[];
  extraMembers?: number;
  totalFamilies: number;
  discountLabel: string;
  discountBadgeColor: PillColor;
}

// ─────────────────────────────────────────────
// Gruppi — dettaglio (bambini + preferenze, aggregazioni, Richiesta Gruppo,
// accompagnamento) — vedi lib/data/group-detail.ts
// ─────────────────────────────────────────────

export type CarpoolLeg = "dropoff" | "pickup" | "both";

// Un bambino iscritto al gruppo, con la preferenza (tag) del genitore.
export interface GroupKidEntry {
  id: string; // id della riga group_kids
  kidId: string;
  kidName: string;
  kidEmoji: string;
  isOwn: boolean; // true se è un bambino del genitore loggato (può modificarlo/rimuoverlo)
  preferredTagId: string | null;
  preferredTagLabel: string | null;
  notes: string;
}

// Sotto-gruppo/aggregazione proposta per una preferenza (es. "Calcio").
export interface GroupSubgroup {
  id: string;
  label: string;
  tagId: string | null;
  kidIds: string[]; // GroupKidEntry.id inclusi
  feasible: boolean; // l'attività target ha questo tag ed è ancora aperta
}

export type GroupRequestStatus = "pending" | "accepted" | "rejected";

export interface GroupRequestItem {
  id: string;
  groupId: string;
  groupName: string;
  activityName: string;
  centerName: string;
  kidsCount: number;
  discountPercent: number;
  message: string;
  status: GroupRequestStatus;
  createdAt: string;
}

export interface CarpoolOfferItem {
  id: string;
  parentId: string;
  parentLabel: string; // "Tu" per l'utente loggato, altrimenti iniziali
  isOwn: boolean;
  seatsAvailable: number;
  hasChildSeat: boolean;
  legs: CarpoolLeg;
  notes: string;
}

export interface CarpoolRequestItem {
  id: string;
  parentId: string;
  parentLabel: string;
  isOwn: boolean;
  kidsCount: number;
  needsChildSeat: boolean;
  legs: CarpoolLeg;
}

export interface CarpoolMatch {
  request: CarpoolRequestItem;
  offers: CarpoolOfferItem[]; // offerte compatibili, già filtrate/ordinate
}

// Vista completa della pagina di dettaglio gruppo.
export interface GroupDetail {
  id: string;
  name: string;
  emoji: string;
  gradient: string;
  createdByMe: boolean;
  activityId: string | null; // dbId dell'attività target, se collegata
  activityName: string | null;
  centerName: string | null;
  kids: GroupKidEntry[];
  subgroups: GroupSubgroup[];
  discountPercent: number; // fascia calcolata da lib/groups.ts sul numero attuale di bambini
  groupDiscountTiers?: { minKids: number; percent: number }[]; // fasce personalizzate dal centro, se presenti (fallback a GROUP_DISCOUNT_TIERS)
  request: GroupRequestItem | null; // ultima Richiesta Gruppo inviata, se presente
  carpoolOffers: CarpoolOfferItem[];
  carpoolRequests: CarpoolRequestItem[];
  myKids: { id: string; name: string; emoji: string; interests?: string[] }[]; // bambini del genitore loggato, non ancora iscritti al gruppo — interessi dal profilo, usati per pre-selezionare la preferenza qui
  availableTags: Tag[];
}

// ─────────────────────────────────────────────
// SPRINT 4 (NEXTGEN) — Community ("Esperienze condivise"): comunità
// persistente e multi-attività fra famiglie, distinta dai "Gruppi" sopra
// (che restano legati a UNA attività). Vedi lib/data/communities.ts.
// ─────────────────────────────────────────────

export type CommunityRole = "creatore" | "admin" | "membro";

export interface CommunityItem {
  id: string;
  name: string;
  description: string;
  emoji: string;
  inviteCode: string;
  membersCount: number;
  myRole: CommunityRole;
  activeProposalsCount: number;
}

// Una famiglia già iscritta alla proposta (dedotta incrociando le
// prenotazioni esistenti, nessuna tabella/duplicazione dedicata) — per
// privacy non mostriamo mai nomi reali di ALTRE famiglie, solo un'etichetta
// generica, stesso principio già usato in GroupDetail.
export interface CommunityProposal {
  id: string;
  activityId: string; // dbId reale
  activitySlug: string;
  activityName: string;
  activityEmoji: string;
  activityGradient: string;
  centerName: string;
  note: string;
  proposedByMe: boolean;
  interestCount: number;
  iAmInterested: boolean;
  alreadyEnrolledCount: number; // famiglie della community già prenotate su questa attività
  createdAt: string;
}

export interface CommunityMemberEntry {
  parentId: string;
  label: string; // "Tu" per l'utente loggato, altrimenti "Famiglia N"
  isOwn: boolean;
  role: CommunityRole;
}

export interface CommunityDetail {
  id: string;
  name: string;
  description: string;
  emoji: string;
  inviteCode: string;
  myRole: CommunityRole;
  members: CommunityMemberEntry[];
  proposals: CommunityProposal[];
}

// Piccolo segnale sociale mostrato in Home NEXTGEN (solo se esiste almeno
// una proposta attiva in una community di cui si fa parte) — richiesta di
// Fabrizio: "Home deve mostrare piccoli elementi sociali", non invasivo.
export interface CommunityHomeSignal {
  communityId: string;
  communityName: string;
  activityName: string;
  interestCount: number;
}

export interface CalendarEvent {
  id: string;
  day: number;
  month: string;
  name: string;
  meta: string;
  meta2?: string;
  pillLabel: string;
  pillColor: PillColor;
  blockColor: string;
  textColor: string;
}

// ─────────────────────────────────────────────
// Centri, disponibilità giornaliera e promozioni
// ─────────────────────────────────────────────

export interface SocialLinks {
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  youtube?: string;
  website?: string;
}

export interface Center {
  id: string;
  name: string;
  emoji: string;
  gradient: string;
  city: string;
  address: string;
  lat: number;
  lng: number;
  description: string;
  contactEmail: string;
  contactPhone: string;
  ownerName: string;
  socialLinks?: SocialLinks;
  hasBar?: boolean;
  accessible?: boolean; // accesso disabili (rampe, bagno attrezzato, ecc.)
  accessibleNote?: string; // nota libera facoltativa
  multiweekDiscountPercent?: number;
  familyDiscountTiers?: number[]; // [2°figlio%, 3°figlio%, 4°+figlio%]
  groupDiscountTiers?: { minKids: number; percent: number }[];
  // Logo/foto reale del centro (Supabase Storage) — se assente si mostra
  // l'emoji + gradiente come prima.
  logoUrl?: string;
  // Giorni di preavviso richiesti per annullare/modificare una prenotazione
  // in autonomia (default 3) — domanda di Fabrizio: "entro quanto si può
  // fare? può essere una variabile gestibile da ciascun centro estivo?".
  cancellationWindowDays?: number;
}

// Disponibilità di un singolo giorno per un'attività — pensata per una
// vista "calendario" stile booking (righe = settimane, colonne = giorni).
export interface DayAvailability {
  date: string; // ISO yyyy-mm-dd
  weekday: number; // 0=Lun … 6=Dom
  isOpen: boolean;
  capacity: number;
  spotsLeft: number;
  singleDayBookable: boolean;
  discountPercent?: number; // sconto su questo giorno specifico
  lastMinute?: boolean; // flaggato come promo last-minute
  specialLabel?: string; // giornata particolare, es. "Giornata in piscina"
  specialEmoji?: string; // es. 🏊, 💦, 🎉
}

export type PromotionType = "day_discount" | "last_minute";

export interface Promotion {
  id: string;
  activityId: string;
  type: PromotionType;
  label: string;
  discountPercent: number;
  dayOfWeek?: number; // 0=Lun … 6=Dom, usato per type "day_discount"
  validFrom?: string;
  validTo?: string;
  active: boolean;
}

export type BookingStatus = "confirmed" | "pending" | "cancelled";

export interface BookingRecord {
  id: string;
  activityId: string;
  kidName: string;
  kidAge: number;
  parentName: string;
  weeksLabel: string;
  totalAmount: number;
  status: BookingStatus;
  createdAt: string; // ISO date
}
