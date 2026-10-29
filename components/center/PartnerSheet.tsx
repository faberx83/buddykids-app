"use client";

import { useEffect, useId, useRef } from "react";

// TRAMA — PORTALE CENTRI V2 (29/10/2026): foglio dal basso, come quelli
// dell'app famiglie (Chi accompagna, il "+"): sale dal basso su telefono, è
// una finestra al centro su computer. Esc o tocco fuori chiude; il fuoco va
// al foglio e torna dove era; la pagina sotto non scorre.

export default function PartnerSheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  /** Pulsanti fissi in fondo (sempre visibili anche con contenuto lungo). */
  footer?: React.ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center md:items-center md:p-6">
      <div className="absolute inset-0 bg-[#0B1F22]/45" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[92vh] w-full flex-col rounded-t-[24px] bg-white shadow-xl md:max-w-xl md:rounded-[24px]"
      >
        <div className="flex justify-center pt-2 md:hidden" aria-hidden="true">
          <span className="h-1 w-10 rounded-full bg-[#D5DDDB]" />
        </div>
        <div className="flex items-start gap-3 border-b border-partner-line px-5 pb-3 pt-3 md:pt-5">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h2 id={titleId} className="font-poppins text-[19px] font-semibold leading-snug text-ink">
              {title}
            </h2>
            {subtitle && <div className="text-[13.5px] text-ink-2">{subtitle}</div>}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="-mr-1.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-partner-page"
          >
            <i className="ti ti-x text-[20px]" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {footer && (
          <div
            className="border-t border-partner-line bg-white px-5 pt-3"
            style={{ paddingBottom: "calc(0.9rem + env(safe-area-inset-bottom))" }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
