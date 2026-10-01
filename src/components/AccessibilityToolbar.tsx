import { useEffect, useState } from "react";
import { Accessibility, X, RotateCcw } from "lucide-react";

type A11y = { scale: number; contrast: boolean; links: boolean; readable: boolean };
const DEFAULT: A11y = { scale: 1, contrast: false, links: false, readable: false };
const KEY = "a11y-prefs";

function apply(s: A11y) {
  const r = document.documentElement;
  r.style.fontSize = s.scale === 1 ? "" : `${s.scale * 100}%`;
  r.classList.toggle("a11y-contrast", s.contrast);
  r.classList.toggle("a11y-links", s.links);
  r.classList.toggle("a11y-readable", s.readable);
}

export function AccessibilityToolbar() {
  const [open, setOpen] = useState(false);
  const [s, setS] = useState<A11y>(DEFAULT);

  useEffect(() => {
    try { const v = localStorage.getItem(KEY); if (v) setS({ ...DEFAULT, ...JSON.parse(v) }); } catch { /* ignore */ }
  }, []);
  useEffect(() => { apply(s); try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } }, [s]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const btn = "w-full rounded-xl border border-border px-3 py-2.5 text-sm font-medium text-right transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring";
  const on = "bg-primary text-primary-foreground hover:bg-primary/90";

  return (
    <div dir="rtl">
      <button
        type="button"
        aria-label="תפריט נגישות"
        aria-expanded={open}
        aria-controls="a11y-panel"
        onClick={() => setOpen((o) => !o)}
        className="fixed left-3 top-1/2 z-40 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-organic opacity-90 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Accessibility className="h-5 w-5" aria-hidden />
      </button>
      {open && (
        <div id="a11y-panel" role="dialog" aria-label="הגדרות נגישות" className="fixed left-3 top-1/2 z-50 w-64 -translate-y-1/2 rounded-2xl border border-border bg-card p-4 shadow-organic">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-bold">נגישות</h2>
            <button type="button" aria-label="סגירת תפריט נגישות" onClick={() => setOpen(false)} className="rounded-full bg-muted p-1.5" autoFocus><X className="h-4 w-4" /></button>
          </div>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={btn} onClick={() => setS({ ...s, scale: Math.min(1.5, +(s.scale + 0.1).toFixed(1)) })}>הגדלת גופן +</button>
              <button type="button" className={btn} onClick={() => setS({ ...s, scale: Math.max(0.8, +(s.scale - 0.1).toFixed(1)) })}>הקטנת גופן −</button>
            </div>
            <button type="button" aria-pressed={s.contrast} className={`${btn} ${s.contrast ? on : ""}`} onClick={() => setS({ ...s, contrast: !s.contrast })}>ניגודיות גבוהה</button>
            <button type="button" aria-pressed={s.links} className={`${btn} ${s.links ? on : ""}`} onClick={() => setS({ ...s, links: !s.links })}>הדגשת קישורים</button>
            <button type="button" aria-pressed={s.readable} className={`${btn} ${s.readable ? on : ""}`} onClick={() => setS({ ...s, readable: !s.readable })}>גופן קריא</button>
            <button type="button" className={`${btn} flex items-center gap-2`} onClick={() => setS(DEFAULT)}><RotateCcw className="h-4 w-4" aria-hidden /> איפוס הגדרות</button>
            <a href="/accessibility" className="block pt-1 text-center text-xs text-primary underline">הצהרת נגישות</a>
          </div>
        </div>
      )}
    </div>
  );
}
