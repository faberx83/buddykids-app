"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { uploadImage, uploadKidAvatar } from "@/lib/storage";
import ImageCropModal from "@/components/ImageCropModal";

// Cerchietto con overlay "cambia foto" (icona macchina fotografica),
// riusabile per genitore/bambino/centro/fornitore — quando c'è una foto
// reale la mostra al posto dell'emoji/iniziali passate come fallback.
//
// Flusso di scelta: click sull'icona -> piccolo menu "Scatta foto"/"Scegli
// dalla galleria" (due input file distinti: quello fotocamera usa
// capture="environment" per aprire direttamente la fotocamera su mobile) ->
// modale di ritaglio/centratura (ImageCropModal, canvas, nessuna dipendenza
// esterna) -> upload del file già ritagliato.
export default function AvatarUploadButton({
  folder,
  currentUrl,
  onUploaded,
  fallback,
  size = 50,
  disabled,
}: {
  folder: string;
  currentUrl?: string | null;
  onUploaded: (url: string) => void | Promise<void>;
  fallback: React.ReactNode; // emoji/iniziali mostrate quando non c'è ancora una foto
  size?: number;
  disabled?: boolean;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // Coordinate viewport del menu (BUG CORRETTO 06/08/2026, seconda ondata —
  // vedi commento esteso più sotto sul perché è un portale).
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  // File appena scelto (nuovo upload) O la foto già caricata (stringa URL,
  // richiesta da Fabrizio: poter ri-centrare/zoomare una foto esistente senza
  // doverla ricaricare da capo) — entrambi aprono lo stesso ImageCropModal.
  const [pendingSource, setPendingSource] = useState<File | string | null>(null);

  function toggleMenu() {
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (rect) setMenuPos({ top: rect.bottom + 4, left: rect.left });
    setMenuOpen(true);
  }

  // Il menu è renderizzato in un portale (vedi return sotto): se resta
  // aperto durante uno scroll/resize le coordinate calcolate all'apertura
  // diventano stale (il menu "galleggia" lontano dall'avatar). Più semplice
  // e robusto chiuderlo, coerente con il comportamento standard di un
  // dropdown quando si scrolla la pagina sotto di esso.
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menuOpen]);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    // Fix privacy 06/08/2026: le foto bambini vanno in un bucket privato
    // dedicato (URL firmato, non pubblico) — vedi lib/storage.ts. Per ogni
    // altro folder (avatars/centers/partner-offers) niente cambia.
    const result = folder === "kids" ? await uploadKidAvatar(file) : await uploadImage(folder, file);
    setUploading(false);
    if (result.error || !result.url) {
      setError(result.error || "Errore nel caricamento");
      return;
    }
    await onUploaded(result.url);
  }

  function handleFileSelected(file: File | undefined) {
    setMenuOpen(false);
    if (!file) return;
    setPendingSource(file); // apre il modale di ritaglio
  }

  return (
    <div ref={wrapperRef} className="relative inline-flex flex-col items-center">
      {/* Cerchio foto: SOLO la foto/fallback qui dentro, con overflow-hidden
          per il ritaglio circolare. Il badge fotocamera vive FUORI da questo
          div (BUG CORRETTO: prima era figlio del div overflow-hidden e,
          posizionato bottom-0 right-0, veniva tagliato dalla maschera
          circolare — un quadrato in un angolo di un cerchio "overflow:hidden"
          sporge sempre oltre il raggio ed è clippato). */}
      <div
        className="relative flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-2xl"
        style={{ width: size, height: size, background: currentUrl ? "#F0F2F5" : undefined }}
      >
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage esterno, non ottimizzabile da next/image senza config extra
          <img src={currentUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          fallback
        )}
      </div>
      <button
        type="button"
        disabled={disabled || uploading}
        onClick={toggleMenu}
        aria-label="Cambia foto"
        className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-sky text-white disabled:opacity-60"
      >
        <i className={`ti ${uploading ? "ti-loader-2 animate-spin" : "ti-camera"} text-[11px]`} />
      </button>

      {/* BUG CORRETTO 06/08/2026 (seconda ondata): questo menu è stato
          tagliato due volte da un overflow-hidden diverso su antenati
          diversi — prima ipoteticamente il cerchio-avatar stesso, poi
          DecorativeIntroCard (Sprint 7 NEXTGEN) attorno a ProfileHeaderClient
          nella pagina Profilo NEXTGEN (screenshot Fabrizio, 06/08/2026: solo
          "Scatta foto" visibile, "Galleria"/"Modifica ritaglio" tagliati e
          sovrapposti a "I miei bambini" sotto). Anziché rincorrere ogni
          futuro contenitore con overflow-hidden, il menu è ora un portale su
          document.body: position:fixed con coordinate calcolate da
          getBoundingClientRect() in toggleMenu() sopra — per costruzione
          non può più essere tagliato o coperto da NESSUN antenato,
          indipendentemente da overflow/z-index/stacking context. */}
      {menuOpen &&
        menuPos &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            {/* Overlay per chiudere il menu cliccando fuori. */}
            <div className="fixed inset-0 z-50" onClick={() => setMenuOpen(false)} />
            <div
              className="fixed z-[60] w-44 rounded-lg bg-white py-1 shadow-[0_4px_16px_rgba(0,0,0,0.15)]"
              style={{ top: menuPos.top, left: menuPos.left }}
            >
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-ink hover:bg-bg"
              >
                <i className="ti ti-camera text-sm" /> Scatta foto
              </button>
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-ink hover:bg-bg"
              >
                <i className="ti ti-photo text-sm" /> Scegli dalla galleria
              </button>
              {/* Richiesto da Fabrizio: poter modificare zoom/centratura della
                  foto già caricata, non solo al momento dell'upload — riapre
                  lo stesso ImageCropModal partendo dall'URL esistente invece
                  che da un File nuovo. */}
              {currentUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setPendingSource(currentUrl);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-ink hover:bg-bg"
                >
                  <i className="ti ti-crop text-sm" /> Modifica ritaglio
                </button>
              )}
            </div>
          </>,
          document.body
        )}

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          handleFileSelected(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFileSelected(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {pendingSource && (
        <ImageCropModal
          source={pendingSource}
          onCancel={() => setPendingSource(null)}
          onConfirm={(croppedFile) => {
            setPendingSource(null);
            handleFile(croppedFile);
          }}
        />
      )}

      {error && <p className="mt-1 max-w-[120px] text-center text-[10px] font-medium text-orange">{error}</p>}
    </div>
  );
}
