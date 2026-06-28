// ─── DateRangePicker (modules/dropi/components/DateRangePicker.tsx) ──────────
import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendarDays, faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils";

export interface DateRange {
  desde: string;   // YYYY-MM-DD
  hasta: string;
}

interface Preset { label: string; days: number; }

const PRESETS: Preset[] = [
  { label: "Hoy",      days: 0  },
  { label: "7 días",   days: 6  },
  { label: "1 mes",    days: 29 },
  { label: "1 año",    days: 364 },
];

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildRange(days: number): DateRange {
  const today = new Date();
  const desde = new Date(today);
  desde.setDate(today.getDate() - days);
  return { desde: toIso(desde), hasta: toIso(today) };
}

export function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (r: DateRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange>(value);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const fmt = (s: string) => {
    if (!s) return "?";
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  };

  const openPicker = () => {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left });
    }
    setDraft(value);
    setOpen(true);
  };

  const applyPreset = (days: number) => {
    const r = buildRange(days);
    onChange(r);
    setOpen(false);
  };

  const applyCustom = () => {
    if (draft.desde && draft.hasta) {
      onChange(draft);
      setOpen(false);
    }
  };

  // Detectar qué preset está activo
  const activePreset = PRESETS.find(p => {
    const r = buildRange(p.days);
    return r.desde === value.desde && r.hasta === value.hasta;
  });

  return (
    <>
      <button
        ref={triggerRef}
        onClick={openPicker}
        className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground hover:border-primary/50 transition-colors"
      >
        <FontAwesomeIcon icon={faCalendarDays} className="text-muted-foreground h-3.5 w-3.5" />
        <span className="tabular-nums">
          {fmt(value.desde)} — {fmt(value.hasta)}
        </span>
        <FontAwesomeIcon icon={faChevronDown} className="text-muted-foreground h-2.5 w-2.5 ml-1" />
      </button>

      {/* Accesos rápidos inline */}
      <div className="flex gap-1">
        {PRESETS.map(p => (
          <button
            key={p.label}
            onClick={() => applyPreset(p.days)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors border",
              activePreset?.label === p.label
                ? "bg-primary/20 text-primary border-primary/40"
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {open && createPortal(
        <>
          <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={() => setOpen(false)} />
          <div
            style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999 }}
            className="w-72 rounded-xl border border-border bg-card shadow-2xl p-4 space-y-4"
          >
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Rango personalizado
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Desde</label>
                <input type="date" value={draft.desde}
                  onChange={e => setDraft(d => ({ ...d, desde: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Hasta</label>
                <input type="date" value={draft.hasta}
                  onChange={e => setDraft(d => ({ ...d, hasta: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
              </div>
            </div>
            <button
              onClick={applyCustom}
              disabled={!draft.desde || !draft.hasta}
              className="w-full rounded-lg bg-primary text-primary-foreground py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
            >
              Aplicar
            </button>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
