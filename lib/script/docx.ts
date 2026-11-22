import mammoth from 'mammoth';
import { htmlToLines } from './html';
import { ReadError, type RawLine } from './types';

/** Word (.docx): converted to HTML first, which keeps bold, paragraphs and line breaks. */
export async function readDocx(data: ArrayBuffer): Promise<RawLine[]> {
  try {
    // The browser build of mammoth reads `arrayBuffer`, the Node build (used in tests) reads `buffer`.
    const input: { arrayBuffer: ArrayBuffer; buffer?: Buffer } = { arrayBuffer: data };
    if (typeof Buffer !== 'undefined') input.buffer = Buffer.from(data);
    const { value } = await mammoth.convertToHtml(input as never);
    return htmlToLines(value);
  } catch (e) {
    console.error('Could not read the Word file', e);
    throw new ReadError('broken');
  }
}
