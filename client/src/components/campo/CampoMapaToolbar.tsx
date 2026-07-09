import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bookmark,
  Boxes,
  Hand,
  LandPlot,
  MapPin,
  MessageSquare,
  Minus,
  Pentagon,
  PencilRuler,
  Ruler,
  Scan,
  Undo2,
} from "lucide-react";
import {
  CAMPO_MAPA_BORDER_WEIGHTS,
  type CampoMapaBorderWeight,
} from "./campo-mapa-border-weight";
import {
  CAMPO_MAPA_DRAW_COLORS,
  type CampoMapaDrawColor,
} from "./campo-mapa-draw-colors";
import {
  CAMPO_MAPA_LINE_STYLE_DEFS,
  type CampoMapaLineStyle,
} from "./campo-mapa-line-style";
import {
  CAMPO_MAPA_OBJETOS,
  getCampoMapaObjetoDef,
  type CampoMapaObjetoTipo,
} from "./campo-mapa-objetos";
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

function DrawBorderWeightPicker({
  borderWeight,
  drawColor,
  onBorderWeightChange,
}: {
  borderWeight: CampoMapaBorderWeight;
  drawColor: CampoMapaDrawColor;
  onBorderWeightChange: (weight: CampoMapaBorderWeight) => void;
}) {
  return (
    <div className="campo-mapa-draw-style-section">
      <span className="campo-mapa-draw-style-label">Grosor</span>
      <div className="campo-mapa-border-weight-options" role="group" aria-label="Grosor del borde">
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
  );
}

function DrawLineStylePicker({
  drawColor,
  lineStyle,
  onLineStyleChange,
}: {
  drawColor: CampoMapaDrawColor;
  lineStyle: CampoMapaLineStyle;
  onLineStyleChange: (style: CampoMapaLineStyle) => void;
}) {
  return (
    <div className="campo-mapa-draw-style-section">
      <span className="campo-mapa-draw-style-label">Tipo de línea</span>
      <div className="campo-mapa-line-style-options" role="group" aria-label="Tipo de línea">
        {CAMPO_MAPA_LINE_STYLE_DEFS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="menuitemradio"
            className={`campo-mapa-line-style-option${
              lineStyle === item.id ? " is-selected" : ""
            }`}
            aria-checked={lineStyle === item.id}
            title={item.label}
            onClick={() => onLineStyleChange(item.id)}
          >
            <span
              className="campo-mapa-line-style-swatch"
              style={{
                borderColor: drawColor,
                borderTopStyle:
                  item.id === "solida" ? "solid" : item.id === "punteada" ? "dotted" : "dashed",
              }}
              aria-hidden
            />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export const CAMPO_MAPA_TOOL_ICONS: Record<CampoMapaTool, LucideIcon> = {
  navegar: Hand,
  marcador: MapPin,
  nota: MessageSquare,
  objeto: Boxes,
  linea: Minus,
  area: Pentagon,
  dibujar: LandPlot,
  contorno: PencilRuler,
  medir_distancia: Ruler,
  medir_area: Scan,
  clip: Bookmark,
};

interface Props {
  activeTool: CampoMapaTool;
  borderWeight: CampoMapaBorderWeight;
  drawColor: CampoMapaDrawColor;
  lineStyle: CampoMapaLineStyle;
  objetoTipo: CampoMapaObjetoTipo;
  disabled?: boolean;
  canUndo?: boolean;
  onSelect: (tool: CampoMapaTool) => void;
  onBorderWeightChange: (weight: CampoMapaBorderWeight) => void;
  onDrawColorChange: (color: CampoMapaDrawColor) => void;
  onLineStyleChange: (style: CampoMapaLineStyle) => void;
  onObjetoTipoChange: (tipo: CampoMapaObjetoTipo) => void;
  onUndo?: () => void;
  onSaveClip?: () => void;
}

export default function CampoMapaToolbar({
  activeTool,
  borderWeight,
  drawColor,
  lineStyle,
  objetoTipo,
  disabled,
  canUndo = false,
  onSelect,
  onBorderWeightChange,
  onDrawColorChange,
  onLineStyleChange,
  onObjetoTipoChange,
  onUndo,
  onSaveClip,
}: Props) {
  const [dibujarMenuOpen, setDibujarMenuOpen] = useState(false);
  const [contornoMenuOpen, setContornoMenuOpen] = useState(false);
  const [marcadorMenuOpen, setMarcadorMenuOpen] = useState(false);
  const [notaMenuOpen, setNotaMenuOpen] = useState(false);
  const [objetoMenuOpen, setObjetoMenuOpen] = useState(false);
  const dibujarMenuRef = useRef<HTMLDivElement | null>(null);
  const contornoMenuRef = useRef<HTMLDivElement | null>(null);
  const marcadorMenuRef = useRef<HTMLDivElement | null>(null);
  const notaMenuRef = useRef<HTMLDivElement | null>(null);
  const objetoMenuRef = useRef<HTMLDivElement | null>(null);

  const closeOtherMenus = (
    except?: "dibujar" | "contorno" | "marcador" | "nota" | "objeto",
  ) => {
    if (except !== "dibujar") setDibujarMenuOpen(false);
    if (except !== "contorno") setContornoMenuOpen(false);
    if (except !== "marcador") setMarcadorMenuOpen(false);
    if (except !== "nota") setNotaMenuOpen(false);
    if (except !== "objeto") setObjetoMenuOpen(false);
  };

  useEffect(() => {
    if (!dibujarMenuOpen) return;
    const onDocClick = (event: MouseEvent) => {
      if (dibujarMenuRef.current && !dibujarMenuRef.current.contains(event.target as Node)) {
        setDibujarMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [dibujarMenuOpen]);

  useEffect(() => {
    if (!contornoMenuOpen) return;
    const onDocClick = (event: MouseEvent) => {
      if (contornoMenuRef.current && !contornoMenuRef.current.contains(event.target as Node)) {
        setContornoMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [contornoMenuOpen]);

  useEffect(() => {
    if (!marcadorMenuOpen) return;
    const onDocClick = (event: MouseEvent) => {
      if (marcadorMenuRef.current && !marcadorMenuRef.current.contains(event.target as Node)) {
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

  useEffect(() => {
    if (!objetoMenuOpen) return;
    const onDocClick = (event: MouseEvent) => {
      if (objetoMenuRef.current && !objetoMenuRef.current.contains(event.target as Node)) {
        setObjetoMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [objetoMenuOpen]);

  const objetoDef = getCampoMapaObjetoDef(objetoTipo);
  const ObjetoIcon = objetoDef.icon;

  const groups: { title: string; tools: CampoMapaTool[] }[] = [
    { title: "Navegar", tools: ["navegar"] },
    { title: "Dibujar", tools: ["marcador", "nota", "objeto", "dibujar", "contorno"] },
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
              const isContorno = tool === "contorno";
              const isMarcador = tool === "marcador";
              const isNota = tool === "nota";
              const isObjeto = tool === "objeto";

              if (isMarcador) {
                return (
                  <div key={tool} className="campo-mapa-toolbar-menu-wrap" ref={marcadorMenuRef}>
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

              if (isObjeto) {
                return (
                  <div key={tool} className="campo-mapa-toolbar-menu-wrap" ref={objetoMenuRef}>
                    <button
                      type="button"
                      className={`campo-mapa-toolbar-btn campo-mapa-toolbar-btn--objetos${
                        activeTool === tool ? " is-active" : ""
                      }${objetoMenuOpen ? " is-menu-open" : ""}`}
                      disabled={disabled}
                      title={`Objetos · ${objetoDef.label}`}
                      aria-label={`Objetos · ${objetoDef.label}`}
                      aria-haspopup="menu"
                      aria-expanded={objetoMenuOpen}
                      onClick={() => {
                        onSelect(tool);
                        setObjetoMenuOpen((open) => !open);
                        closeOtherMenus("objeto");
                      }}
                    >
                      <ObjetoIcon size={18} aria-hidden />
                      <span
                        className="campo-mapa-toolbar-color-dot"
                        style={{ backgroundColor: objetoDef.color }}
                        aria-hidden
                      />
                    </button>
                    {objetoMenuOpen ? (
                      <div
                        className="campo-mapa-draw-style-menu campo-mapa-objetos-menu"
                        role="menu"
                        aria-label="Objetos del campo"
                      >
                        <div className="campo-mapa-draw-style-section">
                          <span className="campo-mapa-draw-style-label">Objetos</span>
                          <div className="campo-mapa-objetos-grid" role="group" aria-label="Tipo de objeto">
                            {CAMPO_MAPA_OBJETOS.map((item) => {
                              const ItemIcon = item.icon;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  role="menuitemradio"
                                  className={`campo-mapa-objeto-option${
                                    objetoTipo === item.id ? " is-selected" : ""
                                  }`}
                                  aria-checked={objetoTipo === item.id}
                                  aria-label={item.label}
                                  title={item.label}
                                  onClick={() => {
                                    onObjetoTipoChange(item.id);
                                    onSelect("objeto");
                                    setObjetoMenuOpen(false);
                                  }}
                                >
                                  <span
                                    className="campo-mapa-objeto-option-icon"
                                    style={{ color: item.color, borderColor: item.color }}
                                  >
                                    <ItemIcon size={16} aria-hidden />
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              }

              if (isDibujar || isContorno) {
                const menuOpen = isDibujar ? dibujarMenuOpen : contornoMenuOpen;
                const menuRef = isDibujar ? dibujarMenuRef : contornoMenuRef;
                const menuKey = isDibujar ? "dibujar" : "contorno";
                return (
                  <div key={tool} className="campo-mapa-toolbar-menu-wrap" ref={menuRef}>
                    <button
                      type="button"
                      className={`campo-mapa-toolbar-btn${activeTool === tool ? " is-active" : ""}${
                        menuOpen ? " is-menu-open" : ""
                      }`}
                      disabled={disabled}
                      title={getToolDef(tool).label}
                      aria-label={getToolDef(tool).label}
                      aria-haspopup="menu"
                      aria-expanded={menuOpen}
                      onClick={() => {
                        onSelect(tool);
                        if (isDibujar) {
                          setDibujarMenuOpen((open) => !open);
                        } else {
                          setContornoMenuOpen((open) => !open);
                        }
                        closeOtherMenus(menuKey);
                      }}
                    >
                      <Icon size={18} aria-hidden />
                      <span
                        className="campo-mapa-toolbar-color-dot"
                        style={{ backgroundColor: drawColor }}
                        aria-hidden
                      />
                    </button>
                    {menuOpen ? (
                      <div
                        className="campo-mapa-draw-style-menu"
                        role="menu"
                        aria-label={isContorno ? "Estilo del contorno" : "Estilo del dibujo"}
                      >
                        <DrawColorPicker
                          drawColor={drawColor}
                          label="Color"
                          onDrawColorChange={onDrawColorChange}
                        />
                        {isContorno ? (
                          <DrawLineStylePicker
                            drawColor={drawColor}
                            lineStyle={lineStyle}
                            onLineStyleChange={onLineStyleChange}
                          />
                        ) : null}
                        <DrawBorderWeightPicker
                          borderWeight={borderWeight}
                          drawColor={drawColor}
                          onBorderWeightChange={onBorderWeightChange}
                        />
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
                  title={isClip ? "Guardar clip de la vista actual" : getToolDef(tool).label}
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
      {canUndo && onUndo ? (
        <div className="campo-mapa-toolbar-group" role="group" aria-label="Edición">
          <button
            type="button"
            className="campo-mapa-toolbar-btn"
            title="Deshacer último punto o marca (Ctrl+Z)"
            aria-label="Deshacer último punto o marca"
            onClick={() => onUndo()}
          >
            <Undo2 size={18} aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
}
