// ─── SettingsPage (modules/settings/SettingsPage.tsx) ────────────────────────
import { useEffect, useState, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGear, faRotateLeft, faFloppyDisk, faCircleInfo,
  faCircleCheck, faTriangleExclamation, faArrowsRotate,
} from "@fortawesome/free-solid-svg-icons";
import { settingsService } from "./settings.service";
import type { ParametroDto } from "@/contracts/api.types";
import { useAuth } from "@/modules/auth/AuthContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const APP_LABELS: Record<string, string> = {
  SYSTEM: "Sistema",
  DROPI:  "Dropi",
};
const APP_COLORS: Record<string, string> = {
  DROPI:  "text-violet-400",
  SYSTEM: "text-muted-foreground",
};

// ── Input por tipo de dato ─────────────────────────────────────────────────────
function ParametroInput({
  param, draft, onChange, disabled,
}: { param: ParametroDto; draft: string; onChange: (v: string) => void; disabled: boolean }) {
  const base = "rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed";

  if (!param.esEditable || disabled) {
    return (
      <span className="font-mono text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg border border-border/50">
        {draft}
      </span>
    );
  }
  if (param.tipoDato === "SELECT" && param.opciones.length > 0) {
    return (
      <select value={draft} onChange={e => onChange(e.target.value)} className={base}>
        {param.opciones.map(o => (
          <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
        ))}
      </select>
    );
  }
  if (param.tipoDato === "BOOLEAN") {
    return (
      <button onClick={() => onChange(draft === "true" ? "false" : "true")}
        className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50",
          draft === "true" ? "bg-primary" : "bg-muted border border-border")}>
        <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
          draft === "true" ? "translate-x-6" : "translate-x-1")} />
      </button>
    );
  }
  if (param.tipoDato === "NUMBER") {
    return (
      <input type="number" value={draft} min={0} onChange={e => onChange(e.target.value)}
        className={cn(base, "w-32 tabular-nums")} />
    );
  }
  return (
    <input type="text" value={draft} onChange={e => onChange(e.target.value)}
      className={cn(base, "w-64")} />
  );
}

// ── Fila de parámetro ─────────────────────────────────────────────────────────
function ParametroRow({ param, isAdmin, onSaved }: {
  param: ParametroDto; isAdmin: boolean; onSaved: (updated: ParametroDto) => void;
}) {
  const [draft, setDraft]     = useState(param.valor);
  const [saving, setSaving]   = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Sincronizar si el param cambió externamente (e.g. reset all)
  useEffect(() => { setDraft(param.valor); }, [param.valor]);

  const isDirty   = draft !== param.valor;
  const isDefault = param.valor === param.valorDefecto;

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const updated = await settingsService.update(param.clave, draft);
      onSaved(updated);
      setSuccess(true); setTimeout(() => setSuccess(false), 2500);
    } catch (e: any) { setError(e.response?.data?.message ?? "Error al guardar."); }
    finally { setSaving(false); }
  };

  const resetToDefault = async () => {
    setSaving(true); setError(null);
    try {
      const updated = await settingsService.reset(param.clave);
      onSaved(updated); setDraft(updated.valor);
      setSuccess(true); setTimeout(() => setSuccess(false), 2500);
    } catch (e: any) { setError(e.response?.data?.message ?? "Error al resetear."); }
    finally { setSaving(false); }
  };

  return (
    <div className={cn(
      "grid grid-cols-1 gap-3 py-4 px-5 border-b border-border/50 last:border-0 transition-colors",
      "sm:grid-cols-[1fr_auto]",
      isDirty && "bg-primary/[0.03]"
    )}>
      {/* Info */}
      <div className="space-y-0.5 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{param.etiqueta}</span>
          {!isDefault && (
            <span className="text-[9px] font-semibold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-full px-1.5 py-0.5 shrink-0">
              Modificado
            </span>
          )}
        </div>
        {param.descripcion && (
          <p className="text-xs text-muted-foreground leading-relaxed flex gap-1.5 items-start">
            <FontAwesomeIcon icon={faCircleInfo} className="h-3 w-3 mt-0.5 shrink-0 opacity-60" />
            <span>{param.descripcion}</span>
          </p>
        )}
        <p className="text-[10px] font-mono text-muted-foreground/40 mt-0.5">{param.clave}</p>
        {error && (
          <p className="text-xs text-red-400 flex items-center gap-1 mt-1">
            <FontAwesomeIcon icon={faTriangleExclamation} className="h-3 w-3 shrink-0" />
            {error}
          </p>
        )}
      </div>

      {/* Controles */}
      <div className="flex items-center gap-2 sm:justify-end flex-wrap">
        <ParametroInput param={param} draft={draft} onChange={setDraft} disabled={!isAdmin} />

        {isAdmin && param.esEditable && (
          <>
            {!isDefault && (
              <button onClick={resetToDefault} disabled={saving}
                title={`Restaurar a: ${param.valorDefecto}`}
                className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:border-amber-500/50 hover:text-amber-400 transition-colors disabled:opacity-40 shrink-0">
                <FontAwesomeIcon icon={faRotateLeft} className="h-3.5 w-3.5" />
              </button>
            )}
            <button onClick={save} disabled={!isDirty || saving}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0",
                isDirty ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted text-muted-foreground"
              )}>
              <FontAwesomeIcon icon={success ? faCircleCheck : faFloppyDisk}
                className={cn("h-3 w-3", success && "text-green-300")} />
              {saving ? "Guardando…" : success ? "Guardado" : "Guardar"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────
export function SettingsPage() {
  const { user }            = useAuth();
  const isAdmin             = user?.role === "ADMIN";
  const [params, setParams] = useState<ParametroDto[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setParams(await settingsService.list()); setError(null); }
    catch (e: any) { setError(e.response?.data?.message ?? "No se pudo cargar."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaved = (updated: ParametroDto) => {
    setParams(prev => prev.map(p => p.clave === updated.clave ? updated : p));
  };

  const handleResetAll = async () => {
    if (!confirmReset) { setConfirmReset(true); return; }
    setResetting(true); setConfirmReset(false);
    try {
      const updated = await settingsService.resetAll();
      setParams(updated);
      setResetDone(true); setTimeout(() => setResetDone(false), 3000);
    } catch (e: any) { setError(e.response?.data?.message ?? "Error al restablecer."); }
    finally { setResetting(false); }
  };

  const groups = params.reduce<Record<string, ParametroDto[]>>((acc, p) => {
    (acc[p.aplicacion] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2.5">
            <FontAwesomeIcon icon={faGear} className="h-5 w-5 text-muted-foreground" />
            Ajustes
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configuración global del sistema.
            {!isAdmin && <span className="ml-1 text-yellow-400">Solo los administradores pueden modificar estos valores.</span>}
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            {confirmReset && (
              <span className="text-xs text-amber-400 animate-fade-in">
                ¿Seguro? Esto restablecerá todos los parámetros.
              </span>
            )}
            <Button
              variant={confirmReset ? "destructive" : "outline"}
              size="sm"
              onClick={handleResetAll}
              disabled={resetting}
              className="h-9 gap-2"
            >
              <FontAwesomeIcon
                icon={faArrowsRotate}
                className={cn("h-3.5 w-3.5", resetting && "animate-spin")}
              />
              {resetting ? "Restableciendo…" : resetDone ? "Restablecido ✓" : confirmReset ? "Confirmar restauración" : "Restablecer de fábrica"}
            </Button>
            {confirmReset && (
              <button onClick={() => setConfirmReset(false)}
                className="text-xs text-muted-foreground hover:text-foreground">
                Cancelar
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-red-400 flex gap-2">
          <FontAwesomeIcon icon={faTriangleExclamation} className="h-4 w-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="rounded-xl border border-border overflow-hidden">
              <div className="h-10 bg-muted/40 animate-pulse" />
              {[1, 2, 3].map(j => (
                <div key={j} className="flex items-center gap-4 px-5 py-4 border-b border-border/50 last:border-0">
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-48 bg-muted animate-pulse rounded" />
                    <div className="h-3 w-80 bg-muted animate-pulse rounded opacity-60" />
                  </div>
                  <div className="h-8 w-24 bg-muted animate-pulse rounded-lg shrink-0" />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(groups).map(([app, items]) => (
            <div key={app} className="rounded-xl border border-border overflow-hidden bg-card">
              {/* Header del grupo */}
              <div className="flex items-center gap-2 px-5 py-3 bg-muted/30 border-b border-border">
                <span className={cn("text-[11px] font-bold uppercase tracking-widest", APP_COLORS[app] ?? "text-muted-foreground")}>
                  {APP_LABELS[app] ?? app}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  — {items.length} {items.length === 1 ? "parámetro" : "parámetros"}
                </span>
              </div>
              {/* Filas */}
              {items.map(p => (
                <ParametroRow key={p.clave} param={p} isAdmin={isAdmin} onSaved={handleSaved} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
