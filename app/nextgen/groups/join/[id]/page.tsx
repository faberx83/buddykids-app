import JoinGroupClient from "@/components/JoinGroupClient";

// TRAMA — LINK D'INVITO A UN GRUPPO "DENTRO L'APP" (22/10/2026). Stessa
// adesione di app/(main)/groups/join/[id] (joinGroupAction), ma sotto
// /nextgen: su Android con TRAMA installata il link condiviso apre l'app, e
// dopo "Unisciti" si arriva al gruppo nell'app nuova (non in quella vecchia).
// Il login, se serve, lo chiede proxy.ts tenendo questa pagina come destinazione.
export default async function NextgenJoinGroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JoinGroupClient groupId={id} basePath="/nextgen/groups" v2 />;
}
