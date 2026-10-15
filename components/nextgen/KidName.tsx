"use client";

// TRAMA — figli nello stile V2 (15/10/2026). Nome del figlio nei chip
// ("Per chi", impegni, scoperte): con la nuova barra solo il nome, senza la
// faccina; fuori dalla nuova barra invariato (faccina + nome).

import { useNavV2 } from "@/components/nextgen/ProfileChip";
import type { Kid } from "@/lib/types";

export default function KidName({ kid }: { kid: Pick<Kid, "name" | "emoji"> }) {
  const v2 = useNavV2();
  if (v2) return <>{kid.name}</>;
  return (
    <>
      {kid.emoji} {kid.name}
    </>
  );
}
