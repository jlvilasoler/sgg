import { useMemo } from "react";
import { Beef } from "lucide-react";
import {
  CATEGORIAS_UNIDAD_GANADERA,
  formatUnidadGanadera,
  type GrupoUnidadGanadera,
} from "../../utils/dotacion-ganadera-ug";

interface Props {
  onVolver: () => void;
  volverLabel?: string;
}

const GRUPO_LABEL: Record<GrupoUnidadGanadera, string> = {
  Común: "Común",
  Hembra: "Hembras",
  Macho: "Machos",
};

function grupoClass(grupo: GrupoUnidadGanadera): string {
  if (grupo === "Hembra") return "is-hembra";
  if (grupo === "Macho") return "is-macho";
  return "is-comun";
}

export default function ConfigDotacionGanadera({
  onVolver,
  volverLabel = "Volver a Configuración SAG",
}: Props) {
  const filas = useMemo(() => [...CATEGORIAS_UNIDAD_GANADERA], []);

  return (
    <div className="subseccion-panel config-dotacion-ganadera">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ {volverLabel}
      </button>

      <section className="sg-hub-panel config-dotacion-ganadera-card" aria-labelledby="config-dotacion-title">
        <div className="sg-hub-panel-head">
          <div>
            <p className="sg-hub-panel-kicker">Referencia SAG</p>
            <h2 id="config-dotacion-title" className="sg-hub-panel-title">
              Dotación ganadera
            </h2>
            <p className="config-dotacion-ganadera-lead muted">
              Equivalencias en unidades ganaderas (UG) por categoría etaria. Se usan para
              convertir el stock a carga animal y calcular la dotación en UG/ha según la
              superficie del potrero en el mapa.
            </p>
          </div>
          <div className="config-dotacion-ganadera-head-icon" aria-hidden>
            <Beef size={22} strokeWidth={1.75} />
          </div>
        </div>

        <div className="config-dotacion-ganadera-formula" role="note">
          <strong>Dotación (UG/ha)</strong>
          <span>= Σ animales × UG de su categoría ÷ hectáreas del potrero</span>
        </div>

        <div className="config-dotacion-ganadera-table-wrap">
          <table className="config-dotacion-ganadera-table listado">
            <thead>
              <tr>
                <th scope="col">Grupo</th>
                <th scope="col">Categoría</th>
                <th scope="col" className="num">
                  Unidad ganadera
                </th>
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => (
                <tr key={fila.id}>
                  <td>
                    <span
                      className={`config-dotacion-ganadera-grupo ${grupoClass(fila.grupo)}`}
                    >
                      {GRUPO_LABEL[fila.grupo]}
                    </span>
                  </td>
                  <td>
                    <span className="config-dotacion-ganadera-categoria">{fila.categoria}</span>
                    {fila.detalle ? (
                      <span className="config-dotacion-ganadera-detalle muted">{fila.detalle}</span>
                    ) : null}
                  </td>
                  <td className="num config-dotacion-ganadera-ug">{formatUnidadGanadera(fila.ug)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="config-dotacion-ganadera-foot muted">
          1 UG equivale a una vaca de 400–450 kg de peso vivo. Los terneros y categorías
          livianas aportan menos carga; toros adultos aportan más por su mayor peso corporal.
        </p>
      </section>
    </div>
  );
}
