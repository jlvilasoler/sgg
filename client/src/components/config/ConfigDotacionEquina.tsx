import { useMemo } from "react";
import { Scale } from "lucide-react";
import { StockEquinoModuleIcon } from "../stock/StockControlSanitarioSectionTitle";
import {
  CATEGORIAS_UNIDAD_EQUINA,
  formatUnidadEquina,
  type GrupoUnidadEquina,
} from "../../utils/dotacion-equina-ug";

interface Props {
  onVolver: () => void;
  volverLabel?: string;
}

const GRUPO_LABEL: Record<GrupoUnidadEquina, string> = {
  Común: "Común",
  Hembra: "Hembras",
  Macho: "Machos",
};

const GRUPO_ORDER: GrupoUnidadEquina[] = ["Hembra", "Macho", "Común"];

function grupoClass(grupo: GrupoUnidadEquina): string {
  if (grupo === "Hembra") return "is-hembra";
  if (grupo === "Macho") return "is-macho";
  return "is-comun";
}

export default function ConfigDotacionEquina({
  onVolver,
  volverLabel = "Volver a Configuración SAG",
}: Props) {
  const filas = useMemo(() => [...CATEGORIAS_UNIDAD_EQUINA], []);

  const resumen = useMemo(() => {
    const ues = filas.map((fila) => fila.ue);
    return {
      minUe: Math.min(...ues),
      maxUe: Math.max(...ues),
      categorias: filas.length,
    };
  }, [filas]);

  return (
    <div className="subseccion-panel config-dotacion-ganadera config-dotacion-equina">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ {volverLabel}
      </button>

      <section
        className="sg-hub-panel config-dotacion-ganadera-card"
        aria-labelledby="config-dotacion-equina-title"
      >
        <header className="sg-hub-panel-head config-dotacion-ganadera-head">
          <div className="config-dotacion-ganadera-head-copy">
            <p className="sg-hub-panel-kicker">Equinos · Referencia</p>
            <h2 id="config-dotacion-equina-title" className="sg-hub-panel-title">
              Coeficientes UE por categoría
            </h2>
            <p className="config-dotacion-ganadera-lead muted">
              Equivalencias en unidades equinas (UE) según el cronograma de evolución del stock
              equino (hembra o macho por edad). Se usan en el Inicio (equinos por potrero) para
              calcular la dotación en UE/ha.
            </p>
          </div>
          <span className="config-dotacion-ganadera-head-icon config-dotacion-equina-head-icon" aria-hidden>
            <StockEquinoModuleIcon size={20} strokeWidth={1.75} />
          </span>
        </header>

        <div className="config-dotacion-ganadera-kpis" aria-label="Resumen de coeficientes">
          <article className="config-dotacion-ganadera-kpi">
            <span className="config-dotacion-ganadera-kpi-label">Categorías</span>
            <strong>{resumen.categorias}</strong>
          </article>
          <article className="config-dotacion-ganadera-kpi">
            <span className="config-dotacion-ganadera-kpi-label">Rango UE</span>
            <strong>
              {formatUnidadEquina(resumen.minUe)} – {formatUnidadEquina(resumen.maxUe)}
            </strong>
          </article>
          <article className="config-dotacion-ganadera-kpi config-dotacion-ganadera-kpi--base">
            <span className="config-dotacion-ganadera-kpi-label">Base de referencia</span>
            <strong>1 UE = yegua / caballo adulto</strong>
          </article>
        </div>

        <div className="config-dotacion-ganadera-intro">
          <div className="config-dotacion-ganadera-formula" role="note">
            <Scale size={16} aria-hidden />
            <div>
              <strong>Dotación (UE/ha)</strong>
              <span>= Σ equinos × UE de su categoría ÷ hectáreas del potrero</span>
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
                          Unidad equina
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((fila) => (
                        <tr key={fila.id}>
                          <td>
                            <span className="config-dotacion-ganadera-categoria">
                              {fila.categoria}
                            </span>
                            {fila.detalle ? (
                              <span className="config-dotacion-ganadera-detalle muted">
                                {fila.detalle}
                              </span>
                            ) : null}
                          </td>
                          <td className="num config-dotacion-ganadera-ug">
                            {formatUnidadEquina(fila.ue)}
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
          Las categorías siguen el mismo cronograma de la ficha de stock equino: potranca/potra/yegua
          y potrillo/potro/caballo o padrillo. Potrancas y potrillos aportan menos carga; padrillos
          adultos aportan un poco más. Sin sexo o edad se asume 1 UE.
        </p>
      </section>
    </div>
  );
}
