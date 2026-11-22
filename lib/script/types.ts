/** One line of a script as read from a file, before speakers are detected. */
export interface RawLine {
  /** Cleaned text (no direction marks, single spaces). */
  text: string;
  /** (Nearly) the whole line is bold. */
  bold: boolean;
  /** Bold text at the start of a line that is not bold as a whole, e.g. "רוס:" in "**רוס:** שלום". */
  boldPrefix: string;
  /** PDF only: id of the font used for most of the line. */
  font?: string;
  /** The line is centered on the page / paragraph. */
  centered?: boolean;
}

export interface Run {
  text: string;
  bold: boolean;
}

export interface Speech {
  speaker: string;
  text: string;
}

export interface ParsedScript {
  title: string;
  author: string;
  speeches: Speech[];
  /** False when no speaker pattern was found: every line is then its own speech without a speaker. */
  recognized: boolean;
}

/** Thrown for files that cannot be read; `code` is translated in the UI. */
export class ReadError extends Error {
  constructor(public code: 'unsupported' | 'old_doc' | 'image' | 'empty' | 'broken', message?: string) {
    super(message ?? code);
  }
}
