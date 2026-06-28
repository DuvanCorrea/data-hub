// ─── Utilities (lib/utils.ts) ─────────────────────────────────────────────────
// General helpers. Keep pure functions only — no side effects.
// ─────────────────────────────────────────────────────────────────────────────

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** shadcn's cn() helper — merges Tailwind classes without conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format ISO date string to readable locale format. */
export function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

/** Clamp a number between min and max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
