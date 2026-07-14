import {
  Activity,
  BookingRecord,
  CalendarEvent,
  Center,
  DayAvailability,
  GroupItem,
  Kid,
  Promotion,
  Tag,
  Week,
} from "./types";

// Lista "master" dei tag di centro/attività — gestibile lato Admin
// piattaforma in /admin/tags. Un'attività può avere più tag (vedi
// Activity.tagIds), non un'unica categoria fissa.
export const categories: Tag[] = [
  { id: "sport", label: "Sport", emoji: "⚽", bg: "#E3F9F5" },
  { id: "arte", label: "Arte", emoji: "🎨", bg: "#FFF0EA" },
  { id: "musica", label: "Musica", emoji: "🎵", bg: "#F0EEFF" },
  { id: "stem", label: "STEM", emoji: "🔬", bg: "#E8F6FD" },
  { id: "outdoor", label: "Outdoor", emoji: "🌳", bg: "#E8F9EE" },
  { id: "intera", label: "Intera", emoji: "☀️", bg: "#FFF8E7" },
  { id: "mezza", label: "Mezza", emoji: "🕐", bg: "#FFF0EA" },
  { id: "piscina", label: "Piscina", emoji: "🏊", bg: "#E3F9F5" },
  { id: "teatro", label: "Teatro", emoji: "🎭", bg: "#F0EEFF" },
  { id: "tecnologia", label: "Tecnologia", emoji: "💻", bg: "#E8F6FD" },
  { id: "natura", label: "Natura", emoji: "🌿", bg: "#E8F9EE" },
  { id: "lingue", label: "Lingue", emoji: "🌍", bg: "#E8F6FD" },
  { id: "cucina", label: "Cucina", emoji: "🍳", bg: "#FFF0EA" },
  { id: "danza", label: "Danza", emoji: "💃", bg: "#F0EEFF" },
];

export const activities: Activity[] = [
  {
    id: "summer-camp-acquatico",
    name: "Summer Camp Acquatico",
    emoji: "🏊",
    imgGradient: "linear-gradient(135deg,#C8ECFD,#A5E5D8)",
    centerId: "centro-sportivo-lido",
    center: "Centro Sportivo Lido",
    tagIds: ["sport", "piscina", "intera"],
    address: "Porta Nuova, Milano",
    lat: 45.479,
    lng: 9.1938,
    rating: 4.9,
    reviewsCount: 128,
    distanceKm: 1.2,
    ageRange: "6-14 anni",
    days: "Lun-Ven",
    hours: "08:00 - 17:30",
    pricePerWeek: 280,
    tags: [
      { label: "🏊 Piscina", color: "aqua" },
      { label: "🌍 Inglese", color: "sky" },
      { label: "🍽️ Pranzo", color: "orange" },
      { label: "🚌 Navetta", color: "green" },
    ],
    badges: [
      { label: "Piscina", icon: "ti-droplet", color: "sky" },
      { label: "Inglese", icon: "ti-language", color: "aqua" },
      { label: "Pranzo incl.", icon: "ti-tools-kitchen", color: "orange" },
      { label: "Navetta", icon: "ti-bus", color: "green" },
      { label: "Outdoor", icon: "ti-sun", color: "purple" },
    ],
    spotsLeft: 3,
    showExactSpots: true,
    description:
      "Un'estate all'insegna dell'acqua, del divertimento e della crescita! Il nostro Summer Camp offre attività in piscina, giochi di squadra, lezioni di nuoto e molto altro in un ambiente sicuro e accogliente, con istruttori qualificati e certificati.",
    schedule: [
      { time: "08:00", label: "Accoglienza e giochi liberi", color: "#4DAFEF" },
      { time: "09:00", label: "Attività in piscina — nuoto e acquagym", color: "#3ECFB2" },
      { time: "12:30", label: "Pranzo incluso + riposo", color: "#FF8C5A" },
      { time: "14:00", label: "Laboratori creativi e sport", color: "#8B7CF8" },
      { time: "16:30", label: "Merenda e giochi outdoor", color: "#52C87A" },
      { time: "17:30", label: "Uscita / navetta di ritorno", color: "#9CA3AF" },
    ],
    weeksAvailable: "6 di 8",
    shuttlePrice: 30,
    preService: { available: true, time: "07:30", priceExtra: 5 },
    postService: { available: true, time: "18:30", priceExtra: 8 },
    mealOption: "included",
    reviews: [
      {
        initials: "AL",
        name: "Anna L.",
        color: "#B8DFF6",
        text: "Mia figlia ha adorato ogni momento! Staff super professionale e attento. La riscriviamo il prossimo anno senza dubbi!",
      },
      {
        initials: "MR",
        name: "Marco R.",
        color: "#FFD0BB",
        text: "Organizzazione impeccabile. I bambini tornano a casa stanchi ma felicissimi ogni giorno. Consigliatissimo!",
      },
    ],
  },
  {
    id: "laboratorio-arti-creative",
    name: "Laboratorio Arti Creative",
    emoji: "🎨",
    imgGradient: "linear-gradient(135deg,#FFE8D9,#FFD0BB)",
    centerId: "accademia-crearte",
    center: "Accademia CreArte",
    tagIds: ["arte", "teatro", "mezza"],
    address: "Milano",
    lat: 45.48,
    lng: 9.195,
    rating: 4.8,
    reviewsCount: 94,
    distanceKm: 2.5,
    ageRange: "7-12 anni",
    pricePerWeek: 220,
    tags: [
      { label: "🎨 Arte", color: "orange" },
      { label: "🎭 Teatro", color: "purple" },
      { label: "🍽️ Pranzo", color: "aqua" },
    ],
    badges: [
      { label: "Arte", icon: "ti-brush", color: "orange" },
      { label: "Teatro", icon: "ti-mask", color: "purple" },
      { label: "Pranzo incl.", icon: "ti-tools-kitchen", color: "aqua" },
    ],
    description:
      "Laboratori di pittura, ceramica, teatro e creatività per stimolare l'immaginazione dei più piccoli in un ambiente stimolante e sicuro.",
    schedule: [
      { time: "09:00", label: "Accoglienza e giochi liberi", color: "#4DAFEF" },
      { time: "10:00", label: "Laboratorio pittura e ceramica", color: "#FF8C5A" },
      { time: "12:30", label: "Pranzo incluso", color: "#3ECFB2" },
      { time: "14:00", label: "Teatro e improvvisazione", color: "#8B7CF8" },
      { time: "16:00", label: "Uscita", color: "#9CA3AF" },
    ],
    weeksAvailable: "8 di 8",
    shuttlePrice: 25,
    preService: { available: false, time: "", priceExtra: 0 },
    postService: { available: true, time: "17:00", priceExtra: 6 },
    mealOption: "included",
    reviews: [
      {
        initials: "GF",
        name: "Giorgia F.",
        color: "#FFD0BB",
        text: "Mio figlio è tornato a casa ogni giorno con un nuovo progetto creativo. Adorato!",
      },
    ],
  },
  {
    id: "coding-robotica-kids",
    name: "Coding & Robotica Kids",
    emoji: "🔬",
    imgGradient: "linear-gradient(135deg,#EDE8FF,#D4CDFF)",
    centerId: "techkids-milano",
    center: "TechKids Milano",
    tagIds: ["stem", "tecnologia"],
    address: "Milano",
    lat: 45.4685,
    lng: 9.1824,
    rating: 4.7,
    reviewsCount: 61,
    distanceKm: 0.8,
    ageRange: "8-13 anni",
    pricePerWeek: 310,
    tags: [
      { label: "🤖 Robot", color: "purple" },
      { label: "💻 Coding", color: "sky" },
    ],
    badges: [
      { label: "Robotica", icon: "ti-robot", color: "purple" },
      { label: "Coding", icon: "ti-code", color: "sky" },
    ],
    description:
      "Un percorso hands-on tra coding, robotica e stampa 3D, pensato per far scoprire ai ragazzi il mondo della tecnologia divertendosi.",
    schedule: [
      { time: "09:00", label: "Accoglienza", color: "#4DAFEF" },
      { time: "09:30", label: "Coding a blocchi e robotica", color: "#8B7CF8" },
      { time: "12:30", label: "Pranzo (non incluso)", color: "#FF8C5A" },
      { time: "14:00", label: "Progetto di gruppo", color: "#3ECFB2" },
      { time: "17:00", label: "Uscita", color: "#9CA3AF" },
    ],
    weeksAvailable: "5 di 8",
    shuttlePrice: 0,
    preService: { available: false, time: "", priceExtra: 0 },
    postService: { available: false, time: "", priceExtra: 0 },
    mealOption: "packed",
    reviews: [
      {
        initials: "PT",
        name: "Paolo T.",
        color: "#D4CDFF",
        text: "Ottimo equilibrio tra teoria e gioco. Mio figlio ha costruito il suo primo robot!",
      },
    ],
  },
  {
    id: "soccer-academy-estate",
    name: "Soccer Academy Estate",
    emoji: "⚽",
    imgGradient: "linear-gradient(135deg,#D8F5E8,#B5EDD1)",
    centerId: "campo-brera",
    center: "Campo Brera",
    tagIds: ["sport", "outdoor", "intera"],
    address: "Milano",
    lat: 45.4719,
    lng: 9.188,
    rating: 4.6,
    reviewsCount: 47,
    distanceKm: 3.1,
    ageRange: "6-16 anni",
    pricePerWeek: 250,
    tags: [
      { label: "⚽ Sport", color: "green" },
      { label: "🍽️ Pranzo", color: "orange" },
    ],
    badges: [
      { label: "Sport", icon: "ti-ball-football", color: "green" },
      { label: "Pranzo incl.", icon: "ti-tools-kitchen", color: "orange" },
    ],
    description:
      "Allenamenti tecnici, tornei interni e tanto divertimento con lo staff della Soccer Academy, per bambini di tutte le età.",
    schedule: [
      { time: "08:30", label: "Accoglienza e riscaldamento", color: "#52C87A" },
      { time: "09:00", label: "Allenamento tecnico", color: "#4DAFEF" },
      { time: "12:30", label: "Pranzo incluso", color: "#FF8C5A" },
      { time: "14:30", label: "Torneo interno", color: "#8B7CF8" },
      { time: "17:00", label: "Uscita", color: "#9CA3AF" },
    ],
    weeksAvailable: "7 di 8",
    shuttlePrice: 20,
    preService: { available: true, time: "08:00", priceExtra: 4 },
    postService: { available: true, time: "18:00", priceExtra: 6 },
    mealOption: "included",
    reviews: [
      {
        initials: "SR",
        name: "Sara R.",
        color: "#B5EDD1",
        text: "Allenatori preparati e attenti. I ragazzi si divertono tantissimo.",
      },
    ],
  },
  {
    id: "summer-music-camp",
    name: "Summer Music Camp",
    emoji: "🎵",
    imgGradient: "linear-gradient(135deg,#FFF5D6,#FFE89A)",
    centerId: "scuola-musica-aria",
    center: "Scuola di Musica Aria",
    tagIds: ["musica"],
    address: "Milano",
    lat: 45.475,
    lng: 9.205,
    rating: 4.5,
    reviewsCount: 38,
    distanceKm: 1.8,
    ageRange: "7-15 anni",
    pricePerWeek: 195,
    tags: [
      { label: "🎵 Musica", color: "purple" },
      { label: "🎤 Canto", color: "aqua" },
    ],
    badges: [
      { label: "Musica", icon: "ti-music", color: "purple" },
      { label: "Canto", icon: "ti-microphone", color: "aqua" },
    ],
    description:
      "Corsi di canto, strumento e propedeutica musicale in un ambiente giocoso e stimolante, con saggio finale per le famiglie.",
    schedule: [
      { time: "09:00", label: "Accoglienza e vocalità", color: "#4DAFEF" },
      { time: "10:00", label: "Laboratorio strumento", color: "#8B7CF8" },
      { time: "12:30", label: "Pranzo (non incluso)", color: "#FF8C5A" },
      { time: "14:00", label: "Coro e prove d'insieme", color: "#3ECFB2" },
      { time: "16:00", label: "Uscita", color: "#9CA3AF" },
    ],
    weeksAvailable: "8 di 8",
    shuttlePrice: 0,
    preService: { available: false, time: "", priceExtra: 0 },
    postService: { available: false, time: "", priceExtra: 0 },
    mealOption: "packed",
    reviews: [
      {
        initials: "EC",
        name: "Elena C.",
        color: "#FFE89A",
        text: "Il saggio finale è stato commovente. Complimenti agli insegnanti!",
      },
    ],
  },
];

export const weeksByActivity: Record<string, Week[]> = {
  "summer-camp-acquatico": [
    { id: "w1", label: "Settimana 1", dates: "24 giu – 28 giu", spots: 3 },
    { id: "w2", label: "Settimana 2", dates: "1 lug – 5 lug", spots: 6 },
    { id: "w3", label: "Settimana 3", dates: "8 lug – 12 lug", spots: 4 },
    { id: "w4", label: "Settimana 4", dates: "15 lug – 19 lug", spots: 7 },
    { id: "w5", label: "Settimana 5", dates: "22 lug – 26 lug", spots: 5 },
    { id: "w6", label: "Settimana 6", dates: "29 lug – 2 ago", spots: 0, soldOut: true },
  ],
};

export const defaultWeeks: Week[] = [
  { id: "w1", label: "Settimana 1", dates: "24 giu – 28 giu", spots: 5 },
  { id: "w2", label: "Settimana 2", dates: "1 lug – 5 lug", spots: 6 },
  { id: "w3", label: "Settimana 3", dates: "8 lug – 12 lug", spots: 4 },
  { id: "w4", label: "Settimana 4", dates: "15 lug – 19 lug", spots: 7 },
];

export const kids: Kid[] = [
  {
    id: "marco",
    name: "Marco",
    age: 10,
    emoji: "👦",
    color: "#E3F9F5",
    accentColor: "sky",
    note: "Ama calcio e robotica",
    grade: "Classe 4ª",
    interests: ["⚽ Calcio", "🤖 Robotica", "🏊 Nuoto"],
  },
  {
    id: "giulia",
    name: "Giulia",
    age: 7,
    emoji: "👧",
    color: "#FFF0EA",
    accentColor: "orange",
    note: "Ama arte e danza",
    grade: "Classe 1ª",
    interests: ["🎨 Arte", "💃 Danza", "📚 Lettura"],
  },
];

export const groups: GroupItem[] = [
  {
    id: "camp-acquatico-2025",
    name: "Camp Acquatico — Estate 2025",
    emoji: "🏊",
    gradient: "linear-gradient(135deg,#C8ECFD,#A5E5D8)",
    location: "Centro Sportivo Lido",
    dateRange: "24 giu – 12 lug",
    members: [
      { initials: "SF", color: "#2a8dc4", bg: "#B8DFF6" },
      { initials: "LM", color: "#F6A623", bg: "#FFD0BB" },
      { initials: "AG", color: "#1fa88e", bg: "#A8EDE2" },
    ],
    extraMembers: 4,
    totalFamilies: 7,
    discountLabel: "Sconto 15%",
    discountBadgeColor: "green",
  },
  {
    id: "soccer-family-brera",
    name: "Soccer Family Brera",
    emoji: "⚽",
    gradient: "linear-gradient(135deg,#EDE8FF,#D4CDFF)",
    location: "Campo Brera",
    dateRange: "Luglio 2025",
    members: [
      { initials: "SF", color: "#2a8dc4", bg: "#B8DFF6" },
      { initials: "RP", color: "#2d8f52", bg: "#E8F9EE" },
    ],
    extraMembers: 2,
    totalFamilies: 3,
    discountLabel: "+1 amico = -10%",
    discountBadgeColor: "orange",
  },
];

export const calendarEvents: CalendarEvent[] = [
  {
    id: "ev1",
    day: 16,
    month: "giu",
    name: "Summer Camp Acquatico — Oggi",
    meta: "08:00-17:30 · Lido Centro",
    meta2: "Marco",
    pillLabel: "Oggi",
    pillColor: "sky",
    blockColor: "#E8F6FD",
    textColor: "#4DAFEF",
  },
  {
    id: "ev2",
    day: 24,
    month: "giu",
    name: "Inizio Summer Camp Acquatico",
    meta: "08:00 · Lido Centro",
    meta2: "Navetta: 07:45 via Roma",
    pillLabel: "Camp",
    pillColor: "aqua",
    blockColor: "#E3F9F5",
    textColor: "#3ECFB2",
  },
  {
    id: "ev3",
    day: 28,
    month: "giu",
    name: "Saggio di fine settimana",
    meta: "16:30 · Genitori invitati",
    meta2: "Marco + 6 bambini",
    pillLabel: "Evento",
    pillColor: "orange",
    blockColor: "#FFF0EA",
    textColor: "#FF8C5A",
  },
  {
    id: "ev4",
    day: 5,
    month: "lug",
    name: "Laboratorio Coding & Robotica",
    meta: "14:00-17:00 · TechKids",
    meta2: "Marco · Lista d'attesa",
    pillLabel: "Attesa",
    pillColor: "purple",
    blockColor: "#F0EEFF",
    textColor: "#8B7CF8",
  },
];

export const bookedDays = [24, 25, 26, 27, 28];
export const eventDays = [16, 17, 18, 19, 20, 21, 24];
export const today = 16;

// ─────────────────────────────────────────────
// Centri (per il pannello "Gestore centro" e "Admin piattaforma")
// ─────────────────────────────────────────────

export const centers: Center[] = [
  {
    id: "centro-sportivo-lido",
    name: "Centro Sportivo Lido",
    emoji: "🏊",
    gradient: "linear-gradient(135deg,#C8ECFD,#A5E5D8)",
    city: "Milano",
    address: "Via Lido 12, Porta Nuova",
    lat: 45.479,
    lng: 9.1938,
    description:
      "Centro sportivo con piscina olimpionica, campi esterni e staff qualificato per camp estivi acquatici e multisport.",
    contactEmail: "info@centrolido.it",
    contactPhone: "+39 02 1234567",
    ownerName: "Luca Bianchi",
    hasBar: true,
    socialLinks: {
      instagram: "https://instagram.com/centrolido",
      facebook: "https://facebook.com/centrolido",
    },
  },
  {
    id: "accademia-crearte",
    name: "Accademia CreArte",
    emoji: "🎨",
    gradient: "linear-gradient(135deg,#FFE8D9,#FFD0BB)",
    city: "Milano",
    address: "Via delle Arti 8",
    lat: 45.48,
    lng: 9.195,
    description: "Scuola d'arte con laboratori di pittura, ceramica e teatro per bambini e ragazzi.",
    contactEmail: "info@crearte.it",
    contactPhone: "+39 02 2345678",
    ownerName: "Giorgia Ferri",
    socialLinks: {
      instagram: "https://instagram.com/crearte_milano",
      website: "https://crearte.it",
    },
  },
  {
    id: "techkids-milano",
    name: "TechKids Milano",
    emoji: "🔬",
    gradient: "linear-gradient(135deg,#EDE8FF,#D4CDFF)",
    city: "Milano",
    address: "Via dell'Innovazione 3",
    lat: 45.4685,
    lng: 9.1824,
    description: "Centro STEM specializzato in coding, robotica e stampa 3D per ragazzi.",
    contactEmail: "info@techkids.it",
    contactPhone: "+39 02 3456789",
    ownerName: "Paolo Conti",
    socialLinks: {
      website: "https://techkids.it",
      youtube: "https://youtube.com/@techkidsmilano",
    },
  },
  {
    id: "campo-brera",
    name: "Campo Brera",
    emoji: "⚽",
    gradient: "linear-gradient(135deg,#D8F5E8,#B5EDD1)",
    city: "Milano",
    address: "Via Brera 22",
    lat: 45.4719,
    lng: 9.188,
    description: "Impianto sportivo dedicato al calcio giovanile con staff di allenatori certificati.",
    contactEmail: "info@camobrera.it",
    contactPhone: "+39 02 4567890",
    ownerName: "Sara Romano",
    socialLinks: {
      instagram: "https://instagram.com/campobrera",
    },
  },
  {
    id: "scuola-musica-aria",
    name: "Scuola di Musica Aria",
    emoji: "🎵",
    gradient: "linear-gradient(135deg,#FFF5D6,#FFE89A)",
    city: "Milano",
    address: "Via delle Note 5",
    lat: 45.475,
    lng: 9.205,
    description: "Scuola di musica con corsi di canto, strumento e propedeutica musicale.",
    contactEmail: "info@scuolaaria.it",
    contactPhone: "+39 02 5678901",
    ownerName: "Elena Costa",
    hasBar: true,
    socialLinks: {
      instagram: "https://instagram.com/scuolaaria",
      tiktok: "https://tiktok.com/@scuolaaria",
    },
  },
];

// Riporta su ogni attività se il centro che la ospita ha un bar/punto ristoro
// (usato dal filtro "servizi aggiuntivi" in Cerca) — evita di dover ripetere
// il campo su ogni singola attività qui sopra.
const centerHasBarById = new Map(centers.map((c) => [c.id, Boolean(c.hasBar)]));
activities.forEach((a) => {
  a.centerHasBar = centerHasBarById.get(a.centerId) ?? false;
});

// L'utente demo che "gestisce" un centro, per il ruolo Gestore centro
export const demoCenterAdminCenterId = "centro-sportivo-lido";

// ─────────────────────────────────────────────
// Disponibilità giornaliera (vista calendario stile booking)
// ─────────────────────────────────────────────

function buildWeekDays(
  startDateISO: string,
  weekIndex: number,
  baseCapacity: number,
  opts: {
    discountDay?: number;
    discountPercent?: number;
    lastMinuteDay?: number;
    closedDays?: number[];
    specialDay?: number;
    specialLabel?: string;
    specialEmoji?: string;
  } = {}
): DayAvailability[] {
  const start = new Date(startDateISO + "T00:00:00");

  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const isClosed = opts.closedDays?.includes(i) ?? false;
    const spotsLeft = isClosed
      ? 0
      : Math.max(0, baseCapacity - ((weekIndex * 2 + i * 3) % (baseCapacity + 1)));

    return {
      date: iso,
      weekday: i,
      isOpen: !isClosed,
      capacity: baseCapacity,
      spotsLeft,
      singleDayBookable: true,
      discountPercent: opts.discountDay === i ? opts.discountPercent ?? 15 : undefined,
      lastMinute: opts.lastMinuteDay === i,
      specialLabel: opts.specialDay === i ? opts.specialLabel : undefined,
      specialEmoji: opts.specialDay === i ? opts.specialEmoji : undefined,
    };
  });
}

export const activityDaysByActivity: Record<string, DayAvailability[]> = {
  "summer-camp-acquatico": [
    ...buildWeekDays("2025-06-24", 0, 12, { discountDay: 4, discountPercent: 15 }),
    ...buildWeekDays("2025-07-01", 1, 12, {
      lastMinuteDay: 0,
      specialDay: 2,
      specialLabel: "Giornata in piscina",
      specialEmoji: "🏊",
    }),
    ...buildWeekDays("2025-07-08", 2, 12, {
      specialDay: 3,
      specialLabel: "Giochi d'acqua",
      specialEmoji: "💦",
    }),
    ...buildWeekDays("2025-07-15", 3, 12),
    ...buildWeekDays("2025-07-22", 4, 12),
    ...buildWeekDays("2025-07-29", 5, 12, { closedDays: [0, 1, 2, 3, 4] }),
  ],
  "laboratorio-arti-creative": [
    ...buildWeekDays("2025-06-24", 0, 10, { discountDay: 4, discountPercent: 10 }),
    ...buildWeekDays("2025-07-01", 1, 10),
    ...buildWeekDays("2025-07-08", 2, 10),
    ...buildWeekDays("2025-07-15", 3, 10),
  ],
  "coding-robotica-kids": [
    ...buildWeekDays("2025-06-24", 0, 8, { lastMinuteDay: 1 }),
    ...buildWeekDays("2025-07-01", 1, 8),
    ...buildWeekDays("2025-07-08", 2, 8),
    ...buildWeekDays("2025-07-15", 3, 8),
  ],
  "soccer-academy-estate": [
    ...buildWeekDays("2025-06-24", 0, 16, { discountDay: 2, discountPercent: 10 }),
    ...buildWeekDays("2025-07-01", 1, 16, {
      specialDay: 4,
      specialLabel: "Torneo di fine settimana",
      specialEmoji: "🏆",
    }),
    ...buildWeekDays("2025-07-08", 2, 16),
    ...buildWeekDays("2025-07-15", 3, 16),
  ],
  "summer-music-camp": [
    ...buildWeekDays("2025-06-24", 0, 9, { lastMinuteDay: 3, discountDay: 3, discountPercent: 25 }),
    ...buildWeekDays("2025-07-01", 1, 9),
    ...buildWeekDays("2025-07-08", 2, 9),
    ...buildWeekDays("2025-07-15", 3, 9),
  ],
};

// ─────────────────────────────────────────────
// Promozioni (sconti su giorni specifici + last-minute)
// ─────────────────────────────────────────────

export const promotions: Promotion[] = [
  {
    id: "promo-1",
    activityId: "summer-camp-acquatico",
    type: "day_discount",
    label: "Venerdì scontato",
    discountPercent: 15,
    dayOfWeek: 4,
    active: true,
  },
  {
    id: "promo-2",
    activityId: "summer-camp-acquatico",
    type: "last_minute",
    label: "Ultimi posti settimana 2 — sconto last-minute",
    discountPercent: 20,
    validFrom: "2025-06-25",
    validTo: "2025-06-30",
    active: true,
  },
  {
    id: "promo-3",
    activityId: "laboratorio-arti-creative",
    type: "day_discount",
    label: "Venerdì -10%",
    discountPercent: 10,
    dayOfWeek: 4,
    active: true,
  },
  {
    id: "promo-4",
    activityId: "coding-robotica-kids",
    type: "last_minute",
    label: "Ultimi posti disponibili — sconto flash",
    discountPercent: 20,
    validFrom: "2025-06-24",
    validTo: "2025-06-26",
    active: true,
  },
  {
    id: "promo-5",
    activityId: "soccer-academy-estate",
    type: "day_discount",
    label: "Mercoledì -10%",
    discountPercent: 10,
    dayOfWeek: 2,
    active: true,
  },
  {
    id: "promo-6",
    activityId: "summer-music-camp",
    type: "last_minute",
    label: "Ultimi posti disponibili",
    discountPercent: 25,
    validFrom: "2025-06-25",
    validTo: "2025-06-28",
    active: true,
  },
];

// ─────────────────────────────────────────────
// Prenotazioni (per le dashboard Admin piattaforma e Gestore centro)
// ─────────────────────────────────────────────

export const bookingsMock: BookingRecord[] = [
  {
    id: "bk-1",
    activityId: "summer-camp-acquatico",
    kidName: "Marco Ferretti",
    kidAge: 10,
    parentName: "Sofia Ferretti",
    weeksLabel: "Settimana 1 – 3",
    totalAmount: 592,
    status: "confirmed",
    createdAt: "2025-06-10",
  },
  {
    id: "bk-2",
    activityId: "summer-camp-acquatico",
    kidName: "Giulia Marchetti",
    kidAge: 8,
    parentName: "Laura Marchetti",
    weeksLabel: "Settimana 2",
    totalAmount: 280,
    status: "confirmed",
    createdAt: "2025-06-12",
  },
  {
    id: "bk-3",
    activityId: "laboratorio-arti-creative",
    kidName: "Tommaso Greco",
    kidAge: 9,
    parentName: "Anna Greco",
    weeksLabel: "Settimana 1",
    totalAmount: 220,
    status: "pending",
    createdAt: "2025-06-14",
  },
  {
    id: "bk-4",
    activityId: "coding-robotica-kids",
    kidName: "Marco Ferretti",
    kidAge: 10,
    parentName: "Sofia Ferretti",
    weeksLabel: "Settimana 1",
    totalAmount: 310,
    status: "pending",
    createdAt: "2025-06-15",
  },
  {
    id: "bk-5",
    activityId: "soccer-academy-estate",
    kidName: "Davide Rossi",
    kidAge: 11,
    parentName: "Elisa Rossi",
    weeksLabel: "Settimana 1 – 2",
    totalAmount: 450,
    status: "confirmed",
    createdAt: "2025-06-16",
  },
  {
    id: "bk-6",
    activityId: "summer-music-camp",
    kidName: "Giulia Ferretti",
    kidAge: 7,
    parentName: "Sofia Ferretti",
    weeksLabel: "Settimana 1",
    totalAmount: 195,
    status: "cancelled",
    createdAt: "2025-06-08",
  },
  {
    id: "bk-7",
    activityId: "summer-camp-acquatico",
    kidName: "Elisa Bruno",
    kidAge: 12,
    parentName: "Marta Bruno",
    weeksLabel: "Settimana 1",
    totalAmount: 280,
    status: "confirmed",
    createdAt: "2025-06-18",
  },
  {
    id: "bk-8",
    activityId: "laboratorio-arti-creative",
    kidName: "Sara Neri",
    kidAge: 8,
    parentName: "Paolo Neri",
    weeksLabel: "Settimana 2",
    totalAmount: 220,
    status: "confirmed",
    createdAt: "2025-06-20",
  },
  {
    id: "bk-9",
    activityId: "coding-robotica-kids",
    kidName: "Luca Verdi",
    kidAge: 12,
    parentName: "Chiara Verdi",
    weeksLabel: "Settimana 2",
    totalAmount: 310,
    status: "confirmed",
    createdAt: "2025-06-21",
  },
  {
    id: "bk-10",
    activityId: "soccer-academy-estate",
    kidName: "Pietro Colombo",
    kidAge: 9,
    parentName: "Francesca Colombo",
    weeksLabel: "Settimana 2",
    totalAmount: 250,
    status: "pending",
    createdAt: "2025-06-22",
  },
  {
    id: "bk-11",
    activityId: "summer-music-camp",
    kidName: "Chiara Gallo",
    kidAge: 8,
    parentName: "Marco Gallo",
    weeksLabel: "Settimana 2",
    totalAmount: 195,
    status: "confirmed",
    createdAt: "2025-06-23",
  },
  {
    id: "bk-12",
    activityId: "summer-camp-acquatico",
    kidName: "Anna Lombardi",
    kidAge: 13,
    parentName: "Roberto Lombardi",
    weeksLabel: "Settimana 3",
    totalAmount: 280,
    status: "pending",
    createdAt: "2025-06-25",
  },
  {
    id: "bk-13",
    activityId: "laboratorio-arti-creative",
    kidName: "Giorgio Fontana",
    kidAge: 11,
    parentName: "Silvia Fontana",
    weeksLabel: "Settimana 3",
    totalAmount: 220,
    status: "confirmed",
    createdAt: "2025-07-01",
  },
  {
    id: "bk-14",
    activityId: "soccer-academy-estate",
    kidName: "Federico Villa",
    kidAge: 14,
    parentName: "Davide Villa",
    weeksLabel: "Settimana 3",
    totalAmount: 250,
    status: "confirmed",
    createdAt: "2025-07-02",
  },
  {
    id: "bk-15",
    activityId: "coding-robotica-kids",
    kidName: "Emma Ricci",
    kidAge: 10,
    parentName: "Luca Ricci",
    weeksLabel: "Settimana 3",
    totalAmount: 310,
    status: "confirmed",
    createdAt: "2025-07-03",
  },
  {
    id: "bk-16",
    activityId: "summer-music-camp",
    kidName: "Nicolò Bianchi",
    kidAge: 7,
    parentName: "Elena Bianchi",
    weeksLabel: "Settimana 1",
    totalAmount: 195,
    status: "cancelled",
    createdAt: "2025-06-05",
  },
];
