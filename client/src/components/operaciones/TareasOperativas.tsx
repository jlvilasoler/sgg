import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  MapPin,
  Plus,
  Repeat,
  Trash2,
  Users,
  X,
} from "lucide-react";
import SgHubShell from "../hub/SgHubShell";
import type { SgHubItem } from "../hub/SgHubTypes";
import { MenuAppIcon } from "../icons/MenuAppIcons";
import {
  createOperativaTarea,
  createOperativaTareaRegistro,
  deleteOperativaTarea,
  fetchCampoPotrerosMapa,
  fetchOperativaRegistrosDia,
  fetchOperativaTareaRegistros,
  fetchOperativaTareas,
  fetchUsuariosMiCuenta,
  updateOperativaTarea,
} from "../../api";
import type {
  AuthUser,
  CampoPotreroMapa,
  OperativaDiaSemana,
  OperativaTarea,
  OperativaTareaRegistro,
} from "../../types";
import { OPERATIVA_DIA_SEMANA_LABELS } from "../../types";
import { hubAsideKicker } from "../../brand";
import { canWriteTareasOperativas } from "../../utils/auth-permissions";
import {
  buildMonthCells,
  DIAS_SEMANA_CORTO,
  formatFechaCorta,
  formatFechaLarga,
  isoWeekday,
  isSameMonth,
  isToday,
  MESES_ES,
  parseIsoDate,
  toIsoDate,
} from "./tareas-calendario";

const HUB_ITEMS: SgHubItem[] = [
  {
    id: "almanaque",
    label: "Almanaque",
    subtitle: "Rutinas semanales y registro diario de trabajo",
    icon: "stock_cabana",
  },
  {
    id: "mapa",
    label: "Mapa del campo",
    subtitle: "Potreros y ubicaciones en vista satelital",
    icon: "stock_cabana",
  },
];

const DIAS_SEMANA: OperativaDiaSemana[] = [0, 1, 2, 3, 4, 5, 6];

interface Props {
  apiOnline: boolean;
  currentUser: AuthUser;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onVolver: () => void;
  onOpenMapa?: () => void;
}

type FormState = {
  titulo: string;
  notas: string;
  dia_semana: OperativaDiaSemana;
  asignado_user_id: string;
  potrero_id: string;
  ubicacion: string;
};

type ModalMode = "rutina" | "ejecucion";

function emptyForm(diaSemana: OperativaDiaSemana): FormState {
  return {
    titulo: "",
    notas: "",
    dia_semana: diaSemana,
    asignado_user_id: "",
    potrero_id: "",
    ubicacion: "",
  };
}

function tareaToForm(t: OperativaTarea): FormState {
  return {
    titulo: t.titulo,
    notas: t.notas,
    dia_semana: (t.dia_semana ?? 0) as OperativaDiaSemana,
    asignado_user_id: t.asignado_user_id != null ? String(t.asignado_user_id) : "",
    potrero_id: t.potrero_id != null ? String(t.potrero_id) : "",
    ubicacion: t.ubicacion,
  };
}

function rutinaEnDia(t: OperativaTarea, iso: string): boolean {
  if (t.dia_semana == null) return false;
  return t.dia_semana === isoWeekday(iso);
}

export default function TareasOperativas({
  apiOnline,
  currentUser,
  onError,
  onSuccess,
  onVolver,
  onOpenMapa,
}: Props) {
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const puedeEditar = canWriteTareasOperativas(currentUser);
  const cuentaNombre =
    currentUser.cuenta_actividad_nombre?.trim() ||
    currentUser.empresa_nombre?.trim() ||
    "tu cuenta";

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState(toIsoDate(now));
  const [rutinas, setRutinas] = useState<OperativaTarea[]>([]);
  const [potreros, setPotreros] = useState<CampoPotreroMapa[]>([]);
  const [equipo, setEquipo] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("rutina");
  const [editing, setEditing] = useState<OperativaTarea | null>(null);
  const [form, setForm] = useState<FormState>(() =>
    emptyForm(isoWeekday(toIsoDate(now)) as OperativaDiaSemana),
  );
  const [registros, setRegistros] = useState<OperativaTareaRegistro[]>([]);
  const [registrosDia, setRegistrosDia] = useState<OperativaTareaRegistro[]>([]);
  const [registroTexto, setRegistroTexto] = useState("");
  const [registroResultados, setRegistroResultados] = useState("");
  const [filtroAsignado, setFiltroAsignado] = useState("");

  const monthCells = useMemo(
    () => buildMonthCells(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  const rutinasPorDia = useMemo(() => {
    const map = new Map<string, OperativaTarea[]>();
    for (const cell of monthCells) {
      if (!cell) continue;
      const list = rutinas.filter((r) => rutinaEnDia(r, cell));
      if (list.length) map.set(cell, list);
    }
    return map;
  }, [rutinas, monthCells]);

  const rutinasDelDia = useMemo(
    () =>
      rutinas
        .filter((r) => rutinaEnDia(r, selectedDate))
        .sort((a, b) => a.titulo.localeCompare(b.titulo)),
    [rutinas, selectedDate],
  );

  const tareasRegistradasIds = useMemo(
    () => new Set(registrosDia.map((r) => r.tarea_id)),
    [registrosDia],
  );

  const loadData = useCallback(async () => {
    if (!apiOnline) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const filters: { asignado_user_id?: number } = {};
      if (filtroAsignado) filters.asignado_user_id = Number(filtroAsignado);
      const [rutinasData, potrerosData, equipoData] = await Promise.all([
        fetchOperativaTareas(filters),
        fetchCampoPotrerosMapa(),
        fetchUsuariosMiCuenta(),
      ]);
      setRutinas(rutinasData);
      setPotreros(potrerosData);
      setEquipo(equipoData.filter((u) => u.activo !== false));
    } catch (e) {
      onErrorRef.current(
        e instanceof Error ? e.message : "No se pudieron cargar las rutinas.",
      );
      setRutinas([]);
    } finally {
      setLoading(false);
    }
  }, [apiOnline, filtroAsignado]);

  const loadRegistrosDia = useCallback(async (fecha: string) => {
    if (!apiOnline) return;
    try {
      const rows = await fetchOperativaRegistrosDia(fecha);
      setRegistrosDia(rows);
    } catch {
      setRegistrosDia([]);
    }
  }, [apiOnline]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    void loadRegistrosDia(selectedDate);
  }, [selectedDate, loadRegistrosDia]);

  const openCreateRutina = () => {
    setModalMode("rutina");
    setEditing(null);
    setForm(emptyForm(isoWeekday(selectedDate) as OperativaDiaSemana));
    setRegistros([]);
    setRegistroTexto("");
    setRegistroResultados("");
    setModalOpen(true);
  };

  const openEjecucion = async (t: OperativaTarea) => {
    setModalMode("ejecucion");
    setEditing(t);
    setForm(tareaToForm(t));
    setRegistroTexto("");
    setRegistroResultados("");
    setModalOpen(true);
    try {
      const rows = await fetchOperativaTareaRegistros(t.id, selectedDate);
      setRegistros(rows);
    } catch {
      setRegistros([]);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const saveRutina = async () => {
    if (!puedeEditar) return;
    if (!form.titulo.trim()) {
      onError("Ingresá qué tarea se realiza.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        titulo: form.titulo.trim(),
        notas: form.notas.trim(),
        dia_semana: form.dia_semana,
        asignado_user_id: form.asignado_user_id ? Number(form.asignado_user_id) : null,
        potrero_id: form.potrero_id ? Number(form.potrero_id) : null,
        ubicacion: form.ubicacion.trim(),
      };
      if (editing && modalMode === "rutina") {
        const updated = await updateOperativaTarea(editing.id, body);
        setRutinas((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        onSuccess("Rutina actualizada.");
      } else if (editing && modalMode === "ejecucion") {
        const updated = await updateOperativaTarea(editing.id, body);
        setRutinas((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        onSuccess("Rutina actualizada.");
      } else {
        const created = await createOperativaTarea(body);
        setRutinas((prev) => [...prev, created]);
        onSuccess("Rutina creada.");
        closeModal();
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo guardar la rutina.");
    } finally {
      setSaving(false);
    }
  };

  const removeRutina = async (t: OperativaTarea) => {
    if (!puedeEditar) return;
    if (!window.confirm(`¿Eliminar la rutina "${t.titulo}"?`)) return;
    setSaving(true);
    try {
      await deleteOperativaTarea(t.id);
      setRutinas((prev) => prev.filter((item) => item.id !== t.id));
      closeModal();
      onSuccess("Rutina eliminada.");
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo eliminar.");
    } finally {
      setSaving(false);
    }
  };

  const addRegistro = async () => {
    if (!editing || !puedeEditar) return;
    if (!registroTexto.trim()) {
      onError("Ingresá qué se hizo en el trabajo.");
      return;
    }
    setSaving(true);
    try {
      const row = await createOperativaTareaRegistro(editing.id, {
        texto: registroTexto.trim(),
        ganado_detalle: registroResultados.trim(),
        fecha_ejecucion: selectedDate,
      });
      setRegistros((prev) => [row, ...prev]);
      setRegistrosDia((prev) => [row, ...prev]);
      setRegistroTexto("");
      setRegistroResultados("");
      onSuccess("Registro guardado.");
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo guardar el registro.");
    } finally {
      setSaving(false);
    }
  };

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const lugarLabel = (t: OperativaTarea): string | null => {
    const parts = [t.potrero_nombre?.trim(), t.ubicacion?.trim()].filter(Boolean);
    return parts.length ? parts.join(" · ") : null;
  };

  const modalTitle =
    modalMode === "rutina"
      ? editing
        ? "Editar rutina"
        : "Nueva rutina semanal"
      : "Registrar trabajo";

  const modalSub =
    modalMode === "rutina"
      ? "Definí qué se hace, dónde y quién lo lleva cada semana."
      : `Documentá lo hecho el ${formatFechaLarga(selectedDate)} y los resultados.`;

  return (
    <div className="sg-module-page tareas-op-module-page">
      <SgHubShell
        activeId="almanaque"
        items={HUB_ITEMS}
        onNavigate={(id) => {
          if (id === "mapa") onOpenMapa?.();
        }}
        onVolverDashboard={onVolver}
        onVolverInicio={onVolver}
        apiOnline={apiOnline}
        title="Tareas operativas"
        subtitle={`Rutinas semanales de ${cuentaNombre}: dónde ir, qué hacer y registro de resultados.`}
        asideKicker={hubAsideKicker("OPERACIONES")}
        asideTitle="Tareas"
        asideLogo={<MenuAppIcon id="tareas_operativas" />}
        navAriaLabel="Tareas operativas"
        showDashboardInNav={false}
        showApiStatus={false}
        hubClassName="tareas-op-hub"
      >
        <div className="tareas-op-workspace">
          <div className="tareas-op-toolbar">
            <div className="tareas-op-toolbar-filters">
              <label>
                Responsable
                <select
                  value={filtroAsignado}
                  onChange={(e) => setFiltroAsignado(e.target.value)}
                >
                  <option value="">Todos</option>
                  {equipo.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {puedeEditar ? (
              <button
                type="button"
                className="tareas-op-btn tareas-op-btn--primary"
                onClick={openCreateRutina}
              >
                <Plus size={16} aria-hidden />
                Nueva rutina
              </button>
            ) : null}
          </div>

          <div className="tareas-op-grid">
            <section className="tareas-op-box tareas-op-calendar" aria-label="Almanaque mensual">
              <header className="tareas-op-box-head">
                <button type="button" className="tareas-op-icon-btn" onClick={prevMonth} aria-label="Mes anterior">
                  <ChevronLeft size={18} />
                </button>
                <h2>
                  <CalendarDays size={18} aria-hidden />
                  {MESES_ES[viewMonth]} {viewYear}
                </h2>
                <button type="button" className="tareas-op-icon-btn" onClick={nextMonth} aria-label="Mes siguiente">
                  <ChevronRight size={18} />
                </button>
              </header>

              <div className="tareas-op-calendar-frame">
                <div className="tareas-op-calendar-weekdays">
                  {DIAS_SEMANA_CORTO.map((d) => (
                    <span key={d}>{d}</span>
                  ))}
                </div>

                <div className="tareas-op-calendar-cells">
                  {monthCells.map((iso, idx) => {
                    if (!iso) {
                      return <span key={`empty-${idx}`} className="tareas-op-day tareas-op-day--empty" />;
                    }
                    const dayRutinas = rutinasPorDia.get(iso) ?? [];
                    const inMonth = isSameMonth(iso, viewYear, viewMonth);
                    return (
                      <button
                        key={iso}
                        type="button"
                        className={[
                          "tareas-op-day",
                          selectedDate === iso ? "is-selected" : "",
                          isToday(iso) ? "is-today" : "",
                          !inMonth ? "is-outside" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => setSelectedDate(iso)}
                      >
                        <span className="tareas-op-day-num">{parseIsoDate(iso).getDate()}</span>
                        {dayRutinas.length > 0 ? (
                          <span className="tareas-op-day-dots" aria-hidden>
                            {dayRutinas.slice(0, 3).map((t) => (
                              <span key={t.id} className="tareas-op-dot tareas-op-dot--rutina" />
                            ))}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="tareas-op-box tareas-op-day-panel" aria-label="Rutinas del día">
              <header className="tareas-op-box-head tareas-op-box-head--stack">
                <div>
                  <p className="sg-hub-panel-kicker">Día seleccionado</p>
                  <h2>{formatFechaLarga(selectedDate)}</h2>
                </div>
              </header>

              {loading ? <p className="tareas-op-hint">Cargando rutinas…</p> : null}
              {!loading && rutinasDelDia.length === 0 ? (
                <div className="tareas-op-empty">
                  <ClipboardList size={22} aria-hidden />
                  <p>No hay rutinas programadas para este día de la semana.</p>
                  {puedeEditar ? (
                    <button
                      type="button"
                      className="tareas-op-btn tareas-op-btn--primary"
                      onClick={openCreateRutina}
                    >
                      Crear rutina
                    </button>
                  ) : null}
                </div>
              ) : null}

              <ul className="tareas-op-list">
                {rutinasDelDia.map((t) => {
                  const registrado = tareasRegistradasIds.has(t.id);
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        className="tareas-op-card"
                        onClick={() => void openEjecucion(t)}
                      >
                        <div className="tareas-op-card-top">
                          <strong>{t.titulo}</strong>
                          <span
                            className={`tareas-op-estado ${
                              registrado ? "tareas-op-estado--hecha" : "tareas-op-estado--pendiente"
                            }`}
                          >
                            {registrado ? "Registrado" : "Pendiente"}
                          </span>
                        </div>
                        <div className="tareas-op-card-meta">
                          <span>
                            <Repeat size={13} aria-hidden />
                            Cada {OPERATIVA_DIA_SEMANA_LABELS[(t.dia_semana ?? 0) as OperativaDiaSemana]}
                          </span>
                          {t.asignado_nombre ? (
                            <span>
                              <Users size={13} aria-hidden />
                              {t.asignado_nombre}
                            </span>
                          ) : null}
                          {lugarLabel(t) ? (
                            <span>
                              <MapPin size={13} aria-hidden />
                              {lugarLabel(t)}
                            </span>
                          ) : null}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        </div>
      </SgHubShell>

      {modalOpen ? (
        <div
          className="pd-overlay usuarios-form-modal-overlay bn-ui"
          onClick={closeModal}
          role="presentation"
        >
          <div
            className="pd-dialog usuarios-form-modal tareas-op-form-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tareas-op-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="usuarios-form-modal-head">
              <div className="usuarios-form-modal-head-main">
                <p className="usuarios-form-modal-kicker">Operaciones</p>
                <h2 id="tareas-op-modal-title" className="usuarios-form-modal-title">
                  {modalTitle}
                </h2>
                <p className="usuarios-form-modal-sub">{modalSub}</p>
              </div>
              <button
                type="button"
                className="usuarios-form-modal-close"
                onClick={closeModal}
                aria-label="Cerrar"
                disabled={saving}
              >
                <X size={18} aria-hidden />
              </button>
            </header>

            <div className="usuarios-form-modal-body">
              {(modalMode === "rutina" || puedeEditar) && (
                <div className="usuarios-form-modal-panel">
                  <p className="usuarios-form-modal-section-title">
                    {modalMode === "ejecucion" ? "Rutina semanal" : "Planificación"}
                  </p>
                  {modalMode === "ejecucion" && !puedeEditar ? (
                    <div className="tareas-op-rutina-resumen">
                      <p>
                        <strong>{form.titulo}</strong>
                      </p>
                      <p className="tareas-op-hint">
                        Cada {OPERATIVA_DIA_SEMANA_LABELS[form.dia_semana]}
                        {lugarLabel(editing!) ? ` · ${lugarLabel(editing!)}` : ""}
                      </p>
                    </div>
                  ) : (
                    <div className="usuarios-form-grid">
                      <div className="field">
                        <label htmlFor="rutina-dia">Día de la semana</label>
                        <select
                          id="rutina-dia"
                          value={form.dia_semana}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              dia_semana: Number(e.target.value) as OperativaDiaSemana,
                            }))
                          }
                          disabled={!puedeEditar || saving}
                        >
                          {DIAS_SEMANA.map((d) => (
                            <option key={d} value={d}>
                              {OPERATIVA_DIA_SEMANA_LABELS[d]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="rutina-asignado">Responsable</label>
                        <select
                          id="rutina-asignado"
                          value={form.asignado_user_id}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, asignado_user_id: e.target.value }))
                          }
                          disabled={!puedeEditar || saving}
                        >
                          <option value="">Sin asignar</option>
                          {equipo.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.nombre}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field usuarios-form-grid-span-full">
                        <label htmlFor="rutina-titulo">Qué hacer</label>
                        <input
                          id="rutina-titulo"
                          value={form.titulo}
                          onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                          maxLength={120}
                          disabled={!puedeEditar || saving}
                          placeholder="Ej. Revisar bebederos y alambrados"
                        />
                      </div>

                      <div className="field">
                        <label htmlFor="rutina-potrero">Potrero / lugar</label>
                        <select
                          id="rutina-potrero"
                          value={form.potrero_id}
                          onChange={(e) => setForm((f) => ({ ...f, potrero_id: e.target.value }))}
                          disabled={!puedeEditar || saving}
                        >
                          <option value="">Sin potrero del mapa</option>
                          {potreros.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nombre}
                              {p.hectareas != null ? ` (${p.hectareas} ha)` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="rutina-ubicacion">Ubicación (texto)</label>
                        <input
                          id="rutina-ubicacion"
                          value={form.ubicacion}
                          onChange={(e) => setForm((f) => ({ ...f, ubicacion: e.target.value }))}
                          placeholder="Ej. Molino, casa del capataz"
                          maxLength={120}
                          disabled={!puedeEditar || saving}
                        />
                      </div>

                      <div className="field usuarios-form-grid-span-full">
                        <label htmlFor="rutina-notas">Notas (opcional)</label>
                        <textarea
                          id="rutina-notas"
                          value={form.notas}
                          onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                          rows={2}
                          placeholder="Indicaciones para el equipo…"
                          disabled={!puedeEditar || saving}
                        />
                      </div>
                    </div>
                  )}
                  {modalMode === "ejecucion" && puedeEditar ? (
                    <button
                      type="button"
                      className="btn btn-ghost sg-hub-cta sg-hub-cta--ghost sg-hub-cta--compact tareas-op-save-rutina-inline"
                      onClick={() => void saveRutina()}
                      disabled={saving}
                    >
                      Guardar cambios de rutina
                    </button>
                  ) : null}
                </div>
              )}

              {modalMode === "ejecucion" && editing ? (
                <div className="usuarios-form-modal-panel usuarios-form-modal-panel--secondary tareas-op-registros-panel">
                  <p className="usuarios-form-modal-section-title">
                    Registro del {formatFechaCorta(selectedDate)}
                  </p>
                  <p className="usuarios-form-modal-section-hint">
                    Qué se hizo en el campo y qué resultados se obtuvieron.
                  </p>
                  {registros.length === 0 ? (
                    <p className="tareas-op-hint">Sin registro para este día.</p>
                  ) : (
                    <ul className="tareas-op-registros-list">
                      {registros.map((r) => (
                        <li key={r.id}>
                          <strong>{r.user_nombre ?? "Equipo"}</strong>
                          <p>{r.texto}</p>
                          {r.ganado_detalle ? (
                            <small>Resultados: {r.ganado_detalle}</small>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                  {puedeEditar ? (
                    <div className="tareas-op-registro-form">
                      <div className="field">
                        <label htmlFor="registro-hecho">Qué se hizo</label>
                        <textarea
                          id="registro-hecho"
                          value={registroTexto}
                          onChange={(e) => setRegistroTexto(e.target.value)}
                          rows={3}
                          placeholder="Ej. Se revisaron 8 km de alambrado, se repararon 2 postes…"
                          disabled={saving}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="registro-resultados">Resultados / observaciones</label>
                        <textarea
                          id="registro-resultados"
                          value={registroResultados}
                          onChange={(e) => setRegistroResultados(e.target.value)}
                          rows={2}
                          placeholder="Ej. Potrero listo para entrar 80 novillos el jueves…"
                          disabled={saving}
                        />
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => void addRegistro()}
                        disabled={saving}
                      >
                        Guardar registro
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <footer className="usuarios-form-modal-footer tareas-op-form-modal-footer">
              {editing && puedeEditar ? (
                <button
                  type="button"
                  className="btn btn-ghost sg-hub-cta sg-hub-cta--danger sg-hub-cta--compact"
                  onClick={() => void removeRutina(editing)}
                  disabled={saving}
                >
                  <Trash2 size={15} aria-hidden />
                  Eliminar rutina
                </button>
              ) : (
                <span />
              )}
              <div className="tareas-op-form-modal-footer-actions">
                <button
                  type="button"
                  className="btn btn-ghost usuarios-form-modal-cancel"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancelar
                </button>
                {puedeEditar && modalMode === "rutina" ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void saveRutina()}
                    disabled={saving}
                  >
                    {editing ? "Guardar rutina" : "Crear rutina"}
                  </button>
                ) : null}
              </div>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
