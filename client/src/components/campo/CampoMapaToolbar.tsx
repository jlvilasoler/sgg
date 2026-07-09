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

function DrawColorPicker({
  drawColor,
  label,
  onDrawColorChange,
}: {
  drawColor: CampoMapaDrawColor;
  label: string;
  onDrawColorChange: (color: CampoMapaDrawColor) => void;
}) {
  return (
    <div className="campo-mapa-draw-style-section">
      <span className="campo-mapa-draw-style-label">{label}</span>
      <div className="campo-mapa-draw-color-options" role="group" aria-label={label}>
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
  );
}

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
  const [marcadorMenuOpen, setMarcadorMenuOpen] = useState(false);
  const [notaMenuOpen, setNotaMenuOpen] = useState(false);
  const dibujarMenuRef = useRef<HTMLDivElement | null>(null);
  const marcadorMenuRef = useRef<HTMLDivElement | null>(null);
  const notaMenuRef = useRef<HTMLDivElement | null>(null);

  const closeOtherMenus = (except?: "dibujar" | "marcador" | "nota") => {
    if (except !== "dibujar") setDibujarMenuOpen(false);
    if (except !== "marcador") setMarcadorMenuOpen(false);
    if (except !== "nota") setNotaMenuOpen(false);
  };

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

  useEffect(() => {
    if (!marcadorMenuOpen) return;
    const onDocClick = (event: MouseEvent) => {
      if (
        marcadorMenuRef.current &&
        !marcadorMenuRef.current.contains(event.target as Node)
      ) {
        setMarcadorMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [marcadorMenuOpen]);

  useEffect(() => {
    if (!notaMenuOpen) return;
    const onDocClick = (event: MouseEvent) => {
      if (notaMenuRef.current && !notaMenuRef.current.contains(event.target as Node)) {
        setNotaMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [notaMenuOpen]);

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
              const isMarcador = tool === "marcador";
              const isNota = tool === "nota";

              if (isMarcador) {
                return (
                  <div
                    key={tool}
                    className="campo-mapa-toolbar-menu-wrap"
                    ref={marcadorMenuRef}
                  >
                    <button
                      type="button"
                      className={`campo-mapa-toolbar-btn${activeTool === tool ? " is-active" : ""}${
                        marcadorMenuOpen ? " is-menu-open" : ""
                      }`}
                      disabled={disabled}
                      title={getToolDef(tool).label}
                      aria-label={getToolDef(tool).label}
                      aria-haspopup="menu"
                      aria-expanded={marcadorMenuOpen}
                      onClick={() => {
                        onSelect(tool);
                        setMarcadorMenuOpen((open) => !open);
                        closeOtherMenus("marcador");
                      }}
                    >
                      <Icon size={18} aria-hidden />
                      <span
                        className="campo-mapa-toolbar-color-dot"
                        style={{ backgroundColor: drawColor }}
                        aria-hidden
                      />
                    </button>
                    {marcadorMenuOpen ? (
                      <div
                        className="campo-mapa-draw-style-menu"
                        role="menu"
                        aria-label="Color del marcador"
                      >
                        <DrawColorPicker
                          drawColor={drawColor}
                          label="Color"
                          onDrawColorChange={onDrawColorChange}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              }

              if (isNota) {
                return (
                  <div key={tool} className="campo-mapa-toolbar-menu-wrap" ref={notaMenuRef}>
                    <button
                      type="button"
                      className={`campo-mapa-toolbar-btn${activeTool === tool ? " is-active" : ""}${
                        notaMenuOpen ? " is-menu-open" : ""
                      }`}
                      disabled={disabled}
                      title={getToolDef(tool).label}
                      aria-label={getToolDef(tool).label}
                      aria-haspopup="menu"
                      aria-expanded={notaMenuOpen}
                      onClick={() => {
                        onSelect(tool);
                        setNotaMenuOpen((open) => !open);
                        closeOtherMenus("nota");
                      }}
                    >
                      <Icon size={18} aria-hidden />
                      <span
                        className="campo-mapa-toolbar-color-dot"
                        style={{ backgroundColor: drawColor }}
                        aria-hidden
                      />
                    </button>
                    {notaMenuOpen ? (
                      <div
                        className="campo-mapa-draw-style-menu"
                        role="menu"
                        aria-label="Color de la nota"
                      >
                        <DrawColorPicker
                          drawColor={drawColor}
                          label="Color"
                          onDrawColorChange={onDrawColorChange}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              }

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
                        closeOtherMenus("dibujar");
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
                        <DrawColorPicker
                          drawColor={drawColor}
                          label="Color"
                          onDrawColorChange={onDrawColorChange}
                        />
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
