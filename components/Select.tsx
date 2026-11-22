'use client';
import { useEffect, useId, useRef, useState } from 'react';

export interface Option {
  value: string;
  label: string;
  hint?: string;
}

/**
 * Custom dropdown: a button that opens a sheet with large options
 * (bottom sheet on phones, centered panel on wider screens).
 */
export default function Select({
  value,
  options,
  onChange,
  label,
  className = '',
  placeholder = '—',
}: {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  label: string;
  className?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const el = list.current;
    (el?.querySelector<HTMLElement>('[aria-selected="true"]') || el?.querySelector<HTMLElement>('[role="option"]'))?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function close() {
    setOpen(false);
    button.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    e.stopPropagation();
    if (e.key === 'Escape') return close();
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...(list.current?.querySelectorAll<HTMLElement>('[role="option"]') || [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${current?.label ?? placeholder}`}
        className={`select-btn ${className}`}
        onClick={() => setOpen(true)}
      >
        <span className="min-w-0 flex-1 truncate text-start">{current?.label ?? placeholder}</span>
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden className="shrink-0 text-dim">
          <path d="M5 7.5l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 sm:items-center sm:p-6" onClick={close} onKeyDown={onKeyDown}>
          <div
            ref={list}
            role="listbox"
            aria-labelledby={id}
            className="sheet flex max-h-[75dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-line bg-card pb-[env(safe-area-inset-bottom)] sm:max-w-md sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-line sm:hidden" aria-hidden />
            <p id={id} className="px-5 pb-2 pt-3 text-base text-dim">
              {label}
            </p>
            <div className="overflow-y-auto px-2 pb-3">
              {options.map((o) => {
                const selected = o.value === value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-4 py-2 text-start text-xl outline-none focus-visible:bg-card2 active:bg-card2 ${selected ? 'bg-card2 font-bold text-mine' : ''}`}
                    onClick={() => {
                      onChange(o.value);
                      close();
                    }}
                  >
                    <span className="min-w-0 flex-1" dir="auto">
                      {o.label}
                      {o.hint && <span className="block text-sm font-normal text-dim">{o.hint}</span>}
                    </span>
                    {selected && <span aria-hidden>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
