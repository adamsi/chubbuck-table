'use client';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { draftFromParsed, toWorksheet, withoutSpeaker, type Draft } from '@/lib/draft';
import { useI18n, type Key } from '@/lib/i18n';
import { ReadError } from '@/lib/script/types';
import { CharactersEditor, SpeechesEditor } from '@/components/Editor';
import { Page, ProgressCard, Stepper, TopBar } from '@/components/ui';

const MAX_BYTES = 25 * 1024 * 1024;
type View = 'upload' | 'check' | 'ready';

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const READ_ERRORS: Record<ReadError['code'], Key> = {
  unsupported: 'errUnsupported',
  old_doc: 'errOldDoc',
  image: 'errImage',
  empty: 'errEmpty',
  broken: 'errBroken',
};

export default function Home() {
  const { t } = useI18n();
  const [view, setView] = useState<View>('upload');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [recognized, setRecognized] = useState(true);
  const [busy, setBusy] = useState<'' | 'read' | 'build'>('');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ url: string; name: string; rows: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);
  useEffect(() => () => void (result && URL.revokeObjectURL(result.url)), [result]);

  const update = (fn: (d: Draft) => Draft) => setDraft((d) => (d ? fn(d) : d));

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError('');
    if (file.size > MAX_BYTES) return setError(t('errTooBig'));
    setFileName(file.name);
    setBusy('read');
    try {
      // The readers are loaded only now, so the first page stays light.
      const [{ readScript }, { parseScript }] = await Promise.all([import('@/lib/script/read'), import('@/lib/script/parse')]);
      const parsed = parseScript(await readScript(await file.arrayBuffer(), file.name));
      setRecognized(parsed.recognized);
      setDraft(draftFromParsed(parsed));
      setView('check');
    } catch (e) {
      setError(t(e instanceof ReadError ? READ_ERRORS[e.code] : 'errBroken'));
    } finally {
      setBusy('');
    }
  }

  async function build() {
    if (!draft) return;
    const sheet = toWorksheet(draft);
    if (!sheet.lines.length) return setError(t('errNothing'));
    setError('');
    setBusy('build');
    try {
      const { buildWorksheet } = await import('@/lib/worksheet');
      const blob = await buildWorksheet(sheet);
      const safe = (sheet.title || 'scene').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
      setResult({ url: URL.createObjectURL(blob), name: `${safe} - טבלת צ׳באק.docx`, rows: sheet.lines.length });
      setView('ready');
    } catch {
      setError(t('errBroken'));
    } finally {
      setBusy('');
    }
  }

  function reset() {
    setDraft(null);
    setResult(null);
    setError('');
    setView('upload');
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    onFile(e.dataTransfer.files[0]);
  };

  const missing = draft ? withoutSpeaker(draft) : 0;

  return (
    <>
      <TopBar onHome={reset} />
      <Page tight={view === 'upload' && !busy}>
        {view === 'upload' && !busy && (
          <div className="flex min-h-[calc(100dvh-8.25rem)] flex-col justify-center gap-6">
            <h1 className="text-center text-3xl font-bold leading-tight sm:text-4xl">{t('heroTitle')}</h1>

            {error && (
              <p className="card border-red-400/50 p-4 text-red-300" dir="auto" role="alert">
                {error}
              </p>
            )}

            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`flex cursor-pointer flex-col items-center gap-5 rounded-3xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
                dragging ? 'border-mine bg-mine/10' : 'border-line bg-card/60 hover:border-mine/60'
              }`}
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-mine/15 text-mine">
                <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden {...stroke}>
                  <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
                </svg>
              </span>
              <span className="btn btn-primary text-xl">{t('chooseFile')}</span>
              <span className="text-dim">{t('dropTitle')}</span>
              <input
                ref={input}
                type="file"
                className="sr-only"
                accept=".pdf,.docx,.odt,.rtf,.html,.htm,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text,application/rtf,text/*"
                onChange={(e) => {
                  onFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>

            <p className="flex items-center justify-center gap-2 text-center text-sm text-dim">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden {...stroke}>
                <rect x="5" y="11" width="14" height="9" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
              {t('privacy')}
            </p>
          </div>
        )}

        {view !== 'upload' && !busy && <Stepper steps={[t('stepUpload'), t('stepCheck'), t('stepDownload')]} current={view === 'check' ? 1 : 2} />}
        {busy === 'read' && <ProgressCard title={t('reading')} hint={fileName} estimateMs={4000} />}
        {busy === 'build' && <ProgressCard title={t('creating')} estimateMs={1500} />}

        {view === 'check' && draft && !busy && (
          <>
            {error && (
              <p className="card border-red-400/50 p-4 text-red-300" role="alert">
                {error}
              </p>
            )}
            <h2 className="text-2xl font-bold">{t('checkTitle')}</h2>
            <p className={recognized ? 'text-dim' : 'text-mine'}>
              {recognized ? t('found', { c: draft.characters.length, s: draft.speeches.length }) : t('notRecognized')}
              {missing > 0 && recognized && <span className="text-red-300"> · {missing === 1 ? t('noSpeakerOne') : t('noSpeaker', { n: missing })}</span>}
            </p>
            <input className="field text-2xl font-bold" dir="auto" aria-label={t('title')} placeholder={t('title')} value={draft.title} onChange={(e) => update((d) => ({ ...d, title: e.target.value }))} />
            <input className="field" dir="auto" aria-label={t('author')} placeholder={t('author')} value={draft.author} onChange={(e) => update((d) => ({ ...d, author: e.target.value }))} />
            <CharactersEditor draft={draft} update={update} />
            <SpeechesEditor draft={draft} update={update} />
          </>
        )}

        {view === 'ready' && result && !busy && (
          <div className="card flex flex-col items-center gap-4 p-8 text-center">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-other/15 text-4xl text-other" aria-hidden>
              ✓
            </span>
            <p className="text-2xl font-bold">{t('ready')}</p>
            <p className="text-dim">
              {result.rows} {t('rows')} · {t('readyHint')}
            </p>
            <a className="btn btn-primary w-full text-xl" href={result.url} download={result.name}>
              ⬇ {t('download')}
            </a>
            <button className="btn w-full" onClick={() => setView('check')}>
              {t('backToEdit')}
            </button>
            <button className="btn w-full" onClick={reset}>
              + {t('newFile')}
            </button>
          </div>
        )}
      </Page>

      {view === 'check' && draft && !busy && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/90 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
          <div className="mx-auto flex max-w-2xl gap-3">
            <button className="btn" onClick={reset}>
              {t('back')}
            </button>
            <button className="btn btn-primary flex-1 text-xl" onClick={build}>
              ✓ {t('createTable')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
