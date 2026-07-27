import PrenotazioniClient from "./PrenotazioniClient";
import { getBookingsForCenter } from "@/lib/data/center-bookings";

// TRAMA ONE Build Sprint 4 (DEC-42, PCR-013/PCR-015) — Inbox prenotazioni del
// Partner: risposta (accetta/rifiuta/proponi), accettazione per giorno,
// stesso principio di /center/richieste (ticketing) applicato a
// public.bookings/booking_days invece di activity_inquiries.
export default async function CenterPrenotazioniPage() {
  const bookings = await getBookingsForCenter();
  return <PrenotazioniClient initialBookings={bookings} />;
}
