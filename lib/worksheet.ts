import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeightRule,
  Packer,
  PageNumber,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';

export interface WorksheetInput {
  title: string;
  author: string;
  /** one table row per speech, in script order */
  lines: { speaker: string; text: string }[];
}

const FONT = 'Arial';
// A4 landscape with 1.5cm margins, in twentieths of a point.
const PAGE_W = 16838;
const PAGE_H = 11906;
const MARGIN = 850;
const WIDTH = PAGE_W - 2 * MARGIN;

/**
 * General fields above the table. A row is either two short fields side by side
 * (half a row each) or one field with several writing lines across the full width.
 */
type BoxRow = { pair: [string, string] } | { label: string; lines: number };
const BOX: BoxRow[] = [
  { pair: ['מטרת העל:', 'תחליף:'] },
  { pair: ['מטרת הסצינה:', 'חלל וקיר רביעי:'] },
  { label: 'מכשולים:', lines: 3 },
  { label: 'רגע לפני:', lines: 3 },
  { label: 'נסיבות מקדימות:', lines: 3 },
];

/** Table columns, first one is the rightmost (Hebrew). The inner-dialogue column is the widest. */
const COLUMNS: [string, number][] = [
  ['מכשולים', 0.12],
  ['טקסט + אובייקטים פנימיים + סימון ביטים', 0.31],
  ['פעולות', 0.12],
  ['Doings', 0.12],
  ['דיאלוג פנימי', 0.33],
];
/** Index of the column that holds the speaker and the text. */
const TEXT_COLUMN = 1;
const COL_W = COLUMNS.map(([, f]) => Math.round(WIDTH * f));
COL_W[COL_W.length - 1] += WIDTH - COL_W.reduce((a, b) => a + b, 0);

const run = (text: string, opts: { bold?: boolean; size?: number; color?: string } = {}) =>
  new TextRun({ text, font: FONT, rightToLeft: true, size: opts.size ?? 22, bold: opts.bold, color: opts.color });

const para = (children: TextRun[], opts: { center?: boolean; before?: number; after?: number } = {}) =>
  new Paragraph({
    bidirectional: true,
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.START,
    spacing: { before: opts.before ?? 0, after: opts.after ?? 0, line: 276 },
    children,
  });

const line = (style: (typeof BorderStyle)[keyof typeof BorderStyle], size: number, color: string) => ({ style, size, color });
const NONE = line(BorderStyle.NONE, 0, 'FFFFFF');
const FRAME = line(BorderStyle.SINGLE, 12, '000000');
const GRID = line(BorderStyle.SINGLE, 6, '000000');

/** The framed box of general questions, with ruled lines to write on. */
function fieldsBox(): Table {
  const HALF = Math.floor(WIDTH / 2);
  const SEP = line(BorderStyle.SINGLE, 6, '7F7F7F');
  const DOTS = line(BorderStyle.DOTTED, 4, 'A6A6A6');
  const rows: TableRow[] = [];
  const boxCell = (label: string, opts: { width: number; span?: number; top: boolean; bottom: ReturnType<typeof line>; start: boolean; end: boolean }) =>
    new TableCell({
      width: { size: opts.width, type: WidthType.DXA },
      columnSpan: opts.span,
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 40, bottom: 40, left: 160, right: 160 },
      borders: {
        top: opts.top ? FRAME : NONE,
        bottom: opts.bottom,
        // The table is laid out right to left: "start" is the right edge.
        right: opts.start ? FRAME : SEP,
        left: opts.end ? FRAME : SEP,
      },
      children: [para(label ? [run(label, { bold: true }), run(' ')] : [run('')])],
    });
  const row = (children: TableCell[]) => new TableRow({ cantSplit: true, height: { value: 520, rule: HeightRule.ATLEAST }, children });

  BOX.forEach((item, r) => {
    const first = r === 0;
    const last = r === BOX.length - 1;
    if ('pair' in item) {
      const bottom = last ? FRAME : SEP;
      rows.push(
        row([
          boxCell(item.pair[0], { width: HALF, top: first, bottom, start: true, end: false }),
          boxCell(item.pair[1], { width: WIDTH - HALF, top: first, bottom, start: false, end: true }),
        ])
      );
      return;
    }
    for (let i = 0; i < item.lines; i++) {
      const lastLine = i === item.lines - 1;
      rows.push(
        row([
          boxCell(i === 0 ? item.label : '', {
            width: WIDTH,
            span: 2,
            top: first && i === 0,
            bottom: lastLine ? (last ? FRAME : SEP) : DOTS,
            start: true,
            end: true,
          }),
        ])
      );
    }
  });
  return new Table({
    visuallyRightToLeft: true,
    layout: TableLayoutType.FIXED,
    width: { size: WIDTH, type: WidthType.DXA },
    columnWidths: [HALF, WIDTH - HALF],
    rows,
  });
}

function cell(children: Paragraph[], width: number, header = false): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    verticalAlign: header ? VerticalAlign.CENTER : VerticalAlign.TOP,
    margins: { top: 90, bottom: 90, left: 110, right: 110 },
    borders: { top: GRID, bottom: GRID, left: GRID, right: GRID },
    shading: header ? { type: ShadingType.CLEAR, color: 'auto', fill: 'E7E6E6' } : undefined,
    children,
  });
}

function workTable(lines: WorksheetInput['lines']): Table {
  const header = new TableRow({
    tableHeader: true, // repeated at the top of every page
    cantSplit: true,
    children: COLUMNS.map(([title], i) => cell([para([run(title, { bold: true, size: 21 })], { center: true })], COL_W[i], true)),
  });
  const rows = lines.map(
    (l) =>
      new TableRow({
        // Short speeches stay whole on a page; a long monologue may continue on the next one.
        cantSplit: l.text.length < 700,
        height: { value: 1000, rule: HeightRule.ATLEAST },
        children: COL_W.map((w, i) =>
          i === TEXT_COLUMN
            ? cell([para([run(l.speaker, { bold: true })], { after: 40 }), ...l.text.split(/\n+/).map((t) => para([run(t.trim())]))], w)
            : cell([para([run('')])], w)
        ),
      })
  );
  return new Table({
    visuallyRightToLeft: true,
    layout: TableLayoutType.FIXED,
    width: { size: WIDTH, type: WidthType.DXA },
    columnWidths: COL_W,
    rows: [header, ...rows],
  });
}

/** Builds the Chubbuck worksheet (.docx): title, general questions box, and one table row per speech. */
export async function buildWorksheet(input: WorksheetInput): Promise<Blob> {
  const doc = new Document({
    creator: 'Chubbuck Table',
    title: input.title,
    styles: { default: { document: { run: { font: FONT, size: 22, rightToLeft: true } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_H, height: PAGE_W, orientation: PageOrientation.LANDSCAPE },
            margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18, color: '7F7F7F' })],
              }),
            ],
          }),
        },
        children: [
          para([run(input.title || 'סצנה', { bold: true, size: 32 })], { center: true }),
          ...(input.author ? [para([run(input.author, { size: 22, color: '595959' })], { center: true })] : []),
          para([run('טבלת עבודה בשיטת צ׳באק', { size: 20, color: '7F7F7F' })], { center: true, after: 200 }),
          fieldsBox(),
          // A small gap; it also keeps Word from merging the two tables. No page break: the table
          // starts right below the box, so there is never an empty page.
          new Paragraph({ spacing: { before: 160, after: 0 }, children: [new TextRun({ text: '', size: 8 })] }),
          workTable(input.lines),
        ],
      },
    ],
  });
  return Packer.toBlob(doc);
}
