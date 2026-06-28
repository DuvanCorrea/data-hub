// ─── Import Jobs Service (modules/import-jobs/import-jobs.service.ts) ─────────
// All API calls for import job management and file uploads.
// ─────────────────────────────────────────────────────────────────────────────

import { http } from "@/lib/http";
import type { ApiResponse, FileUploadResponse, ImportJobDto, Page } from "@/contracts/api.types";

export interface ListJobsParams {
  status?: string;
  page?: number;
  size?: number;
}

export const importJobsService = {
  async uploadFile(file: File): Promise<FileUploadResponse> {
    const form = new FormData();
    form.append("file", file);
    const res = await http.post<ApiResponse<FileUploadResponse>>("/api/files/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data.data;
  },

  async listJobs(params: ListJobsParams = {}): Promise<Page<ImportJobDto>> {
    const res = await http.get<ApiResponse<Page<ImportJobDto>>>("/api/import-jobs", { params });
    return res.data.data;
  },

  async getJob(id: number): Promise<ImportJobDto> {
    const res = await http.get<ApiResponse<ImportJobDto>>(`/api/import-jobs/${id}`);
    return res.data.data;
  },
};
