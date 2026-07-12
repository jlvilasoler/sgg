import { ChevronLeft, ChevronRight, Pin, Plus, StickyNote, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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

function NotaCard({
  nota,
  currentUserId,
  onOpenNota,
}: {
  nota: Nota;
  currentUserId: number;
  onOpenNota: (nota: Nota) => void;
}) {
  const titulo = tituloNotaVisible(nota.titulo);
  const preview = previewNotaTexto(nota.titulo, nota.contenido);
  const rot = rotationForNota(nota.id);
  const esCompartida = nota.compartida || nota.compartidos_con.length > 0;

  return (
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
        <span className="home-hub-note-preview">{preview || "Tocá para escribir…"}</span>
        <span className="home-hub-note-meta">
          {nota.autor_nombre && nota.usuario_id !== currentUserId ? `${nota.autor_nombre} · ` : ""}
          {formatFechaRelativa(nota.actualizado_en)}
        </span>
      </span>
    </button>
  );
}

function HomeNotasCarousel({
  itemCount,
  ariaLabel,
  children,
}: {
  itemCount: number;
  ariaLabel: string;
  children: ReactNode;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const showNav = itemCount > 1;

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
    const raf = requestAnimationFrame(() => updateArrows());
    el.addEventListener("scroll", updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", updateArrows);
      ro.disconnect();
    };
  }, [itemCount, updateArrows]);

  const scrollCarousel = (direction: -1 | 1) => {
    const el = viewportRef.current;
    if (!el) return;
    const step = Math.max(220, Math.round(el.clientWidth * 0.62));
    el.scrollBy({ left: direction * step, behavior: "smooth" });
  };

  return (
    <div className="home-hub-notes-carousel">
      <div
        className={[
          "home-hub-notes-carousel-fade",
          canScrollLeft ? "is-fade-left" : "",
          canScrollRight ? "is-fade-right" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div ref={viewportRef} className="home-hub-notes-carousel-viewport">
          <ul className="home-hub-notes-list" role="list" aria-label={ariaLabel}>
            {children}
          </ul>
        </div>
        {showNav ? (
          <div className="home-hub-notes-carousel-nav" aria-hidden={!showNav}>
            {canScrollLeft ? (
              <button
                type="button"
                className="home-hub-notes-carousel-btn home-hub-notes-carousel-btn--prev"
                aria-label="Notas anteriores"
                onClick={() => scrollCarousel(-1)}
              >
                <ChevronLeft size={18} aria-hidden />
              </button>
            ) : (
              <span className="home-hub-notes-carousel-btn-spacer" aria-hidden />
            )}
            {canScrollRight ? (
              <button
                type="button"
                className="home-hub-notes-carousel-btn home-hub-notes-carousel-btn--next"
                aria-label="Notas siguientes"
                onClick={() => scrollCarousel(1)}
              >
                <ChevronRight size={18} aria-hidden />
              </button>
            ) : (
              <span className="home-hub-notes-carousel-btn-spacer" aria-hidden />
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
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
        <HomeNotasCarousel itemCount={3} ariaLabel="Cargando notas">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={`note-skeleton-${i}`} role="listitem">
              <div className="home-hub-note-skeleton" aria-hidden />
            </li>
          ))}
        </HomeNotasCarousel>
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
      <HomeNotasCarousel itemCount={notas.length} ariaLabel="Notas del pizarrón">
        {notas.map((nota) => (
          <li key={nota.id} role="listitem">
            <NotaCard nota={nota} currentUserId={currentUserId} onOpenNota={onOpenNota} />
          </li>
        ))}
      </HomeNotasCarousel>
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
