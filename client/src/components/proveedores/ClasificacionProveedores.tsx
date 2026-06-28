import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchProveedores,
  fetchSubRubros,
  updateProveedorClasificacionResultado,
  updateProveedorRubroClasificacion,
} from "../../api";
import type { ClasificacionResultado, Proveedor } from "../../types";
import {
  CLASIFICACION_RESULTADO_LABELS,
  CLASIFICACION_RESULTADO_OPCIONES,
  CLASIFICACIONES_RESULTADO,
  clasificarRubroEnResultado,
} from "../../utils/clasificacion-resultado";
import { grupoClaveOrden, grupoTituloCanon } from "../../utils/grupoRubro";
import {
  buildRubrosCatalogoGasto,
  type RubrosCatalogoGasto,
} from "../../utils/rubros-catalogo";
import TablePagination, {
  paginateSlice,
  type PageSize,
} from "../TablePagination";
import ClasificacionProveedoresDashKpi from "./ClasificacionProveedoresDashKpi";

const SUBRUBRO_COL_STORAGE = "scg-clasif-prov-mostrar-subrubro";

type FiltroEstadoResultados = "todos" | "sin_clasificar" | "clasificados" | ClasificacionResultado;

function filtrarPorEstadoResultados(
  rows: Proveedor[],
  filtro: FiltroEstadoResultados
): Proveedor[] {
  switch (filtro) {
    case "sin_clasificar":
      return rows.filter((p) => !p.clasificacion_resultado);
    case "clasificados":
      return rows.filter((p) => Boolean(p.clasificacion_resultado));
    case "COSTOS_PRODUCCION":
    case "GASTOS_ADMINISTRATIVOS":
    case "GASTOS_COMERCIALES":
      return rows.filter((p) => p.clasificacion_resultado === filtro);
    default:
      return rows;
  }
}

function toggleFiltroEr(
  actual: FiltroEstadoResultados,
  next: FiltroEstadoResultados
): FiltroEstadoResultados {
  return actual === next ? "todos" : next;
}

function readMostrarSubRubro(): boolean {
  try {
    return localStorage.getItem(SUBRUBRO_COL_STORAGE) === "1";
  } catch {
    return false;
  }
}

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onVolver: () => void;
}

function subRubrosDelRubro(catalogo: RubrosCatalogoGasto, rubro: string): string[] {
  if (!rubro.trim()) return [];
  const canon = grupoTituloCanon(rubro);
  const map = catalogo.sub_rubros_por_rubro;
  let base = map[canon] ?? map[rubro] ?? [];
  if (!base.length) {
    const clave = grupoClaveOrden(canon);
    const key = Object.keys(map).find((k) => grupoClaveOrden(k) === clave);
    base = key ? (map[key] ?? []) : [];
  }
  return [...base].sort((a, b) => a.localeCompare(b, "es"));
}

export default function ClasificacionProveedores({
  apiOnline,
  onError,
  onSuccess,
  onVolver,
}: Props) {
  const [catalogRows, setCatalogRows] = useState<Proveedor[]>([]);
  const [rubrosCatalogo, setRubrosCatalogo] = useState<RubrosCatalogoGasto>({
    rubros: [],
    sub_rubros_por_rubro: {},
  });
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [guardandoId, setGuardandoId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(30);
  const [mostrarSubRubro, setMostrarSubRubro] = useState(readMostrarSubRubro);
  const [filtroEr, setFiltroEr] = useState<FiltroEstadoResultados>("todos");

  const colCount = mostrarSubRubro ? 7 : 6;

  const rows = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    let list = catalogRows;
    if (term) {
      list = list.filter(
        (p) =>
          String(p.cod).includes(term) ||
          p.razon_social.toLowerCase().includes(term) ||
          (p.rut ?? "").toLowerCase().includes(term) ||
          (p.ciudad ?? "").toLowerCase().includes(term)
      );
    }
    return filtrarPorEstadoResultados(list, filtroEr);
  }, [catalogRows, busqueda, filtroEr]);

  const stats = useMemo(() => {
    const total = catalogRows.length;
    const porTipo = Object.fromEntries(
      CLASIFICACIONES_RESULTADO.map((k) => [k, 0])
    ) as Record<(typeof CLASIFICACIONES_RESULTADO)[number], number>;
    let conEstadoResultados = 0;
    for (const r of catalogRows) {
      if (!r.clasificacion_resultado) continue;
      conEstadoResultados++;
      porTipo[r.clasificacion_resultado]++;
    }
    const sinEstadoResultados = total - conEstadoResultados;
    const pctEstadoResultados =
      total > 0 ? Math.round((conEstadoResultados / total) * 100) : 0;
    const desgloseEr = CLASIFICACIONES_RESULTADO.map(
      (k) => `${porTipo[k]} ${CLASIFICACION_RESULTADO_LABELS[k].toLowerCase()}`
    ).join(" · ");
    return {
      total,
      conEstadoResultados,
      sinEstadoResultados,
      porTipo,
      pctEstadoResultados,
      desgloseEr,
    };
  }, [catalogRows]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageSafe = Math.min(page, totalPages);

  const rowsPagina = useMemo(
    () => paginateSlice(rows, pageSafe, pageSize),
    [rows, pageSafe, pageSize]
  );

  useEffect(() => {
    setPage(1);
  }, [busqueda, pageSize, filtroEr]);

  const loadRubros = useCallback(async () => {
    if (!apiOnline) return;
    try {
      setRubrosCatalogo(buildRubrosCatalogoGasto(await fetchSubRubros(false)));
    } catch {
      /* mantener catálogo previo */
    }
  }, [apiOnline]);

  const load = useCallback(async () => {
    if (!apiOnline) {
      setCatalogRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setCatalogRows(await fetchProveedores());
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar proveedores");
      setCatalogRows([]);
    } finally {
      setLoading(false);
    }
  }, [apiOnline, onError]);

  useEffect(() => {
    void loadRubros();
  }, [loadRubros]);

  useEffect(() => {
    load();
  }, [load]);

  const guardarRubroClasificacion = async (
    proveedor: Proveedor,
    rubro: string,
    sub_rubro: string
  ) => {
    const rubroNorm = rubro.trim();
    const subNorm = sub_rubro.trim();
    if (rubroNorm === (proveedor.rubro ?? "").trim() && subNorm === (proveedor.sub_rubro ?? "").trim()) {
      return;
    }
    setGuardandoId(proveedor.id);
    try {
      const actualizado = await updateProveedorRubroClasificacion(proveedor.id, {
        rubro: rubroNorm,
        sub_rubro: subNorm,
      });
      setCatalogRows((prev) => prev.map((r) => (r.id === actualizado.id ? actualizado : r)));
      onSuccess("Clasificación guardada");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al guardar clasificación");
    } finally {
      setGuardandoId(null);
    }
  };

  const onRubroChange = async (proveedor: Proveedor, rubro: string) => {
    const rubroNorm = grupoTituloCanon(rubro);
    const subs = subRubrosDelRubro(rubrosCatalogo, rubroNorm);
    const subActual = (proveedor.sub_rubro ?? "").trim();
    const subMantiene = subActual && subs.includes(subActual) ? subActual : "";
    await guardarRubroClasificacion(proveedor, rubroNorm, subMantiene);
  };

  const onSubRubroChange = async (proveedor: Proveedor, sub_rubro: string) => {
    await guardarRubroClasificacion(proveedor, proveedor.rubro ?? "", sub_rubro);
  };

  const onEstadoResultadosChange = async (
    proveedor: Proveedor,
    value: ClasificacionResultado | ""
  ) => {
    const clasificacion = value || null;
    if (clasificacion === proveedor.clasificacion_resultado) return;
    setGuardandoId(proveedor.id);
    try {
      const actualizado = await updateProveedorClasificacionResultado(proveedor.id, clasificacion);
      setCatalogRows((prev) => prev.map((r) => (r.id === actualizado.id ? actualizado : r)));
      onSuccess("Estado de resultados guardado");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al guardar estado de resultados");
    } finally {
      setGuardandoId(null);
    }
  };

  return (
    <div className="subseccion-panel">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver a Configuración
      </button>

      <div className="card">
        <div className="form-header">
          <h2>Clasificación proveedores</h2>
          <p className="muted">
            Asigná rubro y estado de resultados a cada proveedor. El sub-rubro es opcional. Al elegir
            rubro, el estado de resultados se sugiere automáticamente y podés ajustarlo manualmente.
          </p>
        </div>

        {apiOnline ? (
          <section className="stock-dash stock-dash--pro" aria-label="Resumen estado de resultados">
            <div className="stock-dash-head sg-kpi-board-head">
              <div>
                <h3 className="stock-dash-title sg-kpi-board-title">Estado de resultados</h3>
                <p className="stock-dash-sub sg-kpi-board-desc">
                  {loading
                    ? "Cargando proveedores…"
                    : stats.sinEstadoResultados === 0
                      ? "Todos los proveedores tienen estado de resultados asignado"
                      : `${stats.conEstadoResultados} con opción elegida · ${stats.sinEstadoResultados} sin clasificar (${stats.pctEstadoResultados}% del catálogo)`}
                </p>
              </div>
            </div>
            <div className="sg-kpi-grid">
              <ClasificacionProveedoresDashKpi
                label="Total catálogo"
                value={stats.total}
                hint="Mostrar todos los proveedores"
                variant="total"
                loading={loading}
                active={filtroEr === "todos"}
                onClick={() => setFiltroEr("todos")}
              />
              <ClasificacionProveedoresDashKpi
                label="Sin clasificar"
                value={stats.sinEstadoResultados}
                hint={
                  stats.sinEstadoResultados > 0
                    ? "Clic para filtrar pendientes de estado de resultados"
                    : "Ningún proveedor quedó sin clasificar"
                }
                variant="pendientes"
                loading={loading}
                active={filtroEr === "sin_clasificar"}
                disabled={stats.sinEstadoResultados === 0}
                onClick={() => setFiltroEr((f) => toggleFiltroEr(f, "sin_clasificar"))}
              />
              <ClasificacionProveedoresDashKpi
                label="Opción asignada"
                value={stats.conEstadoResultados}
                hint={
                  stats.conEstadoResultados > 0
                    ? `${stats.desgloseEr} · clic para filtrar clasificados`
                    : "Aún no hay proveedores con estado de resultados"
                }
                variant="clasificados"
                loading={loading}
                active={filtroEr === "clasificados"}
                disabled={stats.conEstadoResultados === 0}
                onClick={() => setFiltroEr((f) => toggleFiltroEr(f, "clasificados"))}
              />
              <ClasificacionProveedoresDashKpi
                label={CLASIFICACION_RESULTADO_LABELS.COSTOS_PRODUCCION}
                value={stats.porTipo.COSTOS_PRODUCCION}
                hint="Filtrar proveedores con esta opción"
                variant="costos"
                loading={loading}
                active={filtroEr === "COSTOS_PRODUCCION"}
                disabled={stats.porTipo.COSTOS_PRODUCCION === 0}
                onClick={() =>
                  setFiltroEr((f) => toggleFiltroEr(f, "COSTOS_PRODUCCION"))
                }
              />
              <ClasificacionProveedoresDashKpi
                label={CLASIFICACION_RESULTADO_LABELS.GASTOS_ADMINISTRATIVOS}
                value={stats.porTipo.GASTOS_ADMINISTRATIVOS}
                hint="Filtrar proveedores con esta opción"
                variant="admin"
                loading={loading}
                active={filtroEr === "GASTOS_ADMINISTRATIVOS"}
                disabled={stats.porTipo.GASTOS_ADMINISTRATIVOS === 0}
                onClick={() =>
                  setFiltroEr((f) => toggleFiltroEr(f, "GASTOS_ADMINISTRATIVOS"))
                }
              />
              <ClasificacionProveedoresDashKpi
                label={CLASIFICACION_RESULTADO_LABELS.GASTOS_COMERCIALES}
                value={stats.porTipo.GASTOS_COMERCIALES}
                hint="Filtrar proveedores con esta opción"
                variant="comercial"
                loading={loading}
                active={filtroEr === "GASTOS_COMERCIALES"}
                disabled={stats.porTipo.GASTOS_COMERCIALES === 0}
                onClick={() =>
                  setFiltroEr((f) => toggleFiltroEr(f, "GASTOS_COMERCIALES"))
                }
              />
            </div>
          </section>
        ) : null}

        <div className="filters mayusculas-auto">
          <div className="field flex-grow">
            <label htmlFor="clasif-prov-busq">Buscar</label>
            <input
              id="clasif-prov-busq"
              type="search"
              placeholder="Código, razón social, RUT, ciudad…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
            />
          </div>
          <div className="field clasif-prov-er-filter">
            <label htmlFor="clasif-prov-er">Estado de resultados</label>
            <select
              id="clasif-prov-er"
              value={filtroEr}
              onChange={(e) => setFiltroEr(e.target.value as FiltroEstadoResultados)}
            >
              <option value="todos">Todos</option>
              <option value="sin_clasificar">Sin clasificar</option>
              <option value="clasificados">Clasificados</option>
              {CLASIFICACIONES_RESULTADO.map((k) => (
                <option key={k} value={k}>
                  {CLASIFICACION_RESULTADO_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className="btn btn-primary" onClick={load}>
            Buscar
          </button>
          <label className="clasif-prov-subrubro-toggle">
            <input
              type="checkbox"
              checked={mostrarSubRubro}
              onChange={(e) => {
                const checked = e.target.checked;
                setMostrarSubRubro(checked);
                try {
                  localStorage.setItem(SUBRUBRO_COL_STORAGE, checked ? "1" : "0");
                } catch {
                  /* ignore */
                }
              }}
            />
            Mostrar sub-rubro
          </label>
        </div>

        <div className="table-wrap">
          <table className="data-table clasif-proveedores-table">
            <thead>
              <tr>
                <th className="num">Cód.</th>
                <th>Razón social</th>
                <th>RUT</th>
                <th>Ciudad</th>
                <th>Rubro</th>
                {mostrarSubRubro ? <th>Subrubro</th> : null}
                <th>Estado de resultados</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={colCount} className="empty">
                    Cargando…
                  </td>
                </tr>
              ) : !apiOnline ? (
                <tr>
                  <td colSpan={colCount} className="empty">
                    API no conectada
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="empty">
                    Sin proveedores con esos filtros
                  </td>
                </tr>
              ) : (
                rowsPagina.map((p) => {
                  const rubroVal = p.rubro ? grupoTituloCanon(p.rubro) : "";
                  const subOpciones = subRubrosDelRubro(rubrosCatalogo, rubroVal);
                  const guardando = guardandoId === p.id;
                  const estadoSugerido = rubroVal ? clasificarRubroEnResultado(rubroVal) : null;

                  return (
                    <tr key={p.id}>
                      <td className="num">{p.cod}</td>
                      <td>{p.razon_social}</td>
                      <td>{p.rut || "—"}</td>
                      <td>{p.ciudad || "—"}</td>
                      <td>
                        <select
                          className="clasif-proveedor-select"
                          value={rubroVal}
                          disabled={guardando || rubrosCatalogo.rubros.length === 0}
                          onChange={(e) => void onRubroChange(p, e.target.value)}
                          aria-label={`Rubro de ${p.razon_social}`}
                        >
                          <option value="">Sin rubro</option>
                          {rubrosCatalogo.rubros.map((rubro) => (
                            <option key={rubro} value={rubro}>
                              {rubro}
                            </option>
                          ))}
                          {rubroVal && !rubrosCatalogo.rubros.includes(rubroVal) ? (
                            <option value={rubroVal}>{rubroVal}</option>
                          ) : null}
                        </select>
                      </td>
                      {mostrarSubRubro ? (
                        <td>
                          <select
                            className="clasif-proveedor-select"
                            value={p.sub_rubro ?? ""}
                            disabled={guardando || !rubroVal}
                            onChange={(e) => void onSubRubroChange(p, e.target.value)}
                            aria-label={`Subrubro de ${p.razon_social}`}
                          >
                            <option value="">Sin sub-rubro</option>
                            {subOpciones.map((sub) => (
                              <option key={sub} value={sub}>
                                {sub}
                              </option>
                            ))}
                            {p.sub_rubro && !subOpciones.includes(p.sub_rubro) ? (
                              <option value={p.sub_rubro}>{p.sub_rubro}</option>
                            ) : null}
                          </select>
                        </td>
                      ) : null}
                      <td>
                        <select
                          className="clasif-proveedor-select"
                          value={p.clasificacion_resultado ?? ""}
                          disabled={guardando}
                          onChange={(e) =>
                            void onEstadoResultadosChange(
                              p,
                              e.target.value as ClasificacionResultado | ""
                            )
                          }
                          aria-label={`Estado de resultados de ${p.razon_social}`}
                          title={
                            estadoSugerido && p.clasificacion_resultado !== estadoSugerido
                              ? `Sugerido por rubro: ${CLASIFICACION_RESULTADO_LABELS[estadoSugerido]}`
                              : undefined
                          }
                        >
                          {CLASIFICACION_RESULTADO_OPCIONES.map((opt) => (
                            <option key={opt.value || "sin"} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && apiOnline && rows.length > 0 ? (
          <TablePagination
            total={rows.length}
            page={pageSafe}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
