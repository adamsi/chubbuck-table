import { makeLine } from './lines';
import type { RawLine, Run } from './types';

/**
 * Rich Text Format (.rtf): a small reader for text, paragraphs, line breaks and bold.
 * Hebrew in RTF is stored as \'hh bytes in code page 1255 or as \uN escapes; both are decoded.
 */
export function readRtf(source: string): RawLine[] {
  const out: RawLine[] = [];
  let runs: Run[] = [];
  let buf = '';
  let bold = false;
  const decoder = new TextDecoder('windows-1255');
  // Groups whose content is not text (fonts, colors, styles, pictures, ...).
  const skipWords = new Set(['fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'header', 'footer', 'footnote', 'themedata', 'colorschememapping', 'latentstyles', 'datastore', 'listtable', 'listoverridetable', 'rsidtbl', 'generator', 'xmlnstbl']);
  const stack: { bold: boolean; skip: boolean }[] = [];
  let skip = false;
  let pendingBytes: number[] = [];
  let ucSkip = 1;
  let skipChars = 0;

  const flushBytes = () => {
    if (pendingBytes.length) {
      buf += decoder.decode(new Uint8Array(pendingBytes));
      pendingBytes = [];
    }
  };
  const pushText = () => {
    flushBytes();
    if (buf) runs.push({ text: buf, bold });
    buf = '';
  };
  const endLine = () => {
    pushText();
    const line = makeLine(runs);
    if (line) out.push(line);
    runs = [];
  };

  let i = 0;
  while (i < source.length) {
    const c = source[i];
    if (skipChars > 0 && c !== '\\' && c !== '{' && c !== '}') {
      skipChars--;
      i++;
      continue;
    }
    if (c === '{') {
      pushText();
      stack.push({ bold, skip });
      i++;
      // {\*\destination ...} groups are optional content: skip them.
      if (source.startsWith('\\*', i)) skip = true;
    } else if (c === '}') {
      pushText();
      const s = stack.pop();
      if (s) {
        bold = s.bold;
        skip = s.skip;
      }
      i++;
    } else if (c === '\\') {
      const next = source[i + 1];
      if (next === "'") {
        const hex = source.slice(i + 2, i + 4);
        // The fallback character that follows a \uN escape may itself be written as \'hh: skip it.
        if (skipChars > 0) skipChars--;
        else if (!skip) pendingBytes.push(parseInt(hex, 16));
        i += 4;
      } else if (next === '\\' || next === '{' || next === '}') {
        if (!skip) {
          flushBytes();
          buf += next;
        }
        i += 2;
      } else if (next === '~') {
        if (!skip) buf += ' ';
        i += 2;
      } else if (next === '\n' || next === '\r') {
        if (!skip) endLine();
        i += 2;
      } else {
        const m = /^\\([a-zA-Z]+)(-?\d+)? ?/.exec(source.slice(i, i + 40));
        if (!m) {
          i += 2;
          continue;
        }
        const word = m[1];
        const num = m[2] !== undefined ? Number(m[2]) : undefined;
        i += m[0].length;
        if (skipWords.has(word)) skip = true;
        if (skip) continue;
        if (word === 'par' || word === 'line' || word === 'sect' || word === 'page') endLine();
        else if (word === 'tab') buf += ' ';
        else if (word === 'b') {
          pushText();
          bold = num !== 0;
        } else if (word === 'plain') {
          pushText();
          bold = false;
        } else if (word === 'uc' && num !== undefined) ucSkip = num;
        else if (word === 'u' && num !== undefined) {
          flushBytes();
          buf += String.fromCharCode(num < 0 ? num + 65536 : num);
          skipChars = ucSkip;
        }
      }
    } else if (c === '\r' || c === '\n') {
      i++;
    } else {
      if (!skip) {
        flushBytes();
        buf += c;
      }
      i++;
    }
  }
  endLine();
  return out;
}
