import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deleteStockGanaderaDispositivos,
  fetchStockGanaderaDispositivos,
  fetchStockGanaderaSalidas,
  fetchStockGanaderaVentasDispositivos,
  vaciarStockGanaderaCompleto,
} from "../../api";
import { useHeaderBackStep } from "../../header-back";
import type { AuthUser, DispositivoEstado, StockGanaderaDispositivo } from "../../types";
import { fmtDate } from "../../utils";
import { confirmAction } from "../../utils/confirm";
import TablePagination, {
  paginateSlice,
  type PageSize,
} from "../TablePagination";
import BadgeEstadoDispositivo from "./BadgeEstadoDispositivo";
import IconoDispositivoWifi from "./IconoDispositivoWifi";
import StockGanaderaDashKpi from "./StockGanaderaDashKpi";
import StockGanaderaBulkPanel from "./StockGanaderaBulkPanel";
import StockGanaderaDetalle from "./StockGanaderaDetalle";
import StockGanaderaEdadMiniTimeline from "./StockGanaderaEdadMiniTimeline";
import StockGanaderaEditarPanel from "./StockGanaderaEditarModal";
import StockGanaderaHistorialCambiosPanel from "./StockGanaderaHistorialCambiosPanel";
import StockGanaderaFiltrosSidebar from "./StockGanaderaFiltrosSidebar";
import type { CategoriaFiltroKey, EdadFiltroKey } from "./stock-ganadera-utils";
import {
  CATEGORIA_FILTRO_HEMBRA,
  CATEGORIA_FILTRO_MACHO,
  CATEGORIA_FILTRO_OTROS,
  EDAD_FILTRO_OPCIONES,
  categoriasDispositivo,
  coincideCategoriaFiltro,
  coincideSinFechaNacFiltro,
  dispositivoSinFechaNacimiento,
  dispositivoActivoEnStock,
  esDispositivoFueraDeStock,
  calcularResumenStockGanaderaKpis,
  fmtSalidasSistemaHint,
  contarSexoDispositivos,
  edadFiltroKey,
  fmtEstadoDispositivo,
  fmtGrupo,
  fmtGrupoLibre,
  grupoLibreFiltroKey,
  labelCategoriaFiltro,
  labelEdadFiltro,
  labelGrupoLibreFiltro,
  SIN_FECHA_NAC_FILTRO_KEY,
} from "./stock-ganadera-utils";
import {
  filtrosCacheKey,
  readStockGanaderaPageCache,
  rowsDesdeCache,
  ventasClavesDesdeCache,
  clearStockGanaderaPageCache,
  writeStockGanaderaPageCache,
} from "./stock-ganadera-page-cache";

const cacheInicial = readStockGanaderaPageCache();
const filtrosInicialesKey = filtrosCacheKey({});

function toggleSet<T>(prev: Set<T>, value: T): Set<T> {
  const next = new Set(prev);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function aplicaFacetas(
  rows: StockGanaderaDispositivo[],
  filtroSexo: Set<string>,
  filtroEmpresa: Set<string>,
  filtroEstado: Set<DispositivoEstado>,
  filtroEdad: Set<string>,
  filtroGrupoLibre: Set<string>,
  filtroCategoria: Set<string>,
  filtroSinFechaNac: Set<string>
): StockGanaderaDispositivo[] {
  return rows.filter((d) => {
    if (filtroSexo.size > 0 && !filtroSexo.has(d.sexo || "")) return false;
    if (filtroEmpresa.size > 0 && !filtroEmpresa.has(d.empresa || "")) return false;
    if (filtroEstado.size > 0 && !filtroEstado.has(d.estado)) return false;
    if (filtroEdad.size > 0) {
      const edadKey = edadFiltroKey(d);
      if (edadKey === null || !filtroEdad.has(edadKey)) return false;
    }
    if (
      filtroGrupoLibre.size > 0 &&
      !filtroGrupoLibre.has(grupoLibreFiltroKey(d.grupo_libre ?? ""))
    ) {
      return false;
    }
    if (!coincideCategoriaFiltro(d, filtroCategoria)) return false;
    if (!coincideSinFechaNacFiltro(d, filtroSinFechaNac)) return false;
    return true;
  });
}

function fmtSexo(sexo: StockGanaderaDispositivo["sexo"]): string {
  return sexo || "—";
}

function fmtEmpresa(empresa: StockGanaderaDispositivo["empresa"]): string {
  return empresa || "—";
}

function claseCeldaSexo(sexo: StockGanaderaDispositivo["sexo"]): string {
  if (sexo === "MACHO") return "stock-td--sexo-macho";
  if (sexo === "HEMBRA") return "stock-td--sexo-hembra";
  return "stock-td--sexo-na";
}

interface Props {
  apiOnline: boolean;
  currentUser?: AuthUser | null;
  onError: (msg: string) => void;
  onSuccess?: (msg: string) => void;
  onVolver: () => void;
  refreshKey?: number;
}

export default function StockGanadera({
  apiOnline,
  currentUser,
  onError,
  onSuccess,
  onVolver,
  refreshKey = 0,
}: Props) {
  const esAdmin = currentUser?.rol === "admin";
  const [rows, setRows] = useState<StockGanaderaDispositivo[]>(() =>
    rowsDesdeCache(cacheInicial, filtrosInicialesKey)
  );
  const [busqueda, setBusqueda] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [editarDispositivo, setEditarDispositivo] =
    useState<StockGanaderaDispositivo | null>(null);
  const [detalleClave, setDetalleClave] = useState<string | null>(null);
  const [historialCambios, setHistorialCambios] = useState<{
    clave: string;
    vid: string;
    eid: string;
  } | null>(null);
  const volverDetalle = useCallback(() => setDetalleClave(null), []);
  const volverEditar = useCallback(() => setEditarDispositivo(null), []);
  const volverBulk = useCallback(() => setBulkOpen(false), []);
  const volverHistorial = useCallback(() => setHistorialCambios(null), []);
  const [loading, setLoading] = useState(() => !cacheInicial);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(30);
  const [seleccion, setSeleccion] = useState<Set<string>>(() => new Set());
  const [filtroSexo, setFiltroSexo] = useState<Set<string>>(() => new Set());
  const [filtroEmpresa, setFiltroEmpresa] = useState<Set<string>>(() => new Set());
  const [filtroEstado, setFiltroEstado] = useState<Set<DispositivoEstado>>(
    () => new Set()
  );
  const [filtroEdad, setFiltroEdad] = useState<Set<string>>(() => new Set());
  const [filtroGrupoLibre, setFiltroGrupoLibre] = useState<Set<string>>(
    () => new Set()
  );
  const [filtroCategoria, setFiltroCategoria] = useState<Set<string>>(
    () => new Set()
  );
  const [filtroSinFechaNac, setFiltroSinFechaNac] = useState<Set<string>>(
    () => new Set()
  );
  const [bulkOpen, setBulkOpen] = useState(false);
  const [filtrosMobileOpen, setFiltrosMobileOpen] = useState(false);
  const [ventasClaves, setVentasClaves] = useState<Set<string>>(() =>
    ventasClavesDesdeCache(cacheInicial)
  );
  const [statsRows, setStatsRows] = useState<StockGanaderaDispositivo[]>(
    () => cacheInicial?.statsRows ?? []
  );
  const [filtroVentasCerradas, setFiltroVentasCerradas] = useState(false);
  const [filtroSalidasSistema, setFiltroSalidasSistema] = useState(false);

  useHeaderBackStep(!!editarDispositivo, volverEditar, "Stock Ganadero");
  useHeaderBackStep(!!bulkOpen, volverBulk, "Stock Ganadero");
  useHeaderBackStep(!!historialCambios, volverHistorial, "Stock Ganadero");
  useHeaderBackStep(!!detalleClave, volverDetalle, "Stock Ganadero");

  const filtros = useMemo(
    () => ({
      busqueda: busqueda.trim() || undefined,
      fecha_desde: fechaDesde || undefined,
      fecha_hasta: fechaHasta || undefined,
    }),
    [busqueda, fechaDesde, fechaHasta]
  );

  const load = useCallback(async () => {
    if (!apiOnline) {
      if (!readStockGanaderaPageCache()) {
        setRows([]);
        setStatsRows([]);
        setVentasClaves(new Set());
      }
      setLoading(false);
      return;
    }
    setLoading(true);
    const filtrosKey = filtrosCacheKey(filtros);
    try {
      const salidasRes = await fetchStockGanaderaSalidas();
      const [dispositivos, todos, ventas] = await Promise.all([
        fetchStockGanaderaDispositivos(filtros),
        fetchStockGanaderaDispositivos({}),
        fetchStockGanaderaVentasDispositivos(),
      ]);
      const ventasSet = new Set(ventas.claves);
      setRows(dispositivos);
      setStatsRows(todos);
      setVentasClaves(ventasSet);
      writeStockGanaderaPageCache({
        rows: dispositivos,
        statsRows: todos,
        ventasClaves: ventas.claves,
        filtrosKey,
      });
      if (salidasRes.bajasReparadas > 0) {
        onSuccess?.(
          `Se sincronizaron ${salidasRes.bajasReparadas} baja(s) pendiente(s) desde ventas cerradas.`
        );
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, [apiOnline, filtros, onError, onSuccess]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  useEffect(() => {
    setPage(1);
    setSeleccion(new Set());
  }, [busqueda, fechaDesde, fechaHasta, pageSize, filtroSexo, filtroEmpresa, filtroEstado, filtroEdad, filtroGrupoLibre, filtroCategoria, filtroSinFechaNac, filtroVentasCerradas, filtroSalidasSistema]);

  const resumenKpis = useMemo(
    () => calcularResumenStockGanaderaKpis(statsRows, ventasClaves),
    [statsRows, ventasClaves]
  );

  const usaStatsComoBase =
    filtroVentasCerradas || filtroSalidasSistema || filtroEstado.size > 0;

  const rowsBase = useMemo(() => {
    const base = usaStatsComoBase ? statsRows : rows;
    if (filtroSalidasSistema) {
      return base.filter((d) => esDispositivoFueraDeStock(d, ventasClaves));
    }
    if (filtroVentasCerradas) {
      return base.filter((d) => ventasClaves.has(d.clave));
    }
    if (filtroEstado.size > 0) {
      return base;
    }
    return usaStatsComoBase
      ? statsRows.filter((d) => dispositivoActivoEnStock(d, ventasClaves))
      : rows.filter((d) => dispositivoActivoEnStock(d, ventasClaves));
  }, [
    rows,
    statsRows,
    usaStatsComoBase,
    filtroSalidasSistema,
    filtroVentasCerradas,
    filtroEstado.size,
    ventasClaves,
  ]);

  const filteredRows = useMemo(() => {
    let result = aplicaFacetas(
      rowsBase,
      filtroSexo,
      filtroEmpresa,
      filtroEstado,
      filtroEdad,
      filtroGrupoLibre,
      filtroCategoria,
      filtroSinFechaNac
    );
    if (filtroVentasCerradas) {
      result = result.filter((d) => ventasClaves.has(d.clave));
    }
    if (filtroSalidasSistema) {
      result = result.filter((d) => esDispositivoFueraDeStock(d, ventasClaves));
    }
    return result;
  }, [rowsBase, filtroSexo, filtroEmpresa, filtroEstado, filtroEdad, filtroGrupoLibre, filtroCategoria, filtroSinFechaNac, filtroVentasCerradas, filtroSalidasSistema, ventasClaves]);

  const sinDatosPrevios = statsRows.length === 0 && rows.length === 0;
  const mostrarCargaVacia = loading && sinDatosPrevios;

  const activosCount = resumenKpis.activos.length;
  const salidasCount = resumenKpis.salidas.length;
  const totalDispositivosCount = statsRows.length;
  // "Ventas" cuenta todos los animales con estado VENDIDO (marcados a mano o desde el simulador).
  const ventasCount = resumenKpis.vendidos.length;
  const ventasSimuladorCount = resumenKpis.ventasSimulador.length;
  const muertesCount = resumenKpis.muertos.length;
  const extraviadosCount = resumenKpis.perdidos.length;

  const sexoTotal = useMemo(() => contarSexoDispositivos(statsRows), [statsRows]);
  const sexoSalidas = useMemo(
    () => contarSexoDispositivos(resumenKpis.salidas),
    [resumenKpis.salidas]
  );
  const sexoActivos = useMemo(
    () => contarSexoDispositivos(resumenKpis.activos),
    [resumenKpis.activos]
  );
  const sexoVentas = useMemo(
    () => contarSexoDispositivos(resumenKpis.vendidos),
    [resumenKpis.vendidos]
  );
  const sexoMuertes = useMemo(
    () => contarSexoDispositivos(resumenKpis.muertos),
    [resumenKpis.muertos]
  );
  const sexoExtraviados = useMemo(
    () => contarSexoDispositivos(resumenKpis.perdidos),
    [resumenKpis.perdidos]
  );

  const salidasHint = useMemo(() => fmtSalidasSistemaHint(resumenKpis), [resumenKpis]);

  const facetCounts = useMemo(() => {
    const sexo: Record<string, number> = { MACHO: 0, HEMBRA: 0, "": 0 };
    const empresa: Record<string, number> = { GUAVIYU: 0, CHIVILCOY: 0, "": 0 };
    const estado: Record<string, number> = {};
    const edad: Record<string, number> = {};
    const grupoLibre: Record<string, number> = {};
    const categoria: Record<string, number> = {};
    let sinFechaNac = 0;
    for (const o of EDAD_FILTRO_OPCIONES) edad[o.key] = 0;
    for (const o of [
      ...CATEGORIA_FILTRO_HEMBRA,
      ...CATEGORIA_FILTRO_MACHO,
      ...CATEGORIA_FILTRO_OTROS,
    ]) {
      categoria[o.key] = 0;
    }
    for (const d of rows) {
      sexo[d.sexo || ""] = (sexo[d.sexo || ""] ?? 0) + 1;
      empresa[d.empresa || ""] = (empresa[d.empresa || ""] ?? 0) + 1;
      estado[d.estado] = (estado[d.estado] ?? 0) + 1;
      const edadKey = edadFiltroKey(d);
      if (edadKey !== null) edad[edadKey] = (edad[edadKey] ?? 0) + 1;
      if (dispositivoSinFechaNacimiento(d)) sinFechaNac += 1;
      const grupoKey = grupoLibreFiltroKey(d.grupo_libre ?? "");
      grupoLibre[grupoKey] = (grupoLibre[grupoKey] ?? 0) + 1;
      for (const cat of categoriasDispositivo(d)) {
        categoria[cat] = (categoria[cat] ?? 0) + 1;
      }
    }
    return { sexo, empresa, estado, edad, grupoLibre, categoria, sinFechaNac };
  }, [rows]);

  const grupoLibreOpciones = useMemo(() => {
    const keys = Object.keys(facetCounts.grupoLibre).filter(
      (k) => (facetCounts.grupoLibre[k] ?? 0) > 0
    );
    keys.sort((a, b) => {
      if (a === "") return -1;
      if (b === "") return 1;
      return a.localeCompare(b, "es");
    });
    return keys;
  }, [facetCounts.grupoLibre]);

  const hayFacetasActivas =
    filtroSexo.size > 0 ||
    filtroEmpresa.size > 0 ||
    filtroEstado.size > 0 ||
    filtroEdad.size > 0 ||
    filtroGrupoLibre.size > 0 ||
    filtroCategoria.size > 0 ||
    filtroSinFechaNac.size > 0 ||
    filtroVentasCerradas ||
    filtroSalidasSistema;

  const limpiarFacetas = () => {
    setFiltroSexo(new Set());
    setFiltroEmpresa(new Set());
    setFiltroEstado(new Set());
    setFiltroEdad(new Set());
    setFiltroGrupoLibre(new Set());
    setFiltroCategoria(new Set());
    setFiltroSinFechaNac(new Set());
    setFiltroVentasCerradas(false);
    setFiltroSalidasSistema(false);
  };

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const rowsPagina = useMemo(
    () => paginateSlice(filteredRows, pageSafe, pageSize),
    [filteredRows, pageSafe, pageSize]
  );

  const seleccionados = useMemo(
    () => filteredRows.filter((r) => seleccion.has(r.clave)),
    [filteredRows, seleccion]
  );

  const clavesPagina = useMemo(
    () => rowsPagina.map((r) => r.clave),
    [rowsPagina]
  );

  const paginaTodaSeleccionada =
    clavesPagina.length > 0 && clavesPagina.every((c) => seleccion.has(c));
  const paginaParcial =
    !paginaTodaSeleccionada && clavesPagina.some((c) => seleccion.has(c));

  const toggleClave = (clave: string) => {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(clave)) next.delete(clave);
      else next.add(clave);
      return next;
    });
  };

  const togglePagina = () => {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (paginaTodaSeleccionada) {
        for (const c of clavesPagina) next.delete(c);
      } else {
        for (const c of clavesPagina) next.add(c);
      }
      return next;
    });
  };

  const seleccionarTodosFiltrados = () => {
    setSeleccion(new Set(filteredRows.map((r) => r.clave)));
  };

  const limpiarSeleccion = () => setSeleccion(new Set());

  const resetearStockEnCliente = useCallback(() => {
    clearStockGanaderaPageCache();
    setRows([]);
    setStatsRows([]);
    setVentasClaves(new Set());
    limpiarSeleccion();
  }, []);

  const eliminarSeleccionados = async () => {
    if (!esAdmin || seleccionados.length === 0) return;
    const muestra = seleccionados
      .slice(0, 6)
      .map((d) => `${d.eid} / ${d.vid}`)
      .join(", ");
    const extra =
      seleccionados.length > 6 ? ` y ${seleccionados.length - 6} más` : "";
    const ok = await confirmAction({
      title: "Eliminar dispositivos del sistema",
      message: `¿Eliminar ${seleccionados.length} dispositivo(s) y todas sus lecturas? Esta acción no se puede deshacer.${muestra ? `\n\n${muestra}${extra}` : ""}`,
      confirmText: "Eliminar",
      variant: "danger",
    });
    if (!ok) return;
    try {
      const result = await deleteStockGanaderaDispositivos(
        seleccionados.map((d) => d.clave)
      );
      const quedan = statsRows.filter(
        (d) => !seleccionados.some((s) => s.clave === d.clave)
      );
      if (quedan.length === 0) {
        resetearStockEnCliente();
      } else {
        limpiarSeleccion();
        setStatsRows(quedan);
        setRows((prev) =>
          prev.filter((d) => !seleccionados.some((s) => s.clave === d.clave))
        );
        setVentasClaves((prev) => {
          const next = new Set(prev);
          for (const d of seleccionados) next.delete(d.clave);
          return next;
        });
      }
      await load();
      const omitidos =
        result.no_encontrados.length > 0
          ? ` (${result.no_encontrados.length} no encontrado(s))`
          : "";
      onSuccess?.(
        `Se eliminaron ${result.eliminados} dispositivo(s) del sistema${omitidos}`
      );
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al eliminar dispositivos");
    }
  };

  const vaciarTodoElStock = async () => {
    if (!esAdmin || statsRows.length === 0) return;
    const ok = await confirmAction({
      title: "Vaciar todo el stock",
      message: `¿Eliminar TODOS los ${statsRows.length} dispositivo(s) del sistema (incluidas salidas: ventas, muertes y extraviados) junto con sus lecturas e historial? También se desvincularán de las ventas del simulador. Esta acción no se puede deshacer.`,
      confirmText: "Eliminar todo",
      variant: "danger",
    });
    if (!ok) return;
    try {
      const result = await vaciarStockGanaderaCompleto();
      resetearStockEnCliente();
      await load();
      onSuccess?.(
        `Stock vaciado: ${result.dispositivos_eliminados} dispositivo(s) y ${result.lecturas_eliminadas} lectura(s) eliminados`
      );
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al vaciar el stock");
    }
  };

  const actualizarFila = (actualizado: StockGanaderaDispositivo) => {
    setRows((prev) => {
      const next = prev.map((r) => (r.clave === actualizado.clave ? actualizado : r));
      return next;
    });
    setStatsRows((prev) => {
      const next = prev.map((r) => (r.clave === actualizado.clave ? actualizado : r));
      const cached = readStockGanaderaPageCache();
      if (cached) {
        writeStockGanaderaPageCache({
          ...cached,
          rows: cached.filtrosKey === filtrosCacheKey(filtros)
            ? cached.rows.map((r) => (r.clave === actualizado.clave ? actualizado : r))
            : cached.rows,
          statsRows: next,
        });
      }
      return next;
    });
  };

  if (editarDispositivo) {
    return (
      <StockGanaderaEditarPanel
        dispositivo={editarDispositivo}
        apiOnline={apiOnline}
        onVolver={() => setEditarDispositivo(null)}
        onSaved={(actualizado) => {
          actualizarFila(actualizado);
          setEditarDispositivo(null);
        }}
        onVerHistorial={() => {
          setDetalleClave(editarDispositivo.clave);
          setEditarDispositivo(null);
        }}
        onError={onError}
      />
    );
  }

  if (bulkOpen) {
    return (
      <StockGanaderaBulkPanel
        onVolver={() => setBulkOpen(false)}
        seleccionados={seleccionados}
        totalFiltrados={filteredRows.length}
        apiOnline={apiOnline}
        onSeleccionarTodosFiltrados={seleccionarTodosFiltrados}
        onLimpiar={limpiarSeleccion}
        onAplicado={() => {
          limpiarSeleccion();
          setBulkOpen(false);
          void load();
        }}
        onError={onError}
        onSuccess={(msg) => onSuccess?.(msg)}
      />
    );
  }

  if (historialCambios) {
    return (
      <StockGanaderaHistorialCambiosPanel
        clave={historialCambios.clave}
        vid={historialCambios.vid}
        eid={historialCambios.eid}
        apiOnline={apiOnline}
        onVolver={() => setHistorialCambios(null)}
        volverLabel="Volver a Stock Ganadero"
        onError={onError}
      />
    );
  }

  if (detalleClave) {
    return (
      <StockGanaderaDetalle
        clave={detalleClave}
        apiOnline={apiOnline}
        onError={onError}
        onVolver={() => setDetalleClave(null)}
      />
    );
  }

  return (
    <div className="subseccion-panel">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver a Stock Ganadero
      </button>

      <div className="card">
        <div className="form-header">
          <h2>Stock Ganadero</h2>
          <p className="muted">
            {mostrarCargaVacia
              ? "Cargando…"
              : loading
                ? `${filteredRows.length} dispositivo(s) según los filtros aplicados · actualizando…`
                : filteredRows.length === 0
                  ? rows.length === 0
                    ? "No hay dispositivos (EID) registrados. Importá lecturas para armar el stock."
                    : "Ningún dispositivo coincide con los filtros."
                  : `${filteredRows.length} dispositivo(s) según los filtros aplicados`}
          </p>
        </div>

        {apiOnline && (
          <section className="stock-dash stock-dash--pro" aria-label="Resumen de dispositivos">
            <div className="stock-dash-head sg-kpi-board-head">
              <div>
                <h3 className="stock-dash-title sg-kpi-board-title">Resumen</h3>
                <p className="stock-dash-sub sg-kpi-board-desc">
                  Caravanas electrónicas únicas en la base
                </p>
              </div>
            </div>
            <div className="sg-kpi-grid">
              <StockGanaderaDashKpi
                label="Total dispositivos"
                value={totalDispositivosCount}
                hint={`${activosCount} activos · ${salidasCount} salidas del sistema`}
                variant="total"
                sexoStats={sexoTotal}
                loading={mostrarCargaVacia}
              />
              <StockGanaderaDashKpi
                label="Dispositivos activos"
                value={activosCount}
                hint="En stock hoy (sin bajas)"
                variant="activos"
                sexoStats={sexoActivos}
                loading={mostrarCargaVacia}
              />
              <StockGanaderaDashKpi
                label="Salidas del sistema"
                value={salidasCount}
                hint={salidasHint}
                variant="salida"
                sexoStats={sexoSalidas}
                loading={mostrarCargaVacia}
                active={filtroSalidasSistema}
                disabled={salidasCount === 0}
                onClick={() => {
                  setFiltroVentasCerradas(false);
                  setFiltroEstado(new Set());
                  setFiltroSalidasSistema((v) => !v);
                }}
              />
              <StockGanaderaDashKpi
                label="Ventas"
                value={ventasCount}
                hint={
                  ventasSimuladorCount > 0
                    ? `${ventasSimuladorCount} desde el simulador de ventas`
                    : "Animales registrados como vendidos"
                }
                variant="vendido"
                sexoStats={sexoVentas}
                loading={mostrarCargaVacia}
                active={filtroEstado.size === 1 && filtroEstado.has("VENDIDO")}
                disabled={ventasCount === 0}
                onClick={() => {
                  setFiltroSalidasSistema(false);
                  setFiltroVentasCerradas(false);
                  setFiltroEstado((prev) => {
                    const soloVendido = prev.size === 1 && prev.has("VENDIDO");
                    return soloVendido
                      ? new Set()
                      : new Set<DispositivoEstado>(["VENDIDO"]);
                  });
                }}
              />
              <StockGanaderaDashKpi
                label="Muertes"
                value={muertesCount}
                hint="Registradas en salidas del sistema"
                variant="muerto"
                sexoStats={sexoMuertes}
                loading={mostrarCargaVacia}
                active={filtroEstado.size === 1 && filtroEstado.has("MUERTO")}
                disabled={muertesCount === 0}
                onClick={() => {
                  setFiltroVentasCerradas(false);
                  setFiltroSalidasSistema(false);
                  setFiltroEstado((prev) => {
                    const soloMuerto = prev.size === 1 && prev.has("MUERTO");
                    return soloMuerto ? new Set() : new Set<DispositivoEstado>(["MUERTO"]);
                  });
                }}
              />
              <StockGanaderaDashKpi
                label="Extraviados"
                value={extraviadosCount}
                hint="Registrados como extraviados en salidas"
                variant="extraviado"
                sexoStats={sexoExtraviados}
                loading={mostrarCargaVacia}
                active={filtroEstado.size === 1 && filtroEstado.has("PERDIDO")}
                disabled={extraviadosCount === 0}
                onClick={() => {
                  setFiltroVentasCerradas(false);
                  setFiltroSalidasSistema(false);
                  setFiltroEstado((prev) => {
                    const soloPerdido = prev.size === 1 && prev.has("PERDIDO");
                    return soloPerdido ? new Set() : new Set<DispositivoEstado>(["PERDIDO"]);
                  });
                }}
              />
            </div>
          </section>
        )}

        <div className="stock-ganadera-layout">
          {apiOnline && (
            <StockGanaderaFiltrosSidebar
              fechaDesde={fechaDesde}
              fechaHasta={fechaHasta}
              onFechaDesde={setFechaDesde}
              onFechaHasta={setFechaHasta}
              filtroSexo={filtroSexo}
              filtroEmpresa={filtroEmpresa}
              filtroEstado={filtroEstado}
              filtroEdad={filtroEdad}
              filtroGrupoLibre={filtroGrupoLibre}
              filtroCategoria={filtroCategoria}
              filtroSinFechaNac={filtroSinFechaNac}
              grupoLibreOpciones={grupoLibreOpciones}
              onToggleSexo={(k) => setFiltroSexo((p) => toggleSet(p, k))}
              onToggleEmpresa={(k) => setFiltroEmpresa((p) => toggleSet(p, k))}
              onToggleEstado={(e) => setFiltroEstado((p) => toggleSet(p, e))}
              onToggleEdad={(k) => setFiltroEdad((p) => toggleSet(p, k))}
              onToggleGrupoLibre={(k) => setFiltroGrupoLibre((p) => toggleSet(p, k))}
              onToggleCategoria={(k) => setFiltroCategoria((p) => toggleSet(p, k))}
              onToggleSinFechaNac={() =>
                setFiltroSinFechaNac((p) => toggleSet(p, SIN_FECHA_NAC_FILTRO_KEY))
              }
              onLimpiarSexo={() => setFiltroSexo(new Set())}
              onLimpiarEmpresa={() => setFiltroEmpresa(new Set())}
              onLimpiarEstado={() => setFiltroEstado(new Set())}
              onLimpiarEdad={() => setFiltroEdad(new Set())}
              onLimpiarGrupoLibre={() => setFiltroGrupoLibre(new Set())}
              onLimpiarCategoria={() => setFiltroCategoria(new Set())}
              onLimpiarSinFechaNac={() => setFiltroSinFechaNac(new Set())}
              counts={facetCounts}
              onLimpiarFacetas={limpiarFacetas}
              hayFacetasActivas={hayFacetasActivas}
              mobileOpen={filtrosMobileOpen}
              onMobileClose={() => setFiltrosMobileOpen(false)}
            />
          )}

          <div className="stock-ganadera-main">
            <div className="stock-ganadera-search-bar mayusculas-auto">
              <button
                type="button"
                className="stock-ganadera-filtros-mobile-btn"
                onClick={() => setFiltrosMobileOpen(true)}
                aria-label="Abrir filtros"
              >
                Filtros
                {hayFacetasActivas ? (
                  <span className="stock-ganadera-filtros-badge" aria-hidden />
                ) : null}
              </button>
              <div className="stock-ganadera-search-field">
                <label htmlFor="ganadera-busq" className="sr-only">
                  Buscar EID / VID
                </label>
                <input
                  id="ganadera-busq"
                  type="search"
                  placeholder="Buscar por EID o caravana visual…"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && load()}
                />
              </div>
              <button type="button" className="btn btn-primary" onClick={load}>
                Buscar
              </button>
              {esAdmin && statsRows.length > 0 && (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => void vaciarTodoElStock()}
                  title="Eliminar todos los dispositivos del sistema, incluidas las salidas"
                >
                  Vaciar todo el stock
                </button>
              )}
            </div>

            {(hayFacetasActivas || busqueda.trim() || fechaDesde || fechaHasta) && (
              <div className="stock-ganadera-chips" aria-label="Filtros activos">
                {busqueda.trim() ? (
                  <span className="stock-ganadera-chip">
                    Búsqueda: {busqueda.trim()}
                    <button
                      type="button"
                      aria-label="Quitar búsqueda"
                      onClick={() => setBusqueda("")}
                    >
                      ×
                    </button>
                  </span>
                ) : null}
                {fechaDesde ? (
                  <span className="stock-ganadera-chip">
                    Desde {fechaDesde}
                    <button
                      type="button"
                      aria-label="Quitar fecha desde"
                      onClick={() => setFechaDesde("")}
                    >
                      ×
                    </button>
                  </span>
                ) : null}
                {fechaHasta ? (
                  <span className="stock-ganadera-chip">
                    Hasta {fechaHasta}
                    <button
                      type="button"
                      aria-label="Quitar fecha hasta"
                      onClick={() => setFechaHasta("")}
                    >
                      ×
                    </button>
                  </span>
                ) : null}
                {[...filtroSexo].map((k) => (
                  <span key={`sexo-${k}`} className="stock-ganadera-chip">
                    Sexo: {k === "MACHO" ? "Macho" : k === "HEMBRA" ? "Hembra" : "Sin definir"}
                    <button
                      type="button"
                      aria-label="Quitar filtro de sexo"
                      onClick={() => setFiltroSexo((p) => toggleSet(p, k))}
                    >
                      ×
                    </button>
                  </span>
                ))}
                {[...filtroEmpresa].map((k) => (
                  <span key={`emp-${k}`} className="stock-ganadera-chip">
                    Empresa: {k || "Sin definir"}
                    <button
                      type="button"
                      aria-label="Quitar filtro de empresa"
                      onClick={() => setFiltroEmpresa((p) => toggleSet(p, k))}
                    >
                      ×
                    </button>
                  </span>
                ))}
                {[...filtroEstado].map((e) => (
                  <span key={`est-${e}`} className="stock-ganadera-chip">
                    Estado: {fmtEstadoDispositivo(e)}
                    <button
                      type="button"
                      aria-label="Quitar filtro de estado"
                      onClick={() => setFiltroEstado((p) => toggleSet(p, e))}
                    >
                      ×
                    </button>
                  </span>
                ))}
                {[...filtroEdad].map((k) => (
                  <span key={`edad-${k}`} className="stock-ganadera-chip">
                    Edad: {labelEdadFiltro(k as EdadFiltroKey)}
                    <button
                      type="button"
                      aria-label="Quitar filtro de edad"
                      onClick={() => setFiltroEdad((p) => toggleSet(p, k))}
                    >
                      ×
                    </button>
                  </span>
                ))}
                {[...filtroGrupoLibre].map((k) => (
                  <span key={`grupo-${k || "sin"}`} className="stock-ganadera-chip">
                    Grupo: {labelGrupoLibreFiltro(k)}
                    <button
                      type="button"
                      aria-label="Quitar filtro de grupo"
                      onClick={() => setFiltroGrupoLibre((p) => toggleSet(p, k))}
                    >
                      ×
                    </button>
                  </span>
                ))}
                {[...filtroCategoria].map((k) => (
                  <span key={`cat-${k}`} className="stock-ganadera-chip">
                    Categoría: {labelCategoriaFiltro(k as CategoriaFiltroKey)}
                    <button
                      type="button"
                      aria-label="Quitar filtro de categoría"
                      onClick={() => setFiltroCategoria((p) => toggleSet(p, k))}
                    >
                      ×
                    </button>
                  </span>
                ))}
                {filtroSinFechaNac.has(SIN_FECHA_NAC_FILTRO_KEY) ? (
                  <span key="sin-fecha-nac" className="stock-ganadera-chip">
                    Sin fecha nacimiento
                    <button
                      type="button"
                      aria-label="Quitar filtro sin fecha nacimiento"
                      onClick={() => setFiltroSinFechaNac(new Set())}
                    >
                      ×
                    </button>
                  </span>
                ) : null}
                <button
                  type="button"
                  className="stock-ganadera-chips-clear"
                  onClick={() => {
                    setBusqueda("");
                    setFechaDesde("");
                    setFechaHasta("");
                    limpiarFacetas();
                    void load();
                  }}
                >
                  Limpiar todo
                </button>
              </div>
            )}

            {seleccionados.length > 0 && (
              <div className="stock-ganadera-selection-bar">
                <span className="stock-ganadera-selection-count">
                  <strong>{seleccionados.length}</strong> seleccionado
                  {seleccionados.length === 1 ? "" : "s"}
                </span>
                <div className="stock-ganadera-selection-actions">
                  {seleccionados.length < filteredRows.length && (
                    <button
                      type="button"
                      className="stock-bulk-link"
                      onClick={seleccionarTodosFiltrados}
                    >
                      Seleccionar los {filteredRows.length} visibles
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => setBulkOpen(true)}
                  >
                    Editar seleccionados
                  </button>
                  {esAdmin && (
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => void eliminarSeleccionados()}
                    >
                      Eliminar del sistema
                    </button>
                  )}
                  <button
                    type="button"
                    className="stock-bulk-link"
                    onClick={limpiarSeleccion}
                  >
                    Quitar selección
                  </button>
                </div>
              </div>
            )}

            <div className="table-wrap table-wrap-stock-pro">
          <table className="data-table stock-ganadera-table stock-table-pro">
            <thead>
              <tr>
                <th className="stock-th stock-th--sel" aria-label="Seleccionar">
                  <input
                    type="checkbox"
                    className="stock-row-check"
                    checked={paginaTodaSeleccionada}
                    ref={(el) => {
                      if (el) el.indeterminate = paginaParcial;
                    }}
                    onChange={togglePagina}
                    disabled={mostrarCargaVacia || rowsPagina.length === 0}
                    title="Seleccionar página"
                  />
                </th>
                <th className="stock-th stock-th--num">EID</th>
                <th className="stock-th">VID</th>
                <th className="stock-th">Empresa</th>
                <th className="stock-th">Generación</th>
                <th className="stock-th">Grupo</th>
                <th className="stock-th">Sexo</th>
                <th className="stock-th stock-th--edad">Edad</th>
                <th className="stock-th stock-th--time">Última lectura</th>
                <th className="stock-th">Condición</th>
                <th className="stock-th stock-th--num">Lecturas</th>
                <th className="stock-th stock-th--estado">Estado</th>
              </tr>
            </thead>
            <tbody>
              {mostrarCargaVacia ? (
                <tr>
                  <td colSpan={12} className="empty">
                    Cargando…
                  </td>
                </tr>
              ) : !apiOnline ? (
                <tr>
                  <td colSpan={12} className="empty">
                    API no conectada
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="empty">
                    Sin dispositivos para los filtros aplicados.
                  </td>
                </tr>
              ) : (
                rowsPagina.map((d) => (
                  <tr
                    key={d.clave}
                    className={`stock-ganadera-row stock-table-pro-row${
                      seleccion.has(d.clave) ? " stock-table-pro-row--selected" : ""
                    }`}
                  >
                    <td className="stock-td stock-td--sel">
                      <input
                        type="checkbox"
                        className="stock-row-check"
                        checked={seleccion.has(d.clave)}
                        onChange={() => toggleClave(d.clave)}
                        aria-label={`Seleccionar ${d.vid || d.eid}`}
                      />
                    </td>
                    <td className="stock-td stock-td--num stock-td--eid">
                      {d.eid || "—"}
                    </td>
                    <td className="stock-td stock-td--vid">
                      <span className="stock-ganadera-row-eid">
                        <IconoDispositivoWifi className="stock-ganadera-row-icon" />
                        <button
                          type="button"
                          className="stock-ganadera-link stock-table-pro-link"
                          onClick={() => setEditarDispositivo(d)}
                          title="Editar caravana"
                        >
                          {d.vid || "—"}
                        </button>
                      </span>
                    </td>
                    <td className="stock-td stock-td--muted">
                      {fmtEmpresa(d.empresa)}
                    </td>
                    <td className="stock-td stock-td--muted">{fmtGrupo(d.grupo)}</td>
                    <td className="stock-td stock-td--muted">{fmtGrupoLibre(d.grupo_libre)}</td>
                    <td className={`stock-td stock-td--sexo ${claseCeldaSexo(d.sexo)}`}>
                      {fmtSexo(d.sexo)}
                    </td>
                    <td className="stock-td stock-td--edad">
                      <StockGanaderaEdadMiniTimeline
                        sexo={d.sexo}
                        nacimientoMes={d.nacimiento_mes}
                        nacimientoAnio={d.nacimiento_anio}
                        estado={d.estado}
                        bajaMes={d.baja_mes}
                        bajaAnio={d.baja_anio}
                      />
                    </td>
                    <td className="stock-td stock-td--time">
                      <span className="stock-td-time-date">{fmtDate(d.ultima_fecha)}</span>
                      {d.ultima_hora ? (
                        <span className="stock-td-time-hour">{d.ultima_hora}</span>
                      ) : null}
                    </td>
                    <td className="stock-td stock-td--muted">
                      {d.ultima_condicion || "—"}
                    </td>
                    <td className="stock-td stock-td--num stock-td--lecturas">
                      {d.total_lecturas}
                    </td>
                    <td className="stock-td stock-td--estado">
                      <BadgeEstadoDispositivo estado={d.estado} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
            </div>

            {(!mostrarCargaVacia) && apiOnline && filteredRows.length > 0 && (
              <TablePagination
                total={filteredRows.length}
                page={pageSafe}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
