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
  disabled?: boolean;
  onSelect: (tool: CampoMapaTool) => void;
  onSaveClip?: () => void;
}

export default function CampoMapaToolbar({
  activeTool,
  disabled,
  onSelect,
  onSaveClip,
}: Props) {
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
