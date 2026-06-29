// ─── Status & lifecycle ───────────────────────────────────────────────────────

export type SyncStatus =
  | 'pending'
  | 'processing'
  | 'synced'
  | 'error'
  | 'blocked'
  | 'skipped';

export type EntityType = 'customer' | 'item' | 'sales_order';

export type ErpVersion = 'v16' | 'v15';

export type ErpMethod = 'POST' | 'PUT';

export type TriggeredBy = 'scheduler' | 'manual' | 'api';

export type LogResult = 'success' | 'error' | 'skipped';

export type ErrorCode =
  | 'DUPLICATE'
  | 'LINK_ERROR'
  | 'VALIDATION'
  | 'AUTH_ERROR'
  | 'NOT_FOUND'
  | 'NETWORK'
  | 'SERVER_ERROR'
  | 'TRANSFORM';

// ─── Domain models ────────────────────────────────────────────────────────────

export interface ErpSource {
  id: number;
  source_name: string;
  description: string | null;
  erp_version: ErpVersion;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface IncomingRecord {
  id: number;
  source_name: string;
  entity_type: EntityType;
  external_id: string;
  erp_doctype: string;
  payload: Record<string, unknown>;
  sync_status: SyncStatus;
  erp_record_id: string | null;
  erp_method: ErpMethod | null;
  attempts: number;
  max_attempts: number;
  next_attempt_at: Date | null;
  last_attempt_at: Date | null;
  last_error_code: ErrorCode | null;
  last_error_msg: string | null;
  triggered_by: TriggeredBy;
  created_at: Date;
  updated_at: Date;
}

export interface SyncLog {
  id: number;
  record_id: number;
  attempt_number: number;
  triggered_by: TriggeredBy;
  started_at: Date;
  finished_at: Date | null;
  duration_ms: number | null;
  erp_version: ErpVersion;
  erp_doctype: string;
  http_method: string | null;
  http_url: string | null;
  http_status: number | null;
  request_payload: Record<string, unknown> | null;
  response_body: Record<string, unknown> | null;
  result: LogResult;
  error_code: ErrorCode | null;
  error_message: string | null;
  created_at: Date;
}

export interface ErpParam {
  id: number;
  clave: string;
  valor: string;
  descripcion: string | null;
  updated_at: Date;
}

// ─── Params map (cache) ───────────────────────────────────────────────────────

export type ParamsMap = Record<string, string>;

// ─── API request/response contracts ──────────────────────────────────────────

export interface IncomingRecordItem {
  external_id: string;
  payload: Record<string, unknown>;
}

export interface PostRecordsBody {
  source_name: string;
  entity_type: EntityType;
  records: IncomingRecordItem[];
}

export interface RecordActionResult {
  external_id: string;
  record_id: number;
  status: SyncStatus;
  action: 'enqueued' | 're_enqueued';
}

export interface PostRecordsResponse {
  received: number;
  enqueued: number;
  re_enqueued: number;
  records: RecordActionResult[];
}

export interface PaginatedRecords {
  total: number;
  page: number;
  limit: number;
  data: Omit<IncomingRecord, 'payload'>[];
}

export interface RecordDetail extends IncomingRecord {
  log: Partial<SyncLog>[];
}

export interface SyncStatusItem {
  id: number;
  external_id: string;
  sync_status: SyncStatus;
  erp_record_id: string | null;
}

export interface TriggerBody {
  record_ids?: number[];
  source_name?: string;
  entity_type?: EntityType;
  sync_status?: SyncStatus;
}

export interface TriggerResponse {
  triggered: number;
  message: string;
}

export interface RequeueResponse {
  record_id: number;
  previous_status: SyncStatus;
  new_status: SyncStatus;
  attempts_reset: boolean;
}

// ─── ERP Client types ─────────────────────────────────────────────────────────

export interface ErpNextResponse<T = Record<string, unknown>> {
  data: T;
}

export interface ErpNextDocResponse {
  name: string;
  [key: string]: unknown;
}

export interface ErpNextListResponse {
  data: ErpNextDocResponse[];
}

export interface ErpCallResult {
  success: boolean;
  method: ErpMethod;
  status: number;
  erpRecordId: string | null;
  requestPayload: Record<string, unknown>;
  responseBody: Record<string, unknown>;
  errorCode: ErrorCode | null;
  errorMessage: string | null;
  url: string;
}

// ─── Transformer context ──────────────────────────────────────────────────────

export interface TransformerContext {
  external_id: string;
  source_name: string;
}

export type TransformerFn = (
  payload: Record<string, unknown>,
  params: ParamsMap,
  context: TransformerContext,
) => Record<string, unknown>;
