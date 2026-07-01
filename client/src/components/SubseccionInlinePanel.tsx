import type { ReactNode } from "react";
import { PageModuleHeadRow, type PageIconRef } from "./PageModuleHead";

interface Props {
  onVolver: () => void;
  volverLabel?: string;
  title: string;
  description?: ReactNode;
  icon?: PageIconRef;
  headAside?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  cardClassName?: string;
  banner?: ReactNode;
}

export default function SubseccionInlinePanel({
  onVolver,
  volverLabel = "Volver",
  title,
  description,
  icon,
  headAside,
  children,
  footer,
  cardClassName = "",
  banner,
}: Props) {
  return (
    <div className="subseccion-panel">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ {volverLabel}
      </button>

      <div className={`card subseccion-inline-card ${cardClassName}`.trim()}>
        <div
          className={`form-header subseccion-inline-head${
            headAside ? " subseccion-inline-head--split" : ""
          }`.trim()}
        >
          <div className="subseccion-inline-head-main">
            {icon ? (
              <PageModuleHeadRow icon={icon} title={title} subtitle={description} />
            ) : (
              <>
                <h2>{title}</h2>
                {description ? <p className="muted">{description}</p> : null}
              </>
            )}
          </div>
          {headAside ? (
            <div className="subseccion-inline-head-aside">{headAside}</div>
          ) : null}
        </div>

        {banner}

        <div className="subseccion-inline-body">{children}</div>

        {footer ? <footer className="subseccion-inline-foot">{footer}</footer> : null}
      </div>
    </div>
  );
}
