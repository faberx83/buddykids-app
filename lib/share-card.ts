// Genera l'immagine "cartolina" di riepilogo prenotazione da condividere
// (WhatsApp, Note, ecc.) invece di un semplice testo — disegnata a mano su
// <canvas>, senza dipendenze esterne (niente html2canvas/jsPDF). Solo lato
// client: usa l'API Canvas del browser.

export interface ShareCardInfo {
  activityName: string;
  kidNames: string;
  weeksLabel: string;
}

const WIDTH = 900;
const HEIGHT = 1000;

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const words = text.split(" ");
  let line = "";
  let cursorY = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cursorY);
      line = word;
      cursorY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.fillText(line, x, cursorY);
    cursorY += lineHeight;
  }
  return cursorY;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function buildShareCardPng(info: ShareCardInfo): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Sfondo con il gradiente di brand usato nell'header della Home.
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, "#E8F6FD");
  bg.addColorStop(1, "#E3F9F5");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Card bianca centrale.
  const cardX = 60;
  const cardY = 140;
  const cardW = WIDTH - cardX * 2;
  const cardH = 720;
  ctx.fillStyle = "rgba(0,0,0,0.06)";
  roundRect(ctx, cardX, cardY + 10, cardW, cardH, 28);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, cardX, cardY, cardW, cardH, 28);
  ctx.fill();

  // Badge emoji di conferma.
  ctx.fillStyle = "#E3F9F5";
  ctx.beginPath();
  ctx.arc(WIDTH / 2, cardY + 90, 64, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = "56px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("✅", WIDTH / 2, cardY + 108);

  // Titolo.
  ctx.fillStyle = "#12202E";
  ctx.font = "bold 40px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Prenotazione confermata!", WIDTH / 2, cardY + 195);

  // Nome attività.
  ctx.fillStyle = "#3B82C4";
  ctx.font = "bold 32px sans-serif";
  let cursorY = cardY + 260;
  ctx.textAlign = "left";
  cursorY = wrapText(ctx, info.activityName, cardX + 50, cursorY, cardW - 100, 42);

  cursorY += 20;

  // Righe di dettaglio.
  const rows: [string, string][] = [
    ["Bambino/i", info.kidNames],
    ["Settimane", info.weeksLabel],
  ];
  for (const [label, value] of rows) {
    ctx.fillStyle = "#6B7A8D";
    ctx.font = "24px sans-serif";
    ctx.fillText(label, cardX + 50, cursorY);
    cursorY += 34;
    ctx.fillStyle = "#12202E";
    ctx.font = "bold 28px sans-serif";
    cursorY = wrapText(ctx, value, cardX + 50, cursorY, cardW - 100, 36);
    cursorY += 26;
  }

  // Footer brand.
  ctx.textAlign = "center";
  ctx.fillStyle = "#9AA7B4";
  ctx.font = "22px sans-serif";
  ctx.fillText("Prenotato su TRAMA 🏕️", WIDTH / 2, cardY + cardH - 40);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}
