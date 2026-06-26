import type {
  Catalogos,
  IngresoVenta,
  IngresoVentaForm,
  ParDivisa,
  Presupuesto,
  PresupuestoDocumentoAdjunto,
  PresupuestoForm,
  Proveedor,
  ProveedorForm,
  Rubro,
  RubroForm,
  SubRubro,
  SubRubroForm,
  SubRubroItem,
  RubroVinculoMapaItem,
  Funcionario,
  FuncionarioForm,
  ResumenPagosFuncionario,
  Responsable,
  ResponsableForm,
  ResumenEmpresa,
  ResumenRubro,
  TipoCambio,
  TipoCambioForm,
  VentaAgriculturaRow,
  VentaAgriculturaRealInput,
  VentaArrendamientoRow,
  VentaArrendamientoRealInput,
  DivisaIndicadores,
  PrecioGanado,
  SemanaPreciosGanado,
  PrecioGanadoResumenLocal,
  SegmentoPreciosGanado,
  SimuladorVentaTipo,
  SimuladorVentaGanadoRow,
  SimuladorVentaDispositivoRow,
  SimuladorVentaAuditoriaRow,
  SimuladorVentaAuditoriaTipo,
  SimuladorVentaAuditoriaDetalle,
  SimuladorPreciosReferencia,
  SimuladorModoKg,
  SimuladorVentaRealInput,
  StockGanaderoLote,
  StockGanaderoRegistro,
  StockGanaderoEstadisticas,
  StockGanaderaDispositivo,
  StockGanaderaDispositivoDetalle,
  StockGanaderaDispositivoHistorial,
  StockMovimientoAuditoria,
  AuthActividadLog,
  UsuarioOnline,
  StockMovimientoTipo,
  DispositivoSexo,
  DispositivoEmpresa,
  DispositivoEstado,
  AuthUser,
  UserForm,
  Rol,
  RolPermisosConfig,
  RolPermisosInput,
  ChatMessage,
  ChatContact,
  ChatUnreadSummary,
  ChatUserPresence,
  ChatSearchHit,
  ChatChannel,
  TipoDocumentoGasto,
  TipoDocumentoGastoForm,
  BrouTransferenciaParsed,
  ComprobanteLeido,
  DetectarCamposDocumentoResult,
} from "./types";
import type { GastoMapeoCampos } from "./utils/gasto-campos";
import { apiConnectionError } from "./utils/api-messages";

const API = "/api";

const FETCH_INIT: RequestInit = { credentials: "include" };

/** 401 esperado sin sesión (no disparar cierre de sesión en el cliente). */
const SILENT_401_PREFIXES = ["/auth/me", "/auth/login"];

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...FETCH_INIT,
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch {
    throw new Error(apiConnectionError());
  }

  let json: { ok?: boolean; error?: string };
  try {
    json = await res.json();
  } catch {
    throw new Error(
      res.status === 404
        ? "API no encontrada. Usá npm run dev en la raíz del proyecto (no solo en client/)."
        : `Error del servidor (${res.status})`
    );
  }

  if (!json.ok) {
    if (
      res.status === 401 &&
      !SILENT_401_PREFIXES.some((prefix) => path.startsWith(prefix))
    ) {
      window.dispatchEvent(new CustomEvent("scg-unauthorized"));
    }
    throw new Error(json.error || `Error en la solicitud (${res.status})`);
  }
  return json as T;
}

export interface ApiHealthStatus {
  online: boolean;
  ready: boolean;
  error?: string;
  detail?: string;
}

export async function checkApiHealth(): Promise<ApiHealthStatus> {
  try {
    const res = await fetch(`${API}/health`, {
      ...FETCH_INIT,
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    let json: { ok?: boolean; ready?: boolean; error?: string; detail?: string };
    try {
      json = (await res.json()) as {
        ok?: boolean;
        ready?: boolean;
        error?: string;
        detail?: string;
      };
    } catch {
      return { online: false, ready: false };
    }
    if (json.ok !== true) {
      return { online: false, ready: false, error: json.error, detail: json.detail };
    }
    const ready = json.ready === true;
    if (!ready) {
      return { online: true, ready: false, error: json.error, detail: json.detail };
    }
    return { online: true, ready: true };
  } catch {
    return { online: false, ready: false };
  }
}

export async function fetchCatalogos(): Promise<Catalogos> {
  const json = await request<{
    empresas: Catalogos["empresas"];
    rubros: string[];
    sub_rubros?: string[];
    sub_rubros_por_rubro?: Record<string, string[]>;
    responsables: string[];
    funcionarios?: Catalogos["funcionarios"];
  }>("/catalogos");
  return {
    empresas: json.empresas,
    rubros: json.rubros,
    sub_rubros: json.sub_rubros ?? [],
    sub_rubros_por_rubro: json.sub_rubros_por_rubro ?? {},
    responsables: json.responsables ?? [],
    funcionarios: json.funcionarios ?? [],
  };
}

export async function fetchPresupuesto(filters: {
  empresa?: string;
  rubro?: string;
  responsable_gasto?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  busqueda?: string;
  /** Historial global (Presupuesto). Gestor/consulta: requiere este flag en el servidor. */
  ver_todos?: boolean;
  /** Admin: filtrar solo documentos propios. */
  solo_mios?: boolean;
}): Promise<Presupuesto[]> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (k === "solo_mios" || k === "ver_todos") {
      if (v) params.set(k, "1");
      return;
    }
    if (v) params.set(k, String(v));
  });
  const q = params.toString() ? `?${params}` : "";
  const json = await request<{ data: Presupuesto[] }>(`/presupuesto${q}`);
  return json.data;
}

export async function fetchPresupuestoById(id: number): Promise<Presupuesto> {
  const json = await request<{ data: Presupuesto }>(`/presupuesto/${id}`);
  return json.data;
}

export async function fetchSiguienteNumeroOperacion(): Promise<{
  nro_registro: number;
  numero_operacion: string;
}> {
  const json = await request<{
    data: { nro_registro: number; numero_operacion: string };
  }>("/presupuesto/siguiente-operacion");
  return json.data;
}

export async function createPresupuesto(
  data: PresupuestoForm
): Promise<Presupuesto> {
  const json = await request<{ data: Presupuesto; message: string }>(
    "/presupuesto",
    { method: "POST", body: JSON.stringify(data) }
  );
  return json.data;
}

export async function updatePresupuesto(
  id: number,
  data: PresupuestoForm
): Promise<Presupuesto> {
  const json = await request<{ data: Presupuesto; message: string }>(
    `/presupuesto/${id}`,
    { method: "PUT", body: JSON.stringify(data) }
  );
  return json.data;
}

export async function deletePresupuesto(id: number): Promise<void> {
  await request(`/presupuesto/${id}`, { method: "DELETE" });
}

export function presupuestoDocumentoUrl(id: number, download = false): string {
  const q = download ? "?download=1" : "";
  return `${API}/presupuesto/${id}/documento${q}`;
}

export async function uploadPresupuestoDocumento(
  id: number,
  file: File
): Promise<PresupuestoDocumentoAdjunto> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API}/presupuesto/${id}/documento`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  const json = (await res.json()) as {
    ok: boolean;
    data?: PresupuestoDocumentoAdjunto;
    error?: string;
  };
  if (!res.ok || !json.ok || !json.data) {
    throw new Error(json.error || "No se pudo guardar el documento");
  }
  return json.data;
}

export async function fetchPresupuestoDocumentoBlob(id: number): Promise<Blob> {
  const res = await fetch(presupuestoDocumentoUrl(id), { credentials: "include" });
  if (!res.ok) {
    let msg = "No se pudo cargar el documento";
    try {
      const json = (await res.json()) as { error?: string };
      if (json.error) msg = json.error;
    } catch {
      /* respuesta no JSON */
    }
    throw new Error(msg);
  }
  return res.blob();
}

export async function fetchVentasGanadoCerradas(filters?: {
  tipo?: SimuladorVentaTipo;
  fecha_desde?: string;
  fecha_hasta?: string;
  busqueda?: string;
}): Promise<SimuladorVentaGanadoRow[]> {
  const params = new URLSearchParams();
  if (filters?.tipo) params.set("tipo", filters.tipo);
  if (filters?.fecha_desde) params.set("fecha_desde", filters.fecha_desde);
  if (filters?.fecha_hasta) params.set("fecha_hasta", filters.fecha_hasta);
  if (filters?.busqueda?.trim()) params.set("busqueda", filters.busqueda.trim());
  const q = params.toString() ? `?${params}` : "";
  const json = await request<{ ok: boolean; data: SimuladorVentaGanadoRow[] }>(
    `/ingresos-ventas/ventas-ganado-cerradas${q}`
  );
  return json.data;
}

export async function updateVentaGanadoCerradaDestino(
  id: number,
  destino: string | null
): Promise<SimuladorVentaGanadoRow> {
  const json = await request<{ ok: boolean; data: SimuladorVentaGanadoRow; message: string }>(
    `/ingresos-ventas/ventas-ganado-cerradas/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify({ destino }),
    }
  );
  return json.data;
}

export async function fetchVentasAgricultura(filters?: {
  empresa?: string;
  mes?: number;
  anio?: number;
  cultivo?: string;
  busqueda?: string;
}): Promise<VentaAgriculturaRow[]> {
  const params = new URLSearchParams();
  if (filters?.empresa) params.set("empresa", filters.empresa);
  if (filters?.mes != null) params.set("mes", String(filters.mes));
  if (filters?.anio != null) params.set("anio", String(filters.anio));
  if (filters?.cultivo) params.set("cultivo", filters.cultivo);
  if (filters?.busqueda?.trim()) params.set("busqueda", filters.busqueda.trim());
  const q = params.toString() ? `?${params}` : "";
  const json = await request<{ ok: boolean; data: VentaAgriculturaRow[] }>(
    `/ingresos-ventas/ventas-agricultura${q}`
  );
  return json.data;
}

export async function createVentaAgricultura(data: {
  empresa: string;
  mes_inicio: number;
  mes_fin: number;
  anio_inicio: number;
  anio_fin: number;
  cultivo: string;
  hectareas: number;
  rendimiento_ton_ha: number;
  precio_usd_ton: number;
}): Promise<VentaAgriculturaRow> {
  const json = await request<{ ok: boolean; data: VentaAgriculturaRow; message: string }>(
    "/ingresos-ventas/ventas-agricultura",
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
  return json.data;
}

export async function updateVentaAgricultura(
  id: number,
  data: {
    empresa: string;
    mes_inicio: number;
    mes_fin: number;
    anio_inicio: number;
    anio_fin: number;
    cultivo: string;
    hectareas: number;
    rendimiento_ton_ha: number;
    precio_usd_ton: number;
  }
): Promise<VentaAgriculturaRow> {
  const json = await request<{ ok: boolean; data: VentaAgriculturaRow; message: string }>(
    `/ingresos-ventas/ventas-agricultura/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    }
  );
  return json.data;
}

export async function patchVentaAgricultura(
  id: number,
  patch: {
    venta_realizada?: boolean;
    valores_reales?: VentaAgriculturaRealInput;
    destacada?: boolean;
  }
): Promise<{ data: VentaAgriculturaRow; message: string }> {
  const json = await request<{
    ok: boolean;
    data: VentaAgriculturaRow;
    message: string;
  }>(`/ingresos-ventas/ventas-agricultura/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return { data: json.data, message: json.message };
}

export async function deleteVentaAgricultura(id: number): Promise<void> {
  await request(`/ingresos-ventas/ventas-agricultura/${id}`, { method: "DELETE" });
}

export async function fetchVentasArrendamientos(filters?: {
  empresa?: string;
  departamento?: string;
  busqueda?: string;
}): Promise<VentaArrendamientoRow[]> {
  const params = new URLSearchParams();
  if (filters?.empresa) params.set("empresa", filters.empresa);
  if (filters?.departamento) params.set("departamento", filters.departamento);
  if (filters?.busqueda?.trim()) params.set("busqueda", filters.busqueda.trim());
  const q = params.toString() ? `?${params}` : "";
  const json = await request<{ ok: boolean; data: VentaArrendamientoRow[] }>(
    `/ingresos-ventas/ventas-arrendamientos${q}`
  );
  return json.data;
}

export async function createVentaArrendamiento(data: {
  empresa: string;
  fecha_inicio: string;
  fecha_fin: string;
  departamento: string;
  padron: string;
  hectareas: number;
  precio_usd_ha: number;
  total_usd: number;
  notas?: string | null;
  pago_frecuencia: "MENSUAL" | "ANUAL";
  pago_inicio: string;
  pago_fin: string;
  pago_inicio_monto: number;
  pago_inicio_tipo: "VALOR" | "PORCENTAJE";
  pago_fin_monto: number;
  pago_fin_tipo: "VALOR" | "PORCENTAJE";
}): Promise<VentaArrendamientoRow> {
  const json = await request<{ ok: boolean; data: VentaArrendamientoRow; message: string }>(
    "/ingresos-ventas/ventas-arrendamientos",
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
  return json.data;
}

export async function updateVentaArrendamiento(
  id: number,
  data: {
    empresa: string;
    fecha_inicio: string;
    fecha_fin: string;
    departamento: string;
    padron: string;
    hectareas: number;
    precio_usd_ha: number;
    total_usd: number;
    notas?: string | null;
    pago_frecuencia: "MENSUAL" | "ANUAL";
    pago_inicio: string;
    pago_fin: string;
    pago_inicio_monto: number;
    pago_inicio_tipo: "VALOR" | "PORCENTAJE";
    pago_fin_monto: number;
    pago_fin_tipo: "VALOR" | "PORCENTAJE";
  }
): Promise<VentaArrendamientoRow> {
  const json = await request<{ ok: boolean; data: VentaArrendamientoRow; message: string }>(
    `/ingresos-ventas/ventas-arrendamientos/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    }
  );
  return json.data;
}

export async function deleteVentaArrendamiento(id: number): Promise<void> {
  await request(`/ingresos-ventas/ventas-arrendamientos/${id}`, { method: "DELETE" });
}

export async function patchVentaArrendamiento(
  id: number,
  patch: {
    venta_realizada?: boolean;
    valores_reales?: VentaArrendamientoRealInput;
    destacada?: boolean;
  }
): Promise<{ data: VentaArrendamientoRow; message: string }> {
  const json = await request<{
    ok: boolean;
    data: VentaArrendamientoRow;
    message: string;
  }>(`/ingresos-ventas/ventas-arrendamientos/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return { data: json.data, message: json.message };
}

export async function fetchIngresosVentas(filters: {
  fecha_desde?: string;
  fecha_hasta?: string;
  busqueda?: string;
}): Promise<IngresoVenta[]> {
  const params = new URLSearchParams();
  if (filters.fecha_desde) params.set("fecha_desde", filters.fecha_desde);
  if (filters.fecha_hasta) params.set("fecha_hasta", filters.fecha_hasta);
  if (filters.busqueda?.trim()) params.set("busqueda", filters.busqueda.trim());
  const q = params.toString() ? `?${params}` : "";
  const json = await request<{ data: IngresoVenta[] }>(`/ingresos-ventas${q}`);
  return json.data;
}

export async function fetchIngresoVentaById(id: number): Promise<IngresoVenta> {
  const json = await request<{ data: IngresoVenta }>(`/ingresos-ventas/${id}`);
  return json.data;
}

export async function fetchSiguienteNumeroOperacionVenta(): Promise<{
  nro_registro: number;
  numero_operacion: string;
}> {
  const json = await request<{
    data: { nro_registro: number; numero_operacion: string };
  }>("/ingresos-ventas/siguiente-operacion");
  return json.data;
}

export async function createIngresoVenta(
  data: IngresoVentaForm
): Promise<IngresoVenta> {
  const json = await request<{ data: IngresoVenta; message: string }>(
    "/ingresos-ventas",
    { method: "POST", body: JSON.stringify(data) }
  );
  return json.data;
}

export async function updateIngresoVenta(
  id: number,
  data: IngresoVentaForm
): Promise<IngresoVenta> {
  const json = await request<{ data: IngresoVenta; message: string }>(
    `/ingresos-ventas/${id}`,
    { method: "PUT", body: JSON.stringify(data) }
  );
  return json.data;
}

export async function deleteIngresoVenta(id: number): Promise<void> {
  await request(`/ingresos-ventas/${id}`, { method: "DELETE" });
}

export async function fetchStockGanaderoLotes(): Promise<StockGanaderoLote[]> {
  const json = await request<{ data: StockGanaderoLote[] }>("/stock-ganadero/lotes");
  return json.data;
}

export async function fetchStockGanaderoRegistros(filters: {
  lote_id?: number;
  busqueda?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  solo_repetidos?: boolean;
}): Promise<StockGanaderoRegistro[]> {
  const params = new URLSearchParams();
  if (filters.lote_id) params.set("lote_id", String(filters.lote_id));
  if (filters.busqueda?.trim()) params.set("busqueda", filters.busqueda.trim());
  if (filters.fecha_desde) params.set("fecha_desde", filters.fecha_desde);
  if (filters.fecha_hasta) params.set("fecha_hasta", filters.fecha_hasta);
  if (filters.solo_repetidos) params.set("solo_repetidos", "1");
  const q = params.toString() ? `?${params}` : "";
  const json = await request<{ data: StockGanaderoRegistro[] }>(
    `/stock-ganadero/registros${q}`
  );
  return json.data;
}

export async function fetchStockGanaderoEstadisticas(filters: {
  lote_id?: number;
  busqueda?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
}): Promise<StockGanaderoEstadisticas> {
  const params = new URLSearchParams();
  if (filters.lote_id) params.set("lote_id", String(filters.lote_id));
  if (filters.busqueda?.trim()) params.set("busqueda", filters.busqueda.trim());
  if (filters.fecha_desde) params.set("fecha_desde", filters.fecha_desde);
  if (filters.fecha_hasta) params.set("fecha_hasta", filters.fecha_hasta);
  const q = params.toString() ? `?${params}` : "";
  const json = await request<{ data: StockGanaderoEstadisticas }>(
    `/stock-ganadero/estadisticas${q}`
  );
  return json.data;
}

export async function fetchStockGanaderoResumen(): Promise<{
  lotes: number;
  registros: number;
  dispositivos: number;
  ventas_dispositivos: number;
}> {
  const json = await request<{
    data: {
      lotes: number;
      registros: number;
      dispositivos: number;
      ventas_dispositivos: number;
    };
  }>("/stock-ganadero/resumen");
  return json.data;
}

export async function fetchStockGanaderaVentasDispositivos(): Promise<{
  total: number;
  claves: string[];
}> {
  const json = await request<{ data: { total: number; claves: string[] } }>(
    "/stock-ganadero/ventas-dispositivos"
  );
  return json.data;
}

export async function fetchStockGanaderaSalidas(filters: {
  busqueda?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  estado_dispositivo?: DispositivoEstado;
} = {}): Promise<{
  dispositivos: StockGanaderaDispositivo[];
  bajasReparadas: number;
}> {
  const params = new URLSearchParams();
  if (filters.busqueda?.trim()) params.set("busqueda", filters.busqueda.trim());
  if (filters.fecha_desde) params.set("fecha_desde", filters.fecha_desde);
  if (filters.fecha_hasta) params.set("fecha_hasta", filters.fecha_hasta);
  if (
    filters.estado_dispositivo === "MUERTO" ||
    filters.estado_dispositivo === "VENDIDO" ||
    filters.estado_dispositivo === "FRIGORIFICO" ||
    filters.estado_dispositivo === "PERDIDO"
  ) {
    params.set("estado_dispositivo", filters.estado_dispositivo);
  }
  const q = params.toString() ? `?${params}` : "";
  const json = await request<{
    data: StockGanaderaDispositivo[];
    bajas_reparadas: number;
  }>(`/stock-ganadero/salidas${q}`);
  return {
    dispositivos: json.data,
    bajasReparadas: json.bajas_reparadas ?? 0,
  };
}

export async function fetchStockGanaderaDispositivos(filters: {
  busqueda?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  solo_repetidos?: boolean;
  solo_bajas?: boolean;
  estado_dispositivo?: DispositivoEstado;
}): Promise<StockGanaderaDispositivo[]> {
  const params = new URLSearchParams();
  if (filters.busqueda?.trim()) params.set("busqueda", filters.busqueda.trim());
  if (filters.fecha_desde) params.set("fecha_desde", filters.fecha_desde);
  if (filters.fecha_hasta) params.set("fecha_hasta", filters.fecha_hasta);
  if (filters.solo_repetidos) params.set("solo_repetidos", "1");
  if (filters.solo_bajas) params.set("solo_bajas", "1");
  if (
    filters.estado_dispositivo === "MUERTO" ||
    filters.estado_dispositivo === "VENDIDO" ||
    filters.estado_dispositivo === "FRIGORIFICO" ||
    filters.estado_dispositivo === "PERDIDO"
  ) {
    params.set("estado_dispositivo", filters.estado_dispositivo);
  }
  const q = params.toString() ? `?${params}` : "";
  const json = await request<{ data: StockGanaderaDispositivo[] }>(
    `/stock-ganadero/dispositivos${q}`
  );
  return json.data;
}

export async function fetchStockGanaderaDispositivo(
  clave: string
): Promise<StockGanaderaDispositivoDetalle> {
  const json = await request<{ data: StockGanaderaDispositivoDetalle }>(
    `/stock-ganadero/dispositivos/${encodeURIComponent(clave)}`
  );
  return json.data;
}

export async function fetchStockGanaderaDispositivoHistorial(
  clave: string
): Promise<StockGanaderaDispositivoHistorial[]> {
  const json = await request<{ data: StockGanaderaDispositivoHistorial[] }>(
    `/stock-ganadero/dispositivos/${encodeURIComponent(clave)}/historial-cambios`
  );
  return json.data;
}

export async function updateStockGanaderaDispositivoSexo(
  clave: string,
  sexo: DispositivoSexo,
  eid?: string
): Promise<DispositivoSexo> {
  const json = await request<{ data: { sexo: DispositivoSexo } }>(
    `/stock-ganadero/dispositivos/${encodeURIComponent(clave)}/sexo`,
    {
      method: "PATCH",
      body: JSON.stringify({ sexo, eid }),
    }
  );
  return json.data.sexo;
}

export async function updateStockGanaderaDispositivoEdad(
  clave: string,
  edad: number | null,
  eid?: string
): Promise<number | null> {
  const json = await request<{ data: { edad: number | null } }>(
    `/stock-ganadero/dispositivos/${encodeURIComponent(clave)}/edad`,
    {
      method: "PATCH",
      body: JSON.stringify({ edad, eid }),
    }
  );
  return json.data.edad;
}

export async function saveStockGanaderaDispositivo(
  clave: string,
  data: {
    sexo: DispositivoSexo;
    empresa: DispositivoEmpresa;
    grupo: string;
    grupo_libre: string;
    nacimiento_mes: number | null;
    nacimiento_anio: number | null;
    observaciones: string;
    estado: DispositivoEstado;
    tipo_baja?: TipoBaja | "";
    numero_guia?: string;
    baja_mes: number | null;
    baja_anio: number | null;
  },
  eid?: string
): Promise<{
  sexo: DispositivoSexo;
  empresa: DispositivoEmpresa;
  grupo: string;
  grupo_libre: string;
  edad: number | null;
  nacimiento_mes: number | null;
  nacimiento_anio: number | null;
  observaciones: string;
  estado: DispositivoEstado;
  tipo_baja: TipoBaja | "";
  numero_guia: string;
  baja_mes: number | null;
  baja_anio: number | null;
}> {
  const json = await request<{
    data: {
      sexo: DispositivoSexo;
      empresa: DispositivoEmpresa;
      grupo: string;
      grupo_libre: string;
      edad: number | null;
      nacimiento_mes: number | null;
      nacimiento_anio: number | null;
      observaciones: string;
      estado: DispositivoEstado;
      tipo_baja: TipoBaja | "";
      numero_guia: string;
      baja_mes: number | null;
      baja_anio: number | null;
    };
  }>(`/stock-ganadero/dispositivos/${encodeURIComponent(clave)}`, {
    method: "PATCH",
    body: JSON.stringify({ ...data, eid }),
  });
  return json.data;
}

export async function bulkPatchStockGanaderaDispositivos(
  claves: string[],
  patch: Record<string, unknown>,
  eids: Record<string, string> = {}
): Promise<{
  actualizados: number;
  errores: { clave: string; mensaje: string }[];
}> {
  const json = await request<{
    data: {
      actualizados: number;
      errores: { clave: string; mensaje: string }[];
    };
  }>("/stock-ganadero/dispositivos/bulk", {
    method: "PATCH",
    body: JSON.stringify({ claves, patch, eids }),
  });
  return json.data;
}

export async function importStockGanaderoFile(
  file: File
): Promise<{ message: string; lote_id: number; insertados: number }> {
  const form = new FormData();
  form.append("file", file);
  let res: Response;
  try {
    res = await fetch(`${API}/stock-ganadero/import/file`, {
      ...FETCH_INIT,
      method: "POST",
      body: form,
    });
  } catch {
    throw new Error(apiConnectionError());
  }
  const json = (await res.json()) as {
    ok?: boolean;
    error?: string;
    message?: string;
    data?: { lote_id: number; insertados: number };
  };
  if (!json.ok || !json.data) {
    throw new Error(json.error || "Error al importar");
  }
  return {
    message: json.message ?? "Importación completada",
    lote_id: json.data.lote_id,
    insertados: json.data.insertados,
  };
}

export async function importStockGanaderoText(
  texto: string,
  nombreArchivo = "pegado.txt"
): Promise<{ message: string; lote_id: number; insertados: number }> {
  const json = await request<{
    message: string;
    data: { lote_id: number; insertados: number };
  }>("/stock-ganadero/import/text", {
    method: "POST",
    body: JSON.stringify({ texto, nombre_archivo: nombreArchivo }),
  });
  return {
    message: json.message,
    lote_id: json.data.lote_id,
    insertados: json.data.insertados,
  };
}

export async function importStockGanaderoRows(
  rows: Array<{
    eid: string;
    vid?: string;
    fecha: string;
    hora?: string;
    condicion?: string;
  }>,
  nombreArchivo = "carga-manual"
): Promise<{ message: string; lote_id: number; insertados: number }> {
  const json = await request<{
    message: string;
    data: { lote_id: number; insertados: number };
  }>("/stock-ganadero/import/rows", {
    method: "POST",
    body: JSON.stringify({ rows, nombre_archivo: nombreArchivo }),
  });
  return {
    message: json.message,
    lote_id: json.data.lote_id,
    insertados: json.data.insertados,
  };
}

export type TipoBajaImport = "VENDIDO" | "FRIGORIFICO";

export type TipoBaja =
  | "VENTA_FRIGORIFICO"
  | "FRIGORIFICO"
  | "VENTA_PRODUCTOR"
  | "MUERTE"
  | "PERDIDO";

export interface BajaDispositivoDetalleInput {
  numero: string;
  tipo_baja: TipoBaja;
  fecha: string;
  numero_guia?: string;
  observaciones?: string;
}

export interface ImportBajaDispositivosResult {
  message: string;
  actualizados: number;
  no_encontrados: number;
  duplicados_omitidos: number;
  ambiguos: number;
  muestra_no_encontrados: string[];
  muestra_ambiguos: string[];
}

export async function importStockGanaderoBajaFile(
  file: File,
  tipo_baja: TipoBaja
): Promise<ImportBajaDispositivosResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("tipo_baja", tipo_baja);
  let res: Response;
  try {
    res = await fetch(`${API}/stock-ganadero/baja/file`, {
      ...FETCH_INIT,
      method: "POST",
      body: form,
    });
  } catch {
    throw new Error(apiConnectionError());
  }
  const json = (await res.json()) as {
    ok?: boolean;
    error?: string;
    message?: string;
    data?: {
      actualizados: number;
      no_encontrados: number;
      duplicados_omitidos: number;
      ambiguos: number;
      muestra_no_encontrados: string[];
      muestra_ambiguos: string[];
      estado: TipoBajaImport;
      tipo_baja?: TipoBaja;
    };
  };
  if (!json.ok || !json.data) {
    throw new Error(json.error || "Error al importar bajas");
  }
  return {
    message: json.message ?? "Bajas procesadas",
    ...json.data,
  };
}

export async function importStockGanaderoBajaText(
  texto: string,
  estado: TipoBajaImport
): Promise<ImportBajaDispositivosResult> {
  const json = await request<{
    message: string;
    data: {
      actualizados: number;
      no_encontrados: number;
      duplicados_omitidos: number;
      ambiguos: number;
      muestra_no_encontrados: string[];
      muestra_ambiguos: string[];
      estado: TipoBajaImport;
      tipo_baja?: TipoBaja;
    };
  }>("/stock-ganadero/baja/text", {
    method: "POST",
    body: JSON.stringify({ texto, estado }),
  });
  return {
    message: json.message,
    ...json.data,
  };
}

export async function importStockGanaderoBajaRows(
  rows: Array<{
    eid: string;
    vid?: string;
    fecha: string;
    hora?: string;
    condicion?: string;
  }>,
  estado: TipoBajaImport
): Promise<ImportBajaDispositivosResult> {
  const json = await request<{
    message: string;
    data: {
      actualizados: number;
      no_encontrados: number;
      duplicados_omitidos: number;
      ambiguos: number;
      muestra_no_encontrados: string[];
      muestra_ambiguos: string[];
      estado: TipoBajaImport;
      tipo_baja?: TipoBaja;
    };
  }>("/stock-ganadero/baja/rows", {
    method: "POST",
    body: JSON.stringify({ rows, estado }),
  });
  return {
    message: json.message,
    ...json.data,
  };
}

export async function importStockGanaderoBajaDispositivos(
  items: BajaDispositivoDetalleInput[]
): Promise<ImportBajaDispositivosResult> {
  const json = await request<{
    message: string;
    data: {
      actualizados: number;
      no_encontrados: number;
      duplicados_omitidos: number;
      ambiguos: number;
      muestra_no_encontrados: string[];
      muestra_ambiguos: string[];
    };
  }>("/stock-ganadero/baja/dispositivos", {
    method: "POST",
    body: JSON.stringify({ items }),
  });
  return {
    message: json.message,
    ...json.data,
  };
}

export async function deleteStockGanaderoLote(id: number): Promise<void> {
  await request(`/stock-ganadero/lotes/${id}`, { method: "DELETE" });
}

export async function fetchProveedores(busqueda?: string): Promise<Proveedor[]> {
  const q = busqueda?.trim() ? `?busqueda=${encodeURIComponent(busqueda.trim())}` : "";
  const json = await request<{ data: Proveedor[] }>(`/proveedores${q}`);
  return json.data;
}

export async function fetchSiguienteCodProveedor(): Promise<number> {
  const json = await request<{ cod: number }>("/proveedores/siguiente-cod");
  return json.cod;
}

export async function createProveedor(data: ProveedorForm): Promise<Proveedor> {
  const json = await request<{ data: Proveedor; message: string }>("/proveedores", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return json.data;
}

export async function updateProveedor(
  id: number,
  data: ProveedorForm
): Promise<Proveedor> {
  const json = await request<{ data: Proveedor; message: string }>(
    `/proveedores/id/${id}`,
    { method: "PUT", body: JSON.stringify(data) }
  );
  return json.data;
}

export async function deleteProveedor(id: number): Promise<void> {
  await request(`/proveedores/id/${id}`, { method: "DELETE" });
}

export async function fetchRubros(soloActivos = false): Promise<Rubro[]> {
  const q = soloActivos ? "?solo_activos=1" : "";
  const json = await request<{ data: Rubro[] }>(`/rubros${q}`);
  return json.data;
}

export async function createRubro(data: RubroForm): Promise<Rubro> {
  const json = await request<{ data: Rubro; message: string }>("/rubros", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return json.data;
}

export async function updateRubro(id: number, data: RubroForm): Promise<Rubro> {
  const json = await request<{ data: Rubro; message: string }>(`/rubros/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return json.data;
}

export async function deleteRubro(id: number): Promise<void> {
  await request(`/rubros/${id}`, { method: "DELETE" });
}

export async function fetchSubRubros(soloActivos = false): Promise<SubRubro[]> {
  const q = soloActivos ? "?solo_activos=1" : "";
  const json = await request<{ data: SubRubro[] }>(`/sub-rubros${q}`);
  return json.data;
}

export async function fetchSubRubroGrupos(): Promise<string[]> {
  const json = await request<{ data: string[] }>("/sub-rubros/grupos");
  return json.data;
}

export async function createSubRubro(data: SubRubroForm): Promise<SubRubro> {
  const json = await request<{ data: SubRubro; message: string }>("/sub-rubros", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return json.data;
}

/** Crea un sub-rubro vinculado al rubro contable del formulario de gastos. */
export async function createSubRubroByRubro(
  rubro: string,
  nombre: string
): Promise<SubRubro> {
  const json = await request<{ data: SubRubro; message: string }>(
    "/sub-rubros/desde-rubro",
    {
      method: "POST",
      body: JSON.stringify({ rubro, nombre, activo: true }),
    }
  );
  return json.data;
}

export async function updateSubRubro(
  id: number,
  data: SubRubroForm
): Promise<SubRubro> {
  const json = await request<{ data: SubRubro; message: string }>(
    `/sub-rubros/${id}`,
    { method: "PUT", body: JSON.stringify(data) }
  );
  return json.data;
}

export async function deleteSubRubro(id: number): Promise<void> {
  await request(`/sub-rubros/${id}`, { method: "DELETE" });
}

export async function fetchSubRubroItemCounts(
  ids: number[]
): Promise<Record<number, number>> {
  if (!ids.length) return {};
  const json = await request<{ data: Record<number, number> }>(
    `/sub-rubros/items-counts?ids=${ids.join(",")}`
  );
  return json.data ?? {};
}

export async function fetchSubRubroItemsBatch(
  ids: number[]
): Promise<Record<number, SubRubroItem[]>> {
  if (!ids.length) return {};
  const json = await request<{ data: Record<number, SubRubroItem[]> }>(
    `/sub-rubros/items-batch?ids=${ids.join(",")}`
  );
  return json.data ?? {};
}

export async function fetchSubRubroItems(
  subRubroId: number,
  soloActivos = false
): Promise<SubRubroItem[]> {
  const q = soloActivos ? "?solo_activos=1" : "";
  const json = await request<{ data: SubRubroItem[] }>(
    `/sub-rubros/${subRubroId}/items${q}`
  );
  return json.data;
}

export async function fetchSubRubroItemsByNombre(
  subRubroNombre: string,
  soloActivos = true
): Promise<SubRubroItem[]> {
  const params = new URLSearchParams({
    sub_rubro: subRubroNombre,
    solo_activos: soloActivos ? "1" : "0",
  });
  const json = await request<{ data: SubRubroItem[] }>(
    `/sub-rubros/items?${params}`
  );
  return json.data;
}

export async function createSubRubroItem(
  subRubroId: number,
  nombre: string
): Promise<SubRubroItem> {
  const json = await request<{ data: SubRubroItem; message: string }>(
    `/sub-rubros/${subRubroId}/items`,
    { method: "POST", body: JSON.stringify({ nombre, activo: true }) }
  );
  return json.data;
}

/** Crea un ítem en el sub-rubro indicado por nombre (rubro = grupo del sub-rubro en BD). */
export async function createSubRubroItemByNombre(
  subRubroNombre: string,
  nombre: string
): Promise<SubRubroItem> {
  const json = await request<{ data: SubRubroItem; message: string }>(
    "/sub-rubros/items",
    {
      method: "POST",
      body: JSON.stringify({
        sub_rubro: subRubroNombre,
        nombre,
        activo: true,
      }),
    }
  );
  return json.data;
}

export async function deleteSubRubroItem(id: number): Promise<void> {
  await request(`/sub-rubro-items/${id}`, { method: "DELETE" });
}

export type DeleteSubRubrosGrupoResult = {
  deleted: number;
  blocked: Array<{ nombre: string; razon: string }>;
};

export type GrupoIconoInfo =
  | { tipo: "imagen"; url: string }
  | { tipo: "emoji"; emoji: string };

function normalizeGrupoIconosMap(
  raw: Record<string, GrupoIconoInfo | string>
): Record<string, GrupoIconoInfo> {
  const map: Record<string, GrupoIconoInfo> = {};
  for (const [grupo, val] of Object.entries(raw)) {
    if (typeof val === "string") {
      map[grupo] = { tipo: "imagen", url: val };
    } else if (val && (val.tipo === "imagen" || val.tipo === "emoji")) {
      map[grupo] = val;
    }
  }
  return map;
}

export async function fetchGrupoIconos(): Promise<Record<string, GrupoIconoInfo>> {
  const json = await request<{ data: Record<string, GrupoIconoInfo | string> }>(
    "/grupo-iconos"
  );
  return normalizeGrupoIconosMap(json.data ?? {});
}

export async function uploadGrupoIcono(
  grupo: string,
  file: File
): Promise<GrupoIconoInfo> {
  const fd = new FormData();
  fd.append("imagen", file);
  let res: Response;
  try {
    res = await fetch(`${API}/grupo-iconos/${encodeURIComponent(grupo)}/imagen`, {
      ...FETCH_INIT,
      method: "POST",
      body: fd,
    });
  } catch {
    throw new Error(apiConnectionError());
  }
  const json = (await res.json()) as {
    ok?: boolean;
    error?: string;
    data?: { icono: GrupoIconoInfo };
  };
  if (!json.ok || !json.data?.icono) {
    throw new Error(json.error || `Error al subir imagen (${res.status})`);
  }
  return json.data.icono;
}

export async function setGrupoIconoEmoji(
  grupo: string,
  emoji: string
): Promise<GrupoIconoInfo> {
  const json = await request<{ data: { icono: GrupoIconoInfo } }>(
    `/grupo-iconos/${encodeURIComponent(grupo)}/emoji`,
    { method: "PUT", body: JSON.stringify({ emoji }) }
  );
  return json.data.icono;
}

export async function clearGrupoIcono(grupo: string): Promise<void> {
  await request(`/grupo-iconos/${encodeURIComponent(grupo)}/imagen`, {
    method: "DELETE",
  });
}

export function resolveGrupoIcono(
  map: Record<string, GrupoIconoInfo>,
  grupo: string
): GrupoIconoInfo | undefined {
  if (map[grupo]) return map[grupo];
  const key = Object.keys(map).find(
    (k) => k.localeCompare(grupo, "es", { sensitivity: "accent" }) === 0
  );
  return key ? map[key] : undefined;
}

export async function renameSubRubroGrupo(
  anterior: string,
  nuevo: string
): Promise<{ updated: number; nombre: string }> {
  const json = await request<{
    data: { updated: number; nombre: string };
    message: string;
  }>("/sub-rubros/grupo/rename", {
    method: "PUT",
    body: JSON.stringify({ anterior, nuevo }),
  });
  return json.data;
}

export async function deleteSubRubrosGrupo(
  grupo: string
): Promise<DeleteSubRubrosGrupoResult> {
  const json = await request<{
    data: DeleteSubRubrosGrupoResult;
    message: string;
  }>(`/sub-rubros/grupo/${encodeURIComponent(grupo)}`, { method: "DELETE" });
  return json.data;
}

// —— Rubros / sub-rubros de ingresos por ventas ——

export async function fetchVentaSubRubros(soloActivos = false): Promise<SubRubro[]> {
  const q = soloActivos ? "?solo_activos=1" : "";
  const json = await request<{ data: SubRubro[] }>(`/venta-sub-rubros${q}`);
  return json.data;
}

export async function createVentaSubRubro(data: SubRubroForm): Promise<SubRubro> {
  const json = await request<{ data: SubRubro; message: string }>("/venta-sub-rubros", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return json.data;
}

export async function updateVentaSubRubro(
  id: number,
  data: SubRubroForm
): Promise<SubRubro> {
  const json = await request<{ data: SubRubro; message: string }>(
    `/venta-sub-rubros/${id}`,
    { method: "PUT", body: JSON.stringify(data) }
  );
  return json.data;
}

export async function deleteVentaSubRubro(id: number): Promise<void> {
  await request(`/venta-sub-rubros/${id}`, { method: "DELETE" });
}

export async function fetchVentaSubRubroItemsBatch(
  ids: number[]
): Promise<Record<number, SubRubroItem[]>> {
  if (!ids.length) return {};
  const json = await request<{ data: Record<number, SubRubroItem[]> }>(
    `/venta-sub-rubros/items-batch?ids=${ids.join(",")}`
  );
  return json.data ?? {};
}

export async function createVentaSubRubroItem(
  subRubroId: number,
  nombre: string
): Promise<SubRubroItem> {
  const json = await request<{ data: SubRubroItem; message: string }>(
    `/venta-sub-rubros/${subRubroId}/items`,
    { method: "POST", body: JSON.stringify({ nombre, activo: true }) }
  );
  return json.data;
}

export async function deleteVentaSubRubroItem(id: number): Promise<void> {
  await request(`/venta-sub-rubro-items/${id}`, { method: "DELETE" });
}

export async function fetchVentaGrupoIconos(): Promise<Record<string, GrupoIconoInfo>> {
  const json = await request<{ data: Record<string, GrupoIconoInfo | string> }>(
    "/venta-grupo-iconos"
  );
  return normalizeGrupoIconosMap(json.data ?? {});
}

export async function uploadVentaGrupoIcono(
  grupo: string,
  file: File
): Promise<GrupoIconoInfo> {
  const fd = new FormData();
  fd.append("imagen", file);
  let res: Response;
  try {
    res = await fetch(
      `${API}/venta-grupo-iconos/${encodeURIComponent(grupo)}/imagen`,
      { ...FETCH_INIT, method: "POST", body: fd }
    );
  } catch {
    throw new Error(apiConnectionError());
  }
  const json = (await res.json()) as {
    ok?: boolean;
    error?: string;
    data?: { icono: GrupoIconoInfo };
  };
  if (!json.ok || !json.data?.icono) {
    throw new Error(json.error || `Error al subir imagen (${res.status})`);
  }
  return json.data.icono;
}

export async function setVentaGrupoIconoEmoji(
  grupo: string,
  emoji: string
): Promise<GrupoIconoInfo> {
  const json = await request<{ data: { icono: GrupoIconoInfo } }>(
    `/venta-grupo-iconos/${encodeURIComponent(grupo)}/emoji`,
    { method: "PUT", body: JSON.stringify({ emoji }) }
  );
  return json.data.icono;
}

export async function clearVentaGrupoIcono(grupo: string): Promise<void> {
  await request(`/venta-grupo-iconos/${encodeURIComponent(grupo)}/imagen`, {
    method: "DELETE",
  });
}

export function resolveVentaGrupoIcono(
  map: Record<string, GrupoIconoInfo>,
  grupo: string
): GrupoIconoInfo | undefined {
  return resolveGrupoIcono(map, grupo);
}

export async function renameVentaSubRubroGrupo(
  anterior: string,
  nuevo: string
): Promise<{ updated: number; nombre: string }> {
  const json = await request<{
    data: { updated: number; nombre: string };
    message: string;
  }>("/venta-sub-rubros/grupo/rename", {
    method: "PUT",
    body: JSON.stringify({ anterior, nuevo }),
  });
  return json.data;
}

export async function deleteVentaSubRubrosGrupo(
  grupo: string
): Promise<DeleteSubRubrosGrupoResult> {
  const json = await request<{
    data: DeleteSubRubrosGrupoResult;
    message: string;
  }>(`/venta-sub-rubros/grupo/${encodeURIComponent(grupo)}`, { method: "DELETE" });
  return json.data;
}

export async function fetchRubroVinculos(rubroId: number): Promise<number[]> {
  const json = await request<{ data: { sub_rubro_ids: number[] } }>(
    `/rubros/${rubroId}/vinculos-sub-rubros`
  );
  return json.data.sub_rubro_ids;
}

export async function saveRubroVinculos(
  rubroId: number,
  subRubroIds: number[]
): Promise<void> {
  await request(`/rubros/${rubroId}/vinculos-sub-rubros`, {
    method: "PUT",
    body: JSON.stringify({ sub_rubro_ids: subRubroIds }),
  });
}

export async function fetchRubroVinculosMapa(): Promise<RubroVinculoMapaItem[]> {
  const json = await request<{ data: RubroVinculoMapaItem[] }>("/rubro-vinculos/mapa");
  return json.data;
}

export async function fetchResponsables(soloActivos = false): Promise<Responsable[]> {
  const q = soloActivos ? "?solo_activos=1" : "";
  const json = await request<{ data: Responsable[] }>(`/responsables${q}`);
  return json.data;
}

export async function createResponsable(data: ResponsableForm): Promise<Responsable> {
  const json = await request<{ data: Responsable; message: string }>("/responsables", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return json.data;
}

export async function updateResponsable(
  id: number,
  data: ResponsableForm
): Promise<Responsable> {
  const json = await request<{ data: Responsable; message: string }>(
    `/responsables/${id}`,
    { method: "PUT", body: JSON.stringify(data) }
  );
  return json.data;
}

export async function deleteResponsable(id: number): Promise<void> {
  await request(`/responsables/${id}`, { method: "DELETE" });
}

export async function fetchTipoCambioParaFecha(
  par: ParDivisa,
  fecha: string
): Promise<{ par: ParDivisa; valor: number; fecha_tc: string } | null> {
  const params = new URLSearchParams({ par, fecha });
  const json = await request<{
    data: { par: ParDivisa; valor: number; fecha_tc: string } | null;
  }>(`/divisas/para-fecha?${params}`);
  return json.data;
}

export async function fetchDivisas(filters?: {
  par?: ParDivisa;
  fecha_desde?: string;
  fecha_hasta?: string;
}): Promise<{
  data: TipoCambio[];
  ultimos: TipoCambio[];
  indicadores: DivisaIndicadores;
}> {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
  }
  const q = params.toString() ? `?${params}` : "";
  const json = await request<{
    data: TipoCambio[];
    ultimos: TipoCambio[];
    indicadores: DivisaIndicadores;
  }>(`/divisas${q}`);
  return {
    data: json.data,
    ultimos: json.ultimos,
    indicadores: json.indicadores,
  };
}

export async function fetchPreciosGanado(filters?: {
  segmento?: SegmentoPreciosGanado;
  categoria?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
}): Promise<{
  segmento: SegmentoPreciosGanado;
  data: PrecioGanado[];
  semanas: SemanaPreciosGanado[];
  ultima: SemanaPreciosGanado | null;
  resumen_local: PrecioGanadoResumenLocal;
  categorias: string[];
  labels: Record<string, string>;
}> {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
  }
  const q = params.toString() ? `?${params}` : "";
  const json = await request<{
    segmento: SegmentoPreciosGanado;
    data: PrecioGanado[];
    semanas: SemanaPreciosGanado[];
    ultima: SemanaPreciosGanado | null;
    resumen_local: PrecioGanadoResumenLocal;
    categorias: string[];
    labels: Record<string, string>;
  }>(`/precios-ganado${q}`);
  return {
    segmento: json.segmento,
    data: json.data,
    semanas: json.semanas,
    ultima: json.ultima,
    resumen_local: json.resumen_local,
    categorias: json.categorias,
    labels: json.labels,
  };
}

export async function importPreciosGanadoAcg(options?: {
  segmento?: SegmentoPreciosGanado | "ALL";
}): Promise<{
  message: string;
  insertados: number;
  actualizados: number;
  ignorados: number;
  sin_cambios?: number;
  total: number;
  segmento?: SegmentoPreciosGanado | "ALL";
}> {
  return request("/precios-ganado/import/acg", {
    method: "POST",
    body: JSON.stringify(options ?? { segmento: "ALL" }),
  });
}

export async function fetchSimuladorPreciosReferencia(
  tipo: SimuladorVentaTipo
): Promise<SimuladorPreciosReferencia> {
  const json = await request<SimuladorPreciosReferencia & { ok: boolean }>(
    `/simulador-venta-ganado/precios-referencia?tipo=${tipo}`
  );
  return {
    tipo: json.tipo,
    segmento: json.segmento,
    ultima: json.ultima,
    precios: json.precios,
    labels: json.labels,
    categorias: json.categorias,
    siguiente_numero_operacion: json.siguiente_numero_operacion,
  };
}

export async function fetchSimulacionesVentaGanado(filters?: {
  tipo?: SimuladorVentaTipo;
  limit?: number;
}): Promise<SimuladorVentaGanadoRow[]> {
  const params = new URLSearchParams();
  if (filters?.tipo) params.set("tipo", filters.tipo);
  if (filters?.limit != null) params.set("limit", String(filters.limit));
  const q = params.toString() ? `?${params}` : "";
  const json = await request<{ ok: boolean; data: SimuladorVentaGanadoRow[] }>(
    `/simulador-venta-ganado${q}`
  );
  return json.data;
}

export async function saveSimulacionVentaGanado(data: {
  tipo: SimuladorVentaTipo;
  categoria: string;
  modo_kg: SimuladorModoKg;
  precio_usd_kg: number;
  precio_ref_anio?: number | null;
  precio_ref_semana?: number | null;
  precio_ref_fecha_hasta?: string | null;
  cantidad_animales?: number | null;
  kg_promedio?: number | null;
  kg_total: number;
  rendimiento?: number | null;
  total_usd: number;
  total_usd_por_cabeza?: number | null;
  notas?: string | null;
}): Promise<{ data: SimuladorVentaGanadoRow; message: string }> {
  return request("/simulador-venta-ganado", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteSimulacionVentaGanado(id: number): Promise<{ message: string }> {
  return request(`/simulador-venta-ganado/${id}`, { method: "DELETE" });
}

export async function updateSimulacionVentaGanado(
  id: number,
  data: {
    tipo: SimuladorVentaTipo;
    categoria: string;
    modo_kg: SimuladorModoKg;
    precio_usd_kg: number;
    precio_ref_anio?: number | null;
    precio_ref_semana?: number | null;
    precio_ref_fecha_hasta?: string | null;
    cantidad_animales?: number | null;
    kg_promedio?: number | null;
    kg_total: number;
    rendimiento?: number | null;
    total_usd: number;
    total_usd_por_cabeza?: number | null;
    notas?: string | null;
  }
): Promise<{ data: SimuladorVentaGanadoRow; message: string }> {
  return request(`/simulador-venta-ganado/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function patchSimulacionVentaGanado(
  id: number,
  patch: {
    destacada?: boolean;
    venta_realizada?: boolean;
    valores_reales?: SimuladorVentaRealInput;
  }
): Promise<{ data: SimuladorVentaGanadoRow; message: string; restaurados?: number }> {
  return request(`/simulador-venta-ganado/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function fetchSimuladorVentaAuditoria(
  id: number,
  limit?: number
): Promise<{
  data: SimuladorVentaAuditoriaRow[];
  labels: Record<SimuladorVentaAuditoriaTipo, string>;
}> {
  const q = limit != null ? `?limit=${limit}` : "";
  const json = await request<{
    ok: boolean;
    data: Array<Omit<SimuladorVentaAuditoriaRow, "detalle"> & { detalle: string }>;
    labels: Record<SimuladorVentaAuditoriaTipo, string>;
  }>(`/simulador-venta-ganado/${id}/auditoria${q}`);

  const data = json.data.map((row) => {
    let detalle: SimuladorVentaAuditoriaDetalle | null = null;
    if (row.detalle?.trim()) {
      try {
        detalle = JSON.parse(row.detalle) as SimuladorVentaAuditoriaDetalle;
      } catch {
        detalle = null;
      }
    }
    return { ...row, detalle };
  });

  return { data, labels: json.labels };
}

export async function fetchSimuladorVentaDispositivos(
  id: number
): Promise<SimuladorVentaDispositivoRow[]> {
  const json = await request<{ ok: boolean; data: SimuladorVentaDispositivoRow[] }>(
    `/simulador-venta-ganado/${id}/dispositivos`
  );
  return json.data;
}

export async function saveSimuladorVentaDispositivos(
  id: number,
  dispositivos: Array<{ clave: string; eid: string; vid: string }>
): Promise<{
  data: SimuladorVentaDispositivoRow[];
  message: string;
  restaurados?: number;
  bajados?: number;
}> {
  return request(`/simulador-venta-ganado/${id}/dispositivos`, {
    method: "PUT",
    body: JSON.stringify({ dispositivos }),
  });
}

export async function insertDivisa(data: TipoCambioForm): Promise<void> {
  const res = await fetch(`${API}/divisas`, {
    ...FETCH_INIT,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "Error al guardar");
}

export async function importDivisasFile(
  file: File
): Promise<{ message: string; insertados: number; actualizados: number; total: number }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API}/divisas/import/file`, {
    ...FETCH_INIT,
    method: "POST",
    body: form,
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "Error al importar");
  return json;
}

export async function importDivisasInvestingUyu(filters?: {
  fecha_desde?: string;
  fecha_hasta?: string;
}): Promise<{
  message: string;
  insertados: number;
  actualizados: number;
  total: number;
  parseadas?: number;
  rango_html?: { desde: string; hasta: string };
  aviso?: string;
  fuente?: string;
}> {
  return request("/divisas/import/investing-uyu", {
    method: "POST",
    body: JSON.stringify(filters ?? {}),
  });
}

type ImportDivisasAutoOptions = {
  anos?: number;
  fecha_desde?: string;
  fecha_hasta?: string;
  solo_nuevos?: boolean;
  completo?: boolean;
};

type ImportDivisasAutoResult = {
  message: string;
  insertados: number;
  actualizados: number;
  ignorados?: number;
  total: number;
  parseadas?: number;
  rango?: { desde: string; hasta: string };
  lotes?: number;
  fuente?: string;
  ya_actualizado?: boolean;
  ultima_guardada?: string;
};

/** Histórico BCU — USD → pesos uruguayos (cuántos $U por 1 USD). */
export async function importDivisasBcuUyu(
  options?: ImportDivisasAutoOptions
): Promise<ImportDivisasAutoResult> {
  return request("/divisas/import/bcu-uyu", {
    method: "POST",
    body: JSON.stringify({ anos: 2, solo_nuevos: true, ...options }),
  });
}

/** Histórico Yahoo — reales brasileños por 1 USD. */
export async function importDivisasYahooBrl(
  options?: ImportDivisasAutoOptions
): Promise<ImportDivisasAutoResult> {
  return request("/divisas/import/yahoo-brl", {
    method: "POST",
    body: JSON.stringify({ anos: 2, solo_nuevos: true, ...options }),
  });
}

export async function importDivisasText(
  text: string
): Promise<{ message: string; insertados: number; actualizados: number; total: number }> {
  return request("/divisas/import/text", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export async function fetchResumen(filters: {
  fecha_desde?: string;
  fecha_hasta?: string;
  empresa?: string;
}): Promise<{ por_empresa: ResumenEmpresa[]; por_rubro: ResumenRubro[] }> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v) params.set(k, v);
  });
  const q = params.toString() ? `?${params}` : "";
  return request(`/resumen${q}`);
}

export async function fetchFuncionarios(opts?: {
  busqueda?: string;
  soloActivos?: boolean;
}): Promise<Funcionario[]> {
  const params = new URLSearchParams();
  if (opts?.busqueda) params.set("busqueda", opts.busqueda);
  if (opts?.soloActivos) params.set("solo_activos", "1");
  const q = params.toString() ? `?${params}` : "";
  const json = await request<{ data: Funcionario[] }>(`/funcionarios${q}`);
  return json.data;
}

export async function fetchFuncionarioByCedula(cedula: string): Promise<Funcionario> {
  const json = await request<{ data: Funcionario }>(
    `/funcionarios/cedula/${encodeURIComponent(cedula)}`
  );
  return json.data;
}

export async function createFuncionario(data: FuncionarioForm): Promise<Funcionario> {
  const json = await request<{ data: Funcionario; message: string }>("/funcionarios", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return json.data;
}

export async function updateFuncionario(
  id: number,
  data: FuncionarioForm
): Promise<Funcionario> {
  const json = await request<{ data: Funcionario; message: string }>(
    `/funcionarios/${id}`,
    { method: "PUT", body: JSON.stringify(data) }
  );
  return json.data;
}

export async function deleteFuncionario(id: number): Promise<void> {
  await request(`/funcionarios/${id}`, { method: "DELETE" });
}

export async function fetchPagosPorCedula(
  cedula: string,
  filters?: { fecha_desde?: string; fecha_hasta?: string; empresa?: string }
): Promise<ResumenPagosFuncionario> {
  const params = new URLSearchParams({ cedula });
  if (filters?.fecha_desde) params.set("fecha_desde", filters.fecha_desde);
  if (filters?.fecha_hasta) params.set("fecha_hasta", filters.fecha_hasta);
  if (filters?.empresa) params.set("empresa", filters.empresa);
  const json = await request<{ data: ResumenPagosFuncionario }>(
    `/rrhh/pagos?${params}`
  );
  return json.data;
}

export function esRubroRemuneracion(rubro: string, subRubro = ""): boolean {
  const t = `${rubro} ${subRubro}`.toLowerCase();
  return /sueldo|jornal|aguinald|remunerac|carga|social|personal|salario|bonific|vacacional/.test(
    t
  );
}

/* —— Autenticación —— */

export async function loginAuth(
  email: string,
  password: string
): Promise<AuthUser> {
  const json = await request<{ data: AuthUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return json.data;
}

export async function logoutAuth(): Promise<void> {
  await request<{ ok: boolean }>("/auth/logout", { method: "POST" });
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${API}/auth/me`, {
      ...FETCH_INIT,
      cache: "no-store",
    });
    if (res.status === 401) return null;
    const json = (await res.json()) as { ok?: boolean; data?: AuthUser };
    return json.ok && json.data ? json.data : null;
  } catch {
    return null;
  }
}

export async function cambiarPasswordAuth(
  password_actual: string,
  password_nueva: string
): Promise<string> {
  const json = await request<{ message?: string }>("/auth/cambiar-password", {
    method: "POST",
    body: JSON.stringify({ password_actual, password_nueva }),
  });
  return json.message ?? "Contraseña actualizada";
}

async function avatarMutation(path: string, options?: RequestInit): Promise<AuthUser> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...FETCH_INIT,
      ...options,
      credentials: "include",
    });
  } catch {
    throw new Error(apiConnectionError());
  }
  const json = (await res.json()) as { ok?: boolean; data?: AuthUser; error?: string };
  if (!res.ok || !json.ok || !json.data) {
    throw new Error(json.error ?? "Error al actualizar foto de perfil");
  }
  return json.data;
}

export async function subirAvatarFoto(file: File): Promise<AuthUser> {
  const fd = new FormData();
  fd.append("foto", file);
  return avatarMutation("/auth/avatar/foto", { method: "POST", body: fd });
}

export async function quitarAvatarFoto(): Promise<AuthUser> {
  return avatarMutation("/auth/avatar", { method: "DELETE" });
}

/* —— Chat interno —— */

export async function fetchChatMessages(
  peerId: number,
  opts?: { since_id?: number; before_id?: number; around_id?: number; limit?: number }
): Promise<ChatMessage[]> {
  const params = new URLSearchParams({ peer_id: String(peerId) });
  if (opts?.since_id) params.set("since_id", String(opts.since_id));
  if (opts?.before_id) params.set("before_id", String(opts.before_id));
  if (opts?.around_id) params.set("around_id", String(opts.around_id));
  if (opts?.limit) params.set("limit", String(opts.limit));
  const json = await request<{ data: { messages: ChatMessage[] } }>(
    `/chat/messages?${params}`
  );
  return json.data.messages;
}

export async function buscarChatMensajes(
  query: string,
  opts?: { peer_id?: number; limit?: number }
): Promise<ChatSearchHit[]> {
  const params = new URLSearchParams({ q: query.trim() });
  if (opts?.peer_id !== undefined) params.set("peer_id", String(opts.peer_id));
  if (opts?.limit) params.set("limit", String(opts.limit));
  const json = await request<{ data: { hits: ChatSearchHit[] } }>(
    `/chat/search?${params}`
  );
  return json.data.hits;
}

export async function enviarChatMensaje(
  peerId: number,
  body: string
): Promise<ChatMessage> {
  const json = await request<{ data: ChatMessage }>("/chat/messages", {
    method: "POST",
    body: JSON.stringify({ peer_id: peerId, body }),
  });
  return json.data;
}

export async function enviarChatAdjunto(
  peerId: number,
  file: File,
  body = ""
): Promise<ChatMessage> {
  const fd = new FormData();
  fd.append("archivo", file);
  fd.append("peer_id", String(peerId));
  if (body.trim()) fd.append("body", body.trim());

  let res: Response;
  try {
    res = await fetch(`${API}/chat/messages/attachment`, {
      ...FETCH_INIT,
      method: "POST",
      body: fd,
    });
  } catch {
    throw new Error(apiConnectionError());
  }

  const json = (await res.json()) as { ok?: boolean; data?: ChatMessage; error?: string };
  if (!res.ok || !json.ok || !json.data) {
    throw new Error(json.error ?? "Error al enviar adjunto");
  }
  return json.data;
}

export function chatAttachmentUrl(messageId: number): string {
  return `${API}/chat/attachments/${messageId}`;
}

export async function marcarChatLeido(
  peerId: number,
  lastMessageId: number
): Promise<ChatUnreadSummary> {
  const json = await request<{ data: ChatUnreadSummary }>("/chat/read", {
    method: "POST",
    body: JSON.stringify({ peer_id: peerId, last_message_id: lastMessageId }),
  });
  return json.data;
}

export async function fetchChatUnread(): Promise<ChatUnreadSummary> {
  const json = await request<{ data: ChatUnreadSummary }>("/chat/unread");
  return json.data;
}

export async function fetchChatContacts(): Promise<{
  contacts: ChatContact[];
  general_unread: number;
  total_unread: number;
  online_count: number;
}> {
  const json = await request<{
    data: {
      contacts: ChatContact[];
      general_unread: number;
      total_unread: number;
      online_count: number;
    };
  }>("/chat/contacts");
  return json.data;
}

export async function fetchChatPresence(): Promise<{
  users: Record<number, ChatUserPresence>;
  online_count: number;
}> {
  const json = await request<{
    data: {
      users: Record<number, ChatUserPresence>;
      online_count: number;
    };
  }>("/chat/presence");
  return json.data;
}

export async function fetchChatWallpapers(): Promise<{
  presets: { id: string; label: string }[];
  by_peer: Record<number, string>;
}> {
  const json = await request<{
    data: {
      presets: { id: string; label: string }[];
      by_peer: Record<number, string>;
    };
  }>("/chat/wallpapers");
  return json.data;
}

export async function guardarChatWallpaper(
  peerId: number,
  wallpaperId: string
): Promise<{ peer_id: number; wallpaper_id: string }> {
  const json = await request<{
    data: { peer_id: number; wallpaper_id: string };
  }>("/chat/wallpaper", {
    method: "PUT",
    body: JSON.stringify({ peer_id: peerId, wallpaper_id: wallpaperId }),
  });
  return json.data;
}

export async function fetchChatBootstrap(peerId = 0, limit = 50): Promise<{
  channels: ChatChannel[];
  contacts: ChatContact[];
  wallpapers: { presets: Array<{ id: string; label: string }>; by_peer: Record<number, string> };
  messages: ChatMessage[];
  total_unread: number;
  general_unread: number;
  online_count: number;
  peer_id: number;
}> {
  const params = new URLSearchParams();
  params.set("peer_id", String(peerId));
  params.set("limit", String(limit));
  const json = await request<{
    data: {
      channels: ChatChannel[];
      contacts: ChatContact[];
      wallpapers: { presets: Array<{ id: string; label: string }>; by_peer: Record<number, string> };
      messages: ChatMessage[];
      total_unread: number;
      general_unread: number;
      online_count: number;
      peer_id: number;
    };
  }>(`/chat/bootstrap?${params}`);
  return json.data;
}

export async function fetchChatChannels(): Promise<ChatChannel[]> {
  const json = await request<{ data: { channels: ChatChannel[] } }>("/chat/channels");
  return json.data.channels;
}

export async function crearChatCanal(nombre: string): Promise<ChatChannel> {
  const json = await request<{ data: ChatChannel }>("/chat/channels", {
    method: "POST",
    body: JSON.stringify({ nombre }),
  });
  return json.data;
}

export async function renombrarChatCanal(
  channelId: number,
  nombre: string
): Promise<ChatChannel> {
  const json = await request<{ data: ChatChannel }>(
    `/chat/channels/${channelId}/rename`,
    {
      method: "PUT",
      body: JSON.stringify({ nombre }),
    }
  );
  return json.data;
}

export async function fetchUsuarios(): Promise<AuthUser[]> {
  const json = await request<{ data: AuthUser[] }>("/auth/users");
  return json.data;
}

export async function fetchStockMovimientosAuditoria(filters?: {
  user_id?: number;
  tipo?: StockMovimientoTipo;
  limite?: number;
}): Promise<StockMovimientoAuditoria[]> {
  const params = new URLSearchParams();
  if (filters?.user_id) params.set("user_id", String(filters.user_id));
  if (filters?.tipo) params.set("tipo", filters.tipo);
  if (filters?.limite) params.set("limite", String(filters.limite));
  const q = params.toString();
  const json = await request<{ data: StockMovimientoAuditoria[] }>(
    `/auth/stock-movimientos${q ? `?${q}` : ""}`
  );
  return json.data;
}

export async function fetchAuthActividad(filters?: {
  email?: string;
  evento?: string;
  limite?: number;
  offset?: number;
}): Promise<{
  items: AuthActividadLog[];
  total: number;
  resumen: { total: number; logins: number; navegacion: number; acciones: number };
}> {
  const params = new URLSearchParams();
  if (filters?.email) params.set("email", filters.email);
  if (filters?.evento) params.set("evento", filters.evento);
  if (filters?.limite != null) params.set("limite", String(filters.limite));
  if (filters?.offset != null) params.set("offset", String(filters.offset));
  const q = params.toString();
  const json = await request<{
    data: AuthActividadLog[];
    total: number;
    resumen: { total: number; logins: number; navegacion: number; acciones: number };
  }>(`/auth/actividad${q ? `?${q}` : ""}`);
  return {
    items: json.data,
    total: json.total ?? json.data.length,
    resumen: json.resumen ?? {
      total: json.total ?? json.data.length,
      logins: 0,
      navegacion: 0,
      acciones: 0,
    },
  };
}

/** Mantiene presencia activa (fire-and-forget). */
export function enviarPresencia(pantalla?: string): void {
  void request<{ ok: boolean }>("/auth/presencia", {
    method: "POST",
    body: JSON.stringify({ pantalla: pantalla ?? "" }),
  }).catch(() => {
    /* no bloquear la UI */
  });
}

export async function fetchUsuariosOnline(): Promise<UsuarioOnline[]> {
  const json = await request<{ data: UsuarioOnline[] }>("/auth/actividad/online");
  return json.data;
}

/** Registra navegación (fire-and-forget). */
export function registrarPantallaActividad(pantalla: string): void {
  enviarPresencia(pantalla);
  void request<{ ok: boolean }>("/auth/actividad/pantalla", {
    method: "POST",
    body: JSON.stringify({ pantalla }),
  }).catch(() => {
    /* no bloquear la UI */
  });
}

export async function crearUsuario(data: UserForm): Promise<AuthUser> {
  const json = await request<{ data: AuthUser }>("/auth/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return json.data;
}

export async function actualizarUsuario(
  id: number,
  data: Partial<UserForm>
): Promise<AuthUser> {
  const json = await request<{ data: AuthUser }>(`/auth/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  return json.data;
}

export async function fetchRolePermissions(): Promise<RolPermisosConfig[]> {
  const json = await request<{ data: RolPermisosConfig[] }>("/auth/role-permissions");
  return json.data;
}

export async function actualizarRolePermissions(
  rol: Rol,
  data: RolPermisosInput
): Promise<RolPermisosConfig> {
  const json = await request<{ data: RolPermisosConfig }>(
    `/auth/role-permissions/${rol}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    }
  );
  return json.data;
}

export async function fetchTiposDocumentoGasto(opts?: {
  soloActivos?: boolean;
}): Promise<TipoDocumentoGasto[]> {
  const params = new URLSearchParams();
  if (opts?.soloActivos) params.set("solo_activos", "1");
  const q = params.toString() ? `?${params}` : "";
  const json = await request<{ data: TipoDocumentoGasto[] }>(
    `/documentos-digitales/tipos-gasto${q}`
  );
  return json.data;
}

export async function createTipoDocumentoGasto(
  data: TipoDocumentoGastoForm
): Promise<TipoDocumentoGasto> {
  const json = await request<{ data: TipoDocumentoGasto; message: string }>(
    "/documentos-digitales/tipos-gasto",
    { method: "POST", body: JSON.stringify(data) }
  );
  return json.data;
}

export async function updateTipoDocumentoGasto(
  id: number,
  data: TipoDocumentoGastoForm
): Promise<TipoDocumentoGasto> {
  const json = await request<{ data: TipoDocumentoGasto; message: string }>(
    `/documentos-digitales/tipos-gasto/${id}`,
    { method: "PUT", body: JSON.stringify(data) }
  );
  return json.data;
}

export async function deleteTipoDocumentoGasto(id: number): Promise<void> {
  await request(`/documentos-digitales/tipos-gasto/${id}`, { method: "DELETE" });
}

export async function detectarCamposDocumento(
  file: File
): Promise<DetectarCamposDocumentoResult> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API}/documentos-digitales/detectar-campos`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  const json = (await res.json()) as {
    ok: boolean;
    data?: DetectarCamposDocumentoResult;
    error?: string;
  };
  if (!res.ok || !json.ok || !json.data) {
    throw new Error(json.error || "No se pudieron detectar los campos del documento");
  }
  return json.data;
}

export async function parseBrouTransferenciaDocument(
  file: File,
  mapeo?: GastoMapeoCampos,
  mapeoComision?: GastoMapeoCampos
): Promise<BrouTransferenciaParsed> {
  const form = new FormData();
  form.append("file", file);
  if (mapeo && Object.keys(mapeo).length > 0) {
    form.append("mapeo", JSON.stringify(mapeo));
  }
  if (mapeoComision && Object.keys(mapeoComision).length > 0) {
    form.append("mapeo_comision", JSON.stringify(mapeoComision));
  }
  const res = await fetch(`${API}/documentos-digitales/parse-brou-transferencia`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  const json = (await res.json()) as {
    ok: boolean;
    data?: BrouTransferenciaParsed;
    error?: string;
  };
  if (!res.ok || !json.ok || !json.data) {
    throw new Error(json.error || "No se pudo leer el comprobante BROU");
  }
  return json.data;
}

/**
 * Lee un comprobante de cualquier banco: autodetecta el tipo de documento
 * configurado por el texto y aplica su mapeo de campos.
 */
export async function leerComprobante(file: File): Promise<ComprobanteLeido> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API}/documentos-digitales/leer-comprobante`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  const json = (await res.json()) as {
    ok: boolean;
    data?: ComprobanteLeido;
    error?: string;
  };
  if (!res.ok || !json.ok || !json.data) {
    throw new Error(json.error || "No se pudo leer el comprobante");
  }
  return json.data;
}
