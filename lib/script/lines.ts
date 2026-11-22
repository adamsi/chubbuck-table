import type { RawLine, Run } from './types';

// Invisible direction marks that PDF and Word files are full of.
const MARKS = /[​-‏‪-‮⁦-⁩﻿]/g;

/** Removes direction marks, turns odd spaces into plain ones and collapses whitespace. */
export function clean(s: string): string {
  return s
    .replace(MARKS, '')
    .replace(/[   ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const visible = (s: string) => s.replace(/[\s​-‏‪-‮⁦-⁩﻿]/g, '').length;

/** Builds a line from styled runs; returns null for an empty line. */
export function makeLine(runs: Run[], extra: Partial<RawLine> = {}): RawLine | null {
  const text = clean(runs.map((r) => r.text).join(''));
  if (!text) return null;
  const total = runs.reduce((n, r) => n + visible(r.text), 0);
  const boldChars = runs.reduce((n, r) => n + (r.bold ? visible(r.text) : 0), 0);
  const bold = total > 0 && boldChars / total >= 0.8;

  let boldPrefix = '';
  if (!bold) {
    let lead = '';
    for (const r of runs) {
      if (r.bold || !visible(r.text)) lead += r.text;
      else break;
    }
    boldPrefix = clean(lead);
  }
  return { text, bold, boldPrefix, ...extra };
}

/** Plain text: `**bold**` marks become bold runs (Markdown and hand-typed scripts). */
export function textToLines(text: string): RawLine[] {
  const out: RawLine[] = [];
  for (const raw of text.split(/\r?\n|\r/)) {
    const runs: Run[] = [];
    raw
      .replace(/^\s*#{1,6}\s+/, '')
      .split(/(\*\*[^*]+\*\*|__[^_]+__)/)
      .forEach((part) => {
        const m = part.match(/^(\*\*|__)(.+)\1$/);
        if (m) runs.push({ text: m[2], bold: true });
        else if (part) runs.push({ text: part, bold: false });
      });
    const line = makeLine(runs);
    if (line) out.push(line);
  }
  return out;
}
