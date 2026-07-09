"use client";

import { useRef, useState } from "react";
import { uploadImage } from "@/lib/storage";

// Copertina (sfondo scheda attività, sostituisce il gradiente decorativo) +
// galleria foto — usato dal form di modifica attività del Gestore centro.
export default function CoverAndGalleryUploader({
  folder,
  coverUrl,
  galleryUrls,
  onCoverChange,
  onGalleryChange,
}: {
  folder: string;
  coverUrl: string | null;
  galleryUrls: string[];
  onCoverChange: (url: string | null) => void;
  onGalleryChange: (urls: string[]) => void;
}) {
  const coverInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCoverFile(file: File) {
    setError(null);
    setUploadingCover(true);
    const result = await uploadImage(folder, file);
    setUploadingCover(false);
    if (result.error || !result.url) {
      setError(result.error || "Errore nel caricamento");
      return;
    }
    onCoverChange(result.url);
  }

  async function handleGalleryFiles(files: FileList) {
    setError(null);
    setUploadingGallery(true);
    const uploaded: string[] = [];
    for (const file of Array.from(files)) {
      const result = await uploadImage(folder, file);
      if (result.url) uploaded.push(result.url);
      else if (result.error) setError(result.error);
    }
    setUploadingGallery(false);
    if (uploaded.length > 0) onGalleryChange([...galleryUrls, ...uploaded]);
  }

  function removeGalleryImage(url: string) {
    onGalleryChange(galleryUrls.filter((u) => u !== url));
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 text-xs font-semibold text-ink-2">
          Copertina — mostrata al posto dello sfondo colorato nella scheda
        </div>
        <div
          className="relative flex h-32 w-full items-center justify-center overflow-hidden rounded-md border border-dashed border-[#D8DEE8] bg-bg"
          style={coverUrl ? { backgroundImage: `url(${coverUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
        >
          {!coverUrl && <span className="text-xs text-ink-3">Nessuna copertina caricata</span>}
          <div className="absolute bottom-2 right-2 flex gap-1.5">
            {coverUrl && (
              <button
                type="button"
                onClick={() => onCoverChange(null)}
                className="rounded-md bg-white/90 px-2.5 py-1.5 text-[11px] font-semibold text-orange shadow-sm"
              >
                Rimuovi
              </button>
            )}
            <button
              type="button"
              disabled={uploadingCover}
              onClick={() => coverInputRef.current?.click()}
              className="rounded-md bg-white/90 px-2.5 py-1.5 text-[11px] font-semibold text-ink shadow-sm disabled:opacity-60"
            >
              {uploadingCover ? "Carico…" : coverUrl ? "Cambia" : "Carica"}
            </button>
          </div>
        </div>
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleCoverFile(file);
            e.target.value = "";
          }}
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-semibold text-ink-2">
            Galleria ({galleryUrls.length} foto)
          </span>
          <button
            type="button"
            disabled={uploadingGallery}
            onClick={() => galleryInputRef.current?.click()}
            className="rounded-md bg-sky-light px-2.5 py-1.5 text-[11px] font-semibold text-sky disabled:opacity-60"
          >
            {uploadingGallery ? "Carico…" : "+ Aggiungi foto"}
          </button>
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) handleGalleryFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
        {galleryUrls.length > 0 ? (
          <div className="grid grid-cols-4 gap-2">
            {galleryUrls.map((url) => (
              <div key={url} className="group relative aspect-square overflow-hidden rounded-md bg-bg">
                {/* eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage, non ottimizzabile senza config extra */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeGalleryImage(url)}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"
                >
                  <i className="ti ti-x text-[11px]" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-ink-2">Nessuna foto in galleria.</p>
        )}
      </div>

      {error && <p className="text-xs font-medium text-orange">{error}</p>}
    </div>
  );
}
