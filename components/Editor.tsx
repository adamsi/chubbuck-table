'use client';
import { useRef } from 'react';
import { useI18n } from '@/lib/i18n';
import { addCharacter, addSpeechBelow, deleteSpeech, isUsed, mergeWithPrevious, removeCharacter, renameCharacter, setSpeech, splitSpeech, type Draft } from '@/lib/draft';
import Select from './Select';

type Update = (fn: (d: Draft) => Draft) => void;

function AutoTextarea({ value, onChange, label, textarea }: { value: string; onChange: (v: string) => void; label: string; textarea: (el: HTMLTextAreaElement | null) => void }) {
  return (
    <textarea
      ref={(el) => {
        textarea(el);
        if (el) {
          el.style.height = 'auto';
          el.style.height = `${el.scrollHeight + 2}px`;
        }
      }}
      rows={1}
      dir="auto"
      aria-label={label}
      className="field resize-none text-xl leading-relaxed"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function CharactersEditor({ draft, update }: { draft: Draft; update: Update }) {
  const { t } = useI18n();
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-bold">{t('characters')}</h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {draft.characters.map((c) => (
          <div key={c.key} className="flex items-center gap-2">
            <input
              className="field min-w-0 flex-1 font-bold text-other"
              dir="auto"
              aria-label={t('characterName')}
              placeholder={t('characterName')}
              value={c.name}
              onChange={(e) => update((d) => renameCharacter(d, c.key, e.target.value))}
            />
            {!isUsed(draft, c.key) && (
              <button className="btn btn-sm btn-danger px-3" aria-label={t('removeCharacter')} title={t('removeCharacter')} onClick={() => update((d) => removeCharacter(d, c.key))}>
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
      <button className="btn btn-sm self-start" onClick={() => update(addCharacter)}>
        + {t('addCharacter')}
      </button>
    </section>
  );
}

export function SpeechesEditor({ draft, update }: { draft: Draft; update: Update }) {
  const { t } = useI18n();
  const areas = useRef(new Map<string, HTMLTextAreaElement>());
  const options = [
    ...draft.characters.map((c) => ({ value: c.key, label: c.name.trim() || '—' })),
    { value: '', label: t('noSpeakerOption') },
  ];

  return (
    <section className="flex flex-col gap-3">
      {draft.speeches.map((s, i) => {
        const named = draft.characters.some((c) => c.key === s.speaker && c.name.trim());
        return (
          <div key={s.key} className="card flex flex-col gap-2 p-3">
            <div className="flex items-center gap-2">
              <span className="w-8 shrink-0 text-center text-dim" dir="ltr">
                {i + 1}
              </span>
              <Select
                className={`min-w-0 flex-1 font-bold ${named ? 'text-other' : 'text-red-300'}`}
                label={t('speaker')}
                value={s.speaker}
                options={options}
                onChange={(v) => update((d) => setSpeech(d, s.key, { speaker: v }))}
              />
              <button className="btn btn-sm btn-danger px-3" aria-label={t('deleteSpeech')} title={t('deleteSpeech')} onClick={() => update((d) => deleteSpeech(d, s.key))}>
                ✕
              </button>
            </div>
            <AutoTextarea
              label={`${t('speechText')} ${i + 1}`}
              value={s.text}
              onChange={(v) => update((d) => setSpeech(d, s.key, { text: v }))}
              textarea={(el) => {
                if (el) areas.current.set(s.key, el);
                else areas.current.delete(s.key);
              }}
            />
            <div className="flex flex-wrap gap-2">
              {i > 0 && (
                <button className="btn btn-sm" onClick={() => update((d) => mergeWithPrevious(d, s.key))}>
                  ↑ {t('mergeUp')}
                </button>
              )}
              <button
                className="btn btn-sm"
                title={t('splitHint')}
                onClick={() => {
                  const at = areas.current.get(s.key)?.selectionStart ?? 0;
                  update((d) => splitSpeech(d, s.key, at));
                }}
              >
                ✂ {t('split')}
              </button>
              <button className="btn btn-sm" onClick={() => update((d) => addSpeechBelow(d, s.key))}>
                + {t('addBelow')}
              </button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
