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

export interface Activity {
  id: string;
  name: string;
  emoji: string;
  imgGradient: string;
  centerId: string;
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
  tags: { label: string; color: PillColor }[];
  badges: { label: string; icon: string; color: PillColor }[];
  spotsLeft?: number;
  description: string;
  schedule: { time: string; label: string; color: string }[];
  weeksAvailable: string;
  shuttlePrice: number;
  reviews: { initials: string; name: string; text: string; color: string }[];
  preService?: ServiceOption; // ingresso anticipato
  postService?: ServiceOption; // uscita posticipata
  mealOption?: MealOption;
  centerHasBar?: boolean; // presenza di un bar/punto ristoro nel centro che ospita l'attività
  dbId?: string; // uuid reale in Supabase — presente solo quando i dati arrivano dal database, non nei dati mock
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
}

export interface Week {
  id: string;
  label: string;
  dates: string;
  spots: number;
  soldOut?: boolean;
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
  request: GroupRequestItem | null; // ultima Richiesta Gruppo inviata, se presente
  carpoolOffers: CarpoolOfferItem[];
  carpoolRequests: CarpoolRequestItem[];
  myKids: { id: string; name: string; emoji: string }[]; // bambini del genitore loggato, non ancora iscritti al gruppo
  availableTags: Tag[];
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
