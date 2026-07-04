import { Pin, Plus, StickyNote, Users } from "lucide-react";
import type { Nota } from "../../types";
import {
  formatFechaRelativa,
  previewNotaTexto,
  tituloNotaVisible,
} from "./home-dashboard-format";

const ROTATIONS = [-2.4, 1.6, -0.9, 1.9, -1.7, 0.7, 2.2, -0.5, 1.1, -2.1];

function rotationForNota(id: number): number {
  return ROTATIONS[Math.abs(id) % ROTATIONS.length];
}

interface Props {
  notas: Nota[];
  loading: boolean;
  currentUserId: number;
  onOpenNota: (nota: Nota) => void;
  onNewNota: () => void;
}

export default function HomeNotasBoard({
  notas,
  loading,
  currentUserId,
  onOpenNota,
  onNewNota,
}: Props) {
  if (loading && notas.length === 0) {
    return (
      <div className="home-hub-notes-board" aria-busy="true" aria-label="Cargando notas">
        <ul className="home-hub-notes-list home-hub-notes-list--loading">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={`note-skeleton-${i}`}>
              <div className="home-hub-note-skeleton" aria-hidden />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (notas.length === 0) {
    return (
      <div className="home-hub-notes-board home-hub-notes-board--empty">
        <div className="home-hub-notes-state home-hub-notes-state--empty">
          <span className="home-hub-notes-state-icon" aria-hidden>
            <StickyNote size={24} strokeWidth={1.5} />
          </span>
          <p className="home-hub-notes-state-title">Pizarrón vacío</p>
          <p className="home-hub-notes-state-sub">
            Creá una nota y quedará pegada acá para verla cuando vuelvas.
          </p>
          <button type="button" className="home-hub-notes-cta" onClick={onNewNota}>
            <Plus size={15} aria-hidden />
            Nueva nota
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="home-hub-notes-board">
      <ul className="home-hub-notes-list">
        {notas.map((nota) => {
          const titulo = tituloNotaVisible(nota.titulo);
          const preview = previewNotaTexto(nota.titulo, nota.contenido);
          const rot = rotationForNota(nota.id);
          const esCompartida = nota.compartida || nota.compartidos_con.length > 0;
          return (
            <li key={nota.id}>
              <button
                type="button"
                className={`home-hub-note-card home-hub-note-card--${nota.color}${
                  nota.fijada ? " home-hub-note-card--pinned" : ""
                }`}
                style={{ transform: `rotate(${rot}deg)` }}
                onClick={() => onOpenNota(nota)}
                aria-label={[titulo, preview, formatFechaRelativa(nota.actualizado_en)]
                  .filter(Boolean)
                  .join(" · ")}
              >
                {nota.fijada ? (
                  <span className="home-hub-note-thumbtack" aria-hidden>
                    <Pin size={13} strokeWidth={2.25} />
                  </span>
                ) : (
                  <span className="home-hub-note-tape" aria-hidden />
                )}
                <span className="home-hub-note-body">
                  <span className="home-hub-note-head">
                    <span className="home-hub-note-title">{titulo || "Sin título"}</span>
                    {esCompartida ? (
                      <span className="home-hub-note-shared" title="Compartida con el equipo">
                        <Users size={11} strokeWidth={2.2} aria-hidden />
                        <span className="sr-only">Compartida con el equipo</span>
                      </span>
                    ) : null}
                  </span>
                  <span className="home-hub-note-preview">
                    {preview || "Tocá para escribir…"}
                  </span>
                  <span className="home-hub-note-meta">
                    {nota.autor_nombre && nota.usuario_id !== currentUserId
                      ? `${nota.autor_nombre} · `
                      : ""}
                    {formatFechaRelativa(nota.actualizado_en)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className="home-hub-notes-board-add"
        onClick={onNewNota}
        aria-label="Nueva nota en el pizarrón"
        title="Nueva nota"
      >
        <Plus size={18} aria-hidden />
      </button>
    </div>
  );
}
