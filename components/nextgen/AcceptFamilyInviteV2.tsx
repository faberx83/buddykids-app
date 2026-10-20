"use client";

// TRAMA — INVITO IN FAMIGLIA V2 (20/10/2026). Chi apre il link d'invito
// dell'altro genitore (tramapp.it/i/<codice> → /nextgen/planner/famiglia?
// accept=…) con il Profilo V2 attivo vede questa pagina invece della
// vecchia "Famiglia" (FamigliaClient, che resta per chi non ha il Profilo
// V2). Stessi dati (getFamilyInvitePreviewAction) e stessa azione
// (acceptFamilyInviteAction); dopo "Accetta" si arriva in La tua famiglia.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { useNextgenToast } from "@/components/nextgen/NextgenToastProvider";
import { acceptFamilyInviteAction, type AcceptFamilyInviteResult, type FamilyInvitePreview } from "@/app/actions/family";

export const FAMILY_V2_PATH = "/nextgen/profile/famiglia";

export default function AcceptFamilyInviteV2({ token, preview }: { token: string; preview: FamilyInvitePreview | null }) {
  const router = useRouter();
  const showToast = useNextgenToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    const res: AcceptFamilyInviteResult = await acceptFamilyInviteAction(token).catch(() => ({ error: "Qualcosa non ha funzionato, riprova." }));
    if (res.error) {
      setBusy(false);
      setError(res.error);
      return;
    }
    const name = res.familyName ?? null;
    showToast(name ? `Ora fai parte della famiglia "${name}"` : "Ora fate parte della stessa famiglia");
    router.replace(FAMILY_V2_PATH);
    router.refresh();
  }

  const valid = Boolean(preview && preview.valid);
  const inviter = preview?.inviterName || "Un genitore";

  return (
    <div className="flex flex-col pb-10">
      <PageHeader title="Invito in famiglia" backHref={FAMILY_V2_PATH} showBrandIcon />
      <div className="flex flex-col gap-5 px-5 pt-4">
        {valid && preview ? (
          <>
            <div className="flex flex-col items-start gap-3 rounded-2xl border border-trama-line bg-white px-4 py-5">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-trama-primary-soft text-[24px] text-trama-primary">
                <i className="ti ti-users" aria-hidden="true" />
              </span>
              <p className="font-poppins text-[20px] font-semibold leading-snug text-ink">
                {inviter} ti invita nella famiglia &ldquo;{preview.familyName}&rdquo;
              </p>
              <p className="text-[14px] leading-snug text-ink-2">Ognuno col proprio account, organizzate insieme:</p>
              <ul className="flex flex-col gap-2 text-[14px] text-ink">
                <li className="flex items-start gap-2">
                  <i className="ti ti-check mt-0.5 text-[16px] text-trama-primary" aria-hidden="true" />
                  lo stesso Planner, settimana per settimana
                </li>
                <li className="flex items-start gap-2">
                  <i className="ti ti-check mt-0.5 text-[16px] text-trama-primary" aria-hidden="true" />
                  chi porta e chi ritira, giorno per giorno
                </li>
                <li className="flex items-start gap-2">
                  <i className="ti ti-check mt-0.5 text-[16px] text-trama-primary" aria-hidden="true" />
                  i luoghi di famiglia e il piano da condividere con nonni e tata
                </li>
              </ul>
            </div>
            {error && (
              <p role="alert" className="text-[14px] font-medium text-[#B3261E]">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={accept}
              disabled={busy}
              className="min-h-[52px] w-full rounded-[12px] bg-trama-primary px-5 text-[16px] font-semibold text-white active:bg-trama-primary-press disabled:opacity-60"
            >
              {busy ? "Un attimo…" : "Accetta l'invito"}
            </button>
            <p className="text-center text-[13px] leading-snug text-ink-3">
              L&apos;invito era per {preview.invitedEmail}. Puoi uscire dalla famiglia quando vuoi.
            </p>
          </>
        ) : (
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-trama-line bg-white px-4 py-5">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF3E0] text-[24px] text-[#8A5300]">
              <i className="ti ti-link-off" aria-hidden="true" />
            </span>
            <p className="font-poppins text-[18px] font-semibold text-ink">Questo invito non è più valido</p>
            <p className="text-[14px] leading-snug text-ink-2">
              Potrebbe essere già stato usato, annullato o scaduto. Chiedi all&apos;altro genitore di mandartene uno nuovo, oppure
              entra con il codice di famiglia.
            </p>
            <Link href={FAMILY_V2_PATH} className="flex min-h-[44px] items-center text-[14px] font-semibold text-trama-accent-ink">
              Vai a La tua famiglia
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
