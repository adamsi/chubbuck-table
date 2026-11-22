'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { useI18n } from '@/lib/i18n';
import { LangMenu } from './LangMenu';

/** The app's mark: a worksheet with a filled header row (same as the favicon). */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden>
      <rect width="64" height="64" rx="14" fill="#191c23" />
      <path d="M12 21a6 6 0 0 1 6-6h28a6 6 0 0 1 6 6v6H12z" fill="#fbbf24" />
      <rect x="12" y="15" width="40" height="36" rx="6" fill="none" stroke="#fbbf24" strokeWidth="3.5" />
      <path d="M28 27v24M40 27v24M12 39h40" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function TopBar({ onHome }: { onHome?: () => void }) {
  const { t } = useI18n();
  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-bg/80 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
        <button className="flex min-w-0 flex-1 items-center gap-3 text-start" onClick={onHome} aria-label={t('appName')}>
          <Logo size={34} />
          <span className="truncate text-xl font-bold">{t('appName')}</span>
        </button>
        <LangMenu />
      </div>
    </header>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pb-36 pt-5">{children}</main>;
}

/** Steps of a flow: finished steps are filled, the current one is highlighted. */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex gap-2" aria-label={steps[current]}>
      {steps.map((s, i) => (
        <li key={s} className="flex min-w-0 flex-1 flex-col gap-1.5" aria-current={i === current ? 'step' : undefined}>
          <span className={`h-1.5 rounded-full transition-colors ${i <= current ? 'bg-mine' : 'bg-card2'}`} />
          <span className={`truncate text-center text-sm ${i === current ? 'font-bold text-ink' : i < current ? 'text-ink/70' : 'text-dim'}`}>
            {i < current ? '✓ ' : ''}
            {s}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Progress card. With `estimateMs` it eases toward (never reaching) the end until the work finishes. */
export function ProgressCard({ title, hint, estimateMs }: { title: string; hint?: string; estimateMs: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const startedAt = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - startedAt), 200);
    return () => clearInterval(timer);
  }, []);
  const pct = Math.round(95 * (1 - Math.exp((-2.2 * elapsed) / estimateMs)));
  return (
    <div className="card flex flex-col gap-4 p-6" role="status" aria-live="polite">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-2xl font-semibold">{title}</p>
        <p className="text-xl font-bold tabular-nums text-mine" dir="ltr">
          {pct}%
        </p>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-card2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className="bar-live h-full rounded-full bg-mine transition-[width] duration-300 ease-out" style={{ width: `${Math.max(pct, 4)}%` }} />
      </div>
      {hint && <p className="truncate text-dim" dir="auto">{hint}</p>}
    </div>
  );
}
