interface Props {
  className?: string;
  size?: number;
  /** Compatibilidad con iconos stroke del hub. */
  strokeWidth?: number;
}

/**
 * Oveja de perfil (silueta). Usa máscara PNG para leerse bien a 24px
 * y hereda el color del menú con currentColor.
 */
export default function IconoOvejaOvinoSvg({
  className = "",
  size = 24,
}: Props) {
  const classes = ["icon-oveja-ovino", className].filter(Boolean).join(" ");
  return (
    <span
      className={classes}
      role="img"
      aria-hidden
      style={{
        display: "inline-block",
        flexShrink: 0,
        width: size,
        height: size,
        backgroundColor: "currentColor",
        WebkitMaskImage: "url(/icons/stock-ovino.png?v=4)",
        maskImage: "url(/icons/stock-ovino.png?v=4)",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
    />
  );
}
