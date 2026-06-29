import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  ErpCallResult,
  ErpMethod,
  ErrorCode,
  ParamsMap,
} from '../types';
import { params } from '../config/params';

// ─── Tipos internos ────────────────────────────────────────────────────────────

interface ErpNextDoc {
  name?: string;
  [key: string]: unknown;
}

interface ErpNextListResponse {
  data: ErpNextDoc[];
}

interface ErpNextDocResponse {
  data: ErpNextDoc;
}

// ─── Clasificador de errores ──────────────────────────────────────────────────

export function classifyError(
  httpStatus: number | null,
  body: Record<string, unknown>,
  isNetwork: boolean,
): ErrorCode {
  if (isNetwork) return 'NETWORK';

  switch (httpStatus) {
    case 401:
    case 403:
      return 'AUTH_ERROR';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'DUPLICATE';
    case 417: {
      const msg = JSON.stringify(body).toLowerCase();
      if (msg.includes('linkvalidationerror') || msg.includes('does not exist')) {
        return 'LINK_ERROR';
      }
      return 'VALIDATION';
    }
    case 500:
      return 'SERVER_ERROR';
    default:
      return 'SERVER_ERROR';
  }
}

function isRetryable(code: ErrorCode): boolean {
  return code === 'NETWORK' || code === 'SERVER_ERROR';
}

export { isRetryable };

// ─── Cliente ──────────────────────────────────────────────────────────────────

export class ErpNextClient {
  private http: AxiosInstance;
  private baseUrl: string;
  private authHeader: string;
  private timeoutMs: number;

  constructor(p: ParamsMap) {
    this.baseUrl = params.erpBaseUrl(p).replace(/\/$/, '');
    this.authHeader = params.erpAuth(p);
    this.timeoutMs = params.erpTimeoutMs(p);

    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeoutMs,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(this.authHeader ? { Authorization: this.authHeader } : {}),
      },
    });
  }

  /**
   * Busca si un documento ya existe en ERPNext.
   * Retorna el name del doc si existe, null si no existe, lanza error en otro caso.
   */
  async findExisting(
    doctype: string,
    filterField: string,
    filterValue: string,
  ): Promise<string | null> {
    const filters = JSON.stringify([[doctype, filterField, '=', filterValue]]);
    const url = `/api/resource/${encodeURIComponent(doctype)}?filters=${encodeURIComponent(filters)}&fields=["name"]&limit=1`;

    try {
      const res = await this.http.get<ErpNextListResponse>(url);
      const docs = res.data?.data ?? [];
      return docs.length > 0 && docs[0].name ? String(docs[0].name) : null;
    } catch (err) {
      const axErr = err as AxiosError;
      if (axErr.response?.status === 404) return null;
      throw err;
    }
  }

  /**
   * Crea un documento nuevo (POST).
   */
  async post(
    doctype: string,
    payload: Record<string, unknown>,
  ): Promise<ErpCallResult> {
    const url = `/api/resource/${encodeURIComponent(doctype)}`;
    const startMs = Date.now();

    try {
      const res = await this.http.post<ErpNextDocResponse>(url, payload);
      const name = res.data?.data?.name ? String(res.data.data.name) : null;

      return {
        success: true,
        method: 'POST' as ErpMethod,
        status: res.status,
        erpRecordId: name,
        requestPayload: payload,
        responseBody: res.data as unknown as Record<string, unknown>,
        errorCode: null,
        errorMessage: null,
        url: `${this.baseUrl}${url}`,
      };
    } catch (err) {
      return this.handleError(err, 'POST', url, payload, Date.now() - startMs);
    }
  }

  /**
   * Actualiza un documento existente (PUT).
   */
  async put(
    doctype: string,
    name: string,
    payload: Record<string, unknown>,
  ): Promise<ErpCallResult> {
    const url = `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`;
    const startMs = Date.now();

    try {
      const res = await this.http.put<ErpNextDocResponse>(url, payload);
      const erpName = res.data?.data?.name ? String(res.data.data.name) : name;

      return {
        success: true,
        method: 'PUT' as ErpMethod,
        status: res.status,
        erpRecordId: erpName,
        requestPayload: payload,
        responseBody: res.data as unknown as Record<string, unknown>,
        errorCode: null,
        errorMessage: null,
        url: `${this.baseUrl}${url}`,
      };
    } catch (err) {
      return this.handleError(err, 'PUT', url, payload, Date.now() - startMs);
    }
  }

  // ─── Helper privado ─────────────────────────────────────────────────────────

  private handleError(
    err: unknown,
    method: ErpMethod,
    url: string,
    payload: Record<string, unknown>,
    _durationMs: number,
  ): ErpCallResult {
    const axErr = err as AxiosError<Record<string, unknown>>;
    const isNetwork = !axErr.response;
    const httpStatus = axErr.response?.status ?? null;
    const body = (axErr.response?.data ?? {}) as Record<string, unknown>;

    const errorCode = classifyError(httpStatus, body, isNetwork);
    const errorMessage =
      (body?.exception as string) ??
      (body?.message as string) ??
      axErr.message ??
      'Unknown error';

    return {
      success: false,
      method,
      status: httpStatus ?? 0,
      erpRecordId: null,
      requestPayload: payload,
      responseBody: body,
      errorCode,
      errorMessage,
      url: `${this.baseUrl}${url}`,
    };
  }
}
