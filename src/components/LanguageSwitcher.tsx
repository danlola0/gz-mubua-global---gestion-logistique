// Language button: Français / English / 中文 (choice remembered on this device).
import React, { useEffect, useRef, useState } from 'react';
import { Languages } from 'lucide-react';
import { LANGUAGES, getLang, onLangChange, setLang, type Lang } from '../i18n/index.ts';

export const LanguageSwitcher: React.FC<{ variant?: 'dark' | 'light' }> = ({ variant = 'dark' }) => {
  const [lang, setLangState] = useState<Lang>(getLang());
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = onLangChange(setLangState);
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const current = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];
  const buttonClass =
    variant === 'dark'
      ? 'text-slate-200 bg-slate-800 border-slate-700 hover:bg-slate-700'
      : 'text-slate-700 bg-white border-slate-300 hover:bg-slate-50';

  return (
    <div ref={ref} className="relative" data-no-translate>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-bold transition ${buttonClass}`}
        aria-label="Langue / Language / 语言"
        title="Langue / Language / 语言"
      >
        <Languages className="h-4 w-4 text-amber-400" />
        {current.short}
      </button>
      {open && (
        <div className="absolute right-0 z-[80] mt-1 w-36 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-xs shadow-xl">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => {
                setLang(l.code);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between px-3 py-2 text-left hover:bg-amber-50 ${l.code === lang ? 'font-black text-amber-700' : 'text-slate-700'}`}
            >
              {l.label}
              {l.code === lang && <span>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
