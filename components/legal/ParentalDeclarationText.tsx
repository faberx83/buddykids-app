// TRAMA — testo della dichiarazione di responsabilità genitoriale (bozza 1,
// 16/10/2026, versione CURRENT_PARENTAL_DECLARATION_VERSION in
// lib/legal/consent.ts). Mostrato solo con LEGAL_TERMS_GATE acceso, quando si
// aggiunge un figlio (Profilo, La tua famiglia, introduzione, richiesta).
// Da rivedere con il legale insieme a Informativa e Termini.

export const PARENTAL_DECLARATION_TEXT_VERSION = "2026-10-16-bozza1";

export default function ParentalDeclarationText({ kidName }: { kidName: string }) {
  const who = kidName.trim() || "questo bambino";
  return (
    <span>
      Confermo di essere il genitore di {who}, o di esercitare la responsabilità genitoriale, e di inserire i suoi dati
      per organizzare le sue attività con TRAMA, come descritto nell&apos;
      <a href="/privacy" target="_blank" rel="noreferrer" className="font-semibold underline">
        Informativa privacy
      </a>
      .
    </span>
  );
}
