import type { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  busy?: boolean;
  children?: ReactNode;
}

/** Pantalla de arranque con dimmer hub (mismo estilo que carga de ficha sanidad). */
export default function AppBootScreen({
  title,
  subtitle,
  busy = true,
  children,
}: Props) {
  return (
    <div
      className={`app-boot-dimmer${busy ? " app-boot-dimmer--loading" : ""}`}
      role={busy ? "status" : undefined}
      aria-live="polite"
      aria-busy={busy}
    >
      <div className="app-boot-panel">
        <div className="app-boot-pulse" aria-hidden />
        <p className="app-boot-title">{title}</p>
        {subtitle ? <p className="app-boot-sub">{subtitle}</p> : null}
        {children}
      </div>
    </div>
  );
}
