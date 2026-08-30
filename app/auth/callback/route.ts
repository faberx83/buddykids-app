import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveFeatureFlag } from "@/lib/feature-flags/resolve";
import { hasAcceptedCurrentDocument, acceptCurrentLegalDocument } from "@/lib/legal/gate";
import { requiresLegalAcceptanceBeforeAccess } from "@/lib/legal/consent";
import { resolveDefaultLandingPath } from "@/lib/auth/default-landing";

// Handles the redirect from Supabase email confirmation / magic links / OAuth.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const explicitNext = searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // TRAMA — LEGAL FLOW TECHNICAL CLOSURE BEFORE CONTENT (task #579,
      // 25/08/2026 sera) — backstop fail-closed. Questo è il primo momento
      // del flusso in cui esiste una sessione autenticata REALE (auth.uid()
      // popolato, RLS-friendly): il bootstrap fail-soft chiamato subito dopo
      // signUp() (LoginForm.tsx -> recordSignupLegalAcceptanceAction) non
      // aveva questa garanzia (nessuna sessione, serviva un service client —
      // vedi acceptCurrentLegalDocumentAtSignupBootstrap). Se quel bootstrap
      // è fallito silenziosamente, questo è l'ultimo punto per
      // rimediare PRIMA di lasciar entrare l'utente in "/" o in qualunque
      // altra pagina applicativa.
      //
      // Con LEGAL_TERMS_GATE=false per ogni utente reale oggi (default
      // globale OFF, nessun override scritto), requiresLegalAcceptanceBeforeAccess
      // ritorna sempre false qui sotto — questo blocco resta un NO-OP totale
      // finché Fabrizio non attiva il gate: nessuna regressione per il
      // comportamento di login/signup esistente.
      const userId = data.user?.id;
      if (userId) {
        const legalGateEnabled = await resolveFeatureFlag({ flagName: "LEGAL_TERMS_GATE", userId });
        const alreadyAccepted = legalGateEnabled
          ? await hasAcceptedCurrentDocument(supabase, userId, "terms")
          : true;

        if (requiresLegalAcceptanceBeforeAccess(legalGateEnabled, alreadyAccepted)) {
          // Un solo retry, con il client autenticato reale ora disponibile
          // (non più il bootstrap con service client): copre esattamente il
          // caso "l'INSERT è fallito subito dopo signUp() per un errore
          // transitorio" senza duplicare righe (idempotente via
          // UNIQUE(user_id, legal_document_id), vedi acceptCurrentLegalDocument).
          const retry = await acceptCurrentLegalDocument(supabase, userId, "terms", "signup_callback_retry");
          if (!retry.ok) {
            // Fail-closed: mai "/" o `next` senza un'acceptance persistita.
            return NextResponse.redirect(`${origin}/auth/legal-pending`);
          }
        }
      }

      // BUGFIX (Fabrizio, 30/08, con screenshot: "come mai ho degli screen
      // da parte di Maria che mi sembra sia entrata nella versione legacy?")
      // — vedi commento completo su resolveDefaultLandingPath(). Se non è
      // stata richiesta esplicitamente un'altra destinazione (next), un
      // membro della Controlled Beta Cohort (es. iscritto tramite
      // ?beta=CODICE) atterra su /nextgen invece che sulla Legacy Home di
      // default: prima di questo fix ci atterrava comunque, senza alcun
      // modo per raggiungere NextGen (VersionToggle.tsx è visibile solo
      // per le utenze di test di Fabrizio dal 27/08).
      const next =
        explicitNext && explicitNext.startsWith("/")
          ? explicitNext
          : userId
            ? await resolveDefaultLandingPath(supabase, userId)
            : "/";

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login`);
}
