import type { ContribucionRuralJurisdiccionConfig } from "../types/contribucion-rural";
import type { RegimenPrimariaRuralKey } from "../types/primaria-rural";
import { REGIMEN_PRIMARIA_RURAL_LABEL } from "../types/primaria-rural";
import { SEMAFORO_VENCIMIENTO_LABEL, diasRestantesLabel } from "../utils/contribucion-rural-common";
import { escudoDepartamentoSrc } from "../utils/escudos-departamentos";
import type { TipoImpuestoVenc } from "../utils/vencimientos-impuestos-total";

function SemaforoLeyenda() {
  return (
    <ul className="venc-imp-hub-aside-leyenda" aria-label="Leyenda semáforo">
      <li>
        <span className="venc-imp-semaforo-dot venc-imp-semaforo-dot--rojo" aria-hidden /> Próximo
      </li>
      <li>
        <span className="venc-imp-semaforo-dot venc-imp-semaforo-dot--amarillo" aria-hidden /> A preparar
      </li>
      <li>
        <span className="venc-imp-semaforo-dot venc-imp-semaforo-dot--verde" aria-hidden />{" "}
        {SEMAFORO_VENCIMIENTO_LABEL.verde}
      </li>
    </ul>
  );
}

export interface VencImpHubSidebarGuideProps {
  tipoImpuesto: TipoImpuestoVenc;
  ruralListo: boolean;
  patenteListo: boolean;
  bpsListo: boolean;
  primariaListo: boolean;
  configsCuenta: ContribucionRuralJurisdiccionConfig[];
  patenteAnio?: number;
  bpsAnio?: number;
  primariaAnio?: number;
  regimenPrimaria: RegimenPrimariaRuralKey;
  djPrimaria?: { fechaLabel: string; diasRestantes: number } | null;
  primariaFuenteUrls?: { vencimientos: string; padrones: string; dj: string };
}

export default function VencImpHubSidebarGuide({
  tipoImpuesto,
  ruralListo,
  patenteListo,
  bpsListo,
  primariaListo,
  configsCuenta,
  patenteAnio,
  bpsAnio,
  primariaAnio,
  regimenPrimaria,
  djPrimaria,
  primariaFuenteUrls,
}: VencImpHubSidebarGuideProps) {
  return (
    <div className="venc-imp-hub-aside-guide">
      {tipoImpuesto === "total" && (
        <>
          <div className="venc-imp-hub-aside-block">
            <h3 className="venc-imp-hub-aside-title">Vista total</h3>
            <p className="venc-imp-hub-aside-note">
              Todos los vencimientos configurados en una sola línea de tiempo, del más cercano al más
              lejano.
            </p>
          </div>
          <div className="venc-imp-hub-aside-block">
            <h4 className="venc-imp-hub-aside-subtitle">Impuestos incluidos</h4>
            <div className="venc-imp-hub-aside-chips">
              {ruralListo &&
                configsCuenta.map((config) => (
                  <span key={config.id} className="venc-imp-hub-chip">
                    <img
                      src={escudoDepartamentoSrc(config.id)}
                      alt=""
                      className="venc-imp-hub-chip-escudo"
                      loading="lazy"
                      decoding="async"
                    />
                    {config.label}
                  </span>
                ))}
              {patenteListo && (
                <span className="venc-imp-hub-chip">
                  <img src="/logo-sucive.svg" alt="" className="venc-imp-hub-chip-escudo" loading="lazy" />
                  Patente SUCIVE
                </span>
              )}
              {bpsListo && (
                <span className="venc-imp-hub-chip">
                  <img
                    src="/logo-bps-compact.svg"
                    alt=""
                    className="venc-imp-hub-chip-escudo venc-imp-hub-chip-escudo--bps"
                    loading="lazy"
                  />
                  BPS Caja rural
                </span>
              )}
              {primariaListo && (
                <span className="venc-imp-hub-chip">
                  <img
                    src="/logo-dgi-compact.svg"
                    alt=""
                    className="venc-imp-hub-chip-escudo venc-imp-hub-chip-escudo--dgi"
                    loading="lazy"
                  />
                  Primaria (DGI)
                </span>
              )}
            </div>
          </div>
        </>
      )}

      {tipoImpuesto === "rural" && (
        <>
          <div className="venc-imp-hub-aside-block">
            <h3 className="venc-imp-hub-aside-title">Contribución rural</h3>
            <p className="venc-imp-hub-aside-note">
              Vencimientos por departamento según la modalidad configurada en su cuenta.
            </p>
          </div>
          <div className="venc-imp-hub-aside-block">
            <h4 className="venc-imp-hub-aside-subtitle">Departamentos</h4>
            <div className="venc-imp-hub-aside-chips">
              {configsCuenta.map((config) => (
                <span key={config.id} className="venc-imp-hub-chip">
                  <img
                    src={escudoDepartamentoSrc(config.id)}
                    alt=""
                    className="venc-imp-hub-chip-escudo"
                    loading="lazy"
                    decoding="async"
                  />
                  {config.label}
                </span>
              ))}
            </div>
          </div>
        </>
      )}

      {tipoImpuesto === "patente" && (
        <>
          <div className="venc-imp-hub-aside-block">
            <h3 className="venc-imp-hub-aside-title">Patente SUCIVE</h3>
            <p className="venc-imp-hub-aside-note">
              Vencimientos de patente de rodados según el calendario nacional SUCIVE.
            </p>
          </div>
          {patenteAnio != null && (
            <div className="venc-imp-hub-aside-block">
              <h4 className="venc-imp-hub-aside-subtitle">Calendario</h4>
              <div className="venc-imp-hub-aside-chips">
                <span className="venc-imp-hub-chip">
                  <img src="/logo-sucive.svg" alt="" className="venc-imp-hub-chip-escudo" loading="lazy" />
                  Nacional {patenteAnio}
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {tipoImpuesto === "bps" && (
        <>
          <div className="venc-imp-hub-aside-block">
            <h3 className="venc-imp-hub-aside-title">BPS Caja rural</h3>
            <p className="venc-imp-hub-aside-note">
              Aportes de seguridad social del personal rural según el calendario nacional BPS.
            </p>
          </div>
          {bpsAnio != null && (
            <div className="venc-imp-hub-aside-block">
              <h4 className="venc-imp-hub-aside-subtitle">Calendario</h4>
              <div className="venc-imp-hub-aside-chips">
                <span className="venc-imp-hub-chip">
                  <img
                    src="/logo-bps-compact.svg"
                    alt=""
                    className="venc-imp-hub-chip-escudo venc-imp-hub-chip-escudo--bps"
                    loading="lazy"
                  />
                  Nacional {bpsAnio}
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {tipoImpuesto === "primaria" && (
        <>
          <div className="venc-imp-hub-aside-block">
            <h3 className="venc-imp-hub-aside-title">Primaria rural (DGI)</h3>
            <p className="venc-imp-hub-aside-note">
              Impuesto de Enseñanza Primaria sobre padrones rurales. Tres cuotas anuales según calendario
              nacional DGI.
            </p>
          </div>
          <div className="venc-imp-hub-aside-block">
            <h4 className="venc-imp-hub-aside-subtitle">Régimen</h4>
            <p className="venc-imp-hub-aside-note">{REGIMEN_PRIMARIA_RURAL_LABEL[regimenPrimaria]}</p>
          </div>
          {djPrimaria && djPrimaria.diasRestantes >= 0 && (
            <div className="venc-imp-hub-aside-block venc-imp-hub-aside-block--alert">
              <h4 className="venc-imp-hub-aside-subtitle">Declaración jurada</h4>
              <p className="venc-imp-hub-aside-note">
                <strong>{djPrimaria.fechaLabel}</strong>
                <br />
                {diasRestantesLabel(djPrimaria.diasRestantes)}
              </p>
            </div>
          )}
          {primariaAnio != null && (
            <div className="venc-imp-hub-aside-block">
              <h4 className="venc-imp-hub-aside-subtitle">Calendario</h4>
              <div className="venc-imp-hub-aside-chips">
                <span className="venc-imp-hub-chip">
                  <img
                    src="/logo-dgi-compact.svg"
                    alt=""
                    className="venc-imp-hub-chip-escudo venc-imp-hub-chip-escudo--dgi"
                    loading="lazy"
                  />
                  Nacional {primariaAnio}
                </span>
              </div>
            </div>
          )}
          {primariaFuenteUrls && (
            <div className="venc-imp-hub-aside-block">
              <h4 className="venc-imp-hub-aside-subtitle">Enlaces DGI</h4>
              <ul className="venc-imp-hub-aside-links">
                <li>
                  <a href={primariaFuenteUrls.vencimientos} target="_blank" rel="noopener noreferrer">
                    Vencimientos
                  </a>
                </li>
                <li>
                  <a href={primariaFuenteUrls.padrones} target="_blank" rel="noopener noreferrer">
                    Padrones rurales
                  </a>
                </li>
                <li>
                  <a href={primariaFuenteUrls.dj} target="_blank" rel="noopener noreferrer">
                    Declaración jurada
                  </a>
                </li>
              </ul>
            </div>
          )}
        </>
      )}

      <div className="venc-imp-hub-aside-block">
        <h4 className="venc-imp-hub-aside-subtitle">Semáforo</h4>
        <SemaforoLeyenda />
      </div>
    </div>
  );
}
