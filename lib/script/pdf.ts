import { bracketVotes, hasRtl, visualToLogicalRtl } from './bidi';
import { faithful, plain } from './lines';
import { ReadError, type RawLine } from './types';

export interface Item {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
  font: string;
}

interface PdfLine {
  y: number;
  text: string;
  font: string;
  centered: boolean;
  page: number;
  /** distance of the line from the top (0) / bottom (1) of its page */
  vpos: number;
}


const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

const isFiller = (i: Item) => !i.str.trim() && i.w > i.h * 0.8;

/** The pieces of a line, left to right as drawn, with a space wherever there is a gap between two pieces. */
function visualPieces(items: Item[]): string[] {
  const sorted = items.filter((i) => !isFiller(i)).sort((a, b) => a.x - b.x);
  const out: string[] = [];
  sorted.forEach((it, k) => {
    const prev = sorted[k - 1];
    if (prev && prev.str.trim() && it.str.trim() && !/\s$/.test(prev.str) && !/^\s/.test(it.str)) {
      const gap = it.x - (prev.x + prev.w);
      const charW = Math.max(prev.w / Math.max(1, prev.str.length), it.w / Math.max(1, it.str.length)) || 4;
      if (gap > 0.2 * charW) out.push(' ');
    }
    out.push(it.str);
  });
  return out;
}

const isRtlLine = (items: Item[]) => {
  const text = items.map((i) => i.str).join('');
  return (text.match(/[\u0590-\u08ff]/g)?.length ?? 0) >= (text.match(/[A-Za-z]/g)?.length ?? 0) && hasRtl(text);
};

/**
 * The line in the order the pieces are written in the file, with a space wherever there is a gap
 * between two pieces. Pieces that are only a space are kept, unless they are very wide: those are
 * layout fillers that some programs (Google Docs) put in to push a punctuation mark to the other end
 * of the line, and they are not part of the text.
 */
export function joinStream(items: Item[]): string {
  const text = items.map((i) => i.str).join('');
  const rtl = (text.match(/[\u0590-\u08ff]/g)?.length ?? 0) >= (text.match(/[A-Za-z]/g)?.length ?? 0);
  let out = '';
  let prev: Item | null = null;
  for (const it of items) {
    if (!it.str.trim()) {
      if (!isFiller(it)) out += it.str;
      continue;
    }
    if (prev && !out.endsWith(' ') && !it.str.startsWith(' ')) {
      const gap = rtl ? prev.x - (it.x + it.w) : it.x - (prev.x + prev.w);
      const charW = it.w / Math.max(1, it.str.length) || 4;
      if (gap > 0.2 * charW) out += ' ';
    }
    out += it.str;
    prev = it;
  }
  return out;
}

/**
 * The line rebuilt from where its pieces are drawn (see bidi.ts), for programs that write the pieces
 * in another order than they draw them, e.g. a punctuation mark before the word it follows.
 * `mirror`: brackets are stored as drawn (decided for the whole document, see bracketsStoredAsDrawn).
 */
export function joinVisual(items: Item[], mirror: boolean): string {
  return isRtlLine(items) ? visualToLogicalRtl(visualPieces(items), mirror).join('') : joinStream(items);
}

/** For a whole document: are the brackets of its right-to-left lines stored as drawn? */
export function bracketsStoredAsDrawn(lines: Item[][]): boolean {
  let votes = 0;
  for (const items of lines) if (isRtlLine(items)) votes += bracketVotes(visualPieces(items));
  return votes >= 0;
}

/**
 * How odd is the punctuation of a line? Counts what ordinary text does not have: a sentence mark at the
 * start of the line, a space before a comma / full stop / question mark, an unbalanced bracket.
 * A wrongly ordered line scores high; correct text scores 0 or close to it.
 */
export function oddity(text: string): number {
  const t = text.trim();
  let n = /^[.,;:?!%)\]}»]/.test(t) && !/^\.{2,}/.test(t) ? 1 : 0;
  n += (t.match(/\s[.,;:?!](?!\.)/g) ?? []).length;
  const depth: Record<string, number> = { ')': 0, ']': 0, '}': 0 };
  const pair: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  for (const ch of t) {
    if (ch in pair) depth[pair[ch]]++;
    else if (ch in depth) {
      if (depth[ch] > 0) depth[ch]--;
      else n++;
    }
  }
  return n + Object.values(depth).reduce((a, b) => a + b, 0);
}

/**
 * Which way to read this document: in the order written, or from where the pieces are drawn. Programs
 * differ, and each one is consistent, so the whole document is decided at once: the way that leaves the
 * punctuation less odd wins (the order written, if it is a tie).
 */
export function chooseOrder(lines: Item[][], mirror: boolean): 'stream' | 'visual' {
  let stream = 0;
  let visual = 0;
  for (const items of lines) {
    stream += oddity(joinStream(items));
    visual += oddity(joinVisual(items, mirror));
  }
  return visual < stream ? 'visual' : 'stream';
}

/** PDF with a text layer. Scanned PDFs (pictures of pages) have none and cannot be read. */
export async function readPdf(data: ArrayBuffer): Promise<RawLine[]> {
  const { getDocumentProxy } = await import('unpdf');
  let pdf;
  try {
    pdf = await getDocumentProxy(new Uint8Array(data.slice(0)));
  } catch (e) {
    console.error('Could not open the PDF', e);
    throw new ReadError('broken');
  }

  const pages: { page: number; x0: number; pageW: number; pageH: number; y0: number; groups: { y: number; items: Item[] }[] }[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const [x0, y0, x1, y1] = page.view;
    const pageW = x1 - x0;
    const pageH = y1 - y0;
    const content = await page.getTextContent();

    // Group pieces into visual lines by their vertical position.
    const groups: { y: number; items: Item[] }[] = [];
    for (const raw of content.items) {
      if (!('str' in raw) || !raw.str) continue;
      const item: Item = { str: raw.str, x: raw.transform[4], y: raw.transform[5], w: raw.width, h: raw.height || Math.abs(raw.transform[3]) || 10, font: raw.fontName };
      const tol = Math.max(2, item.h * 0.4);
      const group = groups.find((g) => Math.abs(g.y - item.y) <= tol);
      if (group) group.items.push(item);
      else groups.push({ y: item.y, items: [item] });
    }

    pages.push({ page: p, x0, y0, pageW, pageH, groups });
  }

  const allLines = pages.flatMap((pg) => pg.groups.map((g) => g.items));
  const mirror = bracketsStoredAsDrawn(allLines);
  const order = chooseOrder(allLines, mirror);
  const lines: PdfLine[] = [];
  for (const { page: p, x0, y0, pageW, pageH, groups } of pages) {
    for (const g of groups) {
      const text = faithful(order === 'visual' ? joinVisual(g.items, mirror) : joinStream(g.items));
      if (!plain(text)) continue;
      const solid = g.items.filter((i) => i.str.trim());
      const chars = new Map<string, number>();
      for (const i of solid) chars.set(i.font, (chars.get(i.font) ?? 0) + i.str.length);
      const font = [...chars].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
      const left = Math.min(...solid.map((i) => i.x));
      const right = Math.max(...solid.map((i) => i.x + i.w));
      const centered = Math.abs((left + right) / 2 - (x0 + pageW / 2)) < pageW * 0.04 && right - left < pageW * 0.8;
      lines.push({ y: g.y, text, font, centered, page: p, vpos: 1 - (g.y - y0) / pageH });
    }
  }

  // Top to bottom on every page.
  lines.sort((a, b) => a.page - b.page || b.y - a.y);

  // Drop page numbers, headers and footers: short lines in the top / bottom margin that are only
  // digits ("3", "3/10", "עמוד 3") or that repeat on other pages.
  const normalize = (t: string) => t.replace(/\d+/g, '#').toLowerCase();
  const seenOn = new Map<string, Set<number>>();
  for (const l of lines) {
    if (l.vpos < 0.08 || l.vpos > 0.92) {
      const k = normalize(l.text);
      if (!seenOn.has(k)) seenOn.set(k, new Set());
      seenOn.get(k)!.add(l.page);
    }
  }
  const kept = lines.filter((l) => {
    if (l.vpos >= 0.08 && l.vpos <= 0.92) return true;
    if (/^(\D{0,8})?\d{1,4}(\s*[\/-]\s*\d{1,4})?$/.test(l.text)) return false;
    return (seenOn.get(normalize(l.text))?.size ?? 0) < 2;
  });

  return kept.map((l) => ({ text: l.text, bold: false, boldPrefix: '', font: l.font, centered: l.centered }));
}

