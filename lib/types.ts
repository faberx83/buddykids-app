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
}

export interface Kid {
  id: string;
  name: string;
  age: number;
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
