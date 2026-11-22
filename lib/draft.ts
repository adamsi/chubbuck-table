import { speakersOf } from './script/parse';
import type { ParsedScript } from './script/types';
import type { WorksheetInput } from './worksheet';

export interface Character {
  key: string;
  name: string;
}
export interface SpeechRow {
  key: string;
  /** key of a character, or '' for none */
  speaker: string;
  text: string;
}
export interface Draft {
  title: string;
  author: string;
  characters: Character[];
  speeches: SpeechRow[];
}

let seq = 0;
export const newKey = () => `k${Date.now().toString(36)}${seq++}`;

/** Editable form of a parsed script. */
export function draftFromParsed(p: ParsedScript): Draft {
  const characters = speakersOf(p.speeches).map((name) => ({ key: newKey(), name }));
  const byName = new Map(characters.map((c) => [c.name, c.key]));
  return {
    title: p.title,
    author: p.author,
    characters,
    speeches: p.speeches.map((s) => ({ key: newKey(), speaker: byName.get(s.speaker) ?? '', text: s.text })),
  };
}

/** What goes into the Word file: one row per non-empty speech. */
export function toWorksheet(d: Draft): WorksheetInput {
  const names = new Map(d.characters.map((c) => [c.key, c.name.trim()]));
  return {
    title: d.title.trim(),
    author: d.author.trim(),
    lines: d.speeches.filter((s) => s.text.trim()).map((s) => ({ speaker: names.get(s.speaker) ?? '', text: s.text.trim() })),
  };
}

export const withoutSpeaker = (d: Draft) => d.speeches.filter((s) => s.text.trim() && !d.characters.some((c) => c.key === s.speaker && c.name.trim())).length;

const update = (d: Draft, key: string, fn: (s: SpeechRow, i: number, all: SpeechRow[]) => SpeechRow[]): Draft => {
  const i = d.speeches.findIndex((s) => s.key === key);
  if (i < 0) return d;
  return { ...d, speeches: [...d.speeches.slice(0, i), ...fn(d.speeches[i], i, d.speeches), ...d.speeches.slice(i + 1)] };
};

export const setSpeech = (d: Draft, key: string, patch: Partial<SpeechRow>) => update(d, key, (s) => [{ ...s, ...patch }]);
export const deleteSpeech = (d: Draft, key: string) => update(d, key, () => []);
export const addSpeechBelow = (d: Draft, key: string) => update(d, key, (s) => [s, { key: newKey(), speaker: s.speaker, text: '' }]);

/** Joins a speech to the one before it (the text is appended to the previous speaker's speech). */
export function mergeWithPrevious(d: Draft, key: string): Draft {
  const i = d.speeches.findIndex((s) => s.key === key);
  if (i <= 0) return d;
  const prev = d.speeches[i - 1];
  const text = [prev.text.trim(), d.speeches[i].text.trim()].filter(Boolean).join(' ');
  return { ...d, speeches: [...d.speeches.slice(0, i - 1), { ...prev, text }, ...d.speeches.slice(i + 1)] };
}

/** Splits a speech in two at a character position; the second part starts with no change of speaker. */
export function splitSpeech(d: Draft, key: string, at: number): Draft {
  return update(d, key, (s) => {
    const a = s.text.slice(0, at).trim();
    const b = s.text.slice(at).trim();
    if (!a || !b) return [s];
    return [
      { ...s, text: a },
      { key: newKey(), speaker: s.speaker, text: b },
    ];
  });
}

export const renameCharacter = (d: Draft, key: string, name: string): Draft => ({ ...d, characters: d.characters.map((c) => (c.key === key ? { ...c, name } : c)) });
export const addCharacter = (d: Draft): Draft => ({ ...d, characters: [...d.characters, { key: newKey(), name: '' }] });
export const isUsed = (d: Draft, key: string) => d.speeches.some((s) => s.speaker === key);
export const removeCharacter = (d: Draft, key: string): Draft => (isUsed(d, key) ? d : { ...d, characters: d.characters.filter((c) => c.key !== key) });
