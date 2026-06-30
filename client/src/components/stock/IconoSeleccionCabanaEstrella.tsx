interface Props {
  activo: boolean;
  nombreCabana?: string;
  onClick?: () => void;
  disabled?: boolean;
  cargando?: boolean;
  className?: string;
  /** Sin acción (p. ej. listado de salidas o equino). */
  soloLectura?: boolean;
}

function EstrellaSvg({ rellena }: { rellena: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        d="M12 3.5 14.2 9l5.8.5-4.4 3.8 1.4 5.7L12 16.2 7 18.9l1.4-5.7L4 9.5l5.8-.5L12 3.5Z"
        fill={rellena ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function IconoSeleccionCabanaEstrella({
  activo,
  nombreCabana,
  onClick,
  disabled = false,
  cargando = false,
  className = "",
  soloLectura = false,
}: Props) {
  const nombre = nombreCabana?.trim();
  const title = activo
    ? nombre
      ? `Seleccionado · ${nombre} (clic para quitar)`
      : "Seleccionado · animal de cabaña (clic para quitar)"
    : "Marcar como seleccionado de cabaña";

  const cls = `stock-seleccion-cabana-btn${activo ? " is-active" : ""}${
    cargando ? " is-loading" : ""
  }${className ? ` ${className}` : ""}`;

  if (soloLectura || !onClick) {
    if (!activo) return null;
    return (
      <span className={cls} title={nombre ? `Selección · ${nombre}` : title} aria-label={title}>
        <EstrellaSvg rellena={activo} />
      </span>
    );
  }

  return (
    <button
      type="button"
      className={cls}
      title={title}
      aria-label={title}
      aria-pressed={activo}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled || cargando}
    >
      <EstrellaSvg rellena={activo} />
    </button>
  );
}
