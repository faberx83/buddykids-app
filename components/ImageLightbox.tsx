"use client";

import { useEffect, useRef, useState } from "react";

// Visualizzatore foto a schermo intero stile "carosello" — nessuna libreria
// esterna: frecce prev/next, swipe touch, tastiera (frecce/Esc), puntini di
// posizione. Usato per aprire le foto di copertina/galleria di un'attività
// (prima restavano semplici anteprime non cliccabili).
export default function ImageLightbox({
  images,
  initialIndex = 0,
  onClose,
}: {
  images: string[];
  initialIndex?: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const touchStartX = useRef<number | null>(null);

  function goTo(i: number) {
    setIndex((i + images.length) % images.length);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goTo(index + 1);
      if (e.key === "ArrowLeft") goTo(index - 1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  if (images.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95"
      onClick={onClose}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const delta = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(delta) > 40) goTo(index + (delta < 0 ? 1 : -1));
        touchStartX.current = null;
      }}
    >
      <button
        onClick={onClose}
        aria-label="Chiudi"
        className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white"
      >
        <i className="ti ti-x text-lg" />
      </button>

      <div className="flex flex-1 items-center justify-center px-4" onClick={(e) => e.stopPropagation()}>
        {images.length > 1 && (
          <button
            onClick={() => goTo(index - 1)}
            aria-label="Foto precedente"
            className="absolute left-2 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-white sm:left-4"
          >
            <i className="ti ti-chevron-left text-xl" />
          </button>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage, non ottimizzabile senza config extra */}
        <img
          src={images[index]}
          alt=""
          className="max-h-[80vh] max-w-full rounded-md object-contain"
        />
        {images.length > 1 && (
          <button
            onClick={() => goTo(index + 1)}
            aria-label="Foto successiva"
            className="absolute right-2 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-white sm:right-4"
          >
            <i className="ti ti-chevron-right text-xl" />
          </button>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex justify-center gap-1.5 pb-6">
          {images.map((url, i) => (
            <button
              key={url}
              onClick={(e) => {
                e.stopPropagation();
                setIndex(i);
              }}
              aria-label={`Vai alla foto ${i + 1}`}
              className={`h-2 w-2 rounded-full transition-colors ${i === index ? "bg-white" : "bg-white/35"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
