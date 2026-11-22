import { describe, expect, it } from 'vitest';
import { addSpeechBelow, deleteSpeech, draftFromParsed, mergeWithPrevious, removeCharacter, renameCharacter, splitSpeech, toWorksheet, withoutSpeaker } from '../lib/draft';

const base = () =>
  draftFromParsed({
    title: 'כותרת',
    author: '',
    recognized: true,
    speeches: [
      { speaker: 'דנה', text: 'שלום' },
      { speaker: 'יוסי', text: 'היי שם' },
      { speaker: 'דנה', text: 'מה נשמע' },
    ],
  });

describe('editing a draft', () => {
  it('builds characters from the speakers and keeps the order', () => {
    const d = base();
    expect(d.characters.map((c) => c.name)).toEqual(['דנה', 'יוסי']);
    expect(toWorksheet(d).lines.map((l) => l.speaker)).toEqual(['דנה', 'יוסי', 'דנה']);
  });

  it('renaming a character renames it in every row', () => {
    const d = renameCharacter(base(), base().characters[0].key, 'x');
    const d2 = base();
    const renamed = renameCharacter(d2, d2.characters[0].key, 'דני');
    expect(toWorksheet(renamed).lines.map((l) => l.speaker)).toEqual(['דני', 'יוסי', 'דני']);
    expect(d.characters).toHaveLength(2);
  });

  it('merges a speech into the previous one', () => {
    const d = base();
    const merged = mergeWithPrevious(d, d.speeches[1].key);
    expect(merged.speeches.map((s) => s.text)).toEqual(['שלום היי שם', 'מה נשמע']);
    expect(mergeWithPrevious(d, d.speeches[0].key)).toBe(d); // nothing before the first
  });

  it('splits a speech at a position, and ignores a split at either end', () => {
    const d = base();
    const split = splitSpeech(d, d.speeches[1].key, 3);
    expect(split.speeches.map((s) => s.text)).toEqual(['שלום', 'היי', 'שם', 'מה נשמע']);
    expect(split.speeches[2].speaker).toBe(d.speeches[1].speaker);
    expect(splitSpeech(d, d.speeches[1].key, 0).speeches).toHaveLength(3);
    expect(splitSpeech(d, d.speeches[1].key, 99).speeches).toHaveLength(3);
  });

  it('deletes and adds speeches, and drops empty ones from the worksheet', () => {
    const d = base();
    expect(deleteSpeech(d, d.speeches[0].key).speeches).toHaveLength(2);
    const added = addSpeechBelow(d, d.speeches[0].key);
    expect(added.speeches).toHaveLength(4);
    expect(toWorksheet(added).lines).toHaveLength(3);
  });

  it('only removes a character that has no speeches, and counts speeches without a speaker', () => {
    const d = base();
    expect(removeCharacter(d, d.characters[0].key)).toBe(d);
    const emptied = { ...d, speeches: d.speeches.filter((s) => s.speaker !== d.characters[1].key) };
    expect(removeCharacter(emptied, d.characters[1].key).characters).toHaveLength(1);
    expect(withoutSpeaker(d)).toBe(0);
    expect(withoutSpeaker({ ...d, speeches: [{ ...d.speeches[0], speaker: '' }] })).toBe(1);
  });
});
