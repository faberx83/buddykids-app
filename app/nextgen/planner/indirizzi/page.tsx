import { getParentAddresses } from "@/lib/data/addresses";
import IndirizziClient from "./IndirizziClient";

// SPRINT 5.3 (NEXTGEN) — Family Planner, "Logistica leggera": pagina per
// salvare gli indirizzi di famiglia (Casa, Lavoro Genitore 1, Lavoro
// Genitore 2, Altro). Raggiungibile dal Planner (Organizzazione) — vedi
// PlannerClient.tsx. Nessuna nuova logica qui: solo lettura di
// getParentAddresses() (lib/data/addresses.ts, invariata rispetto alla UI).
export default async function IndirizziPage() {
  const addresses = await getParentAddresses();
  return <IndirizziClient addresses={addresses} />;
}
