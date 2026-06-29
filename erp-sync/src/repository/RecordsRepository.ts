import { Pool, PoolClient } from 'pg';
import { pool } from '../db';
import type {
  IncomingRecord,
  SyncStatus,
  EntityType,
  ErpMethod,
  ErrorCode,
  TriggeredBy,
} from '../types';

// ─── Upsert ───────────────────────────────────────────────────────────────────

export interface UpsertRecordInput {
  source_name: string;
  entity_type: EntityType;
  external_id: string;
  erp_doctype: string;
  payload: Record<string, unknown>;
  max_attempts: number;
  triggered_by: TriggeredBy;
}

export interface UpsertRecordResult {
  record: IncomingRecord;
  action: 'enqueued' | 're_enqueued';
}

// ─── List filters ─────────────────────────────────────────────────────────────

export interface ListRecordsFilter {
  source_name?: string;
  entity_type?: string;
  sync_status?: string;
  from_date?: string;
  to_date?: string;
  page?: number;
  limit?: number;
}

export interface ListRecordsResult {
  total: number;
  page: number;
  limit: number;
  data: Omit<IncomingRecord, 'payload'>[];
}

// ─── Repository ───────────────────────────────────────────────────────────────

export class RecordsRepository {
  private db: Pool;

  constructor(db: Pool = pool) {
    this.db = db;
  }

  /**
   * Inserta o actualiza un registro.
   * - Si no existe: crea nuevo con status 'pending'
   * - Si ya existe: actualiza payload, resetea status a 'pending', limpia errores
   *   (siempre se re-encola; puede que ya no exista en ERPNext)
   */
  async upsert(input: UpsertRecordInput): Promise<UpsertRecordResult> {
    const existing = await this.findByExternalId(
      input.source_name,
      input.entity_type,
      input.external_id,
    );

    if (!existing) {
      const { rows } = await this.db.query<IncomingRecord>(
        `INSERT INTO erpsync_incoming_records
           (source_name, entity_type, external_id, erp_doctype, payload,
            max_attempts, triggered_by, sync_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
         RETURNING *`,
        [
          input.source_name,
          input.entity_type,
          input.external_id,
          input.erp_doctype,
          JSON.stringify(input.payload),
          input.max_attempts,
          input.triggered_by,
        ],
      );
      return { record: rows[0], action: 'enqueued' };
    }

    // Siempre re-encola: actualiza payload y resetea para intentar de nuevo
    const { rows } = await this.db.query<IncomingRecord>(
      `UPDATE erpsync_incoming_records
          SET payload          = $1,
              sync_status      = 'pending',
              attempts         = 0,
              next_attempt_at  = NULL,
              last_error_code  = NULL,
              last_error_msg   = NULL,
              erp_record_id    = NULL,
              erp_method       = NULL,
              triggered_by     = $2,
              updated_at       = NOW()
        WHERE source_name = $3
          AND entity_type = $4
          AND external_id = $5
        RETURNING *`,
      [
        JSON.stringify(input.payload),
        input.triggered_by,
        input.source_name,
        input.entity_type,
        input.external_id,
      ],
    );
    return { record: rows[0], action: 're_enqueued' };
  }

  async findById(id: number): Promise<IncomingRecord | null> {
    const { rows } = await this.db.query<IncomingRecord>(
      'SELECT * FROM erpsync_incoming_records WHERE id = $1',
      [id],
    );
    return rows[0] ?? null;
  }

  async findByExternalId(
    sourceName: string,
    entityType: string,
    externalId: string,
  ): Promise<IncomingRecord | null> {
    const { rows } = await this.db.query<IncomingRecord>(
      `SELECT * FROM erpsync_incoming_records
        WHERE source_name = $1 AND entity_type = $2 AND external_id = $3`,
      [sourceName, entityType, externalId],
    );
    return rows[0] ?? null;
  }

  async findByIds(ids: number[]): Promise<IncomingRecord[]> {
    if (ids.length === 0) return [];
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
    const { rows } = await this.db.query<IncomingRecord>(
      `SELECT * FROM erpsync_incoming_records WHERE id IN (${placeholders})`,
      ids,
    );
    return rows;
  }

  async findByExternalIds(
    sourceName: string,
    externalIds: string[],
  ): Promise<IncomingRecord[]> {
    if (externalIds.length === 0) return [];
    const placeholders = externalIds.map((_, i) => `$${i + 2}`).join(', ');
    const { rows } = await this.db.query<IncomingRecord>(
      `SELECT * FROM erpsync_incoming_records
        WHERE source_name = $1 AND external_id IN (${placeholders})`,
      [sourceName, ...externalIds],
    );
    return rows;
  }

  async list(filter: ListRecordsFilter): Promise<ListRecordsResult> {
    const page = Math.max(1, filter.page ?? 1);
    const limit = Math.min(100, Math.max(1, filter.limit ?? 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (filter.source_name) {
      conditions.push(`source_name = $${idx++}`);
      values.push(filter.source_name);
    }
    if (filter.entity_type) {
      conditions.push(`entity_type = $${idx++}`);
      values.push(filter.entity_type);
    }
    if (filter.sync_status) {
      conditions.push(`sync_status = $${idx++}`);
      values.push(filter.sync_status);
    }
    if (filter.from_date) {
      conditions.push(`created_at >= $${idx++}`);
      values.push(filter.from_date);
    }
    if (filter.to_date) {
      conditions.push(`created_at <= $${idx++}`);
      values.push(filter.to_date);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*)::int AS total FROM erpsync_incoming_records ${where}`;
    const dataQuery = `
      SELECT id, source_name, entity_type, external_id, erp_doctype,
             sync_status, erp_record_id, erp_method, attempts, max_attempts,
             next_attempt_at, last_attempt_at, last_error_code, last_error_msg,
             triggered_by, created_at, updated_at
        FROM erpsync_incoming_records
       ${where}
       ORDER BY created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}
    `;

    const [countRes, dataRes] = await Promise.all([
      this.db.query<{ total: number }>(countQuery, values),
      this.db.query(dataQuery, [...values, limit, offset]),
    ]);

    return {
      total: countRes.rows[0].total,
      page,
      limit,
      data: dataRes.rows,
    };
  }

  // ─── Métodos usados por el SyncEngine ───────────────────────────────────────

  /**
   * Selecciona el próximo batch de registros procesables con FOR UPDATE SKIP LOCKED.
   * Solo fuentes activas. Respeta next_attempt_at y max_attempts.
   * Prioridad: customer=1, item=2, sales_order=3.
   */
  async claimBatch(
    batchSize: number,
    client: PoolClient,
  ): Promise<IncomingRecord[]> {
    const { rows } = await client.query<IncomingRecord>(
      `SELECT r.*
         FROM erpsync_incoming_records r
         JOIN erpsync_sources s ON s.source_name = r.source_name
        WHERE r.sync_status IN ('pending', 'error')
          AND s.is_active = TRUE
          AND (r.next_attempt_at IS NULL OR r.next_attempt_at <= NOW())
          AND r.attempts < r.max_attempts
        ORDER BY
          CASE r.entity_type
            WHEN 'customer'    THEN 1
            WHEN 'item'        THEN 2
            WHEN 'sales_order' THEN 3
            ELSE 99
          END ASC,
          r.created_at ASC
        LIMIT $1
        FOR UPDATE OF r SKIP LOCKED`,
      [batchSize],
    );
    return rows;
  }

  async markProcessing(id: number, client: PoolClient): Promise<void> {
    await client.query(
      `UPDATE erpsync_incoming_records
          SET sync_status = 'processing', last_attempt_at = NOW(), updated_at = NOW()
        WHERE id = $1`,
      [id],
    );
  }

  async markSynced(
    id: number,
    erpRecordId: string,
    method: ErpMethod,
    client: PoolClient,
  ): Promise<void> {
    await client.query(
      `UPDATE erpsync_incoming_records
          SET sync_status   = 'synced',
              erp_record_id = $1,
              erp_method    = $2,
              attempts      = attempts + 1,
              last_error_code = NULL,
              last_error_msg  = NULL,
              updated_at    = NOW()
        WHERE id = $3`,
      [erpRecordId, method, id],
    );
  }

  async markError(
    id: number,
    errorCode: ErrorCode,
    errorMsg: string,
    retryDelayMin: number,
    client: PoolClient,
  ): Promise<void> {
    // Incrementamos attempts y revisamos si debe pasar a blocked
    const { rows } = await client.query<{ attempts: number; max_attempts: number }>(
      'SELECT attempts, max_attempts FROM erpsync_incoming_records WHERE id = $1',
      [id],
    );
    const record = rows[0];
    const newAttempts = (record?.attempts ?? 0) + 1;
    const isBlocked = newAttempts >= (record?.max_attempts ?? 3);

    await client.query(
      `UPDATE erpsync_incoming_records
          SET sync_status      = $1,
              attempts         = $2,
              last_error_code  = $3,
              last_error_msg   = $4,
              next_attempt_at  = CASE WHEN $5 THEN NULL ELSE NOW() + ($6 || ' minutes')::INTERVAL END,
              updated_at       = NOW()
        WHERE id = $7`,
      [
        isBlocked ? 'blocked' : 'error',
        newAttempts,
        errorCode,
        errorMsg,
        isBlocked,
        retryDelayMin,
        id,
      ],
    );
  }

  async requeue(id: number): Promise<IncomingRecord | null> {
    const { rows } = await this.db.query<IncomingRecord>(
      `UPDATE erpsync_incoming_records
          SET sync_status     = 'pending',
              attempts        = 0,
              next_attempt_at = NULL,
              last_error_code = NULL,
              last_error_msg  = NULL,
              updated_at      = NOW()
        WHERE id = $1
          AND sync_status = 'blocked'
        RETURNING *`,
      [id],
    );
    return rows[0] ?? null;
  }

  async findPendingByFilter(
    sourceName?: string,
    entityType?: EntityType,
    status?: SyncStatus,
  ): Promise<IncomingRecord[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (sourceName) {
      conditions.push(`source_name = $${idx++}`);
      values.push(sourceName);
    }
    if (entityType) {
      conditions.push(`entity_type = $${idx++}`);
      values.push(entityType);
    }
    if (status) {
      conditions.push(`sync_status = $${idx++}`);
      values.push(status);
    } else {
      conditions.push(`sync_status IN ('pending', 'error')`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await this.db.query<IncomingRecord>(
      `SELECT * FROM erpsync_incoming_records ${where} ORDER BY created_at ASC`,
      values,
    );
    return rows;
  }
}
