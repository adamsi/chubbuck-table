'use client';
import { useEffect, useRef, useState } from 'react';
import { useI18n, type Lang } from '@/lib/i18n';

function Flag({ lang }: { lang: Lang }) {
  return lang === 'he' ? (
    <svg viewBox="0 0 28 20" width="28" height="20" aria-hidden className="shrink-0 rounded-[3px]">
      <rect width="28" height="20" fill="#fff" />
      <rect y="2.5" width="28" height="2.6" fill="#0038b8" />
      <rect y="14.9" width="28" height="2.6" fill="#0038b8" />
      <path d="M14 6.6l2.9 5H11.1zM14 13.4l-2.9-5h5.8z" fill="none" stroke="#0038b8" strokeWidth="0.8" />
    </svg>
  ) : (
    <svg viewBox="0 0 28 20" width="28" height="20" aria-hidden className="shrink-0 rounded-[3px]">
      <rect width="28" height="20" fill="#fff" />
      {[0, 2, 4, 6].map((i) => (
        <rect key={i} y={(i * 20) / 7} width="28" height={20 / 7} fill="#b22234" />
      ))}
      <rect width="12" height={(20 / 7) * 4} fill="#3c3b6e" />
      {[2, 6, 10].flatMap((x) => [2.2, 5.7, 9.2].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="0.8" fill="#fff" />))}
    </svg>
  );
}

const LANGS: { lang: Lang; name: string }[] = [
  { lang: 'he', name: 'עברית' },
  { lang: 'en', name: 'English' },
];

/** Shows the current language with its flag; opens a dropdown to switch. */
export function LangMenu() {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const current = LANGS.find((l) => l.lang === lang)!;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative shrink-0">
      <button
        type="button"
        className="btn min-h-11 gap-2 px-3 text-base"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Language: ${current.name}`}
        onClick={() => setOpen((o) => !o)}
      >
        <Flag lang={current.lang} />
        <span>{current.name}</span>
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden className={`text-dim transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M5 7.5l5 5 5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div role="listbox" aria-label="Language" className="sheet absolute end-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-2xl border border-line bg-card p-1 shadow-xl shadow-black/50">
          {LANGS.map((l) => (
            <button
              key={l.lang}
              type="button"
              role="option"
              aria-selected={l.lang === lang}
              className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-start text-lg outline-none focus-visible:bg-card2 active:bg-card2 ${l.lang === lang ? 'bg-card2 font-bold' : ''}`}
              onClick={() => {
                setLang(l.lang);
                setOpen(false);
              }}
            >
              <Flag lang={l.lang} />
              <span className="flex-1">{l.name}</span>
              {l.lang === lang && <span className="text-mine" aria-hidden>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
