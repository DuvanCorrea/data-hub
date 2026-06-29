import { pool } from '../db';
import type { SyncLog, LogResult, TriggeredBy, ErpMethod, ErrorCode } from '../types';

export interface InsertLogInput {
  record_id: number;
  attempt_number: number;
  triggered_by: TriggeredBy;
  started_at: Date;
  finished_at: Date;
  duration_ms: number;
  erp_version: string;
  erp_doctype: string;
  http_method: ErpMethod | 'GET' | null;
  http_url: string | null;
  http_status: number | null;
  request_payload: Record<string, unknown> | null;
  response_body: Record<string, unknown> | null;
  result: LogResult;
  error_code: ErrorCode | null;
  error_message: string | null;
  log_payload: boolean;
}

export class LogRepository {
  async insert(input: InsertLogInput): Promise<SyncLog> {
    const { rows } = await pool.query<SyncLog>(
      `INSERT INTO erpsync_log
         (record_id, attempt_number, triggered_by, started_at, finished_at,
          duration_ms, erp_version, erp_doctype, http_method, http_url,
          http_status, request_payload, response_body, result, error_code, error_message)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [
        input.record_id,
        input.attempt_number,
        input.triggered_by,
        input.started_at,
        input.finished_at,
        input.duration_ms,
        input.erp_version,
        input.erp_doctype,
        input.http_method,
        input.http_url,
        input.http_status,
        input.log_payload && input.request_payload
          ? JSON.stringify(input.request_payload)
          : null,
        input.log_payload && input.response_body
          ? JSON.stringify(input.response_body)
          : null,
        input.result,
        input.error_code,
        input.error_message,
      ],
    );
    return rows[0];
  }

  async findByRecordId(recordId: number): Promise<Partial<SyncLog>[]> {
    const { rows } = await pool.query<Partial<SyncLog>>(
      `SELECT id, attempt_number, triggered_by, started_at, finished_at,
              duration_ms, http_method, http_status, result,
              error_code, error_message, erp_version, erp_doctype
         FROM erpsync_log
        WHERE record_id = $1
        ORDER BY started_at ASC`,
      [recordId],
    );
    return rows;
  }
}
