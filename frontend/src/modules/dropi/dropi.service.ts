// ─── Dropi Service (modules/dropi/dropi.service.ts) ──────────────────────────
import { http } from "@/lib/http";
import type {
  ApiResponse, Page,
  OrdenListDto, OrdenDetalleDto, ClienteDto, ProductoDto, DropisStatsDto,
} from "@/contracts/api.types";

export interface OrdenesParams {
  estatus?: string;
  ciudad?: string;
  tiendaId?: number;
  fechaDesde?: string;   // YYYY-MM-DD
  fechaHasta?: string;
  page?: number;
  size?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export const dropiService = {
  async getStats(): Promise<DropisStatsDto> {
    const res = await http.get<ApiResponse<DropisStatsDto>>("/api/dropi/stats");
    return res.data.data;
  },

  async listOrdenes(p: OrdenesParams = {}): Promise<Page<OrdenListDto>> {
    const res = await http.get<ApiResponse<Page<OrdenListDto>>>("/api/dropi/ordenes", { params: p });
    return res.data.data;
  },

  async getOrden(id: number): Promise<OrdenDetalleDto> {
    const res = await http.get<ApiResponse<OrdenDetalleDto>>(`/api/dropi/ordenes/${id}`);
    return res.data.data;
  },

  async listClientes(q?: string, page = 0, size = 50): Promise<Page<ClienteDto>> {
    const res = await http.get<ApiResponse<Page<ClienteDto>>>("/api/dropi/clientes", {
      params: { q, page, size },
    });
    return res.data.data;
  },

  async listProductos(page = 0, size = 50): Promise<Page<ProductoDto>> {
    const res = await http.get<ApiResponse<Page<ProductoDto>>>("/api/dropi/productos", {
      params: { page, size },
    });
    return res.data.data;
  },
};
