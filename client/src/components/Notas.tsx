import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Pin, PinOff, Plus, Search, Trash2, Users } from "lucide-react";
import { createNota, deleteNota, fetchNotas, fetchUsuariosMiCuenta, updateNota } from "../api";
import type { AuthUser, Nota, NotaColor, NotaInput } from "../types";
import { NOTA_COLORES } from "../types";
import { confirmAction } from "../utils/confirm";
import NotasHub from "./notas/NotasHub";
import NotaCompartirPanel, {
  esCompartidaConTodoElEquipo,
  idsTodoElEquipo,
  nombresCompartidos,
} from "./notas/NotaCompartirPanel";
import { notasHubMeta, type NotasVistaId } from "./notas/notas-hub-items";

interface Props {
  apiOnline: boolean;
  currentUser: AuthUser;
  onVolver: () => void;
  onError: (msg: string) => void;
  onSuccess?: (msg: string) => void;
}

function previewNota(nota: Nota): string {
  const lines = nota.contenido
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const tituloNorm = nota.titulo.trim().toLowerCase();
  const body =
    lines.find((l) => l.toLowerCase() !== tituloNorm) ?? lines[1] ?? "";
  return body.slice(0, 120);
}

function formatFechaNota(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("es-UY", { day: "numeric", month: "short" });
}

const COLOR_LABELS: Record<NotaColor, string> = {
  default: "Blanco",
  yellow: "Amarillo",
  green: "Verde",
  blue: "Azul",
  pink: "Rosa",
  purple: "Morado",
};

function esNotaPropia(nota: Nota, userId: number): boolean {
  return nota.usuario_id === userId;
}

function esTituloPlaceholder(titulo: string): boolean {
  return /^sin\s*t[ií]tulo$/i.test(titulo.trim());
}

function tituloParaEditor(titulo: string): string {
  return esTituloPlaceholder(titulo) ? "" : titulo;
}

function normalizarNota(nota: Nota): Nota {
  return esTituloPlaceholder(nota.titulo) ? { ...nota, titulo: "" } : nota;
}

export default function Notas({
  apiOnline,
  currentUser,
  onVolver,
  onError,
  onSuccess,
}: Props) {
  const currentUserId = currentUser.id;
  const puedeCompartir = currentUser.empresa_id != null || currentUser.cuenta_actividad_id != null;

  const [vista, setVista] = useState<NotasVistaId>("todas");
  const [notas, setNotas] = useState<Nota[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [titulo, setTitulo] = useState("");
  const [contenido, setContenido] = useState("");
  const [fijada, setFijada] = useState(false);
  const [compartidosCon, setCompartidosCon] = useState<number[]>([]);
  const [miembrosEquipo, setMiembrosEquipo] = useState<AuthUser[]>([]);
  const [color, setColor] = useState<NotaColor>("default");
  const [guardando, setGuardando] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [mobileEditor, setMobileEditor] = useState(false);
  const [modoSeleccion, setModoSeleccion] = useState(false);
  const [idsSeleccionados, setIdsSeleccionados] = useState<Set<number>>(() => new Set());
  const [eliminandoVarias, setEliminandoVarias] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipAutoSaveRef = useRef(false);

  const hubMeta = notasHubMeta(vista);

  const notaSeleccionada = useMemo(
    () => notas.find((n) => n.id === selectedId) ?? null,
    [notas, selectedId]
  );
  const soloLectura = notaSeleccionada != null && !esNotaPropia(notaSeleccionada, currentUserId);

  const miembrosParaCompartir = useMemo(
    () => miembrosEquipo.filter((m) => m.id !== currentUserId && m.activo !== false),
    [miembrosEquipo, currentUserId]
  );

  useEffect(() => {
    if (!apiOnline || !puedeCompartir) {
      setMiembrosEquipo([]);
      return;
    }
    fetchUsuariosMiCuenta()
      .then(setMiembrosEquipo)
      .catch(() => setMiembrosEquipo([]));
  }, [apiOnline, puedeCompartir]);

  const cargar = useCallback(async () => {
    if (!apiOnline) {
      setNotas([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchNotas();
      setNotas(data.map(normalizarNota));
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudieron cargar las notas");
      setNotas([]);
    } finally {
      setLoading(false);
    }
  }, [apiOnline, onError]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const notasFiltradas = useMemo(() => {
    let list = notas;
    if (vista === "mias") {
      list = list.filter((n) => esNotaPropia(n, currentUserId));
    } else if (vista === "equipo") {
      list = list.filter((n) => !esNotaPropia(n, currentUserId));
    }
    const q = busqueda.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (n) =>
        n.titulo.toLowerCase().includes(q) ||
        n.contenido.toLowerCase().includes(q) ||
        n.autor_nombre.toLowerCase().includes(q) ||
        n.compartidos_con.some((u) => u.nombre.toLowerCase().includes(q))
    );
  }, [notas, vista, busqueda, currentUserId]);

  const notasPropiasFiltradas = useMemo(
    () => notasFiltradas.filter((n) => esNotaPropia(n, currentUserId)),
    [notasFiltradas, currentUserId]
  );

  const salirModoSeleccion = useCallback(() => {
    setModoSeleccion(false);
    setIdsSeleccionados(new Set());
  }, []);

  useEffect(() => {
    salirModoSeleccion();
  }, [vista, salirModoSeleccion]);

  const toggleSeleccionNota = (id: number) => {
    setIdsSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const seleccionarTodasPropias = () => {
    setIdsSeleccionados(new Set(notasPropiasFiltradas.map((n) => n.id)));
  };

  const todasSeleccionadas =
    notasPropiasFiltradas.length > 0 &&
    notasPropiasFiltradas.every((n) => idsSeleccionados.has(n.id));

  const toggleTodasPropias = () => {
    if (todasSeleccionadas) setIdsSeleccionados(new Set());
    else seleccionarTodasPropias();
  };

  const puedeSeleccionar = notasPropiasFiltradas.length > 0 && vista !== "equipo";

  const seleccionar = useCallback((nota: Nota, abrirEnMovil = false) => {
    skipAutoSaveRef.current = true;
    setSelectedId(nota.id);
    setTitulo(tituloParaEditor(nota.titulo));
    setContenido(nota.contenido);
    setFijada(nota.fijada);
    setCompartidosCon(nota.compartidos_con.map((u) => u.id));
    setColor(nota.color);
    setDirty(false);
    if (abrirEnMovil) setMobileEditor(true);
  }, []);

  const limpiarEditorSiEliminada = useCallback(
    (rest: Nota[]) => {
      if (selectedId != null && !rest.some((n) => n.id === selectedId)) {
        if (rest[0]) seleccionar(rest[0]);
        else {
          setSelectedId(null);
          setTitulo("");
          setContenido("");
          setFijada(false);
          setCompartidosCon([]);
          setColor("default");
          setMobileEditor(false);
        }
      }
    },
    [selectedId, seleccionar]
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const onChange = () => {
      if (!mq.matches) setMobileEditor(false);
    };
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (loading || selectedId != null || notasFiltradas.length === 0) return;
    seleccionar(notasFiltradas[0]!);
  }, [loading, notasFiltradas, selectedId, seleccionar]);

  useEffect(() => {
    if (selectedId == null) return;
    if (!notasFiltradas.some((n) => n.id === selectedId)) {
      if (notasFiltradas[0]) seleccionar(notasFiltradas[0]);
      else setSelectedId(null);
    }
  }, [notasFiltradas, selectedId, seleccionar]);

  const ordenarNotas = (items: Nota[]) =>
    [...items].sort((a, b) => {
      if (a.fijada !== b.fijada) return a.fijada ? -1 : 1;
      return b.actualizado_en.localeCompare(a.actualizado_en);
    });

  const persistir = useCallback(
    async (id: number, patch: NotaInput) => {
      if (!apiOnline || soloLectura) return null;
      setGuardando(true);
      try {
        const updated = normalizarNota(await updateNota(id, patch));
        setNotas((prev) => ordenarNotas(prev.map((n) => (n.id === id ? updated : n))));
        setCompartidosCon(updated.compartidos_con.map((u) => u.id));
        setDirty(false);
        return updated;
      } catch (e) {
        onError(e instanceof Error ? e.message : "No se pudo guardar la nota");
        return null;
      } finally {
        setGuardando(false);
      }
    },
    [apiOnline, onError, soloLectura]
  );

  const patchActual = useCallback(
    (): NotaInput => ({
      titulo,
      contenido,
      fijada,
      compartida: compartidosCon.length > 0,
      compartidos_con: compartidosCon,
      color,
    }),
    [titulo, contenido, fijada, compartidosCon, color]
  );

  const programarGuardado = useCallback(
    (id: number, patch: NotaInput) => {
      if (!apiOnline || skipAutoSaveRef.current || soloLectura) {
        skipAutoSaveRef.current = false;
        return;
      }
      setDirty(true);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        void persistir(id, patch);
      }, 700);
    },
    [apiOnline, persistir, soloLectura]
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const nuevaNota = async (compartirConTodos = false) => {
    if (!apiOnline) {
      onError("Sin conexión con el servidor");
      return;
    }
    if (compartirConTodos && !puedeCompartir) {
      onError("Tu usuario no está asociado a una cuenta para compartir notas.");
      return;
    }
    if (compartirConTodos && miembrosParaCompartir.length === 0) {
      onError("No hay otros usuarios en tu cuenta para compartir.");
      return;
    }
    try {
      const compartidos = compartirConTodos ? idsTodoElEquipo(miembrosParaCompartir) : [];
      const created = normalizarNota(
        await createNota({
          titulo: "",
          contenido: "",
          color: "default",
          compartidos_con: compartidos,
          compartida: compartidos.length > 0,
        })
      );
      setNotas((prev) => ordenarNotas([created, ...prev]));
      setVista(compartirConTodos ? "todas" : "mias");
      seleccionar(created, true);
      onSuccess?.(compartirConTodos ? "Nota creada para todo el equipo" : "Nota creada");
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo crear la nota");
    }
  };

  const eliminarNota = async () => {
    if (selectedId == null || soloLectura) return;
    const ok = await confirmAction({
      title: "Eliminar nota",
      message: "¿Eliminar esta nota? No se puede deshacer.",
      confirmText: "Eliminar",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await deleteNota(selectedId);
      const rest = notas.filter((n) => n.id !== selectedId);
      setNotas(rest);
      limpiarEditorSiEliminada(rest);
      onSuccess?.("Nota eliminada");
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo eliminar la nota");
    }
  };

  const eliminarVarias = async () => {
    const ids = [...idsSeleccionados];
    if (!ids.length || !apiOnline) return;
    const ok = await confirmAction({
      title: "Eliminar notas",
      message: `¿Eliminar ${ids.length} nota${ids.length === 1 ? "" : "s"}? No se puede deshacer.`,
      confirmText: "Eliminar",
      variant: "danger",
    });
    if (!ok) return;
    setEliminandoVarias(true);
    try {
      const results = await Promise.allSettled(ids.map((id) => deleteNota(id)));
      const deleted = ids.filter((_, i) => results[i].status === "fulfilled");
      const failed = results.length - deleted.length;
      const rest = notas.filter((n) => !deleted.includes(n.id));
      setNotas(rest);
      limpiarEditorSiEliminada(rest);
      salirModoSeleccion();
      if (failed > 0) {
        onError(
          deleted.length > 0
            ? `Se eliminaron ${deleted.length} nota${deleted.length === 1 ? "" : "s"}, pero ${failed} no se pudieron borrar`
            : "No se pudieron eliminar las notas"
        );
      } else {
        onSuccess?.(`${deleted.length} nota${deleted.length === 1 ? "" : "s"} eliminada${deleted.length === 1 ? "" : "s"}`);
      }
    } finally {
      setEliminandoVarias(false);
    }
  };

  const toggleFijar = async () => {
    if (selectedId == null || soloLectura) return;
    const next = !fijada;
    setFijada(next);
    await persistir(selectedId, { ...patchActual(), fijada: next });
  };

  const onCompartidosChange = (ids: number[]) => {
    if (selectedId == null || soloLectura) return;
    if (!puedeCompartir) {
      onError("Tu usuario no está asociado a una cuenta para compartir notas.");
      return;
    }
    setCompartidosCon(ids);
    programarGuardado(selectedId, {
      titulo,
      contenido,
      fijada,
      compartidos_con: ids,
      compartida: ids.length > 0,
      color,
    });
  };

  const onTituloFocus = () => {
    if (esTituloPlaceholder(titulo)) setTitulo("");
  };

  const onTituloChange = (value: string) => {
    let next = value;
    if (esTituloPlaceholder(titulo) && value.startsWith(titulo) && value.length > titulo.length) {
      next = value.slice(titulo.length);
    }
    setTitulo(next);
    if (selectedId == null || soloLectura) return;
    programarGuardado(selectedId, { ...patchActual(), titulo: next });
  };

  const onContenidoChange = (value: string) => {
    setContenido(value);
    if (selectedId == null || soloLectura) return;
    programarGuardado(selectedId, { ...patchActual(), contenido: value });
  };

  const onColorChange = async (next: NotaColor) => {
    if (soloLectura) return;
    setColor(next);
    if (selectedId == null) return;
    await persistir(selectedId, { ...patchActual(), color: next });
  };

  const headerActions = (
    <div className="notas-header-actions">
      {puedeCompartir && miembrosParaCompartir.length > 0 ? (
        <button
          type="button"
          className="btn btn-secondary btn-sm notas-team-note-btn"
          disabled={!apiOnline}
          onClick={() => void nuevaNota(true)}
        >
          <Users size={16} aria-hidden />
          Nota para todos
        </button>
      ) : null}
      <button
        type="button"
        className="btn btn-primary btn-sm notas-new-btn"
        disabled={!apiOnline}
        onClick={() => void nuevaNota(false)}
      >
        <Plus size={16} aria-hidden />
        Nueva nota
      </button>
    </div>
  );

  return (
    <NotasHub
      vista={vista}
      onNavigate={setVista}
      onVolver={onVolver}
      apiOnline={apiOnline}
      title={hubMeta.title}
      subtitle={hubMeta.subtitle}
      headerActions={headerActions}
    >
      <div className={`notas-shell${mobileEditor ? " notas-shell--editor-open" : ""}`}>
        <aside
          className={`notas-sidebar${modoSeleccion ? " notas-sidebar--selecting" : ""}`}
          aria-label="Lista de notas"
        >
          {modoSeleccion ? (
            <div className="notas-select-header">
              <button
                type="button"
                className="notas-select-link"
                disabled={eliminandoVarias}
                onClick={salirModoSeleccion}
              >
                Cancelar
              </button>
              <p className="notas-select-status">
                {idsSeleccionados.size > 0
                  ? `${idsSeleccionados.size} seleccionada${idsSeleccionados.size === 1 ? "" : "s"}`
                  : "Tocá las notas a borrar"}
              </p>
              <button
                type="button"
                className="notas-select-link"
                disabled={notasPropiasFiltradas.length === 0}
                onClick={toggleTodasPropias}
              >
                {todasSeleccionadas ? "Ninguna" : "Todas"}
              </button>
            </div>
          ) : (
            <div className="notas-search-wrap">
              <div className="notas-search-field">
                <Search size={16} className="notas-search-icon" aria-hidden />
                <input
                  type="search"
                  className="notas-search-input"
                  placeholder="Buscar notas"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  aria-label="Buscar notas"
                />
              </div>
              {puedeSeleccionar ? (
                <button
                  type="button"
                  className="notas-edit-link"
                  disabled={!apiOnline}
                  onClick={() => setModoSeleccion(true)}
                >
                  Editar
                </button>
              ) : null}
            </div>
          )}

          {loading ? (
            <p className="notas-empty">Cargando notas…</p>
          ) : notasFiltradas.length === 0 ? (
            <p className="notas-empty">
              {busqueda.trim()
                ? "Sin resultados"
                : vista === "equipo"
                  ? "No hay notas compartidas del equipo todavía."
                  : "Todavía no tenés notas. Creá la primera."}
            </p>
          ) : (
            <ul className="notas-list" role="list">
              {notasFiltradas.map((nota) => {
                const propia = esNotaPropia(nota, currentUserId);
                const bulkSelected = idsSeleccionados.has(nota.id);
                const enSeleccion = modoSeleccion && propia;
                return (
                  <li key={nota.id}>
                    <button
                      type="button"
                      className={`notas-list-item notas-list-item--${nota.color}${
                        selectedId === nota.id && !modoSeleccion ? " notas-list-item--active" : ""
                      }${bulkSelected ? " notas-list-item--bulk-selected" : ""}${
                        enSeleccion ? " notas-list-item--selecting" : ""
                      }${!propia ? " notas-list-item--ajena" : ""}`}
                      aria-pressed={enSeleccion ? bulkSelected : undefined}
                      onClick={() => {
                        if (enSeleccion) toggleSeleccionNota(nota.id);
                        else seleccionar(nota, true);
                      }}
                    >
                      {enSeleccion ? (
                        <span
                          className={`notas-select-dot${bulkSelected ? " notas-select-dot--on" : ""}`}
                          aria-hidden
                        >
                          {bulkSelected ? <Check size={11} strokeWidth={3} /> : null}
                        </span>
                      ) : null}
                      <span className="notas-list-item-body">
                        <div className="notas-list-item-head">
                          <span className="notas-list-item-title">
                            {nota.fijada ? (
                              <Pin size={12} className="notas-pin-icon" aria-hidden />
                            ) : null}
                            {nota.compartida ? (
                              <Users size={12} className="notas-share-icon" aria-hidden />
                            ) : null}
                            {nota.titulo.trim() || "Sin título"}
                          </span>
                          <time className="notas-list-item-date" dateTime={nota.actualizado_en}>
                            {formatFechaNota(nota.actualizado_en)}
                          </time>
                        </div>
                        {!propia ? (
                          <p className="notas-list-item-author">{nota.autor_nombre || "Equipo"}</p>
                        ) : nota.compartidos_con.length > 0 ? (
                          <p className="notas-list-item-shared">
                            Con:{" "}
                            {nombresCompartidos(
                              nota.compartidos_con,
                              esCompartidaConTodoElEquipo(
                                nota.compartidos_con.map((u) => u.id),
                                miembrosParaCompartir
                              )
                                ? miembrosParaCompartir.length
                                : undefined
                            )}
                          </p>
                        ) : null}
                        <p className="notas-list-item-preview">
                          {previewNota(nota) || "Sin contenido"}
                        </p>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {modoSeleccion && idsSeleccionados.size > 0 ? (
            <div className="notas-select-footer">
              <button
                type="button"
                className="notas-select-delete-btn"
                disabled={!apiOnline || eliminandoVarias}
                onClick={() => void eliminarVarias()}
              >
                <Trash2 size={17} aria-hidden />
                {eliminandoVarias
                  ? "Eliminando…"
                  : `Eliminar ${idsSeleccionados.size} nota${idsSeleccionados.size === 1 ? "" : "s"}`}
              </button>
            </div>
          ) : null}
        </aside>

        <section
          className={`notas-editor notas-editor--${color}${soloLectura ? " notas-editor--readonly" : ""}`}
          aria-label="Editor de nota"
        >
          {selectedId == null ? (
            <div className="notas-editor-empty">
              <p>Elegí una nota o creá una nueva.</p>
            </div>
          ) : (
            <>
              <div className="notas-editor-toolbar">
                <button
                  type="button"
                  className="notas-back-list btn btn-secondary btn-sm"
                  onClick={() => setMobileEditor(false)}
                >
                  Notas
                </button>

                {soloLectura ? (
                  <p className="notas-readonly-banner">
                    <Users size={15} aria-hidden />
                    Compartida por <strong>{notaSeleccionada?.autor_nombre || "el equipo"}</strong>
                    {notaSeleccionada?.compartidos_con.length ? (
                      <>
                        {" "}
                        · también con {nombresCompartidos(notaSeleccionada.compartidos_con)}
                      </>
                    ) : null}
                    {" "}
                    · solo lectura
                  </p>
                ) : null}

                <div className="notas-color-picker" role="group" aria-label="Color de la nota">
                  {NOTA_COLORES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`notas-color-swatch notas-color-swatch--${c}${
                        color === c ? " notas-color-swatch--active" : ""
                      }`}
                      title={COLOR_LABELS[c]}
                      aria-label={COLOR_LABELS[c]}
                      aria-pressed={color === c}
                      disabled={!apiOnline || guardando || soloLectura}
                      onClick={() => void onColorChange(c)}
                    />
                  ))}
                </div>

                <div className="notas-editor-actions">
                  {!soloLectura ? (
                    <>
                      <button
                        type="button"
                        className="notas-icon-btn"
                        title={fijada ? "Desfijar" : "Fijar"}
                        aria-label={fijada ? "Desfijar nota" : "Fijar nota"}
                        disabled={!apiOnline || guardando}
                        onClick={() => void toggleFijar()}
                      >
                        {fijada ? <PinOff size={18} /> : <Pin size={18} />}
                      </button>
                      <button
                        type="button"
                        className="notas-icon-btn notas-icon-btn--danger"
                        title="Eliminar"
                        aria-label="Eliminar nota"
                        disabled={!apiOnline || guardando}
                        onClick={() => void eliminarNota()}
                      >
                        <Trash2 size={18} />
                      </button>
                    </>
                  ) : null}
                  <span className="notas-save-state" aria-live="polite">
                    {soloLectura
                      ? "Solo lectura"
                      : guardando
                        ? "Guardando…"
                        : dirty
                          ? "Cambios pendientes…"
                          : "Guardado"}
                  </span>
                </div>
              </div>

              {!soloLectura && puedeCompartir ? (
                <NotaCompartirPanel
                  miembros={miembrosParaCompartir}
                  seleccionados={compartidosCon}
                  disabled={!apiOnline || guardando}
                  onChange={onCompartidosChange}
                />
              ) : null}

              <input
                type="text"
                className="notas-title-input"
                placeholder="Sin título"
                value={titulo}
                onFocus={onTituloFocus}
                onChange={(e) => onTituloChange(e.target.value)}
                disabled={!apiOnline || soloLectura}
                readOnly={soloLectura}
                aria-label="Título de la nota"
              />
              <textarea
                className="notas-body-input"
                placeholder="Escribí acá…"
                value={contenido}
                onChange={(e) => onContenidoChange(e.target.value)}
                disabled={!apiOnline || soloLectura}
                readOnly={soloLectura}
                aria-label="Contenido de la nota"
              />
            </>
          )}
        </section>
      </div>
    </NotasHub>
  );
}
