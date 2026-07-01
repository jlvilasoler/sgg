import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ListPlus, X } from "lucide-react";
import {
  createStockControlSanitarioBulk,
  fetchEmpresasOperativasStock,
  fetchStockGanaderaDispositivos,
  fetchStockGanaderaVentasDispositivos,
} from "../../api";
import { useHeaderBackStep } from "../../header-back";
import type { StockGanaderaDispositivo } from "../../types";
import { PageModuleHeadRow } from "../PageModuleHead";
import TablePagination, {
  paginateSlice,
  type PageSize,
} from "../TablePagination";
import StockControlSanitarioRegistroForm, {
  buildStockControlSanitarioInput,
  emptyStockControlSanitarioForm,
  validateStockControlSanitarioForm,
  type StockControlSanitarioFormState,
} from "./StockControlSanitarioRegistroForm";
import {
  animalCategoriaLoteFromDispositivo,
  animalIdFromDispositivo,
} from "./stock-sanidad-dispositivo-utils";
import {
  categoriasDispositivo,
  dispositivoActivoEnStock,
  EDAD_FILTRO_OPCIONES,
  edadFiltroKey,
  filtrarDispositivosActivosStock,
  fmtGrupo,
  fmtGrupoLibre,
  fmtPotrero,
  fmtRaza,
  generacionFiltroKey,
  grupoLibreFiltroKey,
  labelCategoriaFiltro,
  labelGeneracionFiltro,
  labelGrupoLibreFiltro,
  labelPotreroFiltro,
  labelRazaFiltro,
  normalizarEstadoDispositivo,
  potreroFiltroKey,
  razaFiltroKey,
} from "./stock-ganadera-utils";
import { fmtEmpresaOperativa } from "./stock-empresa-utils";
import IconoDispositivoWifi from "./IconoDispositivoWifi";
import StockGanaderaEdadMiniTimeline from "./StockGanaderaEdadMiniTimeline";
import StockSanidadHistorialDashboard from "./StockSanidadHistorialDashboard";

const SANIDAD_TABLE_COLS = 10;

function fmtSexo(sexo: StockGanaderaDispositivo["sexo"]): string {
  return sexo || "—";
}

function claseCeldaSexo(sexo: StockGanaderaDispositivo["sexo"]): string {
  if (sexo === "MACHO") return "stock-td--sexo-macho";
  if (sexo === "HEMBRA") return "stock-td--sexo-hembra";
  return "stock-td--sexo-na";
}

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string, title?: string) => void;
  onVolver: () => void;
}

interface GrupoRapido {
  key: string;
  label: string;
  claves: string[];
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

interface GrupoCategoria {
  titulo: string;
  grupos: GrupoRapido[];
}

function grupoChipActivo(grupo: GrupoRapido, seleccion: Set<string>): boolean {
  return grupo.claves.length > 0 && grupo.claves.every((c) => seleccion.has(c));
}

function buildGruposRapidos(
  base: StockGanaderaDispositivo[],
  empresasOperativas: Parameters<typeof fmtEmpresaOperativa>[1]
) {
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
    potreros: agruparPor(
      base,
      (d) => potreroFiltroKey(d.potrero ?? ""),
      (k) => labelPotreroFiltro(k)
    ).filter((g) => g.key),
    razas: agruparPor(
      base,
      (d) => razaFiltroKey(d.raza),
      (k) => labelRazaFiltro(k)
    ).filter((g) => g.key),
    edades: agruparPor(
      base,
      (d) => edadFiltroKey(d) ?? "",
      (k) => EDAD_FILTRO_OPCIONES.find((o) => o.key === k)?.label ?? k
    ).filter((g) => g.key),
    generaciones: agruparPor(base, (d) => generacionFiltroKey(d.grupo), (k) =>
      labelGeneracionFiltro(k)
    ).filter((g) => g.key),
    sexos: agruparPor(
      base,
      (d) => d.sexo || "",
      (k) => (k === "MACHO" ? "Machos" : k === "HEMBRA" ? "Hembras" : "Sin sexo")
    ).filter((g) => g.key === "MACHO" || g.key === "HEMBRA"),
    empresas: agruparPor(base, (d) => d.empresa || "", (k) =>
      k ? fmtEmpresaOperativa(k, empresasOperativas) : "Sin empresa"
    ).filter((g) => g.key),
  };
}

function buildGrupoCategorias(grupos: ReturnType<typeof buildGruposRapidos>): GrupoCategoria[] {
  const defs: GrupoCategoria[] = [
    { titulo: "Categoría", grupos: grupos.categorias },
    { titulo: "Grupo personalizado", grupos: grupos.gruposLibres },
    { titulo: "Potrero", grupos: grupos.potreros },
    { titulo: "Raza", grupos: grupos.razas },
    { titulo: "Edad", grupos: grupos.edades },
    { titulo: "Generación", grupos: grupos.generaciones },
    { titulo: "Sexo", grupos: grupos.sexos },
    { titulo: "Empresa", grupos: grupos.empresas },
  ];
  return defs.filter((d) => d.grupos.length > 0);
}

function StockSanidadGrupoCarousel({
  categorias,
  disabled,
  isChipActive,
  onChipClick,
  getChipTitle,
  emptyMessage = "No hay grupos disponibles.",
}: {
  categorias: GrupoCategoria[];
  disabled: boolean;
  isChipActive: (cat: GrupoCategoria, grupo: GrupoRapido) => boolean;
  onChipClick: (cat: GrupoCategoria, grupo: GrupoRapido) => void;
  getChipTitle?: (cat: GrupoCategoria, grupo: GrupoRapido) => string;
  emptyMessage?: string;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(maxScroll > 4 && el.scrollLeft < maxScroll - 4);
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener("scroll", updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      ro.disconnect();
    };
  }, [categorias, updateArrows]);

  const scrollCarousel = (direction: -1 | 1) => {
    const el = viewportRef.current;
    if (!el) return;
    const step = Math.max(160, Math.round(el.clientWidth * 0.72));
    el.scrollBy({ left: direction * step, behavior: "smooth" });
  };

  if (categorias.length === 0) {
    return <p className="muted stock-sanidad-grupos-empty">{emptyMessage}</p>;
  }

  const showArrows = canScrollLeft || canScrollRight;

  return (
    <div className="stock-sanidad-grupos-carousel">
      <div ref={viewportRef} className="stock-sanidad-grupos-carousel-viewport">
        <div className="stock-sanidad-grupos-carousel-track">
          {categorias.map((cat) => (
            <section key={cat.titulo} className="stock-sanidad-grupo-column">
              <h5 className="stock-sanidad-grupo-column-title">{cat.titulo}</h5>
              <div className="stock-sanidad-grupo-column-chips">
                {cat.grupos.slice(0, 12).map((g) => {
                  const activo = isChipActive(cat, g);
                  return (
                    <button
                      key={g.key}
                      type="button"
                      className={`stock-sanidad-grupo-chip${activo ? " is-active" : ""}`}
                      disabled={disabled}
                      aria-pressed={activo}
                      onClick={() => onChipClick(cat, g)}
                      title={getChipTitle?.(cat, g)}
                    >
                      <span className="stock-sanidad-grupo-chip-label">{g.label}</span>
                      <span className="stock-sanidad-grupo-chip-count">{g.claves.length}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
      {showArrows ? (
        <div className="stock-sanidad-grupos-carousel-nav">
          <button
            type="button"
            className="stock-sanidad-grupos-carousel-btn"
            disabled={disabled || !canScrollLeft}
            aria-label="Grupos anteriores"
            onClick={() => scrollCarousel(-1)}
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
          <button
            type="button"
            className="stock-sanidad-grupos-carousel-btn"
            disabled={disabled || !canScrollRight}
            aria-label="Grupos siguientes"
            onClick={() => scrollCarousel(1)}
          >
            <ChevronRight size={18} aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function StockGanaderoSanidad({
  apiOnline,
  onError,
  onSuccess,
  onVolver,
}: Props) {
  const [rows, setRows] = useState<StockGanaderaDispositivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [seleccion, setSeleccion] = useState<Set<string>>(() => new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(50);

  const [form, setForm] = useState<StockControlSanitarioFormState>(() =>
    emptyStockControlSanitarioForm()
  );
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
  }, [busqueda]);

  const filteredRows = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((d) => {
      const haystack = [
        d.eid,
        d.vid,
        d.clave,
        d.grupo_libre,
        d.grupo,
        d.potrero,
        d.raza,
        d.nombre_cabana,
        d.observaciones,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, busqueda]);

  const seleccionados = useMemo(
    () => filteredRows.filter((r) => seleccion.has(r.clave)),
    [filteredRows, seleccion]
  );

  const clavesSeleccionadas = useMemo(
    () => seleccionados.map((d) => d.clave),
    [seleccionados]
  );

  const gruposRapidos = useMemo(
    () => buildGruposRapidos(filteredRows, empresasOperativas),
    [filteredRows, empresasOperativas]
  );

  const grupoCategorias = useMemo(
    () => buildGrupoCategorias(gruposRapidos),
    [gruposRapidos]
  );

  const gruposSeleccionados = useMemo(() => {
    return grupoCategorias.flatMap((cat) =>
      cat.grupos
        .filter((g) => grupoChipActivo(g, seleccion))
        .map((g) => ({ ...g, categoria: cat.titulo }))
    );
  }, [grupoCategorias, seleccion]);

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

  const quitarClaves = (claves: string[]) => {
    setSeleccion((prev) => {
      const next = new Set(prev);
      for (const c of claves) next.delete(c);
      return next;
    });
  };

  const toggleGrupoClaves = useCallback((g: GrupoRapido) => {
    setSeleccion((prev) => {
      const activo = grupoChipActivo(g, prev);
      const next = new Set(prev);
      if (activo) {
        for (const c of g.claves) next.delete(c);
      } else {
        for (const c of g.claves) next.add(c);
      }
      return next;
    });
  }, []);

  const seleccionarTodosFiltrados = () => {
    setSeleccion(new Set(filteredRows.map((r) => r.clave)));
  };

  const limpiarSeleccion = () => setSeleccion(new Set());

  const patchForm = (patch: Partial<StockControlSanitarioFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const limpiarFormulario = () => {
    setForm(emptyStockControlSanitarioForm());
  };

  const guardarMasivo = async () => {
    if (!apiOnline || guardando || seleccionados.length === 0) return;

    const err = validateStockControlSanitarioForm(form, "fechas");
    if (err) {
      onError(err);
      return;
    }

    const items = seleccionados.map((d) => ({
      clave: d.clave,
      input: buildStockControlSanitarioInput(
        form,
        "fechas",
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
            subtitle="Seleccioná animales por grupo y registrá el mismo control sanitario en todos a la vez."
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
                  ? ` · ${filteredRows.length} en búsqueda`
                  : ` · ${rows.length} activos`}
              </span>
            </div>

            <section className="stock-sanidad-grupos-filtros" aria-label="Sumar por grupo">
              <div className="stock-sanidad-grupos-rapidos stock-sanidad-panel stock-sanidad-panel--grupos">
                  <header className="stock-sanidad-panel-head">
                    <span className="stock-sanidad-panel-head-icon" aria-hidden>
                      <ListPlus size={16} strokeWidth={2.25} />
                    </span>
                    <div className="stock-sanidad-panel-head-copy">
                      <h4 className="stock-sanidad-panel-title">Sumar por grupo</h4>
                      <p className="stock-sanidad-panel-sub muted">
                        Clic para sumar o quitar un grupo de la selección
                      </p>
                    </div>
                  </header>
                  <StockSanidadGrupoCarousel
                    categorias={grupoCategorias}
                    disabled={!apiOnline || guardando}
                    isChipActive={(_, g) => grupoChipActivo(g, seleccion)}
                    onChipClick={(_, g) => toggleGrupoClaves(g)}
                    getChipTitle={(_, g) => {
                      const activo = grupoChipActivo(g, seleccion);
                      return activo
                        ? `Quitar ${g.claves.length} de la selección`
                        : `Agregar ${g.claves.length} a la selección`;
                    }}
                  />
                  {gruposSeleccionados.length > 0 ? (
                    <footer className="stock-sanidad-grupos-activos">
                      <span className="stock-sanidad-grupos-activos-label">Grupos en selección</span>
                      <div className="stock-sanidad-grupos-activos-chips">
                        {gruposSeleccionados.map((g) => (
                          <button
                            key={g.key}
                            type="button"
                            className="stock-sanidad-grupos-activos-chip"
                            title={`Quitar ${g.label} de la selección`}
                            onClick={() => quitarClaves(g.claves)}
                          >
                            <span className="stock-sanidad-grupos-activos-chip-cat">{g.categoria}</span>
                            <span className="stock-sanidad-grupos-activos-chip-label">{g.label}</span>
                            <span className="stock-sanidad-grupo-chip-count">{g.claves.length}</span>
                            <X size={13} strokeWidth={2.5} className="stock-sanidad-grupos-activos-chip-remove" aria-hidden />
                          </button>
                        ))}
                      </div>
                    </footer>
                  ) : null}
                </div>
            </section>
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
                  guardando={guardando}
                  apiOnline={apiOnline}
                  modulo="ganadero"
                  onPatch={patchForm}
                  onError={onError}
                  onFichaSaved={(msg) => onSuccess(msg)}
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
            <div className="table-wrap table-wrap-stock-pro stock-sanidad-table-wrap">
              <table className="data-table stock-ganadera-table stock-table-pro stock-sanidad-table-pro">
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
                        disabled={guardando || loading || filteredRows.length === 0}
                        onChange={togglePagina}
                        aria-label="Seleccionar página"
                      />
                    </th>
                    <th className="stock-th stock-th--device-ids">EID / VID</th>
                    <th className="stock-th">Categoría</th>
                    <th className="stock-th stock-th--empresa">Empresa</th>
                    <th className="stock-th">Generación</th>
                    <th className="stock-th">Grupo personalizado</th>
                    <th className="stock-th stock-th--potrero">Potrero</th>
                    <th className="stock-th">Raza</th>
                    <th className="stock-th">Sexo</th>
                    <th className="stock-th stock-th--edad">Edad</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={SANIDAD_TABLE_COLS} className="empty">
                        Cargando animales…
                      </td>
                    </tr>
                  ) : !apiOnline ? (
                    <tr>
                      <td colSpan={SANIDAD_TABLE_COLS} className="empty">
                        Sin conexión a la API
                      </td>
                    </tr>
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={SANIDAD_TABLE_COLS} className="empty">
                        No hay animales con esta búsqueda.
                      </td>
                    </tr>
                  ) : (
                    rowsPagina.map((d) => {
                      const cats = [...categoriasDispositivo(d)]
                        .map((k) => labelCategoriaFiltro(k))
                        .join(", ");
                      const empresaNombre = fmtEmpresaOperativa(d.empresa, empresasOperativas);
                      const checked = seleccion.has(d.clave);
                      return (
                        <tr
                          key={d.clave}
                          className={`stock-ganadera-row stock-table-pro-row stock-table-pro-row--clickable${
                            checked ? " stock-table-pro-row--selected" : ""
                          }`}
                          onClick={() => !guardando && toggleClave(d.clave)}
                        >
                          <td
                            className="stock-td stock-td--sel"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              className="stock-row-check"
                              checked={checked}
                              disabled={guardando}
                              onChange={() => toggleClave(d.clave)}
                              aria-label={`Seleccionar ${d.vid || d.eid}`}
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
                              <div className="stock-device-ids__stack">
                                <span className="stock-device-ids__eid" title="EID electrónico">
                                  {d.eid || "—"}
                                </span>
                                <span
                                  className="stock-device-ids__vid"
                                  title={d.vid ? `VID ${d.vid}` : undefined}
                                >
                                  {d.vid || "—"}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td
                            className="stock-td stock-td--muted stock-td--categoria"
                            title={cats || undefined}
                          >
                            {cats || "—"}
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
                            title={
                              fmtPotrero(d.potrero) !== "—" ? fmtPotrero(d.potrero) : undefined
                            }
                          >
                            {fmtPotrero(d.potrero)}
                          </td>
                          <td className="stock-td stock-td--muted stock-td--raza">
                            {fmtRaza(d.raza)}
                          </td>
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
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {!loading && apiOnline && filteredRows.length > 0 && (
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
