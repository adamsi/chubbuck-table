import type { RawLine, Run } from './types';

// Invisible direction marks that PDF and Word files are full of.
const MARKS = /[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;

/**
 * The text of a line exactly as written: spacing, punctuation and direction marks are kept.
 * Only line breaks and tabs become spaces, odd spaces (no-break, ...) become plain spaces one-to-one,
 * and the ends are trimmed.
 */
export function faithful(s: string): string {
  return s.replace(/[\t\r\n\f\v]/g, ' ').replace(/[\u00a0\u2007\u202f]/g, ' ').trim();
}

/** A simplified form used only to recognise speaker names and patterns: no marks, single spaces. */
export function plain(s: string): string {
  return s.replace(MARKS, '').replace(/\s+/g, ' ').trim();
}

const visible = (s: string) => s.replace(/[\s​-‏‪-‮⁦-⁩﻿]/g, '').length;

/** Builds a line from styled runs; returns null for an empty line. */
export function makeLine(runs: Run[], extra: Partial<RawLine> = {}): RawLine | null {
  const text = faithful(runs.map((r) => r.text).join(''));
  if (!plain(text)) return null;
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
    boldPrefix = faithful(lead);
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
