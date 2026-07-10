"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const STAGE = 260; // dimensione (px) dell'area di ritaglio circolare mostrata
const OUTPUT = 480; // risoluzione (px) dell'immagine quadrata esportata

// Modale di ritaglio/centratura per foto profilo — nessuna libreria esterna:
// canvas + drag (pan) + slider (zoom). Mostra un cerchio guida (l'avatar è
// sempre circolare), esporta un JPEG quadrato via canvas.toBlob.
//
// "source" accetta sia un File appena scelto (upload nuovo) sia una stringa
// URL (richiesta da Fabrizio: poter ri-centrare/zoomare una foto GIA'
// caricata, non solo al momento dell'upload — vedi il pulsante "Ritaglia di
// nuovo" in AvatarUploadButton.tsx). Con un URL remoto serve crossOrigin
// "anonymous" sull'<img>, altrimenti canvas.toBlob fallisce per sicurezza
// (canvas "tainted") — funziona perché Supabase Storage pubblico invia già
// gli header CORS necessari.
export default function ImageCropModal({
  source,
  onCancel,
  onConfirm,
}: {
  source: File | string;
  onCancel: () => void;
  onConfirm: (croppedFile: File) => void;
}) {
  const isRemoteUrl = typeof source === "string";
  const objectUrl = useMemo(() => (isRemoteUrl ? source : URL.createObjectURL(source)), [source, isRemoteUrl]);
  const imgRef = useRef<HTMLImageElement>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (isRemoteUrl) return; // nessun object URL locale da rilasciare
    return () => URL.revokeObjectURL(objectUrl);
  }, [objectUrl, isRemoteUrl]);

  const baseScale = naturalSize ? Math.max(STAGE / naturalSize.w, STAGE / naturalSize.h) : 1;
  const scale = baseScale * zoom;
  const displayedW = naturalSize ? naturalSize.w * scale : STAGE;
  const displayedH = naturalSize ? naturalSize.h * scale : STAGE;

  function clamp(value: number, displayed: number) {
    const maxOffset = Math.max(0, (displayed - STAGE) / 2);
    return Math.min(maxOffset, Math.max(-maxOffset, value));
  }

  function handlePointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPos({
      x: clamp(dragRef.current.origX + dx, displayedW),
      y: clamp(dragRef.current.origY + dy, displayedH),
    });
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  function handleZoomChange(value: number) {
    setZoom(value);
    // Ricalcola i clamp col nuovo zoom per evitare bordi vuoti.
    const newDisplayedW = naturalSize ? naturalSize.w * baseScale * value : STAGE;
    const newDisplayedH = naturalSize ? naturalSize.h * baseScale * value : STAGE;
    setPos((p) => ({ x: clamp(p.x, newDisplayedW), y: clamp(p.y, newDisplayedH) }));
  }

  async function handleConfirm() {
    if (!naturalSize) return;
    setExporting(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT;
      canvas.height = OUTPUT;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Angolo in alto a sinistra dell'immagine (scalata) rispetto allo stage,
      // in px-stage; da qui deriviamo il rettangolo sorgente nell'immagine originale.
      const imgTopLeftX = STAGE / 2 - displayedW / 2 + pos.x;
      const imgTopLeftY = STAGE / 2 - displayedH / 2 + pos.y;
      const srcSize = STAGE / scale;
      const srcX = Math.min(
        Math.max(0, (0 - imgTopLeftX) / scale),
        naturalSize.w - srcSize
      );
      const srcY = Math.min(
        Math.max(0, (0 - imgTopLeftY) / scale),
        naturalSize.h - srcSize
      );

      const img = imgRef.current!;
      ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, OUTPUT, OUTPUT);

      canvas.toBlob(
        (blob) => {
          setExporting(false);
          if (!blob) return;
          const baseName = isRemoteUrl ? "avatar" : source.name.replace(/\.\w+$/, "");
          const croppedFile = new File([blob], `${baseName}-ritagliata.jpg`, {
            type: "image/jpeg",
          });
          onConfirm(croppedFile);
        },
        "image/jpeg",
        0.9
      );
    } catch {
      setExporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-4">
        <div className="mb-3 text-sm font-bold text-ink">Centra e ritaglia la foto</div>

        <div
          className="relative mx-auto touch-none overflow-hidden rounded-full bg-[#F0F2F5]"
          style={{ width: STAGE, height: STAGE }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- anteprima locale (object URL), non un'immagine remota da ottimizzare */}
          <img
            ref={imgRef}
            src={objectUrl}
            alt=""
            draggable={false}
            crossOrigin={isRemoteUrl ? "anonymous" : undefined}
            onLoad={(e) => {
              const el = e.currentTarget;
              setNaturalSize({ w: el.naturalWidth, h: el.naturalHeight });
            }}
            className="pointer-events-none absolute select-none"
            style={{
              width: displayedW,
              height: displayedH,
              left: STAGE / 2 - displayedW / 2 + pos.x,
              top: STAGE / 2 - displayedH / 2 + pos.y,
            }}
          />
        </div>

        <div className="mt-4 flex items-center gap-2">
          <i className="ti ti-zoom-out text-ink-2" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => handleZoomChange(Number(e.target.value))}
            className="flex-1 accent-sky"
          />
          <i className="ti ti-zoom-in text-ink-2" />
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-md border border-[#E8EBF0] py-2.5 text-sm font-semibold text-ink"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!naturalSize || exporting}
            className="flex-1 rounded-md bg-sky py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {exporting ? "Salvo…" : "Usa questa foto"}
          </button>
        </div>
      </div>
    </div>
  );
}
