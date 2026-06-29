// ─── Settings Service (modules/settings/settings.service.ts) ─────────────────
import { http } from "@/lib/http";
import type { ApiResponse, ParametroDto } from "@/contracts/api.types";

export const settingsService = {
  async list(): Promise<ParametroDto[]> {
    const res = await http.get<ApiResponse<ParametroDto[]>>("/api/parametros");
    return res.data.data;
  },

  async update(clave: string, valor: string): Promise<ParametroDto> {
    const res = await http.put<ApiResponse<ParametroDto>>(
      `/api/parametros/${clave}`,
      { valor }
    );
    return res.data.data;
  },

  async reset(clave: string): Promise<ParametroDto> {
    const res = await http.post<ApiResponse<ParametroDto>>(
      `/api/parametros/${clave}/reset`
    );
    return res.data.data;
  },
};
