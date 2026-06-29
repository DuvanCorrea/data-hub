import { pool } from '../db';
import { loadParams, params as p } from '../config/params';
import { RecordsRepository } from '../repository/RecordsRepository';
import { LogRepository } from '../repository/LogRepository';
import { ErpNextClient, isRetryable } from '../client/ErpNextClient';
import { build as buildPayload } from '../transformers';
import type {
  IncomingRecord,
  EntityType,
  ErpVersion,
  TriggeredBy,
  ErrorCode,
} from '../types';

const recordsRepo = new RecordsRepository();
const logRepo = new LogRepository();

// ─── Procesamiento de un solo registro ───────────────────────────────────────

export async function processOne(
  record: IncomingRecord,
  triggeredBy: TriggeredBy = 'scheduler',
): Promise<void> {
  const currentParams = await loadParams();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await recordsRepo.markProcessing(record.id, client);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    console.error(`[engine] Error marking record ${record.id} as processing:`, (err as Error).message);
    return;
  }
  client.release();

  const startedAt = new Date();

  // ─── Construir payload ──────────────────────────────────────────────────────
  let erpPayload: Record<string, unknown>;
  try {
    erpPayload = buildPayload(
      record.entity_type as EntityType,
      record.erp_doctype === 'Customer'
        ? 'v16'
        : (currentParams['ERPSYNC_VERSION'] ?? 'v16') as ErpVersion,
      record.payload,
      currentParams,
      { external_id: record.external_id, source_name: record.source_name },
    );
  } catch (transformErr) {
    await _persistResult(record, {
      triggeredBy,
      startedAt,
      success: false,
      method: null,
      httpStatus: null,
      httpUrl: null,
      requestPayload: record.payload,
      responseBody: {},
      errorCode: 'TRANSFORM',
      errorMessage: (transformErr as Error).message,
      erpRecordId: null,
      logPayload: p.logPayload(currentParams),
    });
    return;
  }

  // ─── Instanciar cliente ERP ─────────────────────────────────────────────────
  const erpClient = new ErpNextClient(currentParams);
  const retryDelayMin = p.retryDelayMin(currentParams);

  // ─── Buscar si ya existe en ERPNext ────────────────────────────────────────
  const idField = p.customerIdField(currentParams);
  const idValue = record.entity_type === 'customer'
    ? (erpPayload[idField] as string | undefined) ?? (erpPayload['email_id'] as string | undefined)
    : null;

  let existingName: string | null = null;

  // Solo buscar si tenemos un campo identificador válido
  if (idValue) {
    try {
      existingName = await erpClient.findExisting(record.erp_doctype, idField, idValue);
    } catch (_findErr) {
      // Si falla la búsqueda por red, lo tratamos como error de red
      await _persistResult(record, {
        triggeredBy,
        startedAt,
        success: false,
        method: null,
        httpStatus: null,
        httpUrl: null,
        requestPayload: erpPayload,
        responseBody: {},
        errorCode: 'NETWORK',
        errorMessage: 'Error buscando en ERPNext: ' + (_findErr as Error).message,
        erpRecordId: null,
        logPayload: p.logPayload(currentParams),
      });
      return;
    }
  }

  // También usar erp_record_id guardado si existe (de sync anterior)
  if (!existingName && record.erp_record_id) {
    existingName = record.erp_record_id;
  }

  // ─── POST o PUT ──────────────────────────────────────────────────────────────
  let callResult = existingName
    ? await erpClient.put(record.erp_doctype, existingName, erpPayload)
    : await erpClient.post(record.erp_doctype, erpPayload);

  // Manejo especial de 409 DUPLICATE: fallback automático a PUT
  if (!callResult.success && callResult.errorCode === 'DUPLICATE' && existingName === null) {
    console.log(`[engine] Record ${record.id}: 409 DUPLICATE on POST, retrying as PUT with name lookup`);
    // Intentar de nuevo buscando el nombre y haciendo PUT
    try {
      const nameFromResponse =
        (callResult.responseBody?.exc_type as string | undefined) ?? null;
      if (nameFromResponse) {
        callResult = await erpClient.put(record.erp_doctype, nameFromResponse, erpPayload);
      }
    } catch (_retryErr) {
      // Si el fallback también falla, continuar con el error original
    }
  }

  await _persistResult(record, {
    triggeredBy,
    startedAt,
    success: callResult.success,
    method: callResult.method,
    httpStatus: callResult.status,
    httpUrl: callResult.url,
    requestPayload: callResult.requestPayload,
    responseBody: callResult.responseBody,
    errorCode: callResult.errorCode,
    errorMessage: callResult.errorMessage,
    erpRecordId: callResult.erpRecordId,
    logPayload: p.logPayload(currentParams),
    retryDelayMin,
  });
}

// ─── Batch del scheduler ──────────────────────────────────────────────────────

export async function runBatch(): Promise<number> {
  const currentParams = await loadParams();

  if (!p.isEnabled(currentParams)) {
    console.log('[engine] Scheduler desactivado (ERPSYNC_ENABLED=false)');
    return 0;
  }

  const batchSize = p.batchSize(currentParams);
  const client = await pool.connect();
  let records: IncomingRecord[] = [];

  try {
    await client.query('BEGIN');
    records = await recordsRepo.claimBatch(batchSize, client);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[engine] Error claiming batch:', (err as Error).message);
    return 0;
  } finally {
    client.release();
  }

  if (records.length === 0) return 0;

  console.log(`[engine] Processing batch of ${records.length} records`);

  // Procesar en paralelo con concurrencia controlada (máximo 5 simultáneos)
  const CONCURRENCY = 5;
  for (let i = 0; i < records.length; i += CONCURRENCY) {
    const chunk = records.slice(i, i + CONCURRENCY);
    await Promise.allSettled(chunk.map((r) => processOne(r, 'scheduler')));
  }

  return records.length;
}

// ─── Helper interno para persistir resultado ──────────────────────────────────

interface PersistInput {
  triggeredBy: TriggeredBy;
  startedAt: Date;
  success: boolean;
  method: string | null;
  httpStatus: number | null;
  httpUrl: string | null;
  requestPayload: Record<string, unknown>;
  responseBody: Record<string, unknown>;
  errorCode: ErrorCode | null;
  errorMessage: string | null;
  erpRecordId: string | null;
  logPayload: boolean;
  retryDelayMin?: number;
}

async function _persistResult(
  record: IncomingRecord,
  input: PersistInput,
): Promise<void> {
  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - input.startedAt.getTime();

  // Obtener la versión ERP de la fuente
  const { rows: sourceRows } = await pool.query<{ erp_version: string }>(
    'SELECT erp_version FROM erpsync_sources WHERE source_name = $1',
    [record.source_name],
  );
  const erpVersion = sourceRows[0]?.erp_version ?? 'v16';

  // Escribir log
  try {
    await logRepo.insert({
      record_id: record.id,
      attempt_number: record.attempts + 1,
      triggered_by: input.triggeredBy,
      started_at: input.startedAt,
      finished_at: finishedAt,
      duration_ms: durationMs,
      erp_version: erpVersion,
      erp_doctype: record.erp_doctype,
      http_method: input.method as 'POST' | 'PUT' | 'GET' | null,
      http_url: input.httpUrl,
      http_status: input.httpStatus,
      request_payload: input.requestPayload,
      response_body: input.responseBody,
      result: input.success ? 'success' : 'error',
      error_code: input.errorCode,
      error_message: input.errorMessage,
      log_payload: input.logPayload,
    });
  } catch (logErr) {
    console.error(`[engine] Failed to write log for record ${record.id}:`, (logErr as Error).message);
  }

  // Actualizar estado del registro
  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');

    if (input.success && input.erpRecordId) {
      await recordsRepo.markSynced(
        record.id,
        input.erpRecordId,
        input.method === 'PUT' ? 'PUT' : 'POST',
        dbClient,
      );
    } else {
      const errorCode = input.errorCode ?? 'SERVER_ERROR';
      const notRetryable = !isRetryable(errorCode as ErrorCode);

      // Errores no reintentables van directo a blocked
      const retryDelay = notRetryable ? 0 : (input.retryDelayMin ?? 10);

      // Si no es reintentable, forzar max_attempts para que pase a blocked
      if (notRetryable) {
        await dbClient.query(
          'UPDATE erpsync_incoming_records SET max_attempts = attempts WHERE id = $1',
          [record.id],
        );
      }

      await recordsRepo.markError(
        record.id,
        errorCode as ErrorCode,
        input.errorMessage ?? 'Error desconocido',
        retryDelay,
        dbClient,
      );
    }

    await dbClient.query('COMMIT');
  } catch (err) {
    await dbClient.query('ROLLBACK');
    console.error(`[engine] Error updating record ${record.id} status:`, (err as Error).message);
  } finally {
    dbClient.release();
  }
}
