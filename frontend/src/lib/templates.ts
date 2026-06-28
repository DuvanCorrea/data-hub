// ─── Template Registry (lib/templates.ts) ────────────────────────────────────
// Única fuente de verdad para las plantillas de importación soportadas.
// Agregar aquí una nueva plantilla la expone automáticamente en Upload y
// en el selector de datos de staging.
// ─────────────────────────────────────────────────────────────────────────────

export interface TemplateConfig {
  id: string;
  label: string;
  description: string;
}

export const TEMPLATES: TemplateConfig[] = [
  {
    id: "DROPI_ORDER",
    label: "Dropi — Órdenes",
    description: "Reporte de órdenes: una fila por orden",
  },
  {
    id: "DOPI_ORDER_PRODUCT",
    label: "Dropi — Órdenes por Producto",
    description: "Reporte de órdenes desglosado: una fila por (orden × producto)",
  },
];

/** Devuelve el label legible de una plantilla dado su id, o el id si no se encuentra */
export function getTemplateLabel(id: string): string {
  return TEMPLATES.find((t) => t.id === id)?.label ?? id;
}
