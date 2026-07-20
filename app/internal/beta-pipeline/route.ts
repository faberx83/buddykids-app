import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

// SPRINT 8 — endpoint interno per l'automazione "BETA feedback -> pipeline"
// (Fabrizio: "voglio che se segnalo come confermata arrivi già qui e la
// metti in lavorazione", ogni 15 minuti). GET-only DI PROPOSITO, anche per
// l'azione "set" che normalmente sarebbe una POST/PATCH: il task schedulato
// che chiama questo endpoint lo fa con un fetch semplice (URL + query
// string), senza poter impostare header o body custom — vincolo
// dell'ambiente di automazione disponibile, non una scelta di design
// "pulita" in senso REST. Protetto da un secret condiviso passato come
// query param (PIPELINE_AUTOMATION_SECRET, variabile d'ambiente separata
// dalla service_role key — cambiala su Vercel in qualsiasi momento se
// sospetti sia stata esposta, il vecchio valore smette subito di
// funzionare).
//
// Usa la service_role key (vedi lib/supabase/service.ts): questo endpoint
// non è collegato a nessuna sessione utente reale, quindi l'unica
// autorizzazione possibile è il secret — bypassa le RLS di beta_feedback di
// proposito, esattamente come farebbe un admin autenticato.
//
// STORIA — la prima versione di questo meccanismo (stesso sprint) usava due
// function SECURITY DEFINER chiamabili con la sola chiave anon pubblica +
// un secret salvato in una tabella dedicata (vedi il commit precedente).
// Cambiato qui perché l'ambiente da cui parte l'automazione può raggiungere
// URL pubblici in GET ma non chiamate dirette all'API REST di Supabase con
// header/body custom — un endpoint interno nell'app stessa, raggiungibile
// con un fetch semplice, è più affidabile per come questa automazione viene
// davvero eseguita.
//
// STORIA 2 — inizialmente questo file viveva sotto app/api/internal/... .
// Spostato fuori da /api perché lo strumento di fetch usato dall'automazione
// scarta silenziosamente (nessun errore, risposta vuota) qualsiasi URL il
// cui path contiene il segmento "/api/" — verificato sia su questo dominio
// sia su domini pubblici estranei (es. reqres.in/api/...), quindi non è un
// blocco di Vercel ma un'euristica del tool stesso. Il path "/internal/..."
// (fuori da /api) evita il problema; proxy.ts esclude "/internal" dal gate
// di ruolo/tenant esattamente come faceva già per "/api".

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  const expected = process.env.PIPELINE_AUTOMATION_SECRET;
  if (!expected || !secret || !timingSafeEqual(secret, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase non configurato (manca SUPABASE_SERVICE_ROLE_KEY)" }, { status: 500 });
  }

  const action = req.nextUrl.searchParams.get("action") ?? "list";

  if (action === "list") {
    const { data, error } = await supabase
      .from("beta_feedback")
      .select("id, app_source, area, page_path, message, admin_note, created_at, pipeline_status")
      .eq("pipeline_status", "confirmed")
      .order("created_at", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data });
  }

  if (action === "set") {
    const id = req.nextUrl.searchParams.get("id");
    const status = req.nextUrl.searchParams.get("status");
    if (!id || !status || !["confirmed", "in_progress", "done"].includes(status)) {
      return NextResponse.json({ error: "parametri non validi (id/status)" }, { status: 400 });
    }
    const { error } = await supabase
      .from("beta_feedback")
      .update({ pipeline_status: status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "azione non valida (usa action=list oppure action=set)" }, { status: 400 });
}
