import type { ReactNode } from "react";

type IconProps = { size?: number; className?: string };

function IconBase({
  size = 16,
  className = "btn-action-icon",
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** Disco / guardar */
export function IconGuardar({ size, className }: IconProps) {
  return (
    <IconBase size={size} className={className}>
      <path
        d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M17 3v4H7V3M12 11v6M9.5 14h5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

/** Lápiz / editar */
export function IconEditar({ size, className }: IconProps) {
  return (
    <IconBase size={size} className={className}>
      <path
        d="M4 20h4l10.5-10.5a2.12 2.12 0 0 0-3-3L5 17v3Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m13.5 6.5 3 3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </IconBase>
  );
}

/** Papelera / eliminar */
export function IconEliminar({ size, className }: IconProps) {
  return (
    <IconBase size={size} className={className}>
      <path
        d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </IconBase>
  );
}

/** Plus / agregar */
export function IconAgregar({ size, className }: IconProps) {
  return (
    <IconBase size={size} className={className}>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
      />
    </IconBase>
  );
}

/** Check / confirmar */
export function IconConfirmar({ size, className }: IconProps) {
  return (
    <IconBase size={size} className={className}>
      <path
        d="m5 12 4 4 10-10"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

/** Ojo / ver detalle */
export function IconVer({ size, className }: IconProps) {
  return (
    <IconBase size={size} className={className}>
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.75" stroke="currentColor" strokeWidth="1.75" />
    </IconBase>
  );
}

/** Cruz / cancelar */
export function IconCancelar({ size, className }: IconProps) {
  return (
    <IconBase size={size} className={className}>
      <path
        d="M6 6l12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </IconBase>
  );
}
