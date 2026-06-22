interface Props {
  titulo: string;
  descripcion: string;
  onVolver: () => void;
}

export default function VentasIngresosSeccion({ titulo, descripcion, onVolver }: Props) {
  return (
    <div className="subseccion-panel">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver a Ingresos por ventas
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
