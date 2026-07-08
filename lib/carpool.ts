// Logica pura di abbinamento "Accompagnamento" (nessuna chiamata a
// Supabase): per ogni genitore che ha richiesto un passaggio, propone le
// offerte di altri genitori compatibili per tratta (andata/ritorno) e, se
// serve un seggiolino, solo chi lo ha indicato. Resta un suggerimento: non
// crea nessuna prenotazione o assegnazione vincolante.

import { CarpoolMatch, CarpoolOfferItem, CarpoolRequestItem, CarpoolLeg } from "@/lib/types";

function legCovers(offerLeg: CarpoolLeg, neededLeg: CarpoolLeg): boolean {
  if (offerLeg === "both") return true;
  return offerLeg === neededLeg;
}

export function matchesForRequest(
  request: CarpoolRequestItem,
  offers: CarpoolOfferItem[]
): CarpoolOfferItem[] {
  return offers
    .filter((offer) => !offer.isOwn || !request.isOwn) // non abbinare una persona con se stessa
    .filter((offer) => legCovers(offer.legs, request.legs))
    .filter((offer) => offer.seatsAvailable >= request.kidsCount)
    .filter((offer) => !request.needsChildSeat || offer.hasChildSeat)
    .sort((a, b) => b.seatsAvailable - a.seatsAvailable);
}

export function buildCarpoolMatches(
  requests: CarpoolRequestItem[],
  offers: CarpoolOfferItem[]
): CarpoolMatch[] {
  return requests.map((request) => ({
    request,
    offers: matchesForRequest(request, offers),
  }));
}
