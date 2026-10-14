"use client";

// TRAMA — PROFILO V2 (14/10/2026, proposta approvata da Fabrizio: "si si
// concordo"). Stessa pagina /nextgen/profile, stessi dati e stesse
// destinazioni del Profilo attuale (ProfileNextgenClient), nuova
// impaginazione nello stile di Home / Planner / Prenotazioni V2:
//   1. intestazione con freccia, "Profilo" e segno TRAMA;
//   2. card con avatar, nome, email e Modifica (ProfileHeaderClient v2);
//   3. "I tuoi figli" (ProfileKidsSection v2: stessa logica di aggiunta,
//      modifica, interessi, scuola);
//   4. tre gruppi: Famiglia / Le tue attività / App — le voci delle due
//      sottopagine "Famiglia e logistica" e "Impostazioni" restano dove sono,
//      ma le quattro voci di famiglia ora sono qui direttamente;
//   5. Esci dall'account.
// Tolte le voci doppie: "Le mie prenotazioni" (è nella barra) e "Preferiti"
// (diventa "Salvati", stesso indirizzo /nextgen/preferiti).
// Dietro PROFILE_V2_ENABLED (release "nav-v2"): con il flag spento resta
// ProfileNextgenClient, invariato.

import Link from "next/link";
import { useRouter } from "next/navigation";
import ProfileHeaderClient from "@/components/ProfileHeaderClient";
import ProfileKidsSection from "@/components/ProfileKidsSection";
import LogoutButton from "@/components/LogoutButton";
import TramaThread from "@/components/nextgen/TramaThread";
import { openBetaFeedback } from "@/lib/nextgen/feedback-open";
import { writeVersionPreference } from "@/lib/version-preference";
import type { ParentRole, Gender } from "@/lib/data/profile";
import type { Kid } from "@/lib/types";
import type { KidSchoolProfileSummary } from "@/lib/data/school-calendar";

import { PROFILE_TINT as TINT, profileV2Sections, type ProfileRowItem } from "@/lib/nextgen/profile-v2";
import { restartWalkthroughAction } from "@/app/actions/walkthrough";
import { ONBOARDING_V2_TUTORIAL_KEY } from "@/lib/nextgen/onboarding-v2";

function Row({ item, last }: { item: ProfileRowItem; last: boolean }) {
  const t = TINT[item.tint];
  const body = (
    <span className={`flex min-h-[60px] items-center gap-3 px-4 py-2.5 ${item.soon ? "opacity-60" : "active:bg-black/[0.03]"} ${last ? "" : "border-b border-[#F0F2F5]"}`}>
      <span className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[10px]" style={{ background: t.bg, color: t.fg }} aria-hidden="true">
        <i className={`ti ${item.icon} text-[18px]`} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[14.5px] font-semibold text-ink">{item.title}</span>
        {item.subtitle && <span className="truncate text-[12.5px] text-ink-2">{item.subtitle}</span>}
      </span>
      {item.soon ? (
        <span className="rounded-full bg-[#F1F3F6] px-2.5 py-1 text-[11.5px] font-semibold text-ink-2">Presto</span>
      ) : item.badge && item.badge > 0 ? (
        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-trama-primary px-1.5 text-[12px] font-bold text-white">{item.badge}</span>
      ) : (
        <i className="ti ti-chevron-right text-[18px] text-[#B4BAC5]" aria-hidden="true" />
      )}
    </span>
  );
  if (item.soon) return <li>{body}</li>;
  if (item.href)
    return (
      <li>
        <Link href={item.href} className="block">
          {body}
        </Link>
      </li>
    );
  return (
    <li>
      <button type="button" onClick={item.onClick} className="block w-full text-left">
        {body}
      </button>
    </li>
  );
}

// POLISH V2 (14/10/2026): card con bordo sottile, niente ombra morbida.
const CARD = "rounded-2xl border border-trama-line bg-white";

export default function ProfileV2Client({
  fullName,
  email,
  parentRole,
  avatarUrl,
  phone,
  dateOfBirth,
  gender,
  kids,
  unreadReplies,
  autoOpenEdit,
  autoOpenAddKid,
  schoolCalendarEnabled,
  schoolProfiles,
  residenceCity,
  classicFallbackEnabled,
  onboardingV2Enabled = false,
}: {
  fullName: string;
  email: string;
  parentRole: ParentRole | null;
  avatarUrl?: string | null;
  phone: string;
  dateOfBirth: string | null;
  gender: Gender | null;
  kids: Kid[];
  unreadReplies: number;
  autoOpenEdit: boolean;
  autoOpenAddKid: boolean;
  schoolCalendarEnabled: boolean;
  schoolProfiles: Record<string, KidSchoolProfileSummary>;
  residenceCity: string | null;
  classicFallbackEnabled: boolean;
  /** ONBOARDING V2 (14/10/2026): mostra "Rivedi l'introduzione". */
  onboardingV2Enabled?: boolean;
}) {
  const router = useRouter();
  const sections = profileV2Sections({
    unreadReplies,
    classicFallbackEnabled,
    onFeedback: () => openBetaFeedback("profilo"),
    onClassic: () => {
      // Stesso meccanismo di components/VersionToggle.tsx e del Profilo attuale.
      writeVersionPreference("legacy");
      router.push("/");
    },
    onReplayIntro: onboardingV2Enabled
      ? () => {
          // Azzera il percorso: al refresh il layout rimonta l'onboarding da capo.
          void restartWalkthroughAction(ONBOARDING_V2_TUTORIAL_KEY).then((res) => {
            if (!res.error) router.refresh();
          });
        }
      : undefined,
  });

  return (
    <div className="-mb-40 flex min-h-[calc(100%+10rem)] flex-col gap-[22px] bg-trama-page px-5 pb-24 pt-[14px]">
      <header className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => {
            if (window.history.length > 1) router.back();
            else router.push("/nextgen");
          }}
          aria-label="Indietro"
          className="-ml-2.5 flex h-11 w-11 items-center justify-center rounded-full text-[22px] text-ink active:bg-black/[0.04]"
        >
          <i className="ti ti-arrow-left" aria-hidden="true" />
        </button>
        <div className="flex flex-col">
          <h1 className="font-poppins text-[24px] font-semibold leading-tight text-ink">Profilo</h1>
          <TramaThread className="mt-1.5" />
        </div>
      </header>

      <section aria-label="Il tuo account" className={`${CARD} p-4`}>
        <ProfileHeaderClient
          initialFullName={fullName}
          initialParentRole={parentRole}
          initialAvatarUrl={avatarUrl}
          email={email}
          autoOpenEdit={autoOpenEdit}
          initialPhone={phone}
          initialDateOfBirth={dateOfBirth}
          initialGender={gender}
          accent="violet"
          v2
        />
      </section>

      <ProfileKidsSection
        initialKids={kids}
        autoOpenAddKid={autoOpenAddKid}
        accent="violet"
        schoolCalendarEnabled={schoolCalendarEnabled}
        schoolProfiles={schoolProfiles}
        residenceCity={residenceCity}
        v2
      />

      {sections.map((s) => (
        <section key={s.title} aria-label={s.title} className="flex flex-col gap-2.5">
          <h2 className="font-poppins text-[18px] font-semibold text-ink">{s.title}</h2>
          <ul className={`${CARD} overflow-hidden`}>
            {s.items.map((item, i) => (
              <Row key={item.key} item={item} last={i === s.items.length - 1} />
            ))}
          </ul>
        </section>
      ))}

      <LogoutButton
        className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[12px] border border-[#F3D3CF] bg-white text-[14.5px] font-bold text-[#B3261E] active:bg-black/[0.03]"
      />
    </div>
  );
}
