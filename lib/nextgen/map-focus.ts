// TRAMA — POLISH V2 (14/10/2026). Vista iniziale della mappa di Scopri:
// adattarla a TUTTI i risultati mostrava l'Italia intera quando c'erano
// attività a Milano e in Puglia. Qui si sceglie la zona utile, in ordine:
//   1. intorno alla posizione della famiglia (se attiva): i punti entro il
//      raggio; se nessuno, i 5 più vicini;
//   2. senza posizione: il gruppo più fitto (il punto con più vicini entro il
//      raggio, con i suoi vicini);
//   3. ripiego: tutti i punti.
// Logica pura, testata in tests/one/polish-v2.spec.ts.

export type LatLng = [number, number];

export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function mapFocusPoints(points: LatLng[], anchor: LatLng | null = null, radiusKm = 30): LatLng[] {
  if (points.length <= 1) return points;
  if (anchor) {
    const near = points.filter((p) => distanceKm(anchor, p) <= radiusKm);
    if (near.length > 0) return near;
    return [...points].sort((a, b) => distanceKm(anchor, a) - distanceKm(anchor, b)).slice(0, 5);
  }
  let best: LatLng[] = [];
  for (const p of points) {
    const group = points.filter((q) => distanceKm(p, q) <= radiusKm);
    if (group.length > best.length) best = group;
  }
  return best.length > 0 ? best : points;
}
