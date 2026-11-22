// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { readScript } from '../lib/script/read';
import { parseScript, speakersOf } from '../lib/script/parse';
import { ReadError } from '../lib/script/types';

const dir = join(__dirname, 'fixtures');
const SCENE: [string, string][] = JSON.parse(readFileSync(join(dir, 'scene.json'), 'utf8'));

async function parse(name: string) {
  const buf = readFileSync(join(dir, name));
  const data = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return parseScript(await readScript(data, name));
}

// The same made-up scene, written down in every convention and file type.
const CONVENTIONS: [string, string, string?][] = [
  ['bold names on their own line (Word)', 'bold-own-line.docx', 'נועה לוי'],
  ['bold names on their own line (OpenDocument)', 'bold-own-line.odt', 'נועה לוי'],
  ['bold names on their own line (RTF)', 'bold-own-line.rtf', 'נועה לוי'],
  ['bold names on their own line (HTML)', 'bold-own-line.html', 'נועה לוי'],
  ['bold names on their own line (PDF)', 'bold-own-line.pdf', 'נועה לוי'],
  ['bold name and text in one paragraph (Word)', 'bold-prefix.docx', 'נועה לוי'],
  ['NAME: text (plain text)', 'colon.txt', 'נועה לוי'],
  ['NAME - text (plain text)', 'dash.txt'],
  ['name alone on its line, no formatting', 'plain-own-line.txt'],
  ['NAME: then the text on the next line', 'inline-wrapped.txt'],
];

describe('speaker detection', () => {
  for (const [label, file, author] of CONVENTIONS) {
    it(label, async () => {
      const p = await parse(file);
      expect(p.recognized).toBe(true);
      expect(speakersOf(p.speeches)).toEqual(['דנה', 'יוסי', 'מיכל']);
      expect(p.speeches.map((s) => s.speaker)).toEqual(SCENE.map(([n]) => n));
      // Every speech keeps its text, including the stage directions in parentheses.
      p.speeches.forEach((s, i) => expect(s.text).toBe(SCENE[i][1]));
      expect(p.title).toBe('קפה של בוקר');
      if (author) expect(p.author).toBe(author);
    });
  }

  it('English names in capitals, without mistaking a scene heading for a character', async () => {
    const p = await parse('english-caps.txt');
    expect(p.recognized).toBe(true);
    expect(speakersOf(p.speeches)).toEqual(['DANA', 'JOE', 'MIKE']);
    expect(p.speeches).toHaveLength(10);
    expect(p.speeches[2].text).toBe('(puts down the cup) On silent? I waited all night.');
    expect(p.title).toBe('MORNING COFFEE');
  });

  it('falls back to one speech per line when no speakers can be found', async () => {
    const p = await parse('no-speakers.txt');
    expect(p.recognized).toBe(false);
    expect(p.speeches.length).toBeGreaterThanOrEqual(3);
    expect(p.speeches.every((s) => s.speaker === '')).toBe(true);
  });

  it('keeps a character who speaks only once when names are marked by a clear style', async () => {
    const lines = [
      { text: 'כותרת', bold: true, boldPrefix: '' },
      ...['דנה', 'יוסי', 'דנה', 'יוסי', 'שוטר', 'דנה'].flatMap((n) => [
        { text: n, bold: true, boldPrefix: '' },
        { text: `דברים של ${n} כאן.`, bold: false, boldPrefix: '' },
      ]),
    ];
    const p = parseScript(lines);
    expect(speakersOf(p.speeches)).toEqual(['דנה', 'יוסי', 'שוטר']);
    expect(p.title).toBe('כותרת');
  });

  it('puts a stage direction on its own line inside the preceding speech', () => {
    const p = parseScript(
      ['דנה: שלום', 'יוסי: היי', 'דנה: מה נשמע', '(היא יושבת)', 'יוסי: טוב'].map((text) => ({ text, bold: false, boldPrefix: '' }))
    );
    expect(p.speeches.map((s) => s.text)).toEqual(['שלום', 'היי', 'מה נשמע (היא יושבת)', 'טוב']);
  });

  it('reads a name followed by a direction: "דנה (בכעס): שלום"', () => {
    const p = parseScript(
      ['דנה (בכעס): שלום', 'יוסי: היי', 'דנה: מה', 'יוסי: כלום', 'דנה (בשקט): טוב'].map((text) => ({ text, bold: false, boldPrefix: '' }))
    );
    expect(speakersOf(p.speeches)).toEqual(['דנה', 'יוסי']);
    expect(p.speeches[0].text).toBe('(בכעס) שלום');
  });
});

describe('reading files', () => {
  it('rejects old binary Word files and pictures with a clear reason', async () => {
    const doc = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0]).buffer;
    await expect(readScript(doc, 'old.doc')).rejects.toMatchObject({ code: 'old_doc' });
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]).buffer;
    await expect(readScript(png, 'scan.png')).rejects.toMatchObject({ code: 'image' });
    await expect(readScript(new ArrayBuffer(0), 'empty.txt')).rejects.toBeInstanceOf(ReadError);
  });

  it('decodes old Windows-1255 Hebrew text files', async () => {
    // "שלום" in Windows-1255
    const bytes = new Uint8Array([0xf9, 0xec, 0xe5, 0xed, 0x0a]);
    const lines = await readScript(bytes.buffer, 'old.txt');
    expect(lines[0].text).toBe('שלום');
  });
});
