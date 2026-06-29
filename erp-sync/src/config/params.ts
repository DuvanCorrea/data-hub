import { pool } from '../db';
import type { ParamsMap } from '../types';

let cache: ParamsMap = {};
let loadedAt: number | null = null;
const CACHE_TTL_MS = 60_000; // 1 minuto

/**
 * Carga todos los parámetros ERPSYNC desde la tabla erpsync_params.
 * Usa cache con TTL de 1 minuto para no golpear la BD en cada operación.
 */
export async function loadParams(forceRefresh = false): Promise<ParamsMap> {
  const now = Date.now();
  if (!forceRefresh && loadedAt !== null && now - loadedAt < CACHE_TTL_MS) {
    return cache;
  }

  const { rows } = await pool.query<{ clave: string; valor: string }>(
    'SELECT clave, valor FROM erpsync_params',
  );

  cache = Object.fromEntries(rows.map((r) => [r.clave, r.valor]));
  loadedAt = now;
  return cache;
}

/**
 * Invalida el cache para que la próxima llamada fuerce recarga desde BD.
 */
export function invalidateCache(): void {
  loadedAt = null;
}

/**
 * Helpers tipados para acceder a los parámetros más usados.
 */
export const params = {
  isEnabled: (p: ParamsMap): boolean => p['ERPSYNC_ENABLED'] !== 'false',
  cron: (p: ParamsMap): string => p['ERPSYNC_CRON'] ?? '*/15 * * * *',
  maxAttempts: (p: ParamsMap): number => parseInt(p['ERPSYNC_MAX_ATTEMPTS'] ?? '3', 10),
  retryDelayMin: (p: ParamsMap): number => parseInt(p['ERPSYNC_RETRY_DELAY_MIN'] ?? '10', 10),
  batchSize: (p: ParamsMap): number => parseInt(p['ERPSYNC_BATCH_SIZE'] ?? '50', 10),
  erpBaseUrl: (p: ParamsMap): string => p['ERPSYNC_ERP_BASE_URL'] ?? '',
  erpAuth: (p: ParamsMap): string => p['ERPSYNC_ERP_AUTH'] ?? '',
  erpTimeoutMs: (p: ParamsMap): number => parseInt(p['ERPSYNC_ERP_TIMEOUT_MS'] ?? '15000', 10),
  logPayload: (p: ParamsMap): boolean => p['ERPSYNC_LOG_PAYLOAD'] !== 'false',
  customerGroup: (p: ParamsMap): string => p['ERPSYNC_CUSTOMER_GROUP'] ?? 'Individual',
  territory: (p: ParamsMap): string => p['ERPSYNC_TERRITORY'] ?? 'Colombia',
  customerIdField: (p: ParamsMap): string => p['ERPSYNC_CUSTOMER_ID_FIELD'] ?? 'email_id',
};
