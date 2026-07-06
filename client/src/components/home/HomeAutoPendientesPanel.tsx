import { useEffect, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, ThumbsDown, ThumbsUp } from "lucide-react";
import type { GastoAutoPendiente } from "../../types";
import { fmtDate } from "../../utils/format";
import { empresaCorta } from "../../utils";

interface Props {
  pendientes: GastoAutoPendiente[];
  loading: boolean;
  busyId: number | null;
  onAprobar: (p: GastoAutoPendiente) => void;
  onRechazar: (p: GastoAutoPendiente) => void;
  onVerTodos: () => void;
}

function formatUsd(n: number): string {
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function nombreCorto(nombre: string): string {
  const colon = nombre.lastIndexOf(":");
  if (colon >= 0) return nombre.slice(colon + 1).trim();
  const guion = nombre.lastIndexOf(" - ");
  if (guion >= 0) return nombre.slice(guion + 3).trim();
  return nombre;
}

export default function HomeAutoPendientesPanel({
  pendientes,
  loading,
  busyId,
  onAprobar,
  onRechazar,
  onVerTodos,
}: Props) {
  const [index, setIndex] = useState(0);
  const total = pendientes.length;
  const hasMultiple = total > 1;
  const actual = total > 0 ? pendientes[Math.min(index, total - 1)] : null;

  useEffect(() => {
    setIndex((prev) => Math.min(prev, Math.max(0, total - 1)));
  }, [total]);

  const irAnterior = () => {
    if (!hasMultiple) return;
    setIndex((prev) => (prev - 1 + total) % total);
  };

  const irSiguiente = () => {
    if (!hasMultiple) return;
    setIndex((prev) => (prev + 1) % total);
  };

  if (loading && total === 0) {
    return (
      <article
        className="home-auto-pendientes-kpi is-loading"
        aria-label="Cargando pagos automáticos pendientes"
        aria-busy="true"
      >
        <p className="home-auto-pendientes-kpi-kicker muted">Pendiente de aprobación</p>
        <p className="home-auto-pendientes-kpi-value muted">…</p>
        <p className="home-auto-pendientes-kpi-meta muted">…</p>
      </article>
    );
  }

  if (!actual) return null;

  const titulo = `${actual.plantilla.nombre} — ${empresaCorta(actual.plantilla.empresa)} · ${fmtDate(actual.fecha_programada)}`;
  const meta = `${nombreCorto(actual.plantilla.nombre)} · ${empresaCorta(actual.plantilla.empresa)} · ${fmtDate(actual.fecha_programada)}`;

  return (
    <article
      className="home-auto-pendientes-kpi"
      aria-label="Pago automático pendiente de aprobación"
      aria-live="polite"
    >
      <div className="home-auto-pendientes-kpi-body">
        <div className="home-auto-pendientes-kpi-head">
          <button
            type="button"
            className="home-auto-pendientes-kpi-link"
            onClick={onVerTodos}
            title="Ver en Automatización"
          >
            <span className="home-auto-pendientes-kpi-dot" aria-hidden />
            <span className="home-auto-pendientes-kpi-kicker">
              Pendiente de aprobación
              {hasMultiple ? (
                <span className="home-auto-pendientes-kpi-count">
                  {" "}
                  · {index + 1}/{total}
                </span>
              ) : null}
            </span>
            <ArrowRight size={9} className="home-auto-pendientes-kpi-arrow" aria-hidden />
          </button>
          {hasMultiple ? (
            <span className="home-auto-pendientes-kpi-nav" aria-label="Cambiar pendiente">
              <button
                type="button"
                className="home-auto-pendientes-kpi-nav-btn"
                onClick={irAnterior}
                aria-label="Pendiente anterior"
              >
                <ChevronLeft size={10} aria-hidden />
              </button>
              <button
                type="button"
                className="home-auto-pendientes-kpi-nav-btn"
                onClick={irSiguiente}
                aria-label="Pendiente siguiente"
              >
                <ChevronRight size={10} aria-hidden />
              </button>
            </span>
          ) : null}
        </div>

        <div className="home-auto-pendientes-kpi-main">
          <div className="home-auto-pendientes-kpi-copy">
            <p className="home-auto-pendientes-kpi-value" title={titulo}>
              {formatUsd(actual.plantilla.saldo_usd)}
            </p>
            <p className="home-auto-pendientes-kpi-meta" title={titulo}>
              {meta}
            </p>
          </div>

          <div className="home-auto-pendientes-kpi-actions">
            <button
              type="button"
              className="home-auto-pendientes-kpi-icon-btn home-auto-pendientes-kpi-icon-btn--no"
              disabled={busyId === actual.id}
              title="Omitir"
              aria-label={`No aprobar ${actual.plantilla.nombre}`}
              onClick={() => onRechazar(actual)}
            >
              <ThumbsDown size={14} aria-hidden />
            </button>
            <button
              type="button"
              className="home-auto-pendientes-kpi-icon-btn home-auto-pendientes-kpi-icon-btn--si"
              disabled={busyId === actual.id}
              title="Aprobar"
              aria-label={`Aprobar ${actual.plantilla.nombre}`}
              onClick={() => onAprobar(actual)}
            >
              <ThumbsUp size={14} aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
