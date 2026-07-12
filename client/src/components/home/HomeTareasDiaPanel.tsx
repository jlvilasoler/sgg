import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  ClipboardList,
  Plus,
} from "lucide-react";
import { fetchOperativaRegistrosDia, fetchOperativaTareas } from "../../api";
import type { OperativaDiaSemana, OperativaTarea } from "../../types";
import { OPERATIVA_DIA_SEMANA_LABELS } from "../../types";
import {
  formatFechaCorta,
  isoWeekday,
  toIsoDate,
} from "../operaciones/tareas-calendario";

interface Props {
  apiOnline: boolean;
  canEdit?: boolean;
  onOpen: () => void;
}

function rutinaEnDia(t: OperativaTarea, iso: string): boolean {
  if (t.dia_semana == null) return false;
  return t.dia_semana === isoWeekday(iso);
}

export default function HomeTareasDiaPanel({
  apiOnline,
  canEdit,
  onOpen,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [rutinas, setRutinas] = useState<OperativaTarea[]>([]);
  const [registrosDia, setRegistrosDia] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const hoy = useMemo(() => toIsoDate(new Date()), []);
  const diaSemana = OPERATIVA_DIA_SEMANA_LABELS[isoWeekday(hoy) as OperativaDiaSemana];

  const load = useCallback(async () => {
    if (!apiOnline) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [rutinasData, registrosData] = await Promise.all([
        fetchOperativaTareas(),
        fetchOperativaRegistrosDia(hoy),
      ]);
      setRutinas(rutinasData);
      setRegistrosDia(registrosData.map((r) => r.tarea_id));
    } catch {
      setError("No se pudieron cargar las tareas del día.");
      setRutinas([]);
      setRegistrosDia([]);
    } finally {
      setLoading(false);
    }
  }, [apiOnline, hoy]);

  useEffect(() => {
    void load();
  }, [load]);

  const rutinasDelDia = useMemo(
    () =>
      rutinas
        .filter((r) => rutinaEnDia(r, hoy))
        .sort((a, b) => a.titulo.localeCompare(b.titulo)),
    [hoy, rutinas],
  );

  const registradasSet = useMemo(() => new Set(registrosDia), [registrosDia]);
  const registradas = rutinasDelDia.filter((t) => registradasSet.has(t.id)).length;
  const pct =
    rutinasDelDia.length > 0 ? Math.round((registradas / rutinasDelDia.length) * 100) : 0;
  const puedeEditar = canEdit ?? false;

  return (
    <section className="sg-hub-panel home-hub-panel--tareas" aria-label="Tareas del día">
      <div className="home-hub-tareas-dia-shell">
        <header className="home-hub-tareas-dia-head">
          <div className="home-hub-tareas-dia-head-main">
            <p className="home-hub-tareas-dia-head-kicker">Tareas operativas</p>
            <h2 className="home-hub-tareas-dia-head-title">
              {diaSemana} · {formatFechaCorta(hoy)}
            </h2>
          </div>
          <button type="button" className="home-hub-link home-hub-tareas-dia-head-link" onClick={onOpen}>
            Abrir
            <ArrowRight size={14} aria-hidden />
          </button>
        </header>

        <div className="home-hub-tareas-dia__body">
          {loading ? (
            <ul className="home-hub-tareas-dia__list" aria-busy="true">
              {Array.from({ length: 2 }).map((_, index) => (
                <li key={`sk-${index}`} className="home-hub-tareas-dia__skeleton" aria-hidden />
              ))}
            </ul>
          ) : null}

          {!loading && error ? (
            <p className="home-hub-tareas-dia__error">{error}</p>
          ) : null}

          {!loading && !error && rutinasDelDia.length === 0 ? (
            <div className="home-hub-tareas-dia__empty">
              <span className="home-hub-tareas-dia__empty-icon" aria-hidden>
                <ClipboardList size={16} strokeWidth={1.75} />
              </span>
              <div className="home-hub-tareas-dia__empty-copy">
                <p className="home-hub-tareas-dia__empty-title">Sin rutinas hoy</p>
                <p className="home-hub-tareas-dia__empty-text">
                  No hay tareas para los {diaSemana.toLowerCase()}.
                </p>
              </div>
              {puedeEditar ? (
                <button type="button" className="home-hub-tareas-dia__empty-cta" onClick={onOpen}>
                  <Plus size={13} aria-hidden />
                  Crear rutina
                </button>
              ) : null}
            </div>
          ) : null}

          {!loading && !error && rutinasDelDia.length > 0 ? (
            <>
              <div className="home-hub-tareas-dia__progress" aria-label="Avance del día">
                <span className="home-hub-tareas-dia__progress-label">
                  {registradas}/{rutinasDelDia.length} registradas
                </span>
                <div className="home-hub-tareas-dia__progress-track">
                  <span
                    className="home-hub-tareas-dia__progress-fill"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              <ul className="home-hub-tareas-dia__list">
                {rutinasDelDia.map((tarea) => {
                  const hecha = registradasSet.has(tarea.id);
                  return (
                    <li key={tarea.id}>
                      <button
                        type="button"
                        className={`home-hub-tareas-dia__item${hecha ? " is-done" : ""}`}
                        onClick={onOpen}
                        aria-label={`${tarea.titulo}. ${hecha ? "Registrada" : "Pendiente"}`}
                      >
                        <span className="home-hub-tareas-dia__item-icon" aria-hidden>
                          {hecha ? <CheckCircle2 size={14} /> : <CircleDashed size={14} />}
                        </span>
                        <span className="home-hub-tareas-dia__item-body">
                          <strong>{tarea.titulo}</strong>
                          {tarea.notas?.trim() ? (
                            <span className="home-hub-tareas-dia__item-note">{tarea.notas.trim()}</span>
                          ) : null}
                        </span>
                        <span
                          className={`home-hub-tareas-dia__estado${hecha ? " is-done" : ""}`}
                        >
                          {hecha ? "Hecha" : "Pend."}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
