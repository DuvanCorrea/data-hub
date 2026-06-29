// ─── SettingsPage (modules/settings/SettingsPage.tsx) ────────────────────────
import { useEffect, useState, useCallback } from "react";
import {
  FontAwesomeIcon
} from "@fortawesome/react-fontawesome";
import {
  faGear, faRotateLeft, faFloppyDisk,
  faCircleInfo, faCircleCheck, faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import { settingsService } from "./settings.service";
import type { ParametroDto } from "@/contracts/api.types";
import { useAuth } from "@/modules/auth/AuthContext";
import { cn } from "@/lib/utils";

const APP_LABELS: Record<string, string> = {
  SYSTEM: "Sistema",
  DROPI:  "Dropi",
};

// ── Input por tipo de dato ────────────────────────────────────────────────────
function ParametroInput({
  param,
  draft,
  onChange,
}: {
  param: ParametroDto;
  draft: string;
  onChange: (v: string) => void;
}) {
  if (!param.esEditable) {
    return (
      <span className="text-sm font-mono text-muted-foreground bg-muted px-3 py-1.5 rounded-lg border border-border">
        {draft}
      </span>
    );
  }

  if (param.tipoDato === "SELECT" && param.opciones.length > 0) {
    return (
      <select
        value={draft}
        onChange={e => onChange(e.target.value)}
        className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
      >
        {param.opciones.map(o => (
          <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
        ))}
      </select>
    );
  }

  if (param.tipoDato === "BOOLEAN") {
    return (
      <button
        onClick={() => onChange(draft === "true" ? "false" : "true")}
        className={cn(
          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50",
          draft === "true" ? "bg-primary" : "bg-muted"
        )}
      >
        <span className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow",
          draft === "true" ? "translate-x-6" : "translate-x-1"
        )} />
      </button>
    );
  }

  if (param.tipoDato === "NUMBER") {
    return (
      <input
        type="number"
        value={draft}
        min={0}
        onChange={e => onChange(e.target.value)}
        className="w-28 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/50"
      />
    );
  }

  return (
    <input
      type="text"
      value={draft}
      onChange={e => onChange(e.target.value)}
      className="w-64 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
    />
  );
}

// ── Fila de parámetro ────────────────────────────────────────────────────────
function ParametroRow({
  param,
  isAdmin,
}: {
  param: ParametroDto;
  isAdmin: boolean;
}) {
  const [draft, setDraft]     = useState(param.valor);
  const [saving, setSaving]   = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const isDirty   = draft !== param.valor;
  const isDefault = draft === param.valorDefecto;

  const save = async () => {
    setSaving(true); setError(null);
    try {
      await settingsService.update(param.clave, draft);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (e: any) {
      setError(e.response?.data?.message ?? "Error al guardar.");
    } finally { setSaving(false); }
  };

  const resetToDefault = async () => {
    setSaving(true); setError(null);
    try {
      const updated = await settingsService.reset(param.clave);
      setDraft(updated.valor);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (e: any) {
      setError(e.response?.data?.message ?? "Error al resetear.");
    } finally { setSaving(false); }
  };

  return (
    <div className={cn(
      "flex items-start gap-4 py-4 px-5 border-b border-border/50 last:border-0 transition-colors",
      isDirty && "bg-primary/3"
    )}>
      {/* Info del parámetro */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{param.etiqueta}</p>
          {param.valorModificado && (
            <span className="text-[9px] font-semibold uppercase tracking-wider bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 rounded-full px-1.5 py-0.5">
              Modificado
            </span>
          )}
        </div>
        {param.descripcion && (
          <p className="text-xs text-muted-foreground flex gap-1.5 items-start">
            <FontAwesomeIcon icon={faCircleInfo} className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground/60" />
            {param.descripcion}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground/50 font-mono">{param.clave}</p>
      </div>

      {/* Control */}
      <div className="flex items-center gap-2 shrink-0">
        {isAdmin && param.esEditable ? (
          <>
            <ParametroInput param={param} draft={draft} onChange={setDraft} />

            {/* Reset al default */}
            {!isDefault && (
              <button
                onClick={resetToDefault}
                disabled={saving}
                title={`Restaurar a: ${param.valorDefecto}`}
                className="flex items-center justify-center h-8 w-8 rounded-lg border border-border text-muted-foreground hover:border-yellow-500/50 hover:text-yellow-400 transition-colors disabled:opacity-40"
              >
                <FontAwesomeIcon icon={faRotateLeft} className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Guardar */}
            <button
              onClick={save}
              disabled={!isDirty || saving}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40",
                isDirty
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              <FontAwesomeIcon
                icon={success ? faCircleCheck : faFloppyDisk}
                className={cn("h-3 w-3", success && "text-green-400")}
              />
              {saving ? "Guardando…" : success ? "Guardado" : "Guardar"}
            </button>
          </>
        ) : (
          <ParametroInput param={param} draft={draft} onChange={() => {}} />
        )}
      </div>

      {error && (
        <p className="text-xs text-red-400 flex items-center gap-1 shrink-0">
          <FontAwesomeIcon icon={faTriangleExclamation} className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export function SettingsPage() {
  const { user }                = useAuth();
  const isAdmin                 = user?.role === "ADMIN";
  const [params, setParams]     = useState<ParametroDto[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setParams(await settingsService.list());
      setError(null);
    } catch (e: any) {
      setError(e.response?.data?.message ?? "No se pudo cargar la configuración.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Agrupar por aplicación
  const groups = params.reduce<Record<string, ParametroDto[]>>((acc, p) => {
    (acc[p.aplicacion] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-6 max-w-4xl animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2.5">
          <FontAwesomeIcon icon={faGear} className="h-5 w-5 text-muted-foreground" />
          Ajustes
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configuración global del sistema.
          {!isAdmin && " Solo los administradores pueden modificar estos valores."}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-red-400 flex gap-2">
          <FontAwesomeIcon icon={faTriangleExclamation} className="h-4 w-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl border border-border overflow-hidden">
              <div className="h-10 bg-muted/40 animate-pulse" />
              <div className="divide-y divide-border/50">
                {[1, 2].map(j => (
                  <div key={j} className="flex items-center gap-4 px-5 py-4">
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 w-48 bg-muted animate-pulse rounded" />
                      <div className="h-3 w-72 bg-muted animate-pulse rounded opacity-60" />
                    </div>
                    <div className="h-8 w-28 bg-muted animate-pulse rounded-lg" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groups).map(([app, items]) => (
            <div key={app} className="rounded-xl border border-border overflow-hidden">
              {/* Header del grupo */}
              <div className="flex items-center gap-2 px-5 py-3 bg-muted/40 border-b border-border">
                <span className={cn(
                  "text-[10px] font-bold uppercase tracking-widest",
                  app === "DROPI"  ? "text-violet-400" : "text-muted-foreground"
                )}>
                  {APP_LABELS[app] ?? app}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  · {items.length} {items.length === 1 ? "parámetro" : "parámetros"}
                </span>
              </div>

              {/* Filas */}
              <div className="divide-y divide-border/50">
                {items.map(p => (
                  <ParametroRow key={p.clave} param={p} isAdmin={isAdmin} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
