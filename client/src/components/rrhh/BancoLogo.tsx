import { useState } from "react";
import {
  BANCO_OTRO,
  bancoLogoSrc,
  getBancoInfoOrCustom,
  type BancoCatalogoEntry,
} from "../../constants/bancosUruguay";

interface Props {
  nombre: string;
  size?: "sm" | "md";
  className?: string;
}

function infoFromNombre(nombre: string): BancoCatalogoEntry | null {
  if (!nombre.trim() || nombre === BANCO_OTRO) return null;
  return getBancoInfoOrCustom(nombre);
}

export default function BancoLogo({ nombre, size = "md", className = "" }: Props) {
  const info = infoFromNombre(nombre);
  const [imgError, setImgError] = useState(false);
  const cls = `banco-logo banco-logo--${size} ${className}`.trim();

  if (!info) {
    return (
      <span className={`${cls} banco-logo-fallback banco-logo-fallback--otro`} aria-hidden>
        🏦
      </span>
    );
  }

  const src = bancoLogoSrc(info, size === "sm" ? 32 : 64);

  if (!src || imgError) {
    return (
      <span
        className={`${cls} banco-logo-fallback`}
        style={{ background: info.color }}
        aria-hidden
        title={info.nombre}
      >
        {info.iniciales}
      </span>
    );
  }

  return (
    <img
      className={cls}
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setImgError(true)}
    />
  );
}
