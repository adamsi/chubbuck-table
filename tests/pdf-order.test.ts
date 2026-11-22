import { describe, expect, it } from 'vitest';
import { bracketVotes, visualToLogicalRtl } from '../lib/script/bidi';
import { bracketsStoredAsDrawn, chooseOrder, joinStream, joinVisual, oddity, type Item } from '../lib/script/pdf';

const it_ = (str: string, x: number, w: number): Item => ({ str, x, y: 700, w, h: 14, font: 'f' });
const read = (items: Item[], order: 'stream' | 'visual', mirror = true) => (order === 'visual' ? joinVisual(items, mirror) : joinStream(items));

// Made-up words on the real layouts of two Google Docs versions (positions are x, width).

// Version A writes a punctuation mark BEFORE the word it follows ("." then the word), word by word.
const clusterLine = [it_('.', 476, 4), it_('ילדה', 479, 26), it_('ספרים', 431, 41), it_('.', 378, 4), it_('מרוהטת', 382, 46), it_(',', 354, 4), it_('אבא', 357, 18), it_('דודה', 329, 22)];
// ... and writes a bracket as drawn: the ")" at the right end of a Hebrew "(1983)" is the written "(".
const clusterBrackets = [it_('בית', 380, 17), it_('חדש', 345, 32), it_(')', 337, 4), it_('1983', 309, 28), it_('(', 305, 4), it_('-', 297, 4), it_(',', 272, 4), it_('אבא', 276, 18)];

// Version B writes the pieces in reading order and pushes the sentence mark away with a very wide
// "space" piece, so the position it reports for the mark is wrong.
const fillerQuestion = [it_('אבא', 310, 25), it_('אמא', 290, 16), it_('בית', 255, 32), it_(' ', 287, 65), it_('?', 335, 6)];
const fillerBrackets = [it_('(', 261, 5), it_(' ', 267, 46), it_('אבא', 302, 27), it_('אמא', 267, 31), it_(' ', 298, 41), it_(')', 329, 5)];
const fillerPeriod = [it_('דני', 400, 20), it_('גר', 380, 14), it_(' ', 250, 182), it_('.', 405, 4)];

describe('reading a line of a right-to-left PDF', () => {
  it('rebuilds the order from the drawing when a mark is written before its word', () => {
    expect(read(clusterLine, 'visual')).toBe('ילדה. ספרים מרוהטת. אבא, דודה');
    expect(read(clusterLine, 'stream')).not.toBe('ילדה. ספרים מרוהטת. אבא, דודה'); // the written order alone is wrong
  });

  it('mirrors brackets that are stored as drawn', () => {
    expect(read(clusterBrackets, 'visual')).toBe('בית חדש (1983) - אבא,');
  });

  it('keeps the written order when a wide filler makes the drawn position of a mark unreliable', () => {
    expect(read(fillerQuestion, 'stream')).toBe('אבא אמא בית?');
    expect(read(fillerBrackets, 'stream')).toBe('(אבא אמא)');
    expect(read(fillerPeriod, 'stream')).toBe('דני גר.');
    // the drawn positions would put the mark at the wrong end
    expect(read(fillerQuestion, 'visual')).not.toBe('אבא אמא בית?');
  });

  it('chooses one way for the whole document', () => {
    expect(chooseOrder([clusterLine, clusterBrackets], true)).toBe('visual');
    expect(chooseOrder([fillerQuestion, fillerBrackets, fillerPeriod], true)).toBe('stream');
    // a document whose lines read the same either way stays in the written order
    expect(chooseOrder([[it_('אבא אמא בית', 300, 80)]], true)).toBe('stream');
  });

  it('decides whether brackets are stored as drawn from the document', () => {
    expect(bracketsStoredAsDrawn([clusterBrackets])).toBe(true);
    expect(bracketsStoredAsDrawn([fillerBrackets])).toBe(true); // ( on the left, ) on the right, as drawn
  });
});

describe('from the page back to the text', () => {
  const rtl = (visual: string[], mirror = true) => visualToLogicalRtl(visual, mirror).join('');

  it('keeps English words and numbers in their own direction inside a Hebrew line', () => {
    expect(rtl(['?', 'בסדר', ' ', ',', '2015', ' ', 'מאז', ' ', 'Tel', ' ', 'Aviv', 'ב-', ' ', 'גר', ' ', 'אני'])).toBe('אני גר ב-Tel Aviv מאז 2015, בסדר?');
  });

  it('keeps numbers with separators and signs whole', () => {
    expect(rtl(['.', 'סך', ' ', '100', '%', ' ', 'הכול'])).toBe('הכול 100% סך.');
    expect(rtl(['בית', ' ', '1', ',', '000', ' ', 'יש'])).toBe('יש 1,000 בית');
  });

  it('mirrors brackets drawn as ( text ), and keeps brackets that are stored as written', () => {
    expect(rtl(['(', 'בית', ')'], true)).toBe('(בית)');
    expect(rtl([')', 'בית', '('], false)).toBe('(בית)');
  });

  it('counts how brackets are drawn', () => {
    expect(bracketVotes(['(', 'x', ')'])).toBe(1);
    expect(bracketVotes([')', 'x', '('])).toBe(-1);
    expect(bracketVotes(['x', 'y'])).toBe(0);
  });
});

describe('how odd the punctuation of a line is', () => {
  it('flags marks that are in the wrong place', () => {
    expect(oddity('אתה נקי עכשיו?')).toBe(0);
    expect(oddity('?אתה נקי עכשיו')).toBeGreaterThan(0);
    expect(oddity('אבא , אמא')).toBeGreaterThan(0);
    expect(oddity('(בית')).toBeGreaterThan(0);
    expect(oddity(')בית(')).toBeGreaterThan(0);
    expect(oddity('"שלום" ... (בסדר)')).toBe(0);
  });
});
