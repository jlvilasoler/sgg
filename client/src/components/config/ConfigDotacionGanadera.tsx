import { useMemo } from "react";
import { Beef, Scale } from "lucide-react";
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

const GRUPO_ORDER: GrupoUnidadGanadera[] = ["Común", "Hembra", "Macho"];

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

  const resumen = useMemo(() => {
    const ugs = filas.map((fila) => fila.ug);
    return {
      minUg: Math.min(...ugs),
      maxUg: Math.max(...ugs),
      categorias: filas.length,
    };
  }, [filas]);

  return (
    <div className="subseccion-panel config-dotacion-ganadera">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ {volverLabel}
      </button>

      <section className="sg-hub-panel config-dotacion-ganadera-card" aria-labelledby="config-dotacion-title">
        <header className="sg-hub-panel-head config-dotacion-ganadera-head">
          <div className="config-dotacion-ganadera-head-copy">
            <p className="sg-hub-panel-kicker">Ganadería · Referencia</p>
            <h2 id="config-dotacion-title" className="sg-hub-panel-title">
              Coeficientes UG por categoría
            </h2>
            <p className="config-dotacion-ganadera-lead muted">
              Equivalencias en unidades ganaderas (UG) por categoría etaria. Se usan en el Inicio
              (stock por potrero) y en el mapa para calcular la dotación en UG/ha.
            </p>
          </div>
          <span className="config-dotacion-ganadera-head-icon" aria-hidden>
            <Beef size={20} strokeWidth={1.75} />
          </span>
        </header>

        <div className="config-dotacion-ganadera-kpis" aria-label="Resumen de coeficientes">
          <article className="config-dotacion-ganadera-kpi">
            <span className="config-dotacion-ganadera-kpi-label">Categorías</span>
            <strong>{resumen.categorias}</strong>
          </article>
          <article className="config-dotacion-ganadera-kpi">
            <span className="config-dotacion-ganadera-kpi-label">Rango UG</span>
            <strong>
              {formatUnidadGanadera(resumen.minUg)} – {formatUnidadGanadera(resumen.maxUg)}
            </strong>
          </article>
          <article className="config-dotacion-ganadera-kpi config-dotacion-ganadera-kpi--base">
            <span className="config-dotacion-ganadera-kpi-label">Base de referencia</span>
            <strong>1 UG = vaca 400–450 kg</strong>
          </article>
        </div>

        <div className="config-dotacion-ganadera-intro">
          <div className="config-dotacion-ganadera-formula" role="note">
            <Scale size={16} aria-hidden />
            <div>
              <strong>Dotación (UG/ha)</strong>
              <span>= Σ animales × UG de su categoría ÷ hectáreas del potrero</span>
            </div>
          </div>
        </div>

        <div className="config-dotacion-ganadera-groups">
          {GRUPO_ORDER.map((grupo) => {
            const rows = filas.filter((fila) => fila.grupo === grupo);
            if (rows.length === 0) return null;
            return (
              <section
                key={grupo}
                className={`config-dotacion-ganadera-group ${grupoClass(grupo)}`}
                aria-label={GRUPO_LABEL[grupo]}
              >
                <header className="config-dotacion-ganadera-group-head">
                  <span className={`config-dotacion-ganadera-grupo ${grupoClass(grupo)}`}>
                    {GRUPO_LABEL[grupo]}
                  </span>
                  <span className="config-dotacion-ganadera-group-meta muted">
                    {rows.length} categoría{rows.length === 1 ? "" : "s"}
                  </span>
                </header>

                <div className="config-dotacion-ganadera-table-wrap">
                  <table className="config-dotacion-ganadera-table">
                    <thead>
                      <tr>
                        <th scope="col">Categoría</th>
                        <th scope="col" className="num">
                          Unidad ganadera
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((fila) => (
                        <tr key={fila.id}>
                          <td>
                            <span className="config-dotacion-ganadera-categoria">{fila.categoria}</span>
                            {fila.detalle ? (
                              <span className="config-dotacion-ganadera-detalle muted">
                                {fila.detalle}
                              </span>
                            ) : null}
                          </td>
                          <td className="num config-dotacion-ganadera-ug">
                            {formatUnidadGanadera(fila.ug)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>

        <p className="config-dotacion-ganadera-foot muted">
          Los terneros y categorías livianas aportan menos carga animal; toros adultos aportan más
          por su mayor peso corporal. Los animales sin sexo o edad clasificados usan 1 UG en los
          cálculos operativos.
        </p>
      </section>
    </div>
  );
}
