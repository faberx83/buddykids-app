"use client";

import { useRef, useState } from "react";
import { uploadImage } from "@/lib/storage";

// Cerchietto con overlay "cambia foto" (icona macchina fotografica),
// riusabile per genitore/bambino/centro/fornitore — quando c'è una foto
// reale la mostra al posto dell'emoji/iniziali passate come fallback.
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="inline-flex flex-col items-center">
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
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          aria-label="Cambia foto"
          className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-sky text-white disabled:opacity-60"
        >
          <i className={`ti ${uploading ? "ti-loader-2 animate-spin" : "ti-camera"} text-[11px]`} />
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      {error && <p className="mt-1 max-w-[120px] text-center text-[10px] font-medium text-orange">{error}</p>}
    </div>
  );
}
