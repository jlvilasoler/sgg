import { Bell } from "lucide-react";

export interface PlatformNotificationCardProps {
  titulo: string;
  mensaje: string;
  /** Vista previa en Config SAG: botón deshabilitado, sin acción. */
  preview?: boolean;
  dismissLabel?: string;
  dismissing?: boolean;
  onDismiss?: () => void;
}

function messageParagraphs(mensaje: string, preview: boolean): string[] {
  const text = mensaje.trim();
  if (!text) {
    return preview
      ? ["Escribí el mensaje arriba para ver cómo quedará el aviso."]
      : [];
  }
  return text.split(/\n+/).filter(Boolean);
}

export default function PlatformNotificationCard({
  titulo,
  mensaje,
  preview = false,
  dismissLabel = "Entendido",
  dismissing = false,
  onDismiss,
}: PlatformNotificationCardProps) {
  const paragraphs = messageParagraphs(mensaje, preview);
  const title = titulo.trim() || "Aviso de SAG";

  return (
    <div
      className={`empresa-gate-card platform-notification-card${preview ? " platform-notification-card--preview" : ""}`}
    >
      <div className="empresa-gate-head platform-notification-card-head">
        <span className="empresa-gate-icon" aria-hidden="true">
          <Bell size={22} strokeWidth={2.1} />
        </span>
        <div>
          {preview ? (
            <p className="platform-notification-preview-kicker">Así lo verá el usuario</p>
          ) : null}
          <h2
            id={preview ? undefined : "platform-notification-live-title"}
            className="empresa-gate-title platform-notification-card-title"
          >
            {title}
          </h2>
          {!preview ? (
            <p className="empresa-gate-sub">
              Mensaje de la plataforma SAG. Se muestra una sola vez al entrar si está vigente.
            </p>
          ) : null}
        </div>
      </div>

      <div className="platform-notification-card-body">
        {paragraphs.map((paragraph, index) => (
          <p key={`platform-notif-p-${index}`}>{paragraph}</p>
        ))}
      </div>

      <button
        type="button"
        className="btn btn-primary platform-notification-card-btn"
        onClick={preview ? undefined : onDismiss}
        disabled={preview || dismissing || !onDismiss}
        aria-disabled={preview || dismissing || !onDismiss}
      >
        {dismissing ? "Guardando…" : dismissLabel}
      </button>
    </div>
  );
}
