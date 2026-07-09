import { useEffect, useMemo, useState } from "react";
import { buildProductoFichaFotoCandidatos } from "./stock-producto-ficha-foto";

interface Props {
  nombre: string;
  fotoData?: string;
  alt: string;
  className?: string;
  onSinFoto?: () => void;
  onConFoto?: () => void;
}

export default function ProductoFichaFotoImg({
  nombre,
  fotoData = "",
  alt,
  className = "stock-edit-foto-img stock-producto-ficha-foto-img",
  onSinFoto,
  onConFoto,
}: Props) {
  const candidatos = useMemo(
    () => buildProductoFichaFotoCandidatos(nombre, fotoData),
    [nombre, fotoData],
  );
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    setIndice(0);
  }, [candidatos]);

  const src = candidatos[indice] ?? "";
  const agotado = !src || indice >= candidatos.length;

  useEffect(() => {
    if (agotado) onSinFoto?.();
    else onConFoto?.();
  }, [agotado, onSinFoto, onConFoto]);

  if (agotado) return null;

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setIndice((prev) => prev + 1)}
    />
  );
}
