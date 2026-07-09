import type { CSSProperties } from "react";
import { ShieldCheck } from "lucide-react";
import type { HomeLayoutConfigurableRol } from "../../utils/home-layout-config";
import { ROL_INFO_DETALLE } from "../../types";

interface Props {
  rol: HomeLayoutConfigurableRol;
  accent: string;
}

export default function ConfigRolAlcancePanel({ rol, accent }: Props) {
  const info = ROL_INFO_DETALLE[rol];

  return (
    <section
      className="config-home-layout-section config-home-layout-section--scope"
      aria-labelledby={`config-rol-scope-${rol}`}
      style={{ "--role-section-accent": accent } as CSSProperties}
    >
      <header className="config-home-layout-section-head">
        <div className="config-home-layout-section-head-icon" aria-hidden>
          <ShieldCheck size={17} />
        </div>
        <div>
          <p className="config-home-layout-section-kicker">Alcance del perfil</p>
          <h3 id={`config-rol-scope-${rol}`}>{info.titulo}</h3>
          <p className="config-home-layout-section-lead">{info.resumen}</p>
        </div>
      </header>

      <div className="config-home-layout-scope-grid">
        {info.secciones.map((seccion) => (
          <div key={seccion.etiqueta} className="config-home-layout-scope-block">
            <p className="config-home-layout-scope-label">{seccion.etiqueta}</p>
            <ul className="config-home-layout-scope-list">
              {seccion.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {info.nota ? <p className="config-home-layout-scope-note">{info.nota}</p> : null}
    </section>
  );
}
