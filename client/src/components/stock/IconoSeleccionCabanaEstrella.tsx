import IconoCabanaEstrellaSvg from "./IconoCabanaEstrellaSvg";

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
    <IconoCabanaEstrellaSvg filled={rellena} size={24} strokeWidth={1.75} />
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
