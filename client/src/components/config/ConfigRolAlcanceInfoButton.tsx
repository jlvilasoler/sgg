import { useId, type CSSProperties } from "react";
import { IconInfo } from "../icons/ActionIcons";
import type { HomeLayoutConfigurableRol } from "../../utils/home-layout-config";
import ConfigRolAlcancePanel from "./ConfigRolAlcancePanel";

interface Props {
  rol: HomeLayoutConfigurableRol;
  accent: string;
  rolLabel: string;
}

export default function ConfigRolAlcanceInfoButton({ rol, accent, rolLabel }: Props) {
  const tipId = useId();

  return (
    <span
      className="config-rol-alcance-info"
      style={{ "--role-section-accent": accent } as CSSProperties}
    >
      <button
        type="button"
        className="config-rol-alcance-info-btn"
        aria-label={`Alcance del perfil: ${rolLabel}`}
        aria-describedby={tipId}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <IconInfo size={13} className="config-rol-alcance-info-btn-icon" aria-hidden />
      </button>

      <span
        id={tipId}
        className="config-rol-alcance-info-popover"
        role="tooltip"
        aria-label={`Alcance del perfil: ${rolLabel}`}
      >
        <ConfigRolAlcancePanel rol={rol} accent={accent} />
      </span>
    </span>
  );
}
