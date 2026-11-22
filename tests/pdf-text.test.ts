import { describe, expect, it } from 'vitest';
import { fixQuotes, tidy } from '../lib/script/pdf';

describe('PDF text tidying', () => {
  it('removes spaces before closing punctuation and inside brackets', () => {
    expect(tidy('אתה נקי עכשיו ?')).toBe('אתה נקי עכשיו?');
    expect(tidy('( מוחא כפיים ) ארבעה ימים . ובכל זאת')).toBe('(מוחא כפיים) ארבעה ימים. ובכל זאת');
  });
  it('fixes spaces inside quotation marks but not gershayim inside words', () => {
    expect(fixQuotes('סצנה – "שובר שורות "')).toBe('סצנה – "שובר שורות"');
    expect(fixQuotes('הוא אמר " שלום " ויצא')).toBe('הוא אמר "שלום" ויצא');
    expect(fixQuotes('חייל בצה"ל אמר "כן"')).toBe('חייל בצה"ל אמר "כן"');
  });
});
