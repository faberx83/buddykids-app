"use client";

// UX-PARTNER-007: bozza della nuova attività conservata nella scheda del
// browser e avviso prima di chiudere/ricaricare con modifiche. Vedi
// lib/centers/activity-draft.ts.
import { useEffect, useRef, useState } from "react";
import { activityDraftKey, isDraftDirty, parseDraft } from "@/lib/centers/activity-draft";

export function useActivityDraft<T extends Record<string, unknown>>(scope: string, initial: T) {
  const key = activityDraftKey(scope);
  const initialRef = useRef(initial);
  const [form, setForm] = useState<T>(initial);
  const [restored, setRestored] = useState(false);
  const skipSave = useRef(true);

  // Ripresa della bozza al ritorno sulla pagina (dopo il primo render: niente differenze col server).
  useEffect(() => {
    try {
      const draft = parseDraft(window.sessionStorage.getItem(key), initialRef.current);
      if (draft) {
        setForm(draft);
        setRestored(true);
      }
    } catch {
      // memoria del browser non disponibile: si lavora senza bozza
    }
  }, [key]);

  const dirty = isDraftDirty(form, initialRef.current);

  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    try {
      if (dirty) window.sessionStorage.setItem(key, JSON.stringify(form));
      else window.sessionStorage.removeItem(key);
    } catch {
      // best effort
    }
  }, [form, dirty, key]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function discard() {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // best effort
    }
    setForm(initialRef.current);
    setRestored(false);
  }

  /** Dopo la creazione riuscita: la bozza non serve più. */
  function clear() {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // best effort
    }
    setRestored(false);
  }

  return { form, setForm, dirty, restored, discard, clear };
}
