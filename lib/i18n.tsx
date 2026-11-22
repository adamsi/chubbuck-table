'use client';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type Lang = 'he' | 'en';

const dict = {
  appName: ['טבלת צ׳באק', 'Chubbuck Table'],
  heroTitle: ['העלו סצנה, קבלו טבלה', 'Upload a scene, get a worksheet'],
  dropTitle: ['או גררו קובץ לכאן', 'or drop a file here'],
  chooseFile: ['בחירת קובץ', 'Choose a file'],
  privacy: ['הקובץ נשאר במכשיר שלך', 'Your file stays on your device'],
  stepUpload: ['העלאה', 'Upload'],
  stepCheck: ['בדיקה', 'Check'],
  stepDownload: ['הורדה', 'Download'],
  reading: ['קורא את הקובץ…', 'Reading the file…'],
  checkTitle: ['בדקו שהדוברים והטקסט נכונים', 'Check the speakers and the text'],
  found: ['זוהו {c} דמויות ו-{s} קטעי טקסט. כל קטע יהיה שורה בטבלה.', 'Found {c} characters and {s} speeches. Each speech becomes a table row.'],
  notRecognized: ['לא זוהו דוברים אוטומטית. הוסיפו דמויות ובחרו דובר לכל קטע.', 'No speakers were found automatically. Add characters and pick a speaker for each speech.'],
  noSpeaker: ['{n} קטעים בלי דובר', '{n} speeches without a speaker'],
  noSpeakerOne: ['קטע אחד בלי דובר', '1 speech without a speaker'],
  title: ['כותרת', 'Title'],
  author: ['מחבר / במאי', 'Author / director'],
  characters: ['דמויות', 'Characters'],
  characterName: ['שם הדמות', 'Character name'],
  addCharacter: ['הוספת דמות', 'Add a character'],
  removeCharacter: ['הסרת דמות', 'Remove character'],
  speaker: ['דובר', 'Speaker'],
  noSpeakerOption: ['ללא דובר', 'No speaker'],
  speechText: ['טקסט', 'Text'],
  mergeUp: ['חיבור לקטע הקודם', 'Merge with previous'],
  split: ['פיצול בסמן', 'Split at cursor'],
  splitHint: ['הציבו את הסמן בטקסט ואז פצלו', 'Place the cursor in the text, then split'],
  deleteSpeech: ['מחיקת קטע', 'Delete speech'],
  addBelow: ['הוספת קטע מתחת', 'Add a speech below'],
  createTable: ['יצירת טבלה', 'Create the worksheet'],
  creating: ['יוצר את הקובץ…', 'Creating the file…'],
  back: ['חזרה', 'Back'],
  ready: ['הטבלה מוכנה', 'Your worksheet is ready'],
  readyHint: ['קובץ Word עם שורה לכל קטע טקסט, ומעליו השאלות הכלליות למילוי.', 'A Word file with a row for every speech and the general questions above it.'],
  rows: ['שורות בטבלה', 'table rows'],
  download: ['הורדת קובץ Word', 'Download the Word file'],
  backToEdit: ['חזרה לעריכה', 'Back to editing'],
  newFile: ['קובץ חדש', 'New file'],
  errUnsupported: ['סוג הקובץ לא נתמך. אפשר להעלות PDF, Word (docx), ODT, RTF, HTML או טקסט.', 'This file type is not supported. Upload a PDF, Word (docx), ODT, RTF, HTML or text file.'],
  errOldDoc: ['קובצי Word ישנים (doc) לא נתמכים. שמרו את הקובץ כ-docx או כ-PDF ונסו שוב.', 'Old Word files (doc) are not supported. Save the file as docx or PDF and try again.'],
  errImage: ['זה קובץ תמונה, והאפליקציה קוראת רק טקסט. אפשר להעלות PDF, Word או טקסט.', 'This is a picture; the app only reads text. Upload a PDF, Word or text file.'],
  errEmpty: ['לא נמצא טקסט בקובץ. אם זה PDF סרוק (תמונות של דפים) אי אפשר לקרוא אותו.', 'No text was found. A scanned PDF (pictures of pages) cannot be read.'],
  errBroken: ['לא הצלחנו לקרוא את הקובץ. ייתכן שהוא פגום או מוגן בסיסמה.', 'The file could not be read. It may be damaged or password protected.'],
  errTooBig: ['הקובץ גדול מדי (עד 25MB).', 'The file is too large (up to 25MB).'],
  errNothing: ['אין קטעי טקסט ליצירת טבלה.', 'There are no speeches to build a worksheet from.'],
  language: ['שפה', 'Language'],
} as const;

export type Key = keyof typeof dict;

const Ctx = createContext<{ lang: Lang; t: (k: Key, vars?: Record<string, string | number>) => string; setLang: (l: Lang) => void }>({
  lang: 'he',
  t: (k) => dict[k][0],
  setLang: () => {},
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('he');
  useEffect(() => {
    try {
      if (localStorage.getItem('lang') === 'en') setLangState('en');
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
  }, [lang]);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem('lang', l);
    } catch {}
  }, []);
  const t = useCallback(
    (k: Key, vars?: Record<string, string | number>) => {
      let s: string = dict[k][lang === 'he' ? 0 : 1];
      for (const [name, v] of Object.entries(vars ?? {})) s = s.replace(`{${name}}`, String(v));
      return s;
    },
    [lang]
  );
  return <Ctx.Provider value={{ lang, t, setLang }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
