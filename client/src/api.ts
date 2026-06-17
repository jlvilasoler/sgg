import type {
  Catalogos,
  IngresoVenta,
  IngresoVentaForm,
  ParDivisa,
  Presupuesto,
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
  DivisaIndicadores,
  StockGanaderoLote,
  StockGanaderoRegistro,
  StockGanaderoEstadisticas,
  StockGanaderaDispositivo,
  StockGanaderaDispositivoDetalle,
  StockGanaderaDispositivoHistorial,
  DispositivoSexo,
  DispositivoEmpresa,
  DispositivoEstado,
  AuthUser,
  UserForm,
  Rol,
  RolPermisosConfig,
  RolPermisosInput,
} from "./types";
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

export async function checkApiHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API}/health`, {
      ...FETCH_INIT,
      cache: "no-store",
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { ok?: boolean; ready?: boolean };
    if (json.ok !== true) return false;
    // En local, esperar a que la DB termine de inicializar (Vite arranca antes).
    if (import.meta.env.DEV && json.ready === false) return false;
    return true;
  } catch {
    return false;
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
}): Promise<Presupuesto[]> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v) params.set(k, v);
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
}> {
  const json = await request<{
    data: { lotes: number; registros: number; dispositivos: number };
  }>("/stock-ganadero/resumen");
  return json.data;
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
    filters.estado_dispositivo === "FRIGORIFICO"
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
    nacimiento_mes: number | null;
    nacimiento_anio: number | null;
    observaciones: string;
    estado: DispositivoEstado;
    baja_mes: number | null;
    baja_anio: number | null;
  },
  eid?: string
): Promise<{
  sexo: DispositivoSexo;
  empresa: DispositivoEmpresa;
  grupo: string;
  edad: number | null;
  nacimiento_mes: number | null;
  nacimiento_anio: number | null;
  observaciones: string;
  estado: DispositivoEstado;
  baja_mes: number | null;
  baja_anio: number | null;
}> {
  const json = await request<{
    data: {
      sexo: DispositivoSexo;
      empresa: DispositivoEmpresa;
      grupo: string;
      edad: number | null;
      nacimiento_mes: number | null;
      nacimiento_anio: number | null;
      observaciones: string;
      estado: DispositivoEstado;
      baja_mes: number | null;
      baja_anio: number | null;
    };
  }>(`/stock-ganadero/dispositivos/${encodeURIComponent(clave)}`, {
    method: "PATCH",
    body: JSON.stringify({ ...data, eid }),
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

export type TipoBajaImport = "VENDIDO" | "FRIGORIFICO";

export interface ImportBajaDispositivosResult {
  message: string;
  actualizados: number;
  no_encontrados: number;
  duplicados_omitidos: number;
  muestra_no_encontrados: string[];
  estado: TipoBajaImport;
}

export async function importStockGanaderoBajaFile(
  file: File,
  estado: TipoBajaImport
): Promise<ImportBajaDispositivosResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("estado", estado);
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
      muestra_no_encontrados: string[];
      estado: TipoBajaImport;
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
      muestra_no_encontrados: string[];
      estado: TipoBajaImport;
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

export async function fetchUsuarios(): Promise<AuthUser[]> {
  const json = await request<{ data: AuthUser[] }>("/auth/users");
  return json.data;
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
