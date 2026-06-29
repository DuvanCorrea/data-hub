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

// ─── Staging Viewer (generic / dynamic) ──────────────────────────────────────

/** Tipo de dato de la columna para renderizado inteligente */
export type StagingColumnType = "text" | "number" | "datetime" | "status";

export interface StagingColumnDef {
  key: string;
  label: string;
  type: StagingColumnType;
}

/** Fila genérica — mapa clave→valor (puede ser null) */
export type StagingRow = Record<string, string | number | null>;

export interface StagingPageResponse {
  template: string;
  columns: StagingColumnDef[];
  rows: StagingRow[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

// ─── Dropi — Órdenes normalizadas ────────────────────────────────────────────

export interface OrdenListDto {
  id: number;
  dropiId: string;
  fecha: string | null;
  estatus: string | null;
  nombreCliente: string | null;
  telefono: string | null;
  ciudadDestino: string | null;
  departamentoDestino: string | null;
  transportadora: string | null;
  numeroGuia: string | null;
  totalOrden: number | null;
  ganancia: number | null;
  precioFlete: number | null;
  tienda: string | null;
  vendedor: string | null;
  tieneItems: boolean;
  createdAt: string;
}

export interface OrdenItemDto {
  id: number;
  productoIdDropi: string | null;
  sku: string | null;
  variacionIdDropi: string | null;
  nombreProducto: string | null;
  nombreVariacion: string | null;
  cantidad: number | null;
  precioProveedor: number | null;
  precioProveedorXCantidad: number | null;
  porcentajeComisionPlataforma: number | null;
  createdAt: string;
}

export interface ClienteDto {
  id: number;
  nombre: string | null;
  telefono: string | null;
  email: string | null;
  tipoIdentificacion: string | null;
  nroIdentificacion: string | null;
  createdAt: string;
}

export interface OrdenDetalleDto extends OrdenListDto {
  hora: string | null;
  fechaReporte: string | null;
  tipoEnvio: string | null;
  direccion: string | null;
  codigoPostal: string | null;
  costoDevolucionFlete: number | null;
  comision: number | null;
  numeroFactura: string | null;
  valorFacturado: number | null;
  ordenDropshipper: string | null;
  tipoTienda: string | null;
  idOrdenTienda: string | null;
  numeroPedidoTienda: string | null;
  tags: string | null;
  categorias: string | null;
  fechaGuiaGenerada: string | null;
  novedad: string | null;
  fueSolucionadaNovedad: string | null;
  solucion: string | null;
  observacion: string | null;
  ultimoMovimiento: string | null;
  conceptoUltimoMovimiento: string | null;
  ubicacionUltimoMovimiento: string | null;
  fechaUltimoMovimiento: string | null;
  contadorIndemnizaciones: string | null;
  conceptoUltimaIndenmizacion: string | null;
  cliente: ClienteDto | null;
  items: OrdenItemDto[];
  updatedAt: string;
}

export interface ProductoDto {
  id: number;
  productoIdDropi: string | null;
  sku: string | null;
  nombre: string | null;
  qtyTotal: number;
  ordenesCount: number;
  createdAt: string;
}

// ─── Parámetros de configuración ─────────────────────────────────────────────

export interface ParametroOpcionDto {
  valor: string;
  etiqueta: string;
}

export interface ParametroDto {
  id: number;
  aplicacion: string;
  clave: string;
  etiqueta: string;
  descripcion: string | null;
  tipoDato: "STRING" | "NUMBER" | "BOOLEAN" | "SELECT";
  valor: string;
  valorDefecto: string;
  valorModificado: boolean;
  opciones: ParametroOpcionDto[];
  esEditable: boolean;
  orden: number;
  updatedAt: string | null;
  updatedBy: number | null;
}

export interface EstatusCount  { estatus: string; count: number; montoTotal: number; }
export interface CiudadCount   { ciudad: string;  count: number; montoTotal: number; }
export interface DiaCount      { fecha: string; count: number; gananciaTotal: number; ventaTotal: number; }
export interface ProductoCount { nombre: string; sku: string; qtyTotal: number; ordenesCount: number; }
export interface OrdenActivaItem {
  id: number; dropiId: string; estatus: string;
  transportadora: string | null; fecha: string | null;
  totalOrden: number | null; ciudadDestino: string | null; diasActiva: number | null;
}

export interface ProductoVariacionDto {
  id: number;
  variacionIdDropi: string | null;
  nombreVariacion: string | null;
  createdAt: string;
}

export interface DropisStatsDto {
  // Perspectiva TIENDA
  totalOrdenes: number;
  ventaTotal: number;
  gananciaTotal: number;
  ordenesEntregadas: number;
  tasaEntrega: number;
  fleteTotal: number;
  comisionTotal: number;
  margenNeto: number;
  // Tendencia vs período anterior
  pctVenta: number;
  pctGanancia: number;
  pctOrdenes: number;
  pctCostoProveedor: number;
  // Perspectiva BODEGA
  unidadesTotal: number;
  costoProveedorTotal: number;
  ordenesConItems: number;
  // Distribuciones
  porEstatus:      EstatusCount[];
  topCiudades:     CiudadCount[];
  evolucionDiaria: DiaCount[];
  topProductos:    ProductoCount[];
  ordenesActivas:  OrdenActivaItem[];
}
