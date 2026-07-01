import { Star } from "lucide-react";

interface Props {
  className?: string;
  size?: number;
  strokeWidth?: number;
  /** Estrella rellena (selección activa) o contorno suave (menú / inactivo). */
  filled?: boolean;
}

/** Estrella de selección de cabaña — icono unificado en menú y filas de stock. */
export default function IconoCabanaEstrellaSvg({
  className = "",
  size = 24,
  strokeWidth = 1.65,
  filled = false,
}: Props) {
  return (
    <Star
      className={className}
      size={size}
      strokeWidth={strokeWidth}
      fill="currentColor"
      fillOpacity={filled ? 1 : 0.2}
      aria-hidden
    />
  );
}
