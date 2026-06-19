import type { RubroVinculoMapaItem } from "../../types";
import { APP_FULL_NAME, APP_NAME } from "../../brand";
import { iconoRubro } from "../../utils/catalogoIconos";
import RubroVinculosSubtree from "./RubroVinculosSubtree";

interface Props {
  mapa: RubroVinculoMapaItem[];
  selectedRubroId: number | "";
  onSelectRubro: (id: number) => void;
}

export default function RubroVinculosMapaDiagrama({
  mapa,
  selectedRubroId,
  onSelectRubro,
}: Props) {
  return (
    <div
      className="conn-mapa-global"
      role="img"
      aria-label={`Mapa ${APP_NAME}: rubros y sub-rubros vinculados`}
    >
      <div className="conn-mapa-frame">
        <header className="conn-mapa-scg-header">
          <div className="diagrama-nodo diagrama-nodo-scg">
            <span className="diagrama-nodo-icon" aria-hidden>
              🐄
            </span>
            <span className="diagrama-nodo-label">{APP_NAME}</span>
            <span className="diagrama-nodo-scg-sub muted">
              {APP_FULL_NAME}
            </span>
          </div>
        </header>

        <div className="conn-mapa-rubros-wrap">
          <div className="conn-mapa-spine-unified" aria-hidden />

          <div className="conn-mapa-rubros">
            {mapa.map((entry) => {
              const selected = selectedRubroId === entry.rubro_id;
              return (
                <section
                  key={entry.rubro_id}
                  className={`conn-mapa-rubro-branch${selected ? " is-selected" : ""}`}
                >
                  <div className="conn-rubro-line">
                    <span className="conn-elbow conn-elbow--rubro" aria-hidden />
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
                        {!entry.rubro_activo && (
                          <span className="badge-muted">inactivo</span>
                        )}
                      </button>
                    </div>
                    <span className="conn-mapa-rubro-count muted">
                      {entry.sub_rubros.length} sub-rubro(s)
                    </span>
                  </div>

                  {entry.sub_rubros.length === 0 ? (
                    <p className="vinculos-mapa-empty muted">
                      Sin sub-rubros vinculados
                    </p>
                  ) : (
                    <div className="conn-mapa-rubro-subtree">
                      <RubroVinculosSubtree entry={entry} />
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
