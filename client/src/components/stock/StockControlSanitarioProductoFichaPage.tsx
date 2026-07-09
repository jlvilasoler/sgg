import type { StockDispositivoModulo } from "../../api";
import { PageModuleHeadRow } from "../PageModuleHead";
import StockControlSanitarioProductoFichaView from "./StockControlSanitarioProductoFichaView";

interface Props {
  nombre: string;
  modulo: StockDispositivoModulo;
  apiOnline: boolean;
  embedded?: boolean;
  onVolver: () => void;
  onError: (msg: string) => void;
  onSaved?: (msg: string) => void;
}

export default function StockControlSanitarioProductoFichaPage({
  nombre,
  modulo,
  apiOnline,
  embedded = false,
  onVolver,
  onError,
  onSaved,
}: Props) {
  const titulo = String(nombre ?? "").trim() || "Producto";

  const card = (
    <div className="card stock-ganadera-detalle-page stock-producto-ficha-page">
      <div className="form-header stock-ganadera-detalle-page-head">
        <PageModuleHeadRow
          icon={{ source: "hub", id: "stock_sanidad" }}
          title="Ficha del producto"
          subtitle={titulo}
        />
      </div>
      <StockControlSanitarioProductoFichaView
        nombre={nombre}
        modulo={modulo}
        apiOnline={apiOnline}
        active
        layout="page"
        onError={onError}
        onSaved={onSaved}
      />
      <footer className="subseccion-inline-foot stock-ganadera-detalle-foot stock-producto-ficha-page-foot">
        <button type="button" className="btn btn-ghost" onClick={onVolver}>
          Volver
        </button>
      </footer>
    </div>
  );

  if (embedded) {
    return <div className="stock-producto-ficha-page-embedded">{card}</div>;
  }

  return (
    <div className="subseccion-panel stock-producto-ficha-page-panel">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver a sanidad
      </button>
      {card}
    </div>
  );
}
