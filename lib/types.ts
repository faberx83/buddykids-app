export type PillColor = "aqua" | "orange" | "purple" | "sky" | "green";

export type Role = "parent" | "center_admin" | "platform_admin";

export interface Activity {
  id: string;
  name: string;
  emoji: string;
  imgGradient: string;
  centerId: string;
  center: string;
  address: string;
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

export interface Center {
  id: string;
  name: string;
  emoji: string;
  gradient: string;
  city: string;
  address: string;
  description: string;
  contactEmail: string;
  contactPhone: string;
  ownerName: string;
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
  parentName: string;
  weeksLabel: string;
  totalAmount: number;
  status: BookingStatus;
  createdAt: string; // ISO date
}
