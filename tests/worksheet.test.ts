// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { buildWorksheet } from '../lib/worksheet';

describe('worksheet (.docx)', () => {
  it('has the general-questions box, then a table with one row per speech and a bold speaker name', async () => {
    const blob = await buildWorksheet({
      title: 'קפה של בוקר',
      author: 'נועה לוי',
      lines: [
        { speaker: 'דנה', text: 'בוקר טוב' },
        { speaker: 'יוסי', text: 'שלום\nעוד שורה' },
      ],
    });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file('word/document.xml')!.async('string');

    for (const label of ['מטרת העל:', 'תחליף:', 'מטרת הסצינה:', 'חלל וקיר רביעי:', 'מכשולים:', 'רגע לפני:', 'נסיבות מקדימות:']) expect(xml).toContain(label);
    for (const col of ['טקסט + אובייקטים פנימיים + סימון ביטים', 'פעולות', 'מכשולים', 'Doings', 'דיאלוג פנימי']) expect(xml).toContain(col);

    // Two tables: the box and the worksheet; the worksheet has a header row plus one row per speech.
    expect(xml.match(/<w:tbl>/g)).toHaveLength(2);
    const tables = xml.split('<w:tbl>').slice(1);
    expect(tables[1].match(/<w:tr[ >]/g)).toHaveLength(3);
    expect(xml).toContain('<w:tblHeader');
    // The speaker's name is bold.
    expect(xml).toMatch(/<w:b\/>[\s\S]{0,300}דנה/);
    // Right-to-left tables, fixed column widths (no overflow).
    expect(xml.match(/<w:bidiVisual/g)!.length).toBeGreaterThanOrEqual(2);
    expect(xml).toContain('w:type="fixed"');
    // Column order, left to right: text, actions, obstacles, doings, inner dialogue.
    // In the file the table runs right to left, so the first header cell is the rightmost.
    const header = tables[1];
    const at = (label: string) => header.indexOf(label);
    expect(at('דיאלוג פנימי')).toBeLessThan(at('Doings'));
    expect(at('Doings')).toBeLessThan(at('מכשולים'));
    expect(at('מכשולים')).toBeLessThan(at('פעולות'));
    expect(at('פעולות')).toBeLessThan(at('טקסט + אובייקטים פנימיים + סימון ביטים'));
    // No forced page break between the box and the table (it left an empty page).
    expect(xml).not.toContain('pageBreakBefore');
    expect(xml).not.toMatch(/<w:br w:type="page"/);
  });
});
