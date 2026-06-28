// ─── Staging Service (modules/staging/staging.service.ts) ────────────────────
// Llama al endpoint genérico /api/staging/{jobId} del backend.
// El endpoint retorna columnas + filas dinámicas según el template del job.
// ─────────────────────────────────────────────────────────────────────────────

import { http } from "@/lib/http";
import type { ApiResponse, StagingPageResponse } from "@/contracts/api.types";

export interface StagingParams {
  jobId: number;
  page?: number;
  size?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export const stagingService = {
  async getPage(params: StagingParams): Promise<StagingPageResponse> {
    const { jobId, page = 0, size = 50, sortBy = "id", sortDir = "asc" } = params;
    const res = await http.get<ApiResponse<StagingPageResponse>>(
      `/api/staging/${jobId}`,
      { params: { page, size, sortBy, sortDir } }
    );
    return res.data.data;
  },
};
