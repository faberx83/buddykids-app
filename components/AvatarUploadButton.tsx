"use client";

import { useRef, useState } from "react";
import { uploadImage } from "@/lib/storage";
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
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    const result = await uploadImage(folder, file);
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
    setPendingFile(file); // apre il modale di ritaglio
  }

  return (
    <div className="relative inline-flex flex-col items-center">
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
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="Cambia foto"
        className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-sky text-white disabled:opacity-60"
      >
        <i className={`ti ${uploading ? "ti-loader-2 animate-spin" : "ti-camera"} text-[11px]`} />
      </button>

      {menuOpen && (
        <>
          {/* Overlay per chiudere il menu cliccando fuori. */}
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          {/* left-0 esplicito (BUG CORRETTO: senza left/right, la "static
              position" orizzontale di un elemento absolute dentro un
              flex-col items-center può centrarlo/farlo sporgere in modo
              imprevedibile e venire tagliato dal contenitore della card —
              ancorarlo al bordo sinistro dell'avatar lo tiene sempre dentro
              i confini della card). */}
          <div className="absolute left-0 top-full z-50 mt-1 w-44 rounded-lg bg-white py-1 shadow-[0_4px_16px_rgba(0,0,0,0.15)]">
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
          </div>
        </>
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

      {pendingFile && (
        <ImageCropModal
          file={pendingFile}
          onCancel={() => setPendingFile(null)}
          onConfirm={(croppedFile) => {
            setPendingFile(null);
            handleFile(croppedFile);
          }}
        />
      )}

      {error && <p className="mt-1 max-w-[120px] text-center text-[10px] font-medium text-orange">{error}</p>}
    </div>
  );
}
