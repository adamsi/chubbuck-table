// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { readScript } from '../lib/script/read';
import { parseScript } from '../lib/script/parse';

const dir = join(__dirname, 'fixtures');
const { tricky, spaces }: { tricky: [string, string][]; spaces: [string, string][] } = JSON.parse(readFileSync(join(dir, 'tricky.json'), 'utf8'));

async function parse(name: string) {
  const buf = readFileSync(join(dir, name));
  return parseScript(await readScript(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), name));
}

// The text of every speech must come out exactly as it was written:
// spacing, punctuation, quotation marks, brackets, English words and numbers.
describe('the text is not changed', () => {
  for (const file of ['tricky.docx', 'tricky.odt', 'tricky.rtf', 'tricky.html', 'tricky.pdf', 'tricky.txt']) {
    it(`punctuation and spacing in ${file}`, async () => {
      const p = await parse(file);
      expect(p.recognized).toBe(true);
      expect(p.speeches.map((s) => s.speaker)).toEqual(tricky.map(([n]) => n));
      expect(p.speeches.map((s) => s.text)).toEqual(tricky.map(([, t]) => t));
    });
  }

  for (const file of ['spaces.docx', 'spaces.txt']) {
    it(`repeated spaces and a space before punctuation in ${file}`, async () => {
      const p = await parse(file);
      expect(p.speeches.map((s) => s.text)).toEqual(spaces.map(([, t]) => t));
    });
  }
});
