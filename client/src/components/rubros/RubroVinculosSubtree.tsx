import type { RubroVinculoMapaItem } from "../../types";
import {
  agruparSubRubrosPorGrupo,
  iconoGrupo,
  iconoSubRubro,
} from "../../utils/catalogoIconos";

interface Props {
  entry: RubroVinculoMapaItem;
}

/** Grupos y sub-rubros colgando de un rubro (sin nodo rubro). */
export default function RubroVinculosSubtree({ entry }: Props) {
  const grupos = agruparSubRubrosPorGrupo(entry.sub_rubros);

  return (
    <div className="conn-diagram conn-diagram--subtree">
      <div className="conn-stem conn-stem--to-grupos" aria-hidden />
      <div className="conn-body">
        <div className="conn-spine" aria-hidden />
        <div className="conn-branches">
          {grupos.map(({ grupo, items }) => (
            <div key={`${entry.rubro_id}-${grupo}`} className="conn-branch">
              <div className="conn-grupo-line">
                <span className="conn-elbow conn-elbow--grupo" aria-hidden />
                <div className="diagrama-nodo diagrama-nodo-grupo">
                  <span className="diagrama-nodo-icon" aria-hidden>
                    {iconoGrupo(grupo)}
                  </span>
                  <span className="diagrama-nodo-label">{grupo}</span>
                  <span className="diagrama-nodo-meta muted">({items.length})</span>
                </div>
              </div>

              {items.length > 0 && (
                <div className="conn-subs-block">
                  <div className="conn-subs-drop" aria-hidden />
                  <div className="conn-subs-row">
                    <div className="conn-subs-spine" aria-hidden />
                    <div className="conn-subs-list">
                      {items.map((s) => (
                        <div
                          key={`${entry.rubro_id}-${s.nombre}`}
                          className="conn-sub-line"
                          title={`${entry.rubro} ← ${grupo} ← ${s.nombre}`}
                        >
                          <span className="conn-elbow conn-elbow--sub" aria-hidden />
                          <div className="diagrama-nodo diagrama-nodo-sub">
                            <span className="diagrama-nodo-icon" aria-hidden>
                              {iconoSubRubro(s.nombre, grupo)}
                            </span>
                            <span className="diagrama-nodo-label">{s.nombre}</span>
                            {!s.activo && <span className="badge-muted">inactivo</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
