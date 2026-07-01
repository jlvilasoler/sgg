import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createStockControlSanitarioBulk,
  fetchEmpresasOperativasStock,
  fetchStockGanaderaDispositivos,
  fetchStockGanaderaVentasDispositivos,
} from "../../api";
import { useHeaderBackStep } from "../../header-back";
import type { AuthUser, StockGanaderaDispositivo } from "../../types";
import { PageModuleHeadRow } from "../PageModuleHead";
import TablePagination, {
  paginateSlice,
  type PageSize,
} from "../TablePagination";
import StockControlSanitarioRegistroForm, {
  buildStockControlSanitarioInput,
  emptyStockControlSanitarioForm,
  validateStockControlSanitarioForm,
  type AdminModo,
  type StockControlSanitarioFormState,
} from "./StockControlSanitarioRegistroForm";
import {
  animalCategoriaLoteFromDispositivo,
  animalIdFromDispositivo,
} from "./stock-sanidad-dispositivo-utils";
import {
  categoriasDispositivo,
  coincideCategoriaFiltro,
  dispositivoActivoEnStock,
  filtrarDispositivosActivosStock,
  fmtGrupo,
  fmtGrupoLibre,
  generacionFiltroKey,
  grupoLibreFiltroKey,
  labelCategoriaFiltro,
  labelGeneracionFiltro,
  labelGrupoLibreFiltro,
  normalizarEstadoDispositivo,
} from "./stock-ganadera-utils";
import { fmtEmpresaOperativa } from "./stock-empresa-utils";
import StockSanidadHistorialDashboard from "./StockSanidadHistorialDashboard";

interface Props {
  apiOnline: boolean;
  currentUser?: AuthUser | null;
  onError: (msg: string) => void;
  onSuccess: (msg: string, title?: string) => void;
  onVolver: () => void;
}

interface GrupoRapido {
  key: string;
  label: string;
  claves: string[];
}

function toggleSet<T>(prev: Set<T>, value: T): Set<T> {
  const next = new Set(prev);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function funcionarioDefaultDesdeUsuario(user?: AuthUser | null): string {
  if (!user) return "";
  return user.nombre.trim() || user.email.trim();
}

function agruparPor<T>(
  rows: StockGanaderaDispositivo[],
  keyFn: (d: StockGanaderaDispositivo) => T,
  labelFn: (key: T) => string
): GrupoRapido[] {
  const map = new Map<string, { label: string; claves: string[] }>();
  for (const d of rows) {
    const raw = keyFn(d);
    const key = String(raw);
    if (!key) continue;
    const label = labelFn(raw);
    const entry = map.get(key) ?? { label, claves: [] };
    entry.claves.push(d.clave);
    map.set(key, entry);
  }
  return [...map.entries()]
    .map(([key, v]) => ({ key, label: v.label, claves: v.claves }))
    .sort((a, b) => b.claves.length - a.claves.length || a.label.localeCompare(b.label, "es"));
}

export default function StockGanaderoSanidad({
  apiOnline,
  currentUser,
  onError,
  onSuccess,
  onVolver,
}: Props) {
  const funcionarioDefault = useMemo(
    () => funcionarioDefaultDesdeUsuario(currentUser),
    [currentUser]
  );

  const [rows, setRows] = useState<StockGanaderaDispositivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroSexo, setFiltroSexo] = useState<Set<string>>(() => new Set());
  const [filtroEmpresa, setFiltroEmpresa] = useState<Set<string>>(() => new Set());
  const [filtroCategoria, setFiltroCategoria] = useState<Set<string>>(() => new Set());
  const [filtroGrupoLibre, setFiltroGrupoLibre] = useState<Set<string>>(() => new Set());
  const [filtroGeneracion, setFiltroGeneracion] = useState<Set<string>>(() => new Set());
  const [seleccion, setSeleccion] = useState<Set<string>>(() => new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(50);

  const [form, setForm] = useState<StockControlSanitarioFormState>(() =>
    emptyStockControlSanitarioForm(funcionarioDefault)
  );
  const [adminModo, setAdminModo] = useState<AdminModo>("fechas");
  const [guardando, setGuardando] = useState(false);
  const [progreso, setProgreso] = useState<{ done: number; total: number } | null>(null);
  const [empresasOperativas, setEmpresasOperativas] = useState<
    Awaited<ReturnType<typeof fetchEmpresasOperativasStock>>
  >([]);
  const [historialRefreshKey, setHistorialRefreshKey] = useState(0);

  useHeaderBackStep(true, onVolver, "Stock Ganadero");

  useEffect(() => {
    if (!apiOnline) {
      setEmpresasOperativas([]);
      return;
    }
    fetchEmpresasOperativasStock()
      .then(setEmpresasOperativas)
      .catch(() => setEmpresasOperativas([]));
  }, [apiOnline]);

  const load = useCallback(async () => {
    if (!apiOnline) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await fetchStockGanaderaDispositivos({});
      let activos: StockGanaderaDispositivo[];
      try {
        const ventas = await fetchStockGanaderaVentasDispositivos();
        activos = filtrarDispositivosActivosStock(list, new Set(ventas.claves));
      } catch {
        activos = list.filter((d) => normalizarEstadoDispositivo(d.estado) === "VIVO");
      }
      setRows(activos.filter((d) => dispositivoActivoEnStock(d)));
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar dispositivos");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [apiOnline, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [busqueda, filtroSexo, filtroEmpresa, filtroCategoria, filtroGrupoLibre, filtroGeneracion]);

  const filteredRows = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return rows.filter((d) => {
      if (filtroSexo.size > 0 && !filtroSexo.has(d.sexo || "")) return false;
      if (filtroEmpresa.size > 0 && !filtroEmpresa.has(d.empresa || "")) return false;
      if (filtroGeneracion.size > 0 && !filtroGeneracion.has(generacionFiltroKey(d.grupo))) {
        return false;
      }
      if (
        filtroGrupoLibre.size > 0 &&
        !filtroGrupoLibre.has(grupoLibreFiltroKey(d.grupo_libre ?? ""))
      ) {
        return false;
      }
      if (!coincideCategoriaFiltro(d, filtroCategoria)) return false;
      if (!q) return true;
      const haystack = [
        d.eid,
        d.vid,
        d.clave,
        d.grupo_libre,
        d.grupo,
        d.nombre_cabana,
        d.observaciones,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [
    rows,
    busqueda,
    filtroSexo,
    filtroEmpresa,
    filtroCategoria,
    filtroGrupoLibre,
    filtroGeneracion,
  ]);

  const seleccionados = useMemo(
    () => filteredRows.filter((r) => seleccion.has(r.clave)),
    [filteredRows, seleccion]
  );

  const clavesSeleccionadas = useMemo(
    () => seleccionados.map((d) => d.clave),
    [seleccionados]
  );

  const gruposRapidos = useMemo(() => {
    const base = filteredRows;
    const categoriasMap = new Map<string, string[]>();
    for (const d of base) {
      for (const cat of categoriasDispositivo(d)) {
        const list = categoriasMap.get(cat) ?? [];
        list.push(d.clave);
        categoriasMap.set(cat, list);
      }
    }
    const categorias: GrupoRapido[] = [...categoriasMap.entries()]
      .map(([key, claves]) => ({
        key: `cat:${key}`,
        label: labelCategoriaFiltro(key as Parameters<typeof labelCategoriaFiltro>[0]),
        claves,
      }))
      .sort((a, b) => b.claves.length - a.claves.length);

    return {
      categorias,
      gruposLibres: agruparPor(
        base,
        (d) => grupoLibreFiltroKey(d.grupo_libre ?? ""),
        (k) => labelGrupoLibreFiltro(k)
      ).filter((g) => g.key),
      generaciones: agruparPor(base, (d) => generacionFiltroKey(d.grupo), (k) =>
        labelGeneracionFiltro(k)
      ).filter((g) => g.key),
      sexos: agruparPor(
        base,
        (d) => d.sexo || "",
        (k) => (k === "MACHO" ? "Machos" : k === "HEMBRA" ? "Hembras" : "Sin sexo")
      ).filter((g) => g.key),
      empresas: agruparPor(base, (d) => d.empresa || "", (k) =>
        k ? fmtEmpresaOperativa(k, empresasOperativas) : "Sin empresa"
      ).filter((g) => g.key),
    };
  }, [filteredRows, empresasOperativas]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const rowsPagina = useMemo(
    () => paginateSlice(filteredRows, pageSafe, pageSize),
    [filteredRows, pageSafe, pageSize]
  );

  const clavesPagina = useMemo(() => rowsPagina.map((r) => r.clave), [rowsPagina]);
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

  const agregarClaves = (claves: string[]) => {
    setSeleccion((prev) => {
      const next = new Set(prev);
      for (const c of claves) next.add(c);
      return next;
    });
  };

  const seleccionarTodosFiltrados = () => {
    setSeleccion(new Set(filteredRows.map((r) => r.clave)));
  };

  const limpiarSeleccion = () => setSeleccion(new Set());

  const patchForm = (patch: Partial<StockControlSanitarioFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const limpiarFormulario = () => {
    setForm(emptyStockControlSanitarioForm(funcionarioDefault));
    setAdminModo("fechas");
  };

  const guardarMasivo = async () => {
    if (!apiOnline || guardando || seleccionados.length === 0) return;

    const err = validateStockControlSanitarioForm(form, adminModo);
    if (err) {
      onError(err);
      return;
    }

    const items = seleccionados.map((d) => ({
      clave: d.clave,
      input: buildStockControlSanitarioInput(
        form,
        adminModo,
        animalCategoriaLoteFromDispositivo(d),
        animalIdFromDispositivo(d)
      ),
    }));

    setGuardando(true);
    setProgreso({ done: 0, total: items.length });
    try {
      const result = await createStockControlSanitarioBulk("ganadero", items);
      setProgreso({ done: items.length, total: items.length });
      const { ok, errores } = result;
      if (ok > 0) {
        onSuccess(
          `Registro sanitario aplicado a ${ok} animal${ok === 1 ? "" : "es"}.`,
          "Sanidad"
        );
        limpiarFormulario();
        setHistorialRefreshKey((k) => k + 1);
        if (errores.length === 0) limpiarSeleccion();
      }
      if (errores.length > 0) {
        onError(
          `${errores.length} animal${errores.length === 1 ? "" : "es"} no se pudo${
            errores.length === 1 ? "" : "ieron"
          } registrar. ${errores[0].mensaje}`
        );
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al registrar sanidad");
    } finally {
      setGuardando(false);
      setProgreso(null);
    }
  };

  const renderGrupoChips = (titulo: string, grupos: GrupoRapido[]) => {
    if (grupos.length === 0) return null;
    return (
      <div className="stock-sanidad-grupo-block">
        <span className="stock-sanidad-grupo-label">{titulo}</span>
        <div className="stock-sanidad-grupo-chips">
          {grupos.slice(0, 12).map((g) => (
            <button
              key={g.key}
              type="button"
              className="stock-sanidad-grupo-chip"
              disabled={!apiOnline || guardando}
              onClick={() => agregarClaves(g.claves)}
              title={`Agregar ${g.claves.length} a la selección`}
            >
              {g.label}
              <span className="stock-sanidad-grupo-chip-count">{g.claves.length}</span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="subseccion-panel stock-sanidad-page">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver a Stock Ganadero
      </button>

      <div className="card stock-sanidad-card">
        <div className="form-header">
          <PageModuleHeadRow
            icon={{ source: "hub", id: "stock_sanidad" }}
            title="Sanidad"
            subtitle="Seleccioná animales por grupo, categoría o filtro y registrá el mismo control sanitario en todos a la vez."
          />
        </div>

        <div className="stock-sanidad-layout">
          <section className="stock-sanidad-seleccion" aria-label="Selección de animales">
            <div className="stock-sanidad-toolbar">
              <input
                type="search"
                className="stock-sanidad-busqueda"
                placeholder="Buscar EID, VID, grupo, cabaña…"
                value={busqueda}
                disabled={loading || guardando}
                onChange={(e) => setBusqueda(e.target.value)}
              />
              <div className="stock-sanidad-toolbar-actions">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={!apiOnline || guardando || filteredRows.length === 0}
                  onClick={seleccionarTodosFiltrados}
                >
                  Todos ({filteredRows.length})
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={seleccion.size === 0 || guardando}
                  onClick={limpiarSeleccion}
                >
                  Limpiar
                </button>
              </div>
            </div>

            <div className="stock-sanidad-seleccion-bar">
              <strong>{seleccionados.length}</strong>
              <span className="muted">
                seleccionado{seleccionados.length === 1 ? "" : "s"}
                {filteredRows.length !== rows.length
                  ? ` · ${filteredRows.length} en filtro`
                  : ` · ${rows.length} activos`}
              </span>
            </div>

            <div className="stock-sanidad-grupos-rapidos">
              <p className="stock-sanidad-grupos-hint muted">
                Clic en un grupo para sumar esos animales a la selección (sin quitar los ya elegidos).
              </p>
              {renderGrupoChips("Categoría", gruposRapidos.categorias)}
              {renderGrupoChips("Grupo libre", gruposRapidos.gruposLibres)}
              {renderGrupoChips("Generación", gruposRapidos.generaciones)}
              {renderGrupoChips("Sexo", gruposRapidos.sexos)}
              {renderGrupoChips("Empresa", gruposRapidos.empresas)}
            </div>

            <div className="stock-sanidad-filtros">
              <span className="stock-sanidad-filtros-label muted">Refinar lista:</span>
              <div className="stock-sanidad-filtros-chips">
                {(["MACHO", "HEMBRA"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`stock-sanidad-filtro-chip${
                      filtroSexo.has(s) ? " is-active" : ""
                    }`}
                    onClick={() => setFiltroSexo((p) => toggleSet(p, s))}
                  >
                    {s === "MACHO" ? "Machos" : "Hembras"}
                  </button>
                ))}
                {gruposRapidos.categorias.slice(0, 6).map((g) => (
                  <button
                    key={`f-${g.key}`}
                    type="button"
                    className={`stock-sanidad-filtro-chip${
                      filtroCategoria.has(g.key.replace("cat:", "")) ? " is-active" : ""
                    }`}
                    onClick={() =>
                      setFiltroCategoria((p) =>
                        toggleSet(p, g.key.replace("cat:", ""))
                      )
                    }
                  >
                    {g.label}
                  </button>
                ))}
                {gruposRapidos.gruposLibres.slice(0, 4).map((g) => (
                  <button
                    key={`fgl-${g.key}`}
                    type="button"
                    className={`stock-sanidad-filtro-chip${
                      filtroGrupoLibre.has(g.key) ? " is-active" : ""
                    }`}
                    onClick={() => setFiltroGrupoLibre((p) => toggleSet(p, g.key))}
                  >
                    {g.label}
                  </button>
                ))}
                {gruposRapidos.empresas.slice(0, 3).map((g) => (
                  <button
                    key={`femp-${g.key}`}
                    type="button"
                    className={`stock-sanidad-filtro-chip${
                      filtroEmpresa.has(g.key) ? " is-active" : ""
                    }`}
                    onClick={() => setFiltroEmpresa((p) => toggleSet(p, g.key))}
                  >
                    {g.label}
                  </button>
                ))}
                {gruposRapidos.generaciones.slice(0, 4).map((g) => (
                  <button
                    key={`fgen-${g.key}`}
                    type="button"
                    className={`stock-sanidad-filtro-chip${
                      filtroGeneracion.has(g.key) ? " is-active" : ""
                    }`}
                    onClick={() => setFiltroGeneracion((p) => toggleSet(p, g.key))}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <StockSanidadHistorialDashboard
            apiOnline={apiOnline}
            claves={clavesSeleccionadas}
            refreshKey={historialRefreshKey}
            onError={onError}
          />

          <section className="stock-sanidad-registro" aria-label="Registro sanitario">
            <form
              className="stock-sanidad-form"
              onSubmit={(e) => {
                e.preventDefault();
                void guardarMasivo();
              }}
            >
              <div className="stock-sanidad-form-head">
                <div>
                  <h3 className="stock-sanidad-form-title">Datos del control</h3>
                  <p className="stock-sanidad-form-hint muted">
                    Mismo producto y fechas para todos; categoría e ID se completan desde cada ficha.
                  </p>
                </div>
                <div className="stock-sanidad-form-actions stock-sanidad-form-actions--head">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={guardando}
                    onClick={limpiarFormulario}
                  >
                    Limpiar formulario
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={!apiOnline || guardando || seleccionados.length === 0}
                  >
                    {guardando
                      ? "Registrando…"
                      : `Registrar en ${seleccionados.length} animal${
                          seleccionados.length === 1 ? "" : "es"
                        }`}
                  </button>
                </div>
              </div>

              <div className="stock-sanidad-form-body stock-sanidad-form-body--band">
                <StockControlSanitarioRegistroForm
                  idPrefix="sanidad"
                  bandLayout
                  form={form}
                  adminModo={adminModo}
                  guardando={guardando}
                  apiOnline={apiOnline}
                  modulo="ganadero"
                  currentUser={currentUser}
                  onPatch={patchForm}
                  onAdminModo={setAdminModo}
                  onError={onError}
                />
              </div>

              {progreso && (
                <div className="stock-sanidad-progreso" role="status">
                  <div
                    className="stock-sanidad-progreso-bar"
                    style={{
                      width: `${Math.round((progreso.done / progreso.total) * 100)}%`,
                    }}
                  />
                  <span>
                    Registrando {progreso.done} / {progreso.total}…
                  </span>
                </div>
              )}
            </form>
          </section>

          <section className="stock-sanidad-listado" aria-label="Listado de animales">
            <div className="stock-sanidad-table-wrap">
              {loading ? (
                <p className="muted stock-sanidad-empty">Cargando animales…</p>
              ) : !apiOnline ? (
                <p className="muted stock-sanidad-empty">Sin conexión a la API</p>
              ) : filteredRows.length === 0 ? (
                <p className="muted stock-sanidad-empty">No hay animales con estos filtros.</p>
              ) : (
                <table className="stock-sanidad-table">
                  <thead>
                    <tr>
                      <th className="stock-sanidad-th-check">
                        <input
                          type="checkbox"
                          checked={paginaTodaSeleccionada}
                          ref={(el) => {
                            if (el) el.indeterminate = paginaParcial;
                          }}
                          disabled={guardando}
                          onChange={togglePagina}
                          aria-label="Seleccionar página"
                        />
                      </th>
                      <th>VID / EID</th>
                      <th>Categoría</th>
                      <th>Grupo</th>
                      <th>Empresa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rowsPagina.map((d) => {
                      const cats = [...categoriasDispositivo(d)]
                        .map((k) => labelCategoriaFiltro(k))
                        .join(", ");
                      const checked = seleccion.has(d.clave);
                      return (
                        <tr
                          key={d.clave}
                          className={checked ? "is-selected" : undefined}
                          onClick={() => !guardando && toggleClave(d.clave)}
                        >
                          <td className="stock-sanidad-td-check" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={guardando}
                              onChange={() => toggleClave(d.clave)}
                              aria-label={`Seleccionar ${d.vid || d.eid}`}
                            />
                          </td>
                          <td>
                            <span className="stock-sanidad-id-vid">{d.vid || "—"}</span>
                            <span className="stock-sanidad-id-eid muted">{d.eid}</span>
                          </td>
                          <td>{cats || "—"}</td>
                          <td>{fmtGrupoLibre(d.grupo_libre) || fmtGrupo(d.grupo) || "—"}</td>
                          <td>
                            {d.empresa
                              ? fmtEmpresaOperativa(d.empresa, empresasOperativas)
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {filteredRows.length > 0 && (
              <TablePagination
                page={pageSafe}
                pageSize={pageSize}
                total={filteredRows.length}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
