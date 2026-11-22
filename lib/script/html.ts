import { makeLine } from './lines';
import type { RawLine, Run } from './types';

const BLOCKS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TR', 'BLOCKQUOTE', 'SECTION', 'ARTICLE', 'PRE', 'TABLE', 'UL', 'OL', 'TD', 'TH', 'CENTER', 'HEADER', 'FOOTER']);
const SKIP = new Set(['SCRIPT', 'STYLE', 'HEAD', 'TITLE', 'META', 'LINK']);

function isBold(el: HTMLElement): boolean {
  if (el.tagName === 'B' || el.tagName === 'STRONG' || /^H[1-6]$/.test(el.tagName)) return true;
  const w = el.style?.fontWeight;
  return w === 'bold' || w === 'bolder' || (!!w && Number(w) >= 600);
}

const isCentered = (el: HTMLElement) => el.tagName === 'CENTER' || el.style?.textAlign === 'center' || el.getAttribute('align') === 'center';

/** Reads HTML (also what Word files are converted to): one line per block element and per <br>. */
export function htmlToLines(html: string): RawLine[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out: RawLine[] = [];
  let runs: Run[] = [];
  let centered = false;

  const flush = () => {
    const line = makeLine(runs, { centered });
    if (line) out.push(line);
    runs = [];
  };

  const walk = (node: Node, bold: boolean) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.nodeValue ?? '';
      if (text) runs.push({ text, bold });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    if (SKIP.has(el.tagName)) return;
    if (el.tagName === 'BR') {
      flush();
      return;
    }
    const block = BLOCKS.has(el.tagName);
    const outerCentered = centered;
    if (block) {
      flush();
      centered = isCentered(el) || (el.tagName !== 'DIV' && outerCentered);
    }
    const b = bold || isBold(el);
    el.childNodes.forEach((child) => walk(child, b));
    if (block) {
      flush();
      centered = outerCentered;
    }
  };

  walk(doc.body, false);
  flush();
  return out;
}
