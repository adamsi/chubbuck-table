import JSZip from 'jszip';
import { makeLine } from './lines';
import { ReadError, type RawLine, type Run } from './types';

const NS = {
  text: 'urn:oasis:names:tc:opendocument:xmlns:text:1.0',
  style: 'urn:oasis:names:tc:opendocument:xmlns:style:1.0',
  fo: 'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0',
};

/** OpenDocument text (.odt, also LibreOffice / Google Docs exports). */
export async function readOdt(data: ArrayBuffer): Promise<RawLine[]> {
  let xml: string;
  try {
    const zip = await JSZip.loadAsync(data);
    xml = (await zip.file('content.xml')?.async('string')) ?? '';
  } catch (e) {
    console.error('Could not read the OpenDocument file', e);
    throw new ReadError('broken');
  }
  if (!xml) throw new ReadError('broken');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');

  // Styles that make text bold, and paragraph styles that center it.
  const boldStyles = new Set<string>();
  const centerStyles = new Set<string>();
  for (const s of Array.from(doc.getElementsByTagNameNS(NS.style, 'style'))) {
    const name = s.getAttributeNS(NS.style, 'name');
    if (!name) continue;
    const tp = s.getElementsByTagNameNS(NS.style, 'text-properties')[0];
    const w = tp?.getAttributeNS(NS.fo, 'font-weight');
    if (w === 'bold' || (w && Number(w) >= 600)) boldStyles.add(name);
    const pp = s.getElementsByTagNameNS(NS.style, 'paragraph-properties')[0];
    if (pp?.getAttributeNS(NS.fo, 'text-align') === 'center') centerStyles.add(name);
  }

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
      if (node.nodeValue) runs.push({ text: node.nodeValue, bold });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    if (el.namespaceURI !== NS.text) {
      el.childNodes.forEach((c) => walk(c, bold));
      return;
    }
    switch (el.localName) {
      case 'line-break':
        flush();
        return;
      case 's':
        runs.push({ text: ' '.repeat(Number(el.getAttributeNS(NS.text, 'c') || 1)), bold });
        return;
      case 'tab':
        runs.push({ text: ' ', bold });
        return;
      case 'p':
      case 'h': {
        flush();
        const style = el.getAttributeNS(NS.text, 'style-name') || '';
        centered = centerStyles.has(style);
        el.childNodes.forEach((c) => walk(c, bold || boldStyles.has(style)));
        flush();
        return;
      }
      case 'span':
        el.childNodes.forEach((c) => walk(c, bold || boldStyles.has(el.getAttributeNS(NS.text, 'style-name') || '')));
        return;
      default:
        el.childNodes.forEach((c) => walk(c, bold));
    }
  };

  const body = doc.getElementsByTagNameNS('urn:oasis:names:tc:opendocument:xmlns:office:1.0', 'text')[0];
  if (body) walk(body, false);
  flush();
  return out;
}
