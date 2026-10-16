// Parser minimo dei testi legali (vedi components/LegalDocumentView.tsx). Logica pura.

export type LegalBlock =
  | { kind: "h1" | "h2" | "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "table"; rows: string[][] };

export function parseLegalText(source: string): LegalBlock[] {
  const blocks: LegalBlock[] = [];
  const lines = source.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i += 1;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push({ kind: "h2", text: line.slice(3) });
      i += 1;
    } else if (line.startsWith("# ")) {
      blocks.push({ kind: "h1", text: line.slice(2) });
      i += 1;
    } else if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("- ")) {
        items.push(lines[i].trim().slice(2));
        i += 1;
      }
      blocks.push({ kind: "ul", items });
    } else if (line.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const cells = lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (!cells.every((c) => /^-+$/.test(c))) rows.push(cells);
        i += 1;
      }
      blocks.push({ kind: "table", rows });
    } else {
      const para: string[] = [];
      while (i < lines.length && lines[i].trim() && !/^(#|- |\|)/.test(lines[i].trim())) {
        para.push(lines[i].trim());
        i += 1;
      }
      blocks.push({ kind: "p", text: para.join(" ") });
    }
  }
  return blocks;
}
