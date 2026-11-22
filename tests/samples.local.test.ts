// @vitest-environment jsdom
// Runs the reader + parser on real scripts from the folder given in SAMPLES_DIR (skipped otherwise).
import { describe, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { readScript } from '../lib/script/read';
import { parseScript, speakersOf } from '../lib/script/parse';

const dir = process.env.SAMPLES_DIR;
const out = (s: string) => process.stdout.write(s + '\n');

describe.skipIf(!dir || !existsSync(dir))('real samples', () => {
  const names = dir && existsSync(dir) ? readdirSync(dir).filter((f) => !f.startsWith('.')) : [];
  for (const name of names) {
    it(name, async () => {
      const buf = readFileSync(join(dir!, name));
      const lines = await readScript(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), name);
      const p = parseScript(lines);
      out(`\n=== ${name}: ${lines.length} lines | recognized=${p.recognized} | title="${p.title}" | author="${p.author}"`);
      out(`speakers: ${JSON.stringify(speakersOf(p.speeches))} | speeches: ${p.speeches.length}`);
      for (const s of p.speeches.slice(0, Number(process.env.SHOW ?? 6))) out(`  [${s.speaker}] ${s.text.slice(0, 110)}`);
      if (process.env.SEQ) out('sequence: ' + p.speeches.map((s) => s.speaker[0]).join(''));
    }, 60000);
  }
});
