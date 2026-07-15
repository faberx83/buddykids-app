// SPRINT 5.5 (NEXTGEN) — Profilo Famiglia multi-genitore: tipi/costanti
// usati sia da app/actions/family.ts (server) sia da FamigliaClient.tsx
// ("use client") — modulo SENZA alcun import di lib/supabase/server, stesso
// pattern già stabilito per lib/nextgen/address-kinds.ts e
// lib/nextgen/responsibility-options.ts (vedi commenti li: un componente
// client che importa una costante RUNTIME da un file che risale a
// lib/supabase/server rompe la build Next.js/Turbopack in produzione, anche
// se tsc/eslint locali non se ne accorgono).

export type FamilyRole = "creatore" | "admin" | "membro";

export const FAMILY_ROLE_LABELS: Record<FamilyRole, string> = {
  creatore: "Creatore",
  admin: "Admin",
  membro: "Membro",
};

export interface FamilyMember {
  parentId: string;
  fullName: string | null;
  email: string | null;
  role: FamilyRole;
  joinedAt: string;
  isMe: boolean;
}

// SPRINT: invito "vero" via email (in aggiunta al codice) — un invito
// inviato ma non ancora accettato, mostrato in UI come "In attesa di
// risposta" così l'admin sa che non deve reinvitare a caso.
export interface PendingFamilyInvite {
  id: string;
  invitedEmail: string;
  status: "pending" | "sent";
  createdAt: string;
}

export interface Family {
  id: string;
  name: string;
  inviteCode: string;
  myRole: FamilyRole;
  members: FamilyMember[];
  pendingInvites: PendingFamilyInvite[];
}
