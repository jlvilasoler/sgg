import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import {
  deleteStockEquinaDispositivos,
  fetchEmpresasOperativasStock,
  fetchStockEquinaDispositivos,
  fetchStockEquinaSalidas,
  fetchStockEquinaVentasDispositivos,
} from "../../api";
import { useHeaderBackStep } from "../../header-back";
import type { AuthUser, DispositivoEstado, StockEquinaDispositivo } from "../../types";
import { fmtDate } from "../../utils";
import { confirmAction } from "../../utils/confirm";
import TablePagination, {
  paginateSlice,
  type PageSize,
} from "../TablePagination";
import BadgeEstadoDispositivo from "../stock/BadgeEstadoDispositivo";
import IconoDispositivoWifi from "../stock/IconoDispositivoWifi";
import IconoSeleccionCabanaEstrella from "../stock/IconoSeleccionCabanaEstrella";
import { StockEquinoModuleIcon } from "../stock/StockControlSanitarioSectionTitle";
import StockEquinoHubNav from "./StockEquinoHubNav";
import type { StockEquinoHubItem } from "./StockEquinoHub";
import {
  StockEquinoHubAsideSearchField,
  useStockEquinoAsideSearch,
} from "./StockEquinoHubAsideSearch";
import StockEquinaDashKpi from "./StockEquinaDashKpi";
import StockEquinaBulkPanel from "./StockEquinaBulkPanel";
import StockEquinaDetalle from "./StockEquinaDetalle";
import StockEquinaEdadMiniTimeline from "./StockEquinaEdadMiniTimeline";
import StockEquinaEditarPanel from "./StockEquinaEditarModal";
import StockEquinaHistorialCambiosPanel from "./StockEquinaHistorialCambiosPanel";
import StockEquinaFiltrosSidebar from "./StockEquinaFiltrosSidebar";
import type { CategoriaFiltroKey, EdadFiltroKey } from "./stock-equina-utils";
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
  calcularResumenStockEquinaKpis,
  fmtSalidasSistemaHint,
  contarSexoDispositivos,
  edadFiltroKey,
  fmtEstadoDispositivo,
  fmtGrupo,
  fmtGrupoLibre,
  generacionFiltroKey,
  grupoLibreFiltroKey,
  labelCategoriaFiltro,
  labelEdadFiltro,
  labelGrupoLibreFiltro,
  labelRazaFiltro,
  labelUltimaLecturaMesFiltro,
  fmtRegEquino,
  splitEidVid,
  razaFiltroKey,
  ultimaLecturaMesFiltroKey,
  SIN_FECHA_NAC_FILTRO_KEY,
} from "./stock-equina-utils";
import { fmtEmpresaOperativa } from "../stock/stock-empresa-utils";
import { fmtPotrero } from "../stock/stock-ganadera-utils";
import {
  clearStockEquinaPageCache,
  filtrosCacheKey,
  readStockEquinaPageCache,
  rowsDesdeCache,
  stockEquinaCacheScope,
  ventasClavesDesdeCache,
  writeStockEquinaPageCache,
} from "./stock-equina-page-cache";

function toggleSet<T>(prev: Set<T>, value: T): Set<T> {
  const next = new Set(prev);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function aplicaFacetas(
  rows: StockEquinaDispositivo[],
  filtroSexo: Set<string>,
  filtroEmpresa: Set<string>,
  filtroEstado: Set<DispositivoEstado>,
  filtroEdad: Set<string>,
  filtroGrupoLibre: Set<string>,
  filtroRaza: Set<string>,
  filtroGeneracion: Set<string>,
  filtroUltimaLecturaMes: Set<string>,
  filtroCategoria: Set<string>,
  filtroSinFechaNac: Set<string>
): StockEquinaDispositivo[] {
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
    if (filtroRaza.size > 0 && !filtroRaza.has(razaFiltroKey(d.raza))) return false;
    if (
      filtroGeneracion.size > 0 &&
      !filtroGeneracion.has(generacionFiltroKey(d.grupo))
    ) {
      return false;
    }
    if (
      filtroUltimaLecturaMes.size > 0 &&
      !filtroUltimaLecturaMes.has(ultimaLecturaMesFiltroKey(d.ultima_fecha))
    ) {
      return false;
    }
    if (!coincideCategoriaFiltro(d, filtroCategoria)) return false;
    if (!coincideSinFechaNacFiltro(d, filtroSinFechaNac)) return false;
    return true;
  });
}

function fmtSexo(sexo: StockEquinaDispositivo["sexo"]): string {
  return sexo || "—";
}

function claseCeldaSexo(sexo: StockEquinaDispositivo["sexo"]): string {
  if (sexo === "MACHO") return "stock-td--sexo-macho";
  if (sexo === "HEMBRA") return "stock-td--sexo-hembra";
  return "stock-td--sexo-na";
}

function fmtCategoriaEquino(categoria: string | null | undefined): string {
  const c = String(categoria ?? "").trim().toUpperCase();
  const map: Record<string, string> = {
    POTRANCA: "Potranca",
    POTRA: "Potra",
    YEGUA: "Yegua",
    POTRILLO: "Potrillo",
    POTRO: "Potro",
    CABALLO: "Caballo",
    PADRILLO: "Padrillo",
  };
  return map[c] ?? (c || "—");
}

function esEquinoCabana(d: StockEquinaDispositivo): boolean {
  return (
    String(d.origen_alta ?? "").trim().toLowerCase() === "cabana" ||
    Boolean(d.nombre_animal?.trim()) ||
    Boolean(d.cabana_premium)
  );
}

function nombreEquinoCabana(d: StockEquinaDispositivo): string {
  return (
    d.nombre_animal?.trim() ||
    d.nombre_cabana?.trim() ||
    (d.rp?.trim() ? `RP ${d.rp.trim()}` : "")
  );
}

interface Props {
  apiOnline: boolean;
  currentUser?: AuthUser | null;
  onError: (msg: string) => void;
  onSuccess?: (msg: string) => void;
  onVolver: () => void;
  refreshKey?: number;
  hubNav?: {
    items: StockEquinoHubItem[];
    activeId: string;
    onNavigate: (id: string) => void;
    onVolverDashboard: () => void;
    onVolverInicio?: () => void;
  };
}

export default function StockEquina({
  apiOnline,
  currentUser,
  onError,
  onSuccess,
  onVolver,
  refreshKey = 0,
  hubNav,
}: Props) {
  const hubNavItems = hubNav?.items ?? [];
  const {
    busquedaModulos,
    setBusquedaModulos,
    busquedaInputRef,
    consultaActiva,
    itemsFiltrados,
    mostrarDashboard,
  } = useStockEquinoAsideSearch(hubNavItems);

  const esAdmin = currentUser?.rol === "admin";
  const cacheScope = currentUser ? stockEquinaCacheScope(currentUser) : "";
  const filtrosInicialesKey = filtrosCacheKey({});
  const cacheInicial = cacheScope ? readStockEquinaPageCache(cacheScope) : null;

  const [rows, setRows] = useState<StockEquinaDispositivo[]>(() =>
    rowsDesdeCache(cacheInicial, filtrosInicialesKey)
  );
  const [busqueda, setBusqueda] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [editarDispositivo, setEditarDispositivo] =
    useState<StockEquinaDispositivo | null>(null);
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
  const [loading, setLoading] = useState(true);
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
  const [filtroRaza, setFiltroRaza] = useState<Set<string>>(() => new Set());
  const [filtroGeneracion, setFiltroGeneracion] = useState<Set<string>>(() => new Set());
  const [filtroUltimaLecturaMes, setFiltroUltimaLecturaMes] = useState<Set<string>>(
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
  const [statsRows, setStatsRows] = useState<StockEquinaDispositivo[]>(
    () => cacheInicial?.statsRows ?? []
  );
  const [filtroVentasCerradas, setFiltroVentasCerradas] = useState(false);
  const [filtroSalidasSistema, setFiltroSalidasSistema] = useState(false);
  const [empresasOperativas, setEmpresasOperativas] = useState<
    Awaited<ReturnType<typeof fetchEmpresasOperativasStock>>
  >([]);

  useEffect(() => {
    if (!apiOnline) {
      setEmpresasOperativas([]);
      return;
    }
    fetchEmpresasOperativasStock()
      .then(setEmpresasOperativas)
      .catch(() => setEmpresasOperativas([]));
  }, [apiOnline]);

  const empresaOpciones = useMemo(
    () => [
      ...empresasOperativas.map((e) => ({ key: e.codigo, label: e.nombre })),
      { key: "", label: "Sin definir" },
    ],
    [empresasOperativas]
  );

  useEffect(() => {
    if (filtroEmpresa.size === 0) return;
    const validas = new Set(empresaOpciones.map((o) => o.key));
    const next = new Set([...filtroEmpresa].filter((k) => validas.has(k)));
    if (next.size !== filtroEmpresa.size) setFiltroEmpresa(next);
  }, [empresaOpciones, filtroEmpresa]);

  useHeaderBackStep(!!editarDispositivo, volverEditar, "Stock Equino");
  useHeaderBackStep(!!bulkOpen, volverBulk, "Stock Equino");
  useHeaderBackStep(!!historialCambios, volverHistorial, "Stock Equino");
  useHeaderBackStep(!!detalleClave, volverDetalle, "Stock Equino");

  const filtros = useMemo(
    () => ({
      busqueda: busqueda.trim() || undefined,
      fecha_desde: fechaDesde || undefined,
      fecha_hasta: fechaHasta || undefined,
    }),
    [busqueda, fechaDesde, fechaHasta]
  );

  useEffect(() => {
    if (!cacheScope) {
      setRows([]);
      setStatsRows([]);
      setVentasClaves(new Set());
      return;
    }
    const cache = readStockEquinaPageCache(cacheScope);
    if (!cache) {
      setRows([]);
      setStatsRows([]);
      setVentasClaves(new Set());
      return;
    }
    setRows(rowsDesdeCache(cache, filtrosInicialesKey));
    setStatsRows(cache.statsRows);
    setVentasClaves(ventasClavesDesdeCache(cache));
  }, [cacheScope, filtrosInicialesKey]);

  const load = useCallback(async () => {
    if (!apiOnline) {
      if (!cacheScope || !readStockEquinaPageCache(cacheScope)) {
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
      const salidasRes = await fetchStockEquinaSalidas();
      const [dispositivos, todos, ventas] = await Promise.all([
        fetchStockEquinaDispositivos(filtros),
        fetchStockEquinaDispositivos({}),
        fetchStockEquinaVentasDispositivos(),
      ]);
      const ventasSet = new Set(ventas.claves);
      setRows(dispositivos);
      setStatsRows(todos);
      setVentasClaves(ventasSet);
      writeStockEquinaPageCache(
        {
          rows: dispositivos,
          statsRows: todos,
          ventasClaves: ventas.claves,
          filtrosKey,
        },
        cacheScope
      );
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
  }, [apiOnline, cacheScope, filtros, onError, onSuccess]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  useEffect(() => {
    setPage(1);
    setSeleccion(new Set());
  }, [busqueda, fechaDesde, fechaHasta, pageSize, filtroSexo, filtroEmpresa, filtroEstado, filtroEdad, filtroGrupoLibre, filtroRaza, filtroGeneracion, filtroUltimaLecturaMes, filtroCategoria, filtroSinFechaNac, filtroVentasCerradas, filtroSalidasSistema]);

  const resumenKpis = useMemo(
    () => calcularResumenStockEquinaKpis(statsRows, ventasClaves),
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
      filtroRaza,
      filtroGeneracion,
      filtroUltimaLecturaMes,
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
  }, [rowsBase, filtroSexo, filtroEmpresa, filtroEstado, filtroEdad, filtroGrupoLibre, filtroRaza, filtroGeneracion, filtroUltimaLecturaMes, filtroCategoria, filtroSinFechaNac, filtroVentasCerradas, filtroSalidasSistema, ventasClaves]);

  const sinDatosPrevios = statsRows.length === 0 && rows.length === 0;
  const kpisCargando = loading;
  const mostrarCargaVacia = loading && sinDatosPrevios;

  const activosCount = resumenKpis.activos.length;
  const salidasCount = resumenKpis.salidas.length;
  const totalDispositivosCount = statsRows.length;
  // "Ventas" cuenta todos los animales con estado VENDIDO (marcados a mano o desde el simulador).
  const ventasCount = resumenKpis.vendidos.length;
  const ventasSimuladorCount = resumenKpis.ventasSimulador.length;
  const muertesCount = resumenKpis.muertos.length;
  const extraviadosCount = resumenKpis.perdidos.length;

  const sexoSalidas = useMemo(
    () => contarSexoDispositivos(resumenKpis.salidas),
    [resumenKpis.salidas]
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
    const empresa: Record<string, number> = { "": 0 };
    for (const e of empresasOperativas) empresa[e.codigo] = 0;
    const estado: Record<string, number> = {};
    const edad: Record<string, number> = {};
    const grupoLibre: Record<string, number> = {};
    const raza: Record<string, number> = {};
    const generacion: Record<string, number> = {};
    const ultimaLecturaMes: Record<string, number> = {};
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
      const razaKey = razaFiltroKey(d.raza);
      raza[razaKey] = (raza[razaKey] ?? 0) + 1;
      const generacionKey = generacionFiltroKey(d.grupo);
      generacion[generacionKey] = (generacion[generacionKey] ?? 0) + 1;
      const lecturaMesKey = ultimaLecturaMesFiltroKey(d.ultima_fecha);
      ultimaLecturaMes[lecturaMesKey] = (ultimaLecturaMes[lecturaMesKey] ?? 0) + 1;
      for (const cat of categoriasDispositivo(d)) {
        categoria[cat] = (categoria[cat] ?? 0) + 1;
      }
    }
    return {
      sexo,
      empresa,
      estado,
      edad,
      grupoLibre,
      raza,
      generacion,
      ultimaLecturaMes,
      categoria,
      sinFechaNac,
    };
  }, [rows, empresasOperativas]);

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

  const razaOpciones = useMemo(() => {
    const keys = Object.keys(facetCounts.raza).filter(
      (k) => (facetCounts.raza[k] ?? 0) > 0
    );
    keys.sort((a, b) => {
      if (a === "") return -1;
      if (b === "") return 1;
      return a.localeCompare(b, "es");
    });
    return keys;
  }, [facetCounts.raza]);

  const generacionOpciones = useMemo(() => {
    const keys = Object.keys(facetCounts.generacion).filter(
      (k) => (facetCounts.generacion[k] ?? 0) > 0
    );
    keys.sort((a, b) => {
      if (a === "") return -1;
      if (b === "") return 1;
      return b.localeCompare(a, "es");
    });
    return keys;
  }, [facetCounts.generacion]);

  const ultimaLecturaMesOpciones = useMemo(() => {
    const keys = Object.keys(facetCounts.ultimaLecturaMes).filter(
      (k) => (facetCounts.ultimaLecturaMes[k] ?? 0) > 0
    );
    keys.sort((a, b) => {
      if (a === "") return 1;
      if (b === "") return -1;
      return b.localeCompare(a);
    });
    return keys;
  }, [facetCounts.ultimaLecturaMes]);

  const hayFacetasActivas =
    filtroSexo.size > 0 ||
    filtroEmpresa.size > 0 ||
    filtroEstado.size > 0 ||
    filtroEdad.size > 0 ||
    filtroGrupoLibre.size > 0 ||
    filtroRaza.size > 0 ||
    filtroGeneracion.size > 0 ||
    filtroUltimaLecturaMes.size > 0 ||
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
    setFiltroRaza(new Set());
    setFiltroGeneracion(new Set());
    setFiltroUltimaLecturaMes(new Set());
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
    clearStockEquinaPageCache();
    setRows([]);
    setStatsRows([]);
    setVentasClaves(new Set());
    limpiarSeleccion();
  }, []);

  const eliminarSeleccionados = async () => {
    if (!esAdmin || seleccionados.length === 0) return;
    const muestra = seleccionados
      .slice(0, 6)
      .map((d) => fmtRegEquino(d.eid, d.vid) || d.clave)
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
      const result = await deleteStockEquinaDispositivos(
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

  const actualizarFila = (actualizado: StockEquinaDispositivo) => {
    setRows((prev) => {
      const next = prev.map((r) => (r.clave === actualizado.clave ? actualizado : r));
      return next;
    });
    setStatsRows((prev) => {
      const next = prev.map((r) => (r.clave === actualizado.clave ? actualizado : r));
      const cached = cacheScope ? readStockEquinaPageCache(cacheScope) : null;
      if (cached && cacheScope) {
        writeStockEquinaPageCache(
          {
            ...cached,
            rows: cached.filtrosKey === filtrosCacheKey(filtros)
              ? cached.rows.map((r) => (r.clave === actualizado.clave ? actualizado : r))
              : cached.rows,
            statsRows: next,
          },
          cacheScope
        );
      }
      return next;
    });
  };

  const sincronizarFotoDispositivo = (
    clave: string,
    meta: import("../../api").StockDispositivoFotoMeta
  ) => {
    setEditarDispositivo((prev) =>
      prev && prev.clave === clave
        ? {
            ...prev,
            tiene_foto: meta.tiene_foto,
            foto_url: meta.foto_url,
            foto_actualizado_en: meta.foto_actualizado_en,
          }
        : prev
    );
    setRows((prev) =>
      prev.map((r) =>
        r.clave === clave
          ? {
              ...r,
              tiene_foto: meta.tiene_foto,
              foto_url: meta.foto_url,
              foto_actualizado_en: meta.foto_actualizado_en,
            }
          : r
      )
    );
  };

  if (editarDispositivo) {
    return (
      <StockEquinaEditarPanel
        dispositivo={editarDispositivo}
        empresas={empresasOperativas}
        apiOnline={apiOnline}
        currentUser={currentUser}
        onVolver={() => setEditarDispositivo(null)}
        onSaved={(actualizado) => {
          actualizarFila(actualizado);
          setEditarDispositivo(actualizado);
        }}
        onFotoMetaChange={(meta) => sincronizarFotoDispositivo(editarDispositivo.clave, meta)}
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
      <StockEquinaBulkPanel
        empresas={empresasOperativas}
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
      <StockEquinaHistorialCambiosPanel
        clave={historialCambios.clave}
        vid={historialCambios.vid}
        eid={historialCambios.eid}
        apiOnline={apiOnline}
        onVolver={() => setHistorialCambios(null)}
        volverLabel="Volver a Stock Equino"
        onError={onError}
      />
    );
  }

  if (detalleClave) {
    return (
      <StockEquinaDetalle
        clave={detalleClave}
        apiOnline={apiOnline}
        onError={onError}
        onVolver={() => setDetalleClave(null)}
      />
    );
  }

  return (
    <div className="stock-equino-devices-page">
      <div className="sg-hub sg-hub--devices">
        <aside className="sg-hub-aside sg-hub-aside--filters" aria-label="Filtros Stock Equino">
          <div className="sg-hub-aside-brand">
            <span className="sg-hub-aside-logo" aria-hidden>
              <StockEquinoModuleIcon size={20} strokeWidth={1.75} />
            </span>
            <div>
              <p className="sg-hub-aside-kicker">SAG</p>
              <p className="sg-hub-aside-title">Stock Equino</p>
            </div>
          </div>

          {hubNav ? (
            <>
              <StockEquinoHubAsideSearchField
                value={busquedaModulos}
                onChange={setBusquedaModulos}
                inputRef={busquedaInputRef}
              />
              <StockEquinoHubNav
                items={itemsFiltrados}
                activeId={hubNav.activeId}
                onNavigate={hubNav.onNavigate}
                onVolverDashboard={hubNav.onVolverDashboard}
                showDashboard={mostrarDashboard}
                showSubtitles={consultaActiva}
                navLabel={consultaActiva ? `Resultados (${itemsFiltrados.length})` : "Principal"}
              />
              {consultaActiva && !mostrarDashboard && itemsFiltrados.length === 0 ? (
                <p className="sg-hub-aside-nav-empty">Ningún módulo coincide con la búsqueda.</p>
              ) : null}
            </>
          ) : (
            <button
              type="button"
              className="sg-hub-nav-item sg-hub-nav-item--muted sg-hub-nav-item--back"
              onClick={onVolver}
            >
              ‹ Volver al dashboard
            </button>
          )}

          {apiOnline ? (
            <StockEquinaFiltrosSidebar
              embedded
              tone="dark"
              empresaOpciones={empresaOpciones}
              fechaDesde={fechaDesde}
              fechaHasta={fechaHasta}
              onFechaDesde={setFechaDesde}
              onFechaHasta={setFechaHasta}
              filtroUltimaLecturaMes={filtroUltimaLecturaMes}
              onToggleUltimaLecturaMes={(k) =>
                setFiltroUltimaLecturaMes((p) => toggleSet(p, k))
              }
              onLimpiarUltimaLectura={() => {
                setFechaDesde("");
                setFechaHasta("");
                setFiltroUltimaLecturaMes(new Set());
              }}
              ultimaLecturaMesOpciones={ultimaLecturaMesOpciones}
              filtroSexo={filtroSexo}
              filtroEmpresa={filtroEmpresa}
              filtroEstado={filtroEstado}
              filtroEdad={filtroEdad}
              filtroGrupoLibre={filtroGrupoLibre}
              filtroRaza={filtroRaza}
              filtroGeneracion={filtroGeneracion}
              filtroCategoria={filtroCategoria}
              filtroSinFechaNac={filtroSinFechaNac}
              grupoLibreOpciones={grupoLibreOpciones}
              razaOpciones={razaOpciones}
              generacionOpciones={generacionOpciones}
              onToggleSexo={(k) => setFiltroSexo((p) => toggleSet(p, k))}
              onToggleEmpresa={(k) => setFiltroEmpresa((p) => toggleSet(p, k))}
              onToggleEstado={(e) => setFiltroEstado((p) => toggleSet(p, e))}
              onToggleEdad={(k) => setFiltroEdad((p) => toggleSet(p, k))}
              onToggleGrupoLibre={(k) => setFiltroGrupoLibre((p) => toggleSet(p, k))}
              onToggleRaza={(k) => setFiltroRaza((p) => toggleSet(p, k))}
              onToggleGeneracion={(k) => setFiltroGeneracion((p) => toggleSet(p, k))}
              onToggleCategoria={(k) => setFiltroCategoria((p) => toggleSet(p, k))}
              onToggleSinFechaNac={() =>
                setFiltroSinFechaNac((p) => toggleSet(p, SIN_FECHA_NAC_FILTRO_KEY))
              }
              onLimpiarSexo={() => setFiltroSexo(new Set())}
              onLimpiarEmpresa={() => setFiltroEmpresa(new Set())}
              onLimpiarEstado={() => setFiltroEstado(new Set())}
              onLimpiarEdad={() => setFiltroEdad(new Set())}
              onLimpiarGrupoLibre={() => setFiltroGrupoLibre(new Set())}
              onLimpiarRaza={() => setFiltroRaza(new Set())}
              onLimpiarGeneracion={() => setFiltroGeneracion(new Set())}
              onLimpiarCategoria={() => setFiltroCategoria(new Set())}
              onLimpiarSinFechaNac={() => setFiltroSinFechaNac(new Set())}
              counts={facetCounts}
              onLimpiarFacetas={limpiarFacetas}
              hayFacetasActivas={hayFacetasActivas}
              mobileOpen={filtrosMobileOpen}
              onMobileClose={() => setFiltrosMobileOpen(false)}
            />
          ) : (
            <p className="sg-hub-aside-offline">Conectá la API para filtrar dispositivos.</p>
          )}

          {hubNav?.onVolverInicio ? (
            <div className="sg-hub-aside-foot">
              <button
                type="button"
                className="sg-hub-nav-item sg-hub-nav-item--muted"
                onClick={hubNav.onVolverInicio}
              >
                ‹ Volver al inicio
              </button>
            </div>
          ) : null}
        </aside>

        <main className="sg-hub-main sg-hub-main--devices">
          <header className="sg-hub-main-head sg-devices-head">
            <div>
              <h1 className="sg-hub-main-title">Dispositivos REG</h1>
              <p className="sg-hub-main-sub">
                {mostrarCargaVacia
                  ? "Cargando caravanas electrónicas…"
                  : loading
                    ? `${filteredRows.length} dispositivo(s) según filtros · actualizando…`
                    : filteredRows.length === 0
                      ? rows.length === 0
                        ? "No hay dispositivos equinos registrados. Importá lecturas para armar el stock."
                        : "Ningún dispositivo coincide con los filtros aplicados."
                      : `${filteredRows.length} dispositivo(s) según los filtros aplicados`}
              </p>
            </div>
            <div className="sg-hub-main-actions">
              <button
                type="button"
                className="sg-hub-icon-btn"
                aria-label="Actualizar listado"
                disabled={!apiOnline || loading}
                onClick={() => void load()}
              >
                <RefreshCw size={17} className={loading ? "sg-spin" : undefined} />
              </button>
            </div>
          </header>

          {apiOnline && (
            <section className="sg-hub-panel sg-devices-dashboard" aria-label="Resumen del stock equino">
              <div className="sg-hub-panel-head">
                <div>
                  <p className="sg-hub-panel-kicker">Indicadores</p>
                  <h2 className="sg-hub-panel-title">Resumen del stock</h2>
                </div>
              </div>

              <div className="sg-hub-kpi-strip sg-devices-kpi-summary">
                <StockEquinaDashKpi
                  label="Total dispositivos"
                  value={totalDispositivosCount}
                  hint="Caravanas electrónicas equinas únicas en la base."
                  variant="total"
                  trend={
                    !kpisCargando && totalDispositivosCount > 0
                      ? `${activosCount} activos · ${salidasCount} salidas`
                      : undefined
                  }
                  showSexo={false}
                  barsHighlight="last"
                  loading={kpisCargando}
                />
                <StockEquinaDashKpi
                  label="Dispositivos activos"
                  value={activosCount}
                  hint="En stock hoy (sin bajas registradas)."
                  variant="activos"
                  showSexo={false}
                  barsHighlight="mid"
                  loading={kpisCargando}
                />
                <StockEquinaDashKpi
                  label="Salidas del sistema"
                  value={salidasCount}
                  hint={salidasHint}
                  variant="salida"
                  showSexo={false}
                  loading={kpisCargando}
                />
              </div>

              <div className="sg-devices-kpi-divider">
                <p className="sg-devices-kpi-divider-label">Filtrar por estado</p>
                <span className="sg-devices-kpi-divider-line" aria-hidden />
              </div>

              <div className="sg-hub-kpi-strip sg-devices-kpi-filters">
                <StockEquinaDashKpi
                  label="Salidas del sistema"
                  value={salidasCount}
                  hint={salidasHint}
                  variant="salida"
                  sexoStats={sexoSalidas}
                  loading={kpisCargando}
                  active={filtroSalidasSistema}
                  disabled={salidasCount === 0}
                  onClick={() => {
                    setFiltroVentasCerradas(false);
                    setFiltroEstado(new Set());
                    setFiltroSalidasSistema((v) => !v);
                  }}
                />
                <StockEquinaDashKpi
                  label="Ventas"
                  value={ventasCount}
                  hint={
                    ventasSimuladorCount > 0
                      ? `${ventasSimuladorCount} desde el simulador de ventas`
                      : "Equinos registrados como vendidos"
                  }
                  variant="vendido"
                  sexoStats={sexoVentas}
                  loading={kpisCargando}
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
                <StockEquinaDashKpi
                  label="Muertes"
                  value={muertesCount}
                  hint="Registradas en salidas del sistema"
                  variant="muerto"
                  sexoStats={sexoMuertes}
                  loading={kpisCargando}
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
                <StockEquinaDashKpi
                  label="Extraviados"
                  value={extraviadosCount}
                  hint="Registrados como extraviados en salidas"
                  variant="extraviado"
                  sexoStats={sexoExtraviados}
                  loading={kpisCargando}
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

          <section className="sg-hub-panel sg-hub-panel--devices-table" aria-label="Listado de dispositivos equinos">
            <div className="sg-devices-search-bar mayusculas-auto">
              <button
                type="button"
                className="sg-devices-filtros-mobile-btn"
                onClick={() => setFiltrosMobileOpen(true)}
                aria-label="Abrir filtros"
              >
                <SlidersHorizontal size={16} aria-hidden />
                Filtros
                {hayFacetasActivas ? (
                  <span className="sg-devices-filtros-badge" aria-hidden />
                ) : null}
              </button>
              <label className="sg-devices-search-field">
                <Search size={17} className="sg-devices-search-icon" aria-hidden />
                <span className="sr-only">Buscar REG</span>
                <input
                  id="equina-busq"
                  type="search"
                  placeholder="Buscar por REG…"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="sg-hub-cta sg-devices-search-btn"
                onClick={() => void load()}
                disabled={!apiOnline}
              >
                Buscar
              </button>
            </div>

            {(hayFacetasActivas ||
              busqueda.trim() ||
              fechaDesde ||
              fechaHasta ||
              filtroUltimaLecturaMes.size > 0) && (
              <div className="sg-devices-chips" aria-label="Filtros activos">
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
                {[...filtroUltimaLecturaMes].map((k) => (
                  <span key={`lect-${k || "sin"}`} className="stock-ganadera-chip">
                    Última lectura: {labelUltimaLecturaMesFiltro(k)}
                    <button
                      type="button"
                      aria-label="Quitar filtro de última lectura"
                      onClick={() => setFiltroUltimaLecturaMes((p) => toggleSet(p, k))}
                    >
                      ×
                    </button>
                  </span>
                ))}
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
                    Empresa: {empresaOpciones.find((o) => o.key === k)?.label ?? (k || "Sin definir")}
                    <button
                      type="button"
                      aria-label="Quitar filtro de empresa"
                      onClick={() => setFiltroEmpresa((p) => toggleSet(p, k))}
                    >
                      ×
                    </button>
                  </span>
                ))}
                {[...filtroRaza].map((k) => (
                  <span key={`raza-${k}`} className="stock-ganadera-chip">
                    Raza: {labelRazaFiltro(k)}
                    <button
                      type="button"
                      aria-label="Quitar filtro de raza"
                      onClick={() => setFiltroRaza((p) => toggleSet(p, k))}
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
              <div className="stock-equina-selection-bar">
                <span className="stock-equina-selection-count">
                  <strong>{seleccionados.length}</strong> seleccionado
                  {seleccionados.length === 1 ? "" : "s"}
                </span>
                <div className="stock-equina-selection-actions">
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
                    className="sg-hub-cta sg-hub-cta--compact"
                    onClick={() => setBulkOpen(true)}
                  >
                    Editar seleccionados
                  </button>
                  {esAdmin && (
                    <button
                      type="button"
                      className="sg-hub-cta sg-hub-cta--compact sg-hub-cta--danger"
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
          <table className="data-table stock-equina-table stock-table-pro">
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
                <th
                  className="stock-th stock-th--cabana"
                  aria-label="Cabaña"
                  title="Cabaña"
                />
                <th className="stock-th stock-th--device-ids">REG</th>
                <th className="stock-th stock-th--empresa">Empresa</th>
                <th className="stock-th">Generación</th>
                <th className="stock-th">Grupo</th>
                <th className="stock-th stock-th--potrero">Potrero</th>
                <th className="stock-th">Categoría</th>
                <th className="stock-th">Sexo</th>
                <th className="stock-th stock-th--edad">Edad</th>
                <th className="stock-th stock-th--time">Última lectura</th>
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
                rowsPagina.map((d) => {
                  const empresaNombre = fmtEmpresaOperativa(
                    d.empresa,
                    empresasOperativas
                  );
                  const cabana = esEquinoCabana(d);
                  const nombreCabana = nombreEquinoCabana(d);
                  const { eid: regPrefijo, vid: regNumero } = splitEidVid(d.eid, d.vid);
                  const reg = fmtRegEquino(d.eid, d.vid) || "—";
                  return (
                  <tr
                    key={d.clave}
                    className={`stock-equina-row stock-table-pro-row stock-table-pro-row--clickable${
                      cabana ? " stock-table-pro-row--seleccion-cabana" : ""
                    }${seleccion.has(d.clave) ? " stock-table-pro-row--selected" : ""}`}
                    onClick={() => setEditarDispositivo(d)}
                    title={`Abrir ${reg !== "—" ? reg : "dispositivo"}`}
                  >
                    <td
                      className="stock-td stock-td--sel"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        className="stock-row-check"
                        checked={seleccion.has(d.clave)}
                        onChange={() => toggleClave(d.clave)}
                        aria-label={`Seleccionar ${reg}`}
                      />
                    </td>
                    <td className="stock-td stock-td--cabana">
                      <IconoSeleccionCabanaEstrella
                        activo={cabana}
                        nombreCabana={nombreCabana}
                        soloLectura
                      />
                    </td>
                    <td className="stock-td stock-td--device-ids">
                      <div className="stock-device-ids">
                        <span className="stock-device-ids__icon-wrap" aria-hidden>
                          <IconoDispositivoWifi
                            animated
                            className="stock-device-ids__icon"
                          />
                        </span>
                        <div className="stock-device-ids__stack" title={reg !== "—" ? `REG ${reg}` : undefined}>
                          <span className="stock-device-ids__eid">
                            {regPrefijo || "—"}
                          </span>
                          <span className="stock-device-ids__vid stock-table-pro-link">
                            {regNumero || "—"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="stock-td stock-td--muted stock-td--empresa">
                      <span
                        className="stock-td-empresa-name"
                        title={empresaNombre !== "—" ? empresaNombre : undefined}
                      >
                        {empresaNombre}
                      </span>
                    </td>
                    <td className="stock-td stock-td--muted stock-td--generacion">
                      {fmtGrupo(d.grupo)}
                    </td>
                    <td className="stock-td stock-td--muted stock-td--grupo">
                      {fmtGrupoLibre(d.grupo_libre)}
                    </td>
                    <td
                      className="stock-td stock-td--muted stock-td--potrero"
                      title={fmtPotrero(d.potrero) !== "—" ? fmtPotrero(d.potrero) : undefined}
                    >
                      {fmtPotrero(d.potrero)}
                    </td>
                    <td className="stock-td stock-td--muted stock-td--raza">
                      {fmtCategoriaEquino(d.categoria)}
                    </td>
                    <td className={`stock-td stock-td--sexo ${claseCeldaSexo(d.sexo)}`}>
                      {fmtSexo(d.sexo)}
                    </td>
                    <td className="stock-td stock-td--edad">
                      <StockEquinaEdadMiniTimeline
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
                    <td className="stock-td stock-td--estado">
                      <BadgeEstadoDispositivo estado={d.estado} />
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
            </div>

            {(!mostrarCargaVacia) && apiOnline && filteredRows.length > 0 && (
              <div className="sg-devices-pagination">
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
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
