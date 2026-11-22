import { readDocx } from './docx';
import { htmlToLines } from './html';
import { textToLines } from './lines';
import { readOdt } from './odt';
import { readPdf } from './pdf';
import { readRtf } from './rtf';
import { ReadError, type RawLine } from './types';

const ext = (name: string) => name.toLowerCase().split('.').pop() ?? '';
const startsWith = (bytes: Uint8Array, ascii: string) => ascii.split('').every((c, i) => bytes[i] === c.charCodeAt(0));

/** Decodes text files: UTF-8 (also with a BOM), UTF-16, or Windows-1255 for old Hebrew files. */
function decodeText(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1255').decode(bytes);
  }
}

/** Reads any supported file into lines. The file type is taken from its content, then its name. */
export async function readScript(data: ArrayBuffer, name: string): Promise<RawLine[]> {
  const bytes = new Uint8Array(data.slice(0, 8));
  const e = ext(name);
  let lines: RawLine[];

  if (startsWith(bytes, '%PDF')) lines = await readPdf(data);
  else if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11) throw new ReadError('old_doc');
  else if (startsWith(bytes, 'PK')) {
    // A zip: Word, OpenDocument, ...
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(data).catch(() => null);
    if (zip?.file('word/document.xml')) lines = await readDocx(data);
    else if (zip?.file('content.xml')) lines = await readOdt(data);
    else throw new ReadError('unsupported');
  } else if (startsWith(bytes, '{\\rtf')) lines = readRtf(decodeText(data));
  else if (startsWith(bytes, '\x89PNG') || (bytes[0] === 0xff && bytes[1] === 0xd8) || startsWith(bytes, 'GIF8') || startsWith(bytes, 'RIFF')) throw new ReadError('image');
  else if (['txt', 'md', 'markdown', 'text', 'html', 'htm', 'xhtml', 'rtf', 'csv', 'fountain', ''].includes(e) || e === 'srt') {
    const text = decodeText(data);
    lines = /\.(html?|xhtml)$/i.test(name) || /^\s*<(!doctype|html|body|p|div)/i.test(text) ? htmlToLines(text) : textToLines(text);
  } else if (['pdf', 'docx', 'odt'].includes(e)) throw new ReadError('broken');
  else if (['doc', 'wps', 'pages'].includes(e)) throw new ReadError('old_doc');
  else if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'bmp', 'tif', 'tiff'].includes(e)) throw new ReadError('image');
  else {
    // Unknown extension: try it as text.
    lines = textToLines(decodeText(data));
  }

  if (!lines.length) throw new ReadError('empty');
  return lines;
}
