import { plain } from './lines';
import type { ParsedScript, RawLine, Speech } from './types';

/*
 * Finds who speaks what, from the layout alone (no AI).
 *
 * Character names repeat, dialogue does not. So every line that could be a speaker marker is
 * collected under the convention it follows, and the convention that yields a small set of
 * names which keep coming back wins:
 *
 *   header      the name stands alone on its line (bold / centered / capitals / its own font / plain)
 *   inline      "NAME: text"
 *   boldprefix  "**NAME** text" (name in bold, text in the same line)
 *   dash        "NAME - text"
 *
 * Every line after a marker belongs to that speaker until the next marker.
 */

type Kind = 'header' | 'inline' | 'boldprefix' | 'dash';

interface Candidate {
  /** index of the line */
  i: number;
  kind: Kind;
  /** style signature (header kind only) */
  sig: string;
  key: string;
  name: string;
  /** a "(...)" written next to the name, kept at the start of the speech */
  direction: string;
  /** text on the same line after the name */
  rest: string;
}

const NIQQUD = /[֑-ׇ]/g;
/** Normal form of a name, to recognise the same character written slightly differently. */
export const nameKey = (s: string) =>
  s.replace(NIQQUD, '').replace(/[’‘ʼ׳`´]/g, "'").replace(/[״“”]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase();

// Scene headings and other labels that look like names but are not.
const NOT_A_NAME = /^(סצנה|תמונה|פרק|מערכה|תסריט|הערה|הערות|הסבר|כותרת|scene|act|chapter|int\.?|ext\.?|int\.?\/ext\.?|cut to|fade|title|note|notes)(\b|\s|$)/i;
const AUTHOR = /^(במאי|בימוי|מאת|כתב|כתיבה|כותב|כותבת|תסריט|תסריטאי|מחבר|מחברת|עיבוד|written by|by|directed by|director|writer)\s*[:\-–—]?\s*(.+)$/i;

/** Splits "דנה (בכעס)" into the name and the direction; null when the text cannot be a name. */
function splitName(raw: string): { name: string; direction: string } | null {
  let s = raw.trim().replace(/[:：]\s*$/, '').trim();
  let direction = '';
  const m = s.match(/^(.*?)\s*(\([^)]*\)|\[[^\]]*\])\s*$/);
  if (m && m[1]) {
    s = m[1].trim();
    direction = m[2];
  }
  s = s.replace(/\s*[-–—]\s*$/, '').trim();
  if (!s || s.length > 35) return null;
  if (s.split(/\s+/).length > 4) return null;
  if (!/\p{L}/u.test(s)) return null;
  if (/^[(\[\-–—*"“'«•]/.test(s)) return null;
  if (/[.?!…,;:(){}\[\]]$/.test(s) || /[:：(){}\[\]]/.test(s)) return null;
  if (NOT_A_NAME.test(s)) return null;
  return { name: s, direction };
}

const isUpperLatin = (s: string) => /[A-Z]/.test(s) && s === s.toUpperCase() && !/[a-z֐-׿]/.test(s);

function signature(l: RawLine, name: string): string {
  return [l.bold ? 'B' : '', l.centered ? 'C' : '', isUpperLatin(name) ? 'U' : '', l.font ? `F${l.font}` : ''].join('');
}

function candidates(lines: RawLine[]): Candidate[] {
  const out: Candidate[] = [];
  lines.forEach((l, i) => {
    const text = l.text;
    const ptext = plain(text);

    // header: the whole line is a name
    const h = splitName(ptext);
    if (h) out.push({ i, kind: 'header', sig: signature(l, h.name), key: nameKey(h.name), name: h.name, direction: h.direction, rest: '' });

    // inline: "NAME: text"
    const inline = text.match(/^([^:：]{1,45}?)\s*[:：]\s*(\S.*)$/);
    if (inline) {
      const n = splitName(plain(inline[1]));
      if (n) out.push({ i, kind: 'inline', sig: '', key: nameKey(n.name), name: n.name, direction: n.direction, rest: inline[2] });
    }

    // boldprefix: "**NAME** text" (the name is the bold start of a line that is not bold as a whole)
    if (l.boldPrefix && text.startsWith(l.boldPrefix) && text.length > l.boldPrefix.length) {
      const n = splitName(plain(l.boldPrefix));
      if (n) {
        const rest = text.slice(l.boldPrefix.length).replace(/^\s*[:：\-–—]?\s*/, '');
        if (rest) out.push({ i, kind: 'boldprefix', sig: '', key: nameKey(n.name), name: n.name, direction: n.direction, rest });
      }
    }

    // dash: "NAME - text"
    const dash = text.match(/^(.{1,35}?)\s+[-–—]\s+(\S.*)$/);
    if (dash) {
      const n = splitName(plain(dash[1]));
      if (n) out.push({ i, kind: 'dash', sig: '', key: nameKey(n.name), name: n.name, direction: n.direction, rest: dash[2] });
    }
  });
  return out;
}

interface Scored {
  members: Candidate[];
  kept: Set<string>;
  score: number;
  /** the style is a clear marker (bold, font, ...): then names that appear only once are accepted too */
  strong: boolean;
}

const WEIGHT: Record<Kind, number> = { header: 1, inline: 1, boldprefix: 1, dash: 0.7 };

function score(kind: Kind, sig: string, members: Candidate[], totalLines: number): Scored | null {
  const counts = new Map<string, number>();
  for (const m of members) counts.set(m.key, (counts.get(m.key) ?? 0) + 1);
  const kept = new Set([...counts].filter(([, n]) => n >= 2).map(([k]) => k));
  const cover = [...kept].reduce((n, k) => n + counts.get(k)!, 0);
  const noise = members.length - cover;
  const strong = kind === 'boldprefix' || (kind === 'header' && sig !== '');

  if (cover < 3 || kept.size < 1 || kept.size > 25) return null;
  if (cover / (cover + noise) < 0.6) return null;
  // A style shared by nearly the whole document is the body text style, not a marker.
  if (kind === 'header' && members.length / totalLines > 0.75) return null;
  if (kind === 'header' && sig === '' && kept.size > 12) return null;

  const weight = kind === 'header' && sig === '' ? 0.6 : WEIGHT[kind];
  return { members, kept, strong, score: weight * cover * (cover / (cover + noise)) };
}

function pickMarkers(lines: RawLine[]): Candidate[] | null {
  const all = candidates(lines);
  const groups = new Map<string, Candidate[]>();
  for (const c of all) {
    const k = `${c.kind}|${c.sig}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(c);
  }

  let best: Scored | null = null;
  for (const [k, members] of groups) {
    const [kind, sig] = k.split('|') as [Kind, string];
    const s = score(kind, sig, members, lines.length);
    if (s && (!best || s.score > best.score || (s.score === best.score && s.strong && !best.strong))) best = s;
  }
  if (!best) return null;

  const firstKept = best.members.find((m) => best!.kept.has(m.key))!.i;
  return best.members.filter((m) => best!.kept.has(m.key) || (best!.strong && m.i >= firstKept));
}

const short = (s: string) => s.length <= 30 && s.split(/\s+/).length <= 4 && !/[.?!…,;:]/.test(s);

function titleAndAuthor(pre: RawLine[]): { title: string; author: string } {
  const title = plain(pre[0]?.text ?? '');
  let author = '';
  for (const l of pre.slice(1)) {
    const m = plain(l.text).match(AUTHOR);
    if (m) {
      author = m[2].trim();
      break;
    }
  }
  if (!author && pre.length >= 2 && pre.length <= 3 && short(plain(pre[1].text))) author = plain(pre[1].text);
  return { title, author };
}

/** Finds the speakers in a script. Without a recognisable pattern every line becomes its own speech. */
export function parseScript(lines: RawLine[]): ParsedScript {
  const markers = lines.length ? pickMarkers(lines) : null;
  if (!markers) {
    const { title } = titleAndAuthor(lines.slice(0, 1));
    return { title, author: '', recognized: false, speeches: lines.slice(title ? 1 : 0).map((l) => ({ speaker: '', text: l.text })) };
  }

  const at = new Map(markers.map((m) => [m.i, m]));
  const first = Math.min(...markers.map((m) => m.i));
  const { title, author } = titleAndAuthor(lines.slice(0, first));

  // The first spelling of a name is the one shown.
  const shown = new Map<string, string>();
  const speeches: Speech[] = [];
  let current: Speech | null = null;
  const add = (s: Speech, t: string) => {
    s.text = s.text ? `${s.text} ${t}` : t;
  };

  for (let i = first; i < lines.length; i++) {
    const m = at.get(i);
    if (m) {
      if (!shown.has(m.key)) shown.set(m.key, m.name);
      current = { speaker: shown.get(m.key)!, text: '' };
      speeches.push(current);
      if (m.direction) add(current, m.direction);
      if (m.rest) add(current, m.rest);
    } else if (current) {
      add(current, lines[i].text);
    }
  }

  return { title, author, recognized: true, speeches: speeches.filter((s) => s.text.trim()) };
}

/** Distinct speakers in order of first appearance. */
export function speakersOf(speeches: Speech[]): string[] {
  const seen = new Map<string, string>();
  for (const s of speeches) if (s.speaker && !seen.has(nameKey(s.speaker))) seen.set(nameKey(s.speaker), s.speaker);
  return [...seen.values()];
}
