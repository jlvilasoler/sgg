/** Muestra el nombre del sub-rubro en una o dos líneas para ahorrar ancho de columna. */
export default function SubRubroNombre({ nombre }: { nombre: string }) {
  const sep = " / ";
  const idx = nombre.indexOf(sep);
  if (idx === -1) {
    return <span className="col-subrubro-name-text">{nombre}</span>;
  }
  const linea1 = nombre.slice(0, idx).trim();
  const linea2 = nombre.slice(idx + sep.length).trim();
  return (
    <span className="col-subrubro-name-text col-subrubro-name-text--split">
      {linea1 ? <span className="col-subrubro-line">{linea1}</span> : null}
      {linea2 ? <span className="col-subrubro-line col-subrubro-line--sec">{linea2}</span> : null}
    </span>
  );
}
