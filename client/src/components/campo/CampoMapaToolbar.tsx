import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bookmark,
  Hand,
  LandPlot,
  MapPin,
  MessageSquare,
  Minus,
  Pentagon,
  Ruler,
  Scan,
} from "lucide-react";
import {
  CAMPO_MAPA_BORDER_WEIGHTS,
  type CampoMapaBorderWeight,
} from "./campo-mapa-border-weight";
import {
  CAMPO_MAPA_DRAW_COLORS,
  type CampoMapaDrawColor,
} from "./campo-mapa-draw-colors";
import { getToolDef, type CampoMapaTool } from "./campo-mapa-tools";

export const CAMPO_MAPA_TOOL_ICONS: Record<CampoMapaTool, LucideIcon> = {
  navegar: Hand,
  marcador: MapPin,
  nota: MessageSquare,
  linea: Minus,
  area: Pentagon,
  dibujar: LandPlot,
  medir_distancia: Ruler,
  medir_area: Scan,
  clip: Bookmark,
};

interface Props {
  activeTool: CampoMapaTool;
  borderWeight: CampoMapaBorderWeight;
  drawColor: CampoMapaDrawColor;
  disabled?: boolean;
  onSelect: (tool: CampoMapaTool) => void;
  onBorderWeightChange: (weight: CampoMapaBorderWeight) => void;
  onDrawColorChange: (color: CampoMapaDrawColor) => void;
  onSaveClip?: () => void;
}

export default function CampoMapaToolbar({
  activeTool,
  borderWeight,
  drawColor,
  disabled,
  onSelect,
  onBorderWeightChange,
  onDrawColorChange,
  onSaveClip,
}: Props) {
  const [dibujarMenuOpen, setDibujarMenuOpen] = useState(false);
  const dibujarMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!dibujarMenuOpen) return;
    const onDocClick = (event: MouseEvent) => {
      if (
        dibujarMenuRef.current &&
        !dibujarMenuRef.current.contains(event.target as Node)
      ) {
        setDibujarMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [dibujarMenuOpen]);

  const groups: { title: string; tools: CampoMapaTool[] }[] = [
    { title: "Navegar", tools: ["navegar"] },
    { title: "Dibujar", tools: ["marcador", "nota", "dibujar"] },
    { title: "Medir", tools: ["medir_distancia", "medir_area"] },
    { title: "Vista", tools: ["clip"] },
  ];

  return (
    <div className="campo-mapa-toolbar" role="toolbar" aria-label="Herramientas del mapa">
      {groups.map((group) => (
        <div key={group.title} className="campo-mapa-toolbar-group" role="group" aria-label={group.title}>
          <p className="campo-mapa-toolbar-title sr-only">{group.title}</p>
          <div className="campo-mapa-toolbar-buttons">
            {group.tools.map((tool) => {
              const Icon = CAMPO_MAPA_TOOL_ICONS[tool];
              const isClip = tool === "clip";
              const isDibujar = tool === "dibujar";

              if (isDibujar) {
                return (
                  <div
                    key={tool}
                    className="campo-mapa-toolbar-menu-wrap"
                    ref={dibujarMenuRef}
                  >
                    <button
                      type="button"
                      className={`campo-mapa-toolbar-btn${activeTool === tool ? " is-active" : ""}${
                        dibujarMenuOpen ? " is-menu-open" : ""
                      }`}
                      disabled={disabled}
                      title={getToolDef(tool).label}
                      aria-label={getToolDef(tool).label}
                      aria-haspopup="menu"
                      aria-expanded={dibujarMenuOpen}
                      onClick={() => {
                        onSelect(tool);
                        setDibujarMenuOpen((open) => !open);
                      }}
                    >
                      <Icon size={18} aria-hidden />
                      <span
                        className="campo-mapa-toolbar-color-dot"
                        style={{ backgroundColor: drawColor }}
                        aria-hidden
                      />
                    </button>
                    {dibujarMenuOpen ? (
                      <div
                        className="campo-mapa-draw-style-menu"
                        role="menu"
                        aria-label="Estilo del dibujo"
                      >
                        <div className="campo-mapa-draw-style-section">
                          <span className="campo-mapa-draw-style-label">Color</span>
                          <div
                            className="campo-mapa-draw-color-options"
                            role="group"
                            aria-label="Color del trazo"
                          >
                            {CAMPO_MAPA_DRAW_COLORS.map((color) => (
                              <button
                                key={color}
                                type="button"
                                role="menuitemradio"
                                className={`campo-mapa-draw-color-option${
                                  drawColor === color ? " is-selected" : ""
                                }`}
                                aria-checked={drawColor === color}
                                title={`Color ${color}`}
                                style={{ backgroundColor: color }}
                                onClick={() => onDrawColorChange(color)}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="campo-mapa-draw-style-section">
                          <span className="campo-mapa-draw-style-label">Grosor</span>
                          <div
                            className="campo-mapa-border-weight-options"
                            role="group"
                            aria-label="Grosor del borde"
                          >
                            {CAMPO_MAPA_BORDER_WEIGHTS.map((weight) => (
                              <button
                                key={weight}
                                type="button"
                                role="menuitemradio"
                                className={`campo-mapa-border-weight-option${
                                  borderWeight === weight ? " is-selected" : ""
                                }`}
                                aria-checked={borderWeight === weight}
                                title={`Grosor ${weight}`}
                                onClick={() => onBorderWeightChange(weight)}
                              >
                                <span
                                  className="campo-mapa-border-weight-swatch"
                                  style={{ borderWidth: weight, borderColor: drawColor }}
                                  aria-hidden
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              }

              return (
                <button
                  key={tool}
                  type="button"
                  className={`campo-mapa-toolbar-btn${activeTool === tool ? " is-active" : ""}`}
                  disabled={disabled}
                  title={
                    isClip
                      ? "Guardar clip de la vista actual"
                      : getToolDef(tool).label
                  }
                  onClick={() => {
                    if (isClip) {
                      onSaveClip?.();
                      return;
                    }
                    onSelect(tool);
                  }}
                >
                  <Icon size={18} aria-hidden />
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
