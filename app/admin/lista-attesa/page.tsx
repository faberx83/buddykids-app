import { getWaitlistForAdmin } from "@/lib/data/waitlist";
import { getBetaInviteCodesForAdmin } from "@/lib/data/beta-invites";
import ListaAttesaAdminClient from "./ListaAttesaAdminClient";

// TRAMA — LISTA D'ATTESA (20/10/2026): chi ha chiesto un invito dalla pagina
// di benvenuto (tramapp.it/benvenuto). Stesso schema delle altre code Admin
// (server component → client con stato locale). Per invitare si riusa un
// codice Inviti Beta attivo: il messaggio pronto contiene il suo link.
export default async function ListaAttesaAdminPage() {
  const [data, codes] = await Promise.all([getWaitlistForAdmin(), getBetaInviteCodesForAdmin().catch(() => [])]);
  const code = codes.find((c) => c.state === "redeemable")?.code ?? null;
  return <ListaAttesaAdminClient data={data} inviteCode={code} />;
}
