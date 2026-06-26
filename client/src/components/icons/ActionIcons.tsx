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

/** Círculo con check — cerrar venta */
export function IconCerrarVenta({ size, className }: IconProps) {
  return (
    <IconBase size={size} className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="m8 12 3 3 5-6"
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

/** Estrella / destacar */
export function IconDestacar({ size, className }: IconProps) {
  return (
    <IconBase size={size} className={className}>
      <path
        d="M12 3.5 14.2 9l5.8.5-4.4 3.8 1.4 5.7L12 16.2 7 18.9l1.4-5.7L4 9.5l5.8-.5L12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

/** Documento / archivo adjunto */
export function IconDocumento({ size, className }: IconProps) {
  return (
    <IconBase size={size} className={className}>
      <path
        d="M14 3H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7l-4-4Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M14 3v4H8M10 13h4M10 17h4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </IconBase>
  );
}

/** Flecha hacia abajo a bandeja / descargar */
export function IconDescargar({ size, className }: IconProps) {
  return (
    <IconBase size={size} className={className}>
      <path
        d="M12 3v12m0 0 4-4m-4 4-4-4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

/** Planilla / CSV */
export function IconCsv({ size, className }: IconProps) {
  return (
    <IconBase size={size} className={className}>
      <path
        d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M14 3v6h6" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path
        d="M8 12.5h8M8 15h8M8 17.5h5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </IconBase>
  );
}

/** Planilla / Excel */
export function IconExcel({ size, className }: IconProps) {
  return (
    <IconBase size={size} className={className}>
      <path
        d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M14 3v6h6" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path
        d="m9 13 4 5M13 13l-4 5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

/** Documento / PDF */
export function IconPdf({ size, className }: IconProps) {
  return (
    <IconBase size={size} className={className}>
      <path
        d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M14 3v6h6" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path
        d="M8 13.5h1.4a1.1 1.1 0 0 1 0 2.2H8v-2.2Zm0 2.2V18M13 13.5v4.5m0-4.5h1.6m-1.6 2.2h1.3M17.4 13.5v4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

/** Círculo i / información */
export function IconInfo({ size, className }: IconProps) {
  return (
    <IconBase size={size} className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 11v5M12 8h.01"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

/** Reloj / historial */
export function IconHistorial({ size, className }: IconProps) {
  return (
    <IconBase size={size} className={className}>
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 8v4l2.5 1.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}
