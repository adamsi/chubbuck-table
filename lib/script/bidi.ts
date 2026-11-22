/*
 * From the order on the page to the order of the text.
 *
 * A PDF stores what is drawn where. In a right-to-left line the pieces on the page run from the
 * right edge to the left, but numbers and English words inside them run left to right, and
 * punctuation sits next to the word it belongs to. Some programs also write the pieces in a
 * different order than they are drawn, and write brackets as drawn: a Hebrew "(text)" shows an
 * opening bracket on its right side, mirrored, so the PDF holds ")" there.
 *
 * Going from the page back to the text is the Unicode bidirectional algorithm run backwards:
 * give every piece a level (1 = Hebrew, 2 = numbers and Latin), then undo the reordering.
 */

type Cls = 'R' | 'L' | 'EN' | 'N';

const RTL_CHAR = /[֐-ࣿיִ-﷿ﹰ-﻿]/;

/** Bracket pairs: a bracket drawn on the "wrong" side of an RTL run is the mirror of the written one. */
export const MIRROR: Record<string, string> = { '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<', '«': '»', '»': '«' };
const OPENERS = '([{<«';

export const isBracket = (s: string) => s.length === 1 && s in MIRROR;
export const hasRtl = (s: string) => RTL_CHAR.test(s);

function classOf(str: string): Cls {
  for (const ch of str) {
    if (RTL_CHAR.test(ch)) return 'R';
    if (/\p{L}/u.test(ch)) return 'L';
    if (/\p{Nd}/u.test(ch)) return 'EN';
  }
  return 'N';
}

/**
 * The pieces of a right-to-left line, given left to right as they are drawn, in the order they are
 * written. `mirror`: brackets were stored as drawn (see above) and are mirrored back where needed.
 */
export function visualToLogicalRtl(visual: string[], mirror: boolean): string[] {
  const n = visual.length;
  const cls: Cls[] = visual.map(classOf);

  // Separators inside numbers ("1,000", "3.5", "10-12") and signs next to numbers ("100%") belong to the number.
  for (let i = 0; i < n; i++) {
    if (cls[i] !== 'N') continue;
    const s = visual[i].trim();
    if (/^[,.:/\-+]$/.test(s) && cls[i - 1] === 'EN' && cls[i + 1] === 'EN') cls[i] = 'EN';
    else if (/^[%$€₪°#]$/.test(s) && (cls[i - 1] === 'EN' || cls[i + 1] === 'EN')) cls[i] = 'EN';
  }

  // Levels: Hebrew 1; numbers and Latin 2; neutrals (spaces, punctuation) follow their surroundings.
  const level: number[] = cls.map((c) => (c === 'R' ? 1 : c === 'N' ? 0 : 2));
  const dir = (c: Cls | undefined) => (c === 'L' ? 'L' : 'R'); // numbers count as Hebrew next to neutrals
  for (let i = 0; i < n; ) {
    if (cls[i] !== 'N') {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < n && cls[j + 1] === 'N') j++;
    const left = i > 0 ? dir(cls[i - 1]) : 'R';
    const right = j < n - 1 ? dir(cls[j + 1]) : 'R';
    const lvl = left === right && left === 'L' ? 2 : 1;
    for (let k = i; k <= j; k++) level[k] = lvl;
    i = j + 1;
  }

  // Undo the reordering: reverse the runs at each level, lowest level first.
  const order = visual.map((_, i) => i);
  const max = Math.max(1, ...level);
  for (let lvl = 1; lvl <= max; lvl++) {
    for (let i = 0; i < n; ) {
      if (level[order[i]] < lvl) {
        i++;
        continue;
      }
      let j = i;
      while (j + 1 < n && level[order[j + 1]] >= lvl) j++;
      for (let a = i, b = j; a < b; a++, b--) [order[a], order[b]] = [order[b], order[a]];
      i = j + 1;
    }
  }

  return order.map((i) => (mirror && isBracket(visual[i]) && level[i] % 2 === 1 ? MIRROR[visual[i]] : visual[i]));
}

/**
 * Do the brackets of this line look as stored-as-drawn? Counts bracket pairs read left to right:
 * an opener before its closer (+1) means the brackets are drawn forms, a closer before its opener
 * (-1) means they are the written characters. Used over a whole document to decide on mirroring.
 */
export function bracketVotes(visual: string[]): number {
  let votes = 0;
  const open = new Map<string, number>();
  const closedFirst = new Map<string, number>();
  for (const s of visual) {
    if (!isBracket(s)) continue;
    const isOpener = OPENERS.includes(s);
    const kind = isOpener ? s : MIRROR[s];
    if (isOpener) {
      if ((closedFirst.get(kind) ?? 0) > 0) {
        closedFirst.set(kind, closedFirst.get(kind)! - 1);
        votes--;
      } else open.set(kind, (open.get(kind) ?? 0) + 1);
    } else if ((open.get(kind) ?? 0) > 0) {
      open.set(kind, open.get(kind)! - 1);
      votes++;
    } else closedFirst.set(kind, (closedFirst.get(kind) ?? 0) + 1);
  }
  return votes;
}
