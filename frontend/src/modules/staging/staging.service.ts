// ─── Staging Service (modules/staging/staging.service.ts) ────────────────────
import { http } from "@/lib/http";
import type { ApiResponse, StagingPageResponse } from "@/contracts/api.types";

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
  /** Filas de un job específico */
  async getPage(params: StagingByJobParams): Promise<StagingPageResponse> {
    const { jobId, page = 0, size = 50, sortBy = "id", sortDir = "asc" } = params;
    const res = await http.get<ApiResponse<StagingPageResponse>>(
      `/api/staging/${jobId}`,
      { params: { page, size, sortBy, sortDir } }
    );
    return res.data.data;
  },

  /** Todos los registros del tenant para un template */
  async getAllPage(params: StagingAllParams = {}): Promise<StagingPageResponse> {
    const { template = "DROPI_ORDER", page = 0, size = 50, sortBy = "id", sortDir = "desc" } = params;
    const res = await http.get<ApiResponse<StagingPageResponse>>(
      `/api/staging`,
      { params: { template, page, size, sortBy, sortDir } }
    );
    return res.data.data;
  },
};
