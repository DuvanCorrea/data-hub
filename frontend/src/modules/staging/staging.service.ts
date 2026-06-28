// ─── Staging Service (modules/staging/staging.service.ts) ────────────────────
import { http } from "@/lib/http";
import type { ApiResponse, StagingPageResponse, StagingRow } from "@/contracts/api.types";

export interface StagingByJobParams {
  jobId: number;
  page?: number;
  size?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export interface StagingAllParams {
  template?: string;
  page?: number;
  size?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export const stagingService = {
  /** Filas de un job específico (paginado) */
  async getPage(params: StagingByJobParams): Promise<StagingPageResponse> {
    const { jobId, page = 0, size = 50, sortBy = "id", sortDir = "asc" } = params;
    const res = await http.get<ApiResponse<StagingPageResponse>>(
      `/api/staging/${jobId}`,
      { params: { page, size, sortBy, sortDir } }
    );
    return res.data.data;
  },

  /** Todos los registros del tenant para un template (paginado) */
  async getAllPage(params: StagingAllParams = {}): Promise<StagingPageResponse> {
    const { template = "DROPI_ORDER", page = 0, size = 50, sortBy = "id", sortDir = "desc" } = params;
    const res = await http.get<ApiResponse<StagingPageResponse>>(
      `/api/staging`,
      { params: { template, page, size, sortBy, sortDir } }
    );
    return res.data.data;
  },

  /**
   * Obtiene TODAS las filas para exportación, recorriendo páginas de 200
   * hasta agotar el total. Llama onProgress(loaded, total) en cada página.
   */
  async fetchAllRows(
    params: { jobId?: number; template?: string },
    onProgress?: (loaded: number, total: number) => void
  ): Promise<StagingRow[]> {
    const PAGE_SIZE = 200;
    const all: StagingRow[] = [];
    let page = 0;

    while (true) {
      const result = params.jobId
        ? await stagingService.getPage({ jobId: params.jobId, page, size: PAGE_SIZE, sortBy: "id", sortDir: "asc" })
        : await stagingService.getAllPage({ template: params.template, page, size: PAGE_SIZE, sortBy: "id", sortDir: "asc" });

      all.push(...result.rows);
      onProgress?.(all.length, result.totalElements);

      if (page >= result.totalPages - 1 || result.rows.length === 0) break;
      page++;
    }

    return all;
  },
};
