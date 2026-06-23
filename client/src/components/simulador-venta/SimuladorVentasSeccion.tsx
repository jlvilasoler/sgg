interface Props {
  titulo: string;
  descripcion: string;
  onVolver: () => void;
  volverLabel?: string;
}

export default function SimuladorVentasSeccion({
  titulo,
  descripcion,
  onVolver,
  volverLabel = "Volver al simulador de ventas",
}: Props) {
  return (
    <div className="subseccion-panel">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ {volverLabel}
      </button>
      <div className="card">
        <div className="form-header">
          <h2>{titulo}</h2>
          <p className="muted">{descripcion}</p>
        </div>
      </div>
    </div>
  );
}
