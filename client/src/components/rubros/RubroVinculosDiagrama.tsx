import type { RubroVinculoMapaItem } from "../../types";
import { iconoRubro } from "../../utils/catalogoIconos";
import RubroVinculosSubtree from "./RubroVinculosSubtree";

interface Props {
  entry: RubroVinculoMapaItem;
  onSelectRubro: (id: number) => void;
}

/** Diagrama de un solo rubro (uso puntual; el mapa completo usa RubroVinculosMapaDiagrama). */
export default function RubroVinculosDiagrama({ entry, onSelectRubro }: Props) {
  if (entry.sub_rubros.length === 0) {
    return <p className="vinculos-mapa-empty muted">Sin sub-rubros vinculados</p>;
  }

  return (
    <div
      className="conn-diagram"
      role="img"
      aria-label={`Diagrama de vínculos de ${entry.rubro}`}
    >
      <div className="conn-rubro-wrap">
        <div className="diagrama-nodo diagrama-nodo-rubro">
          <button
            type="button"
            className="diagrama-nodo-btn"
            onClick={() => onSelectRubro(entry.rubro_id)}
            title="Editar vínculos de este rubro"
          >
            <span className="diagrama-nodo-icon" aria-hidden>
              {iconoRubro(entry.rubro)}
            </span>
            <span className="diagrama-nodo-label">{entry.rubro}</span>
            {!entry.rubro_activo && <span className="badge-muted">inactivo</span>}
          </button>
        </div>
      </div>
      <div className="conn-stem" aria-hidden />
      <RubroVinculosSubtree entry={entry} />
    </div>
  );
}
