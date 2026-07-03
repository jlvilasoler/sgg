import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Cantidad de tarjetas; recalcula flechas al cambiar */
  itemCount: number;
  ariaLabel?: string;
  /** Mensaje centrado cuando itemCount es 0 (misma estructura que con tarjetas) */
  emptyMessage?: string;
}

export default function VencImpProximosCarousel({
  children,
  itemCount,
  ariaLabel = "Próximos vencimientos",
  emptyMessage,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const hasItems = itemCount > 0;

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
    const step = Math.max(200, Math.round(el.clientWidth * 0.72));
    el.scrollBy({ left: direction * step, behavior: "smooth" });
  };

  const showNavControls = itemCount > 1;

  return (
    <div className="venc-imp-proximos-carousel">
      <div className="venc-imp-proximos-carousel-fade">
        <div ref={viewportRef} className="venc-imp-proximos-carousel-viewport">
          <div
            className={`venc-imp-proximos-carousel-track${hasItems ? "" : " venc-imp-proximos-carousel-track--empty"}`}
            role="list"
            aria-label={ariaLabel}
          >
            {hasItems ? (
              children
            ) : (
              <p className="venc-imp-proximos-empty" role="status">
                {emptyMessage ?? "No hay vencimientos en el plazo seleccionado."}
              </p>
            )}
          </div>
        </div>
      </div>
      <div
        className={`venc-imp-proximos-carousel-nav${showNavControls ? "" : " venc-imp-proximos-carousel-nav--reserved"}`}
        aria-hidden={!showNavControls}
      >
        <button
          type="button"
          className="venc-imp-proximos-carousel-btn"
          disabled={!showNavControls || !canScrollLeft}
          aria-label="Vencimientos anteriores"
          tabIndex={showNavControls ? 0 : -1}
          onClick={() => scrollCarousel(-1)}
        >
          <ChevronLeft size={18} aria-hidden />
        </button>
        <button
          type="button"
          className="venc-imp-proximos-carousel-btn"
          disabled={!showNavControls || !canScrollRight}
          aria-label="Vencimientos siguientes"
          tabIndex={showNavControls ? 0 : -1}
          onClick={() => scrollCarousel(1)}
        >
          <ChevronRight size={18} aria-hidden />
        </button>
      </div>
    </div>
  );
}
