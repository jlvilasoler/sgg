import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchStockGanaderaDispositivos,
} from "../../api";
import { useHeaderBackStep } from "../../header-back";
import type { DispositivoEstado, StockGanaderaDispositivo } from "../../types";
import { fmtDate } from "../../utils";
import TablePagination, {
  paginateSlice,
  type PageSize,
} from "../TablePagination";
import BadgeEstadoDispositivo from "./BadgeEstadoDispositivo";
import IconoDispositivoWifi from "./IconoDispositivoWifi";
import StockGanaderaBulkModal from "./StockGanaderaBulkPanel";
import StockGanaderaDetalle from "./StockGanaderaDetalle";
import StockGanaderaEdadMiniTimeline from "./StockGanaderaEdadMiniTimeline";
import StockGanaderaEditarModal from "./StockGanaderaEditarModal";
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
  onError: (msg: string) => void;
  onSuccess?: (msg: string) => void;
  onVolver: () => void;
  refreshKey?: number;
}

export default function StockGanadera({
  apiOnline,
  onError,
  onSuccess,
  onVolver,
  refreshKey = 0,
}: Props) {
  const [rows, setRows] = useState<StockGanaderaDispositivo[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [editarDispositivo, setEditarDispositivo] =
    useState<StockGanaderaDispositivo | null>(null);
  const [detalleClave, setDetalleClave] = useState<string | null>(null);
  const volverDetalle = useCallback(() => setDetalleClave(null), []);
  useHeaderBackStep(!!detalleClave, volverDetalle, "Stock Ganadero");
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
  const [filtroCategoria, setFiltroCategoria] = useState<Set<string>>(
    () => new Set()
  );
  const [filtroSinFechaNac, setFiltroSinFechaNac] = useState<Set<string>>(
    () => new Set()
  );
  const [bulkOpen, setBulkOpen] = useState(false);
  const [filtrosMobileOpen, setFiltrosMobileOpen] = useState(false);

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
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setRows(await fetchStockGanaderaDispositivos(filtros));
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [apiOnline, filtros, onError]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  useEffect(() => {
    setPage(1);
    setSeleccion(new Set());
  }, [busqueda, fechaDesde, fechaHasta, pageSize, filtroSexo, filtroEmpresa, filtroEstado, filtroEdad, filtroGrupoLibre, filtroCategoria, filtroSinFechaNac]);

  const filteredRows = useMemo(
    () =>
      aplicaFacetas(
        rows,
        filtroSexo,
        filtroEmpresa,
        filtroEstado,
        filtroEdad,
        filtroGrupoLibre,
        filtroCategoria,
        filtroSinFechaNac
      ),
    [rows, filtroSexo, filtroEmpresa, filtroEstado, filtroEdad, filtroGrupoLibre, filtroCategoria, filtroSinFechaNac]
  );

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
    filtroSinFechaNac.size > 0;

  const limpiarFacetas = () => {
    setFiltroSexo(new Set());
    setFiltroEmpresa(new Set());
    setFiltroEstado(new Set());
    setFiltroEdad(new Set());
    setFiltroGrupoLibre(new Set());
    setFiltroCategoria(new Set());
    setFiltroSinFechaNac(new Set());
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

  const sexoStats = useMemo(() => {
    let machos = 0;
    let hembras = 0;
    let sinDefinir = 0;
    for (const d of filteredRows) {
      if (d.sexo === "MACHO") machos += 1;
      else if (d.sexo === "HEMBRA") hembras += 1;
      else sinDefinir += 1;
    }
    return { machos, hembras, sinDefinir };
  }, [filteredRows]);

  const actualizarFila = (actualizado: StockGanaderaDispositivo) => {
    setRows((prev) =>
      prev.map((r) => (r.clave === actualizado.clave ? actualizado : r))
    );
  };

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
            {loading
              ? "Cargando…"
              : filteredRows.length === 0
                ? rows.length === 0
                  ? "No hay dispositivos (EID) registrados. Importá lecturas para armar el stock."
                  : "Ningún dispositivo coincide con los filtros."
                : `${filteredRows.length} dispositivo(s) según los filtros aplicados`}
          </p>
        </div>

        {apiOnline && (
          <section className="stock-dash" aria-label="Resumen de dispositivos">
            <div className="stock-dash-head">
              <h3 className="stock-dash-title">Resumen</h3>
              <p className="stock-dash-sub">Caravanas electrónicas únicas en la base</p>
            </div>
            <div className="stock-dash-grid stock-dash-grid--sexo">
              <div className="stock-dash-card stock-dash-card--total">
                <span className="stock-dash-label">Dispositivos</span>
                <span className="stock-dash-valor">
                  {loading ? "—" : filteredRows.length}
                </span>
                <span className="stock-dash-hint">Caravanas en el filtro</span>
              </div>
              <div className="stock-dash-card stock-dash-card--macho">
                <span className="stock-dash-label">Total machos</span>
                <span className="stock-dash-valor stock-dash-valor--macho">
                  {loading ? "—" : sexoStats.machos}
                </span>
                <span className="stock-dash-hint">Sexo MACHO</span>
              </div>
              <div className="stock-dash-card stock-dash-card--hembra">
                <span className="stock-dash-label">Total hembras</span>
                <span className="stock-dash-valor stock-dash-valor--hembra">
                  {loading ? "—" : sexoStats.hembras}
                </span>
                <span className="stock-dash-hint">Sexo HEMBRA</span>
              </div>
              <div className="stock-dash-card stock-dash-card--sin-sexo">
                <span className="stock-dash-label">Sin definir</span>
                <span className="stock-dash-valor stock-dash-valor--sin-sexo">
                  {loading ? "—" : sexoStats.sinDefinir}
                </span>
                <span className="stock-dash-hint">Sin sexo asignado</span>
              </div>
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
                    disabled={loading || rowsPagina.length === 0}
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
              {loading ? (
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

            {!loading && apiOnline && filteredRows.length > 0 && (
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

        <StockGanaderaBulkModal
          open={bulkOpen}
          onClose={() => setBulkOpen(false)}
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
      </div>

      {editarDispositivo && (
        <StockGanaderaEditarModal
          dispositivo={editarDispositivo}
          apiOnline={apiOnline}
          onClose={() => setEditarDispositivo(null)}
          onSaved={actualizarFila}
          onVerHistorial={() => {
            setDetalleClave(editarDispositivo.clave);
            setEditarDispositivo(null);
          }}
          onError={onError}
        />
      )}
    </div>
  );
}
