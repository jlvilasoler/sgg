import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
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

type DayPopoverState = {
  date: string;
  left: number;
  top: number;
  placement: "above" | "below";
};

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
  const calendarFrameRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
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
  const [dayPopover, setDayPopover] = useState<DayPopoverState | null>(null);

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

  const popoverRutinas = useMemo(() => {
    if (!dayPopover) return [];
    return rutinas
      .filter((r) => rutinaEnDia(r, dayPopover.date))
      .sort((a, b) => a.titulo.localeCompare(b.titulo));
  }, [dayPopover, rutinas]);

  const tareasRegistradasIds = useMemo(
    () => new Set(registrosDia.map((r) => r.tarea_id)),
    [registrosDia],
  );

  const stats = useMemo(() => {
    const delDia = rutinasDelDia.length;
    const registradas = rutinasDelDia.filter((t) => tareasRegistradasIds.has(t.id)).length;
    const pendientes = delDia - registradas;
    const pct = delDia > 0 ? Math.round((registradas / delDia) * 100) : 0;
    return {
      totalRutinas: rutinas.length,
      delDia,
      registradas,
      pendientes,
      pct,
      diaSemana: OPERATIVA_DIA_SEMANA_LABELS[isoWeekday(selectedDate) as OperativaDiaSemana],
    };
  }, [rutinas.length, rutinasDelDia, tareasRegistradasIds, selectedDate]);

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

  useEffect(() => {
    if (!dayPopover) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDayPopover(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dayPopover]);

  useEffect(() => {
    if (!dayPopover) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if ((e.target as HTMLElement).closest?.(".tareas-op-day")) return;
      setDayPopover(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [dayPopover]);

  useLayoutEffect(() => {
    if (!dayPopover || !popoverRef.current || !calendarFrameRef.current) return;
    const pop = popoverRef.current;
    const frame = calendarFrameRef.current;
    const popWidth = pop.offsetWidth;
    const frameWidth = frame.clientWidth;
    const half = popWidth / 2 + 8;
    const clampedLeft = Math.min(Math.max(dayPopover.left, half), frameWidth - half);
    if (Math.abs(clampedLeft - dayPopover.left) > 1) {
      setDayPopover((prev) => (prev ? { ...prev, left: clampedLeft } : null));
    }
  }, [dayPopover?.date, dayPopover?.left, dayPopover?.top, dayPopover?.placement, popoverRutinas.length]);

  const openDayPopover = (iso: string, cell: HTMLButtonElement) => {
    setSelectedDate(iso);
    const frame = calendarFrameRef.current;
    if (!frame) {
      setDayPopover({ date: iso, left: 50, top: 80, placement: "below" });
      return;
    }
    const cellRect = cell.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    const centerX = cellRect.left - frameRect.left + cellRect.width / 2;
    const belowTop = cellRect.bottom - frameRect.top + 10;
    const aboveTop = cellRect.top - frameRect.top - 10;
    const preferAbove = belowTop > frame.clientHeight - 190;
    setDayPopover({
      date: iso,
      left: centerX,
      top: preferAbove ? aboveTop : belowTop,
      placement: preferAbove ? "above" : "below",
    });
  };

  const handleDayClick = (iso: string, e: React.MouseEvent<HTMLButtonElement>) => {
    if (dayPopover?.date === iso) {
      setDayPopover(null);
      return;
    }
    openDayPopover(iso, e.currentTarget);
  };

  const openCreateRutina = (dateIso?: string) => {
    setDayPopover(null);
    const iso = dateIso ?? selectedDate;
    setModalMode("rutina");
    setEditing(null);
    setForm(emptyForm(isoWeekday(iso) as OperativaDiaSemana));
    setRegistros([]);
    setRegistroTexto("");
    setRegistroResultados("");
    setModalOpen(true);
  };

  const openEjecucion = async (t: OperativaTarea) => {
    setDayPopover(null);
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
    setDayPopover(null);
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    setDayPopover(null);
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

  const goToday = () => {
    setDayPopover(null);
    const today = toIsoDate(new Date());
    setSelectedDate(today);
    const d = parseIsoDate(today);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const headerActions = puedeEditar ? (
    <button type="button" className="sg-hub-cta" onClick={() => openCreateRutina()}>
      <Plus size={16} aria-hidden />
      Nueva rutina
    </button>
  ) : null;

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
        headerActions={headerActions}
        hubClassName="tareas-op-hub"
      >
        <div className="tareas-op-workspace">
          <p className="tareas-op-periodo muted" role="status">
            {loading
              ? "Actualizando almanaque…"
              : !apiOnline
                ? "Sin conexión con la API"
                : `${stats.totalRutinas} rutina${stats.totalRutinas === 1 ? "" : "s"} activas · ${MESES_ES[viewMonth]} ${viewYear}`}
          </p>

          <div className="sg-hub-kpi-strip tareas-op-kpi-strip" aria-label="Resumen del día">
            <article className="sg-hub-kpi">
              <p className="sg-hub-kpi-kicker">Rutinas activas</p>
              <p className="sg-hub-kpi-value">{loading ? "—" : stats.totalRutinas}</p>
              <p className="sg-hub-kpi-hint">Programadas por día de la semana</p>
            </article>
            <article className="sg-hub-kpi">
              <p className="sg-hub-kpi-kicker">Hoy · {stats.diaSemana}</p>
              <p className="sg-hub-kpi-value">{loading ? "—" : stats.delDia}</p>
              <p className="sg-hub-kpi-hint">Tareas previstas para el día seleccionado</p>
            </article>
            <article className="sg-hub-kpi">
              <p className="sg-hub-kpi-kicker">Pendientes</p>
              <p className="sg-hub-kpi-value">{loading ? "—" : stats.pendientes}</p>
              <p className="sg-hub-kpi-hint">Sin registro de trabajo todavía</p>
            </article>
            <article className="sg-hub-kpi sg-hub-kpi--dark">
              <p className="sg-hub-kpi-kicker">Registradas</p>
              <p className="sg-hub-kpi-value">{loading ? "—" : stats.registradas}</p>
              <p className="sg-hub-kpi-hint">
                {stats.delDia > 0 ? `${stats.pct}% del día completado` : "Sin tareas este día"}
              </p>
            </article>
          </div>

          <div className="tareas-op-toolbar">
            <div className="tareas-op-toolbar-filters">
              <label className="tareas-op-filter">
                <span className="tareas-op-filter-label">Responsable</span>
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
            <button type="button" className="tareas-op-today-btn" onClick={goToday}>
              Ir a hoy
            </button>
          </div>

          <div className="tareas-op-grid">
            <section
              className="sg-hub-panel tareas-op-panel tareas-op-calendar"
              aria-label="Almanaque mensual"
            >
              <header className="tareas-op-panel-head">
                <div>
                  <p className="sg-hub-panel-kicker">Calendario</p>
                  <h2 className="sg-hub-panel-title">
                    <CalendarDays size={18} aria-hidden />
                    {MESES_ES[viewMonth]} {viewYear}
                  </h2>
                </div>
                <div className="tareas-op-month-nav">
                  <button
                    type="button"
                    className="tareas-op-icon-btn"
                    onClick={prevMonth}
                    aria-label="Mes anterior"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    type="button"
                    className="tareas-op-icon-btn"
                    onClick={nextMonth}
                    aria-label="Mes siguiente"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </header>

              <div className="tareas-op-calendar-frame" ref={calendarFrameRef}>
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
                          dayPopover?.date === iso ? "is-popover-open" : "",
                          isToday(iso) ? "is-today" : "",
                          !inMonth ? "is-outside" : "",
                          dayRutinas.length > 0 ? "has-rutinas" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={(e) => handleDayClick(iso, e)}
                        aria-expanded={dayPopover?.date === iso}
                        aria-haspopup="dialog"
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

                {dayPopover ? (
                  <div
                    ref={popoverRef}
                    className={`tareas-op-day-popover tareas-op-day-popover--${dayPopover.placement}`}
                    style={{ left: dayPopover.left, top: dayPopover.top }}
                    role="dialog"
                    aria-label={`Rutinas del ${formatFechaCorta(dayPopover.date)}`}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <span
                      className={`tareas-op-day-popover-arrow tareas-op-day-popover-arrow--${dayPopover.placement}`}
                      aria-hidden
                    />
                    <header className="tareas-op-day-popover-head">
                      <div>
                        <p className="tareas-op-day-popover-kicker">
                          {
                            OPERATIVA_DIA_SEMANA_LABELS[
                              isoWeekday(dayPopover.date) as OperativaDiaSemana
                            ]
                          }
                        </p>
                        <p className="tareas-op-day-popover-title">
                          {formatFechaCorta(dayPopover.date)}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="tareas-op-day-popover-close"
                        onClick={() => setDayPopover(null)}
                        aria-label="Cerrar"
                      >
                        <X size={14} aria-hidden />
                      </button>
                    </header>

                    <div className="tareas-op-day-popover-body">
                      {popoverRutinas.length === 0 ? (
                        <div className="tareas-op-day-popover-empty-wrap">
                          <p className="tareas-op-day-popover-empty">
                            No hay rutinas para este día de la semana.
                          </p>
                          {puedeEditar ? (
                            <button
                              type="button"
                              className="sg-hub-cta sg-hub-cta--compact tareas-op-day-popover-cta"
                              onClick={() => openCreateRutina(dayPopover.date)}
                            >
                              <Plus size={14} aria-hidden />
                              Crear rutina
                            </button>
                          ) : (
                            <p className="tareas-op-day-popover-hint">
                              Las rutinas se repiten cada semana según el día elegido.
                            </p>
                          )}
                        </div>
                      ) : (
                        <>
                          <ul className="tareas-op-day-popover-list">
                            {popoverRutinas.map((t) => {
                              const registrado =
                                dayPopover.date === selectedDate &&
                                tareasRegistradasIds.has(t.id);
                              return (
                                <li key={t.id}>
                                  <button
                                    type="button"
                                    className={`tareas-op-day-popover-item${registrado ? " is-done" : ""}`}
                                    onClick={() => void openEjecucion(t)}
                                  >
                                    <span className="tareas-op-day-popover-item-icon" aria-hidden>
                                      {registrado ? (
                                        <CheckCircle2 size={14} />
                                      ) : (
                                        <CircleDashed size={14} />
                                      )}
                                    </span>
                                    <span className="tareas-op-day-popover-item-body">
                                      <strong>{t.titulo}</strong>
                                      {lugarLabel(t) ? (
                                        <small>{lugarLabel(t)}</small>
                                      ) : null}
                                      {t.asignado_nombre ? (
                                        <small className="tareas-op-day-popover-assignee">
                                          {t.asignado_nombre}
                                        </small>
                                      ) : null}
                                    </span>
                                    <span
                                      className={`tareas-op-estado ${
                                        registrado
                                          ? "tareas-op-estado--hecha"
                                          : "tareas-op-estado--pendiente"
                                      }`}
                                    >
                                      {registrado ? "Hecho" : "Pend."}
                                    </span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                          {puedeEditar ? (
                            <button
                              type="button"
                              className="tareas-op-day-popover-add"
                              onClick={() => openCreateRutina(dayPopover.date)}
                            >
                              <Plus size={13} aria-hidden />
                              Agregar rutina
                            </button>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            <section
              className="sg-hub-panel tareas-op-panel tareas-op-day-panel"
              aria-label="Rutinas del día"
            >
              <header className="tareas-op-panel-head tareas-op-panel-head--stack">
                <div>
                  <p className="sg-hub-panel-kicker">Día seleccionado</p>
                  <h2 className="sg-hub-panel-title">{formatFechaLarga(selectedDate)}</h2>
                </div>
                {stats.delDia > 0 ? (
                  <div className="tareas-op-day-progress" aria-label="Avance del día">
                    <span className="tareas-op-day-progress-label">
                      {stats.registradas}/{stats.delDia} registradas
                    </span>
                    <div className="tareas-op-day-progress-track">
                      <div
                        className="tareas-op-day-progress-fill"
                        style={{ width: `${stats.pct}%` }}
                      />
                    </div>
                  </div>
                ) : null}
              </header>

              {loading ? (
                <ul className="tareas-op-skeleton-list" aria-busy="true">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <li key={`tareas-skel-${i}`}>
                      <div className="tareas-op-skeleton-row" aria-hidden>
                        <span className="tareas-op-skeleton-icon" />
                        <span className="tareas-op-skeleton-lines">
                          <span />
                          <span />
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}

              {!loading && rutinasDelDia.length === 0 ? (
                <div className="tareas-op-empty">
                  <span className="tareas-op-empty-icon" aria-hidden>
                    <ClipboardList size={22} />
                  </span>
                  <p className="tareas-op-empty-title">Sin rutinas este día</p>
                  <p className="tareas-op-empty-text">
                    No hay tareas programadas para los {stats.diaSemana.toLowerCase()}. Creá una rutina
                    semanal para que aparezca acá cada semana.
                  </p>
                  {puedeEditar ? (
                    <button
                      type="button"
                      className="sg-hub-cta tareas-op-empty-cta"
                      onClick={() => openCreateRutina(selectedDate)}
                    >
                      Crear rutina
                      <ArrowRight size={15} aria-hidden />
                    </button>
                  ) : null}
                </div>
              ) : null}

              {!loading && rutinasDelDia.length > 0 ? (
                <ul className="tareas-op-list">
                  {rutinasDelDia.map((t) => {
                    const registrado = tareasRegistradasIds.has(t.id);
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          className={`tareas-op-task-item${registrado ? " is-done" : ""}`}
                          onClick={() => void openEjecucion(t)}
                        >
                          <span className="tareas-op-task-icon" aria-hidden>
                            {registrado ? <CheckCircle2 size={18} /> : <CircleDashed size={18} />}
                          </span>
                          <div className="tareas-op-task-body">
                            <div className="tareas-op-task-top">
                              <strong>{t.titulo}</strong>
                              <span
                                className={`tareas-op-estado ${
                                  registrado
                                    ? "tareas-op-estado--hecha"
                                    : "tareas-op-estado--pendiente"
                                }`}
                              >
                                {registrado ? "Registrado" : "Pendiente"}
                              </span>
                            </div>
                            {t.notas?.trim() ? (
                              <p className="tareas-op-task-notas">{t.notas.trim()}</p>
                            ) : null}
                            <div className="tareas-op-task-meta">
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
                          </div>
                          <ArrowRight size={16} className="tareas-op-task-chevron" aria-hidden />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
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
