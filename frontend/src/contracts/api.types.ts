// ─── Type Contracts (contracts/api.types.ts) ────────────────────────────────
// These are the TypeScript mirrors of the backend ApiResponse<T> DTOs.
// Never mutate these; create new interfaces if you need to extend them.
// ─────────────────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  status: number;
  message: string;
  data: T;
  timestamp: string;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface AuthResponse {
  accessToken: string;
  expiresIn: number;
}

export interface UserProfile {
  id: number;
  tenantId: number;
  username: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

// ─── Import Jobs ──────────────────────────────────────────────────────────────

export type JobStatus = "PENDING" | "RUNNING" | "COMPLETED" | "ERROR";

export interface ImportJobDto {
  id: number;
  status: JobStatus;
  progress: number;
  rowsDone: number;
  rowsTotal: number;
  template: string;
  startedAt: string;
  finishedAt: string;
  errorMsg: string;
}

export interface FileUploadResponse {
  jobId: number;
  fileId: number;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}
