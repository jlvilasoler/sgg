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
import { SgHubKpi, SgMiniBars } from "../stock/SgHubUi";
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
import { confirmAction } from "../../utils/confirm";
import StockControlSanitarioSectionTitle from "../stock/StockControlSanitarioSectionTitle";
import NotaCompartirPanel, { nombresCompartidos } from "../notas/NotaCompartirPanel";
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
  asignados_user_ids: number[];
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
    asignados_user_ids: [],
    potrero_id: "",
    ubicacion: "",
  };
}

function responsablesFromTarea(t: OperativaTarea): number[] {
  if (t.asignados?.length) return t.asignados.map((a) => a.id);
  return t.asignado_user_id != null ? [t.asignado_user_id] : [];
}

function responsablesLabel(t: OperativaTarea, totalEquipo?: number): string | null {
  if (t.asignados?.length) {
    const label = nombresCompartidos(
      t.asignados.map((a) => ({ id: a.id, nombre: a.nombre })),
      totalEquipo,
    );
    return label || null;
  }
  return t.asignado_nombre;
}

function tareaToForm(t: OperativaTarea): FormState {
  return {
    titulo: t.titulo,
    notas: t.notas,
    dia_semana: (t.dia_semana ?? 0) as OperativaDiaSemana,
    asignados_user_ids: responsablesFromTarea(t),
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
  const tituloInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (!modalOpen || modalMode !== "rutina" || !puedeEditar) return;
    const t = window.setTimeout(() => tituloInputRef.current?.focus(), 80);
    return () => window.clearTimeout(t);
  }, [modalOpen, modalMode, puedeEditar]);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, saving]);

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
        asignados_user_ids: form.asignados_user_ids,
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
    const ok = await confirmAction({
      title: "Eliminar rutina",
      message: `¿Eliminar la rutina «${t.titulo}»? No se puede deshacer.`,
      confirmText: "Eliminar",
      variant: "danger",
    });
    if (!ok) return;
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
        headerActions={headerActions}
        hubClassName="tareas-op-hub"
      >
        <div className="tareas-op-workspace">
          <section className="tareas-op-hero" aria-label="Resumen del almanaque">
            <div className="tareas-op-hero-glow" aria-hidden />
            <div className="tareas-op-hero-inner">
              <div className="tareas-op-hero-copy">
                <span className="tareas-op-hero-badge">
                  <Repeat size={14} aria-hidden />
                  Rutinas semanales
                </span>
                <h2 className="tareas-op-hero-title">
                  {stats.diaSemana}
                  {isToday(selectedDate) ? (
                    <span className="tareas-op-hero-today"> · Hoy</span>
                  ) : null}
                </h2>
                <p className="tareas-op-hero-lead" role="status">
                  {loading
                    ? "Actualizando almanaque…"
                    : !apiOnline
                      ? "Sin conexión con la API"
                      : `${stats.totalRutinas} rutina${stats.totalRutinas === 1 ? "" : "s"} activas en ${cuentaNombre}`}
                </p>
              </div>
              <div className="tareas-op-hero-month" aria-hidden>
                <CalendarDays size={22} />
                <span>
                  {MESES_ES[viewMonth]} {viewYear}
                </span>
              </div>
            </div>
          </section>

          <div className="sg-hub-kpi-strip tareas-op-kpi-strip" aria-label="Resumen del día">
            <SgHubKpi
              kicker="Rutinas activas"
              value={loading ? "—" : stats.totalRutinas}
              hint="Programadas por día de la semana"
              trend="Semanal"
              bars={<SgMiniBars highlight="mid" />}
            />
            <SgHubKpi
              kicker={`Hoy · ${stats.diaSemana}`}
              value={loading ? "—" : stats.delDia}
              hint="Tareas previstas para el día seleccionado"
              trend="Día"
              bars={<SgMiniBars />}
            />
            <SgHubKpi
              kicker="Pendientes"
              value={loading ? "—" : stats.pendientes}
              hint="Sin registro de trabajo todavía"
              trend="Por hacer"
              bars={<SgMiniBars highlight="last" />}
            />
            <SgHubKpi
              variant="dark"
              kicker="Registradas"
              value={loading ? "—" : stats.registradas}
              hint={
                stats.delDia > 0
                  ? `${stats.pct}% del día completado`
                  : "Sin tareas este día"
              }
              trend={stats.delDia > 0 ? `${stats.pct}%` : "—"}
              bars={<SgMiniBars highlight="last" />}
            />
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
                                      {responsablesLabel(t, equipo.length) ? (
                                        <small className="tareas-op-day-popover-assignee">
                                          {responsablesLabel(t, equipo.length)}
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
              <div className="tareas-op-calendar-legend" aria-hidden>
                <span>
                  <i className="tareas-op-legend-dot tareas-op-legend-dot--rutina" />
                  Con rutinas
                </span>
                <span>
                  <i className="tareas-op-legend-ring" />
                  Hoy
                </span>
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
                    <ClipboardList size={26} strokeWidth={1.5} />
                  </span>
                  <p className="tareas-op-empty-title">Día tranquilo en el campo</p>
                  <p className="tareas-op-empty-text">
                    No hay rutinas para los {stats.diaSemana.toLowerCase()}. Creá una tarea semanal
                    y aparecerá acá cada semana, con registro de lo hecho.
                  </p>
                  {puedeEditar ? (
                    <button
                      type="button"
                      className="sg-hub-cta tareas-op-empty-cta"
                      onClick={() => openCreateRutina(selectedDate)}
                    >
                      <Plus size={15} aria-hidden />
                      Crear rutina
                    </button>
                  ) : null}
                </div>
              ) : null}

              {!loading && rutinasDelDia.length > 0 ? (
                <ul className="tareas-op-list">
                  {rutinasDelDia.map((t) => {
                    const registrado = tareasRegistradasIds.has(t.id);
                    return (
                      <li key={t.id} className="tareas-op-task-row">
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
                              {responsablesLabel(t, equipo.length) ? (
                                <span>
                                  <Users size={13} aria-hidden />
                                  {responsablesLabel(t, equipo.length)}
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
                        {puedeEditar ? (
                          <button
                            type="button"
                            className="tareas-op-task-delete"
                            onClick={() => void removeRutina(t)}
                            disabled={saving}
                            aria-label={`Eliminar rutina ${t.titulo}`}
                            title="Eliminar rutina"
                          >
                            <Trash2 size={16} aria-hidden />
                          </button>
                        ) : null}
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
          className="pd-overlay usuarios-form-modal-overlay tareas-op-modal-overlay bn-ui"
          onClick={closeModal}
          role="presentation"
        >
          <div
            className={`pd-dialog tareas-op-sanidad-modal${
              modalMode === "rutina" ? " tareas-op-sanidad-modal--rutina" : ""
            }`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tareas-op-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="stock-sanidad-hub-head-box tareas-op-sanidad-modal-head">
              <div className="tareas-op-sanidad-modal-head-row">
                <span className="stock-sanidad-panel-head-icon tareas-op-sanidad-modal-head-icon" aria-hidden>
                  {modalMode === "rutina" ? <Repeat size={20} /> : <ClipboardList size={20} />}
                </span>
                <div className="tareas-op-sanidad-modal-head-copy">
                  <p className="sg-hub-panel-kicker">Operaciones</p>
                  <h2 id="tareas-op-modal-title" className="stock-sanidad-hub-title">
                    {modalTitle}
                  </h2>
                  <p className="stock-sanidad-hub-sub muted">{modalSub}</p>
                </div>
              </div>
              <button
                type="button"
                className="tareas-op-sanidad-modal-close"
                onClick={closeModal}
                aria-label="Cerrar"
                disabled={saving}
              >
                <X size={18} aria-hidden />
              </button>
            </header>

            <div className="tareas-op-sanidad-modal-body">
              {modalMode === "rutina" && !editing ? (
                <div className="stock-sanidad-seleccion-bar tareas-op-sanidad-modal-guide">
                  <p>
                    Programá una tarea que se repita cada semana el mismo día. El equipo la verá en
                    el calendario operativo.
                  </p>
                </div>
              ) : null}

              {(modalMode === "rutina" || puedeEditar) && (
                <div className="stock-sanidad-hub-box stock-sanidad-hub-box--registro-form">
                  <header className="stock-sanidad-hub-head-box stock-sanidad-hub-head-box--panel">
                    <p className="sg-hub-panel-kicker">Planificación</p>
                    <h3 className="stock-sanidad-hub-title">
                      {modalMode === "ejecucion" ? "Rutina semanal" : "Datos de la rutina"}
                    </h3>
                  </header>

                  {modalMode === "ejecucion" && !puedeEditar ? (
                    <div className="tareas-op-rutina-resumen tareas-op-sanidad-modal-resumen">
                      <p>
                        <strong>{form.titulo}</strong>
                      </p>
                      <p className="tareas-op-hint">
                        Cada {OPERATIVA_DIA_SEMANA_LABELS[form.dia_semana]}
                        {lugarLabel(editing!) ? ` · ${lugarLabel(editing!)}` : ""}
                      </p>
                    </div>
                  ) : (
                    <div className="stock-sanidad-form-fields-box">
                      <div className="stock-sanidad-form-body stock-sanidad-form-body--band">
                        <section className="stock-control-sanitario-section stock-sanidad-form-section--admin tareas-op-rutina-sec tareas-op-rutina-sec--cuando">
                          <div className="stock-control-sanitario-section-head stock-control-sanitario-section-head--solo-titulo">
                            <StockControlSanitarioSectionTitle icon="admin">
                              Cuándo
                            </StockControlSanitarioSectionTitle>
                          </div>
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
                        </section>

                        <section className="stock-control-sanitario-section stock-sanidad-form-section--controles tareas-op-responsables-section tareas-op-rutina-sec tareas-op-rutina-sec--responsables">
                          <div className="stock-control-sanitario-section-head stock-control-sanitario-section-head--solo-titulo">
                            <h3 className="stock-control-sanitario-section-title stock-control-sanitario-section-title--controles">
                              <span className="stock-control-sanitario-section-title-icon" aria-hidden>
                                <Users size={14} />
                              </span>
                              <span className="stock-control-sanitario-section-title-text">
                                Responsables
                              </span>
                            </h3>
                          </div>
                          <NotaCompartirPanel
                            miembros={equipo}
                            seleccionados={form.asignados_user_ids}
                            disabled={!puedeEditar || saving}
                            onChange={(ids) =>
                              setForm((f) => ({ ...f, asignados_user_ids: ids }))
                            }
                            label="Involucrados en la rutina"
                            ariaLabel="Responsables de la rutina"
                            equipoNombre="Todo el equipo"
                            equipoDetalle={`${equipo.filter((u) => u.activo !== false).length} personas`}
                            emptyMessage="No hay usuarios en tu cuenta para asignar."
                            showMiembroRolLabel={false}
                          />
                        </section>

                        <section className="stock-control-sanitario-section stock-sanidad-form-section--controles tareas-op-rutina-sec tareas-op-rutina-sec--tarea">
                          <StockControlSanitarioSectionTitle icon="controles">
                            La tarea
                          </StockControlSanitarioSectionTitle>
                          <div className="field">
                            <label htmlFor="rutina-titulo">Qué hacer</label>
                            <input
                              ref={tituloInputRef}
                              id="rutina-titulo"
                              value={form.titulo}
                              onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                              maxLength={120}
                              disabled={!puedeEditar || saving}
                              placeholder="Ej. Revisar bebederos y alambrados"
                            />
                          </div>
                        </section>

                        <section className="stock-control-sanitario-section stock-sanidad-form-section--producto tareas-op-rutina-sec tareas-op-rutina-sec--donde">
                          <h3 className="stock-control-sanitario-section-title stock-control-sanitario-section-title--producto">
                            <span className="stock-control-sanitario-section-title-icon" aria-hidden>
                              <MapPin size={14} />
                            </span>
                            <span className="stock-control-sanitario-section-title-text">Dónde</span>
                          </h3>
                          <p className="stock-sanidad-form-hint muted tareas-op-sanidad-section-hint">
                            Elegí un potrero del mapa o describí el lugar en texto libre.
                          </p>
                          <div className="stock-sanidad-form-band-row">
                            <div className="field">
                              <label htmlFor="rutina-potrero">Potrero / lugar</label>
                              <select
                                id="rutina-potrero"
                                value={form.potrero_id}
                                onChange={(e) =>
                                  setForm((f) => ({ ...f, potrero_id: e.target.value }))
                                }
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
                                onChange={(e) =>
                                  setForm((f) => ({ ...f, ubicacion: e.target.value }))
                                }
                                placeholder="Ej. Molino, casa del capataz"
                                maxLength={120}
                                disabled={!puedeEditar || saving}
                              />
                            </div>
                          </div>
                        </section>

                        <section className="stock-control-sanitario-section stock-sanidad-form-section--admin tareas-op-rutina-sec tareas-op-rutina-sec--indicaciones">
                          <div className="stock-control-sanitario-section-head stock-control-sanitario-section-head--solo-titulo">
                            <h3 className="stock-control-sanitario-section-title stock-control-sanitario-section-title--admin">
                              <span className="stock-control-sanitario-section-title-icon" aria-hidden>
                                <ClipboardList size={14} />
                              </span>
                              <span className="stock-control-sanitario-section-title-text">
                                Indicaciones
                                <span className="tareas-op-sanidad-optional">opcional</span>
                              </span>
                            </h3>
                          </div>
                          <div className="field">
                            <label htmlFor="rutina-notas" className="sr-only">
                              Notas
                            </label>
                            <textarea
                              id="rutina-notas"
                              value={form.notas}
                              onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                              rows={2}
                              placeholder="Indicaciones para el equipo…"
                              disabled={!puedeEditar || saving}
                            />
                          </div>
                        </section>
                      </div>
                    </div>
                  )}

                  {modalMode === "ejecucion" && puedeEditar ? (
                    <div className="stock-sanidad-form-actions stock-sanidad-form-actions--head tareas-op-sanidad-inline-actions">
                      <button
                        type="button"
                        className="sg-hub-cta sg-hub-cta--ghost sg-hub-cta--compact"
                        onClick={() => void saveRutina()}
                        disabled={saving}
                      >
                        Guardar cambios de rutina
                      </button>
                    </div>
                  ) : null}
                </div>
              )}

              {modalMode === "ejecucion" && editing ? (
                <div className="stock-sanidad-hub-box tareas-op-sanidad-registros-box">
                  <header className="stock-sanidad-hub-head-box stock-sanidad-hub-head-box--panel">
                    <p className="sg-hub-panel-kicker">Registro</p>
                    <h3 className="stock-sanidad-hub-title">
                      Trabajo del {formatFechaCorta(selectedDate)}
                    </h3>
                    <p className="stock-sanidad-hub-sub muted">
                      Qué se hizo en el campo y qué resultados se obtuvieron.
                    </p>
                  </header>

                  <div className="stock-sanidad-form-fields-box">
                    {registros.length === 0 ? (
                      <div className="tareas-op-sanidad-empty-registro">
                        <CircleDashed size={20} aria-hidden />
                        <p>Sin registro para este día todavía.</p>
                      </div>
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
                      <div className="stock-sanidad-form-body stock-sanidad-form-body--band tareas-op-registro-form">
                        <section className="stock-control-sanitario-section stock-sanidad-form-section--controles">
                          <StockControlSanitarioSectionTitle icon="controles">
                            Nuevo registro
                          </StockControlSanitarioSectionTitle>
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
                            className="sg-hub-cta sg-hub-cta--compact"
                            onClick={() => void addRegistro()}
                            disabled={saving}
                          >
                            <CheckCircle2 size={15} aria-hidden />
                            Guardar registro
                          </button>
                        </section>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            <footer className="stock-sanidad-form-actions tareas-op-sanidad-modal-footer">
              {editing && puedeEditar ? (
                <button
                  type="button"
                  className="sg-hub-cta sg-hub-cta--danger sg-hub-cta--compact"
                  onClick={() => void removeRutina(editing)}
                  disabled={saving}
                >
                  <Trash2 size={15} aria-hidden />
                  Eliminar rutina
                </button>
              ) : (
                <span />
              )}
              <div className="tareas-op-sanidad-modal-footer-actions">
                <button
                  type="button"
                  className="sg-hub-cta sg-hub-cta--ghost"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancelar
                </button>
                {puedeEditar && modalMode === "rutina" ? (
                  <button
                    type="button"
                    className="sg-hub-cta"
                    onClick={() => void saveRutina()}
                    disabled={saving}
                  >
                    {editing ? (
                      <>
                        <CheckCircle2 size={15} aria-hidden />
                        Guardar rutina
                      </>
                    ) : (
                      <>
                        <Plus size={15} aria-hidden />
                        Crear rutina
                      </>
                    )}
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
