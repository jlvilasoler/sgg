import IconoDispositivoWifi from "./IconoDispositivoWifi";
import IconoSeleccionCabanaEstrella from "./IconoSeleccionCabanaEstrella";
import { FichaLabelIconSvg } from "./StockEditarFichaLabel";
import { fmtDate } from "../../utils";
import { fmtRegEquino } from "../stock-equino/stock-equina-utils";

interface Props {
  eid: string;
  vid: string;
  totalLecturas: number;
  ultimaFecha: string;
  ultimaHora?: string | null;
  esCabanaPremium?: boolean;
  nombreCabana?: string;
  iconClassName?: string;
  /** Equinos: un solo campo REG (EID-VID) en lugar de EID + VID separados. */
  modoReg?: boolean;
}

export default function StockEditarHeadPanel({
  eid,
  vid,
  totalLecturas,
  ultimaFecha,
  ultimaHora,
  esCabanaPremium = false,
  nombreCabana = "",
  iconClassName = "stock-editar-head-signal",
  modoReg = false,
}: Props) {
  const ultima =
    fmtDate(ultimaFecha) + (ultimaHora?.trim() ? ` ${ultimaHora.trim()}` : "");
  const reg = modoReg ? fmtRegEquino(eid, vid) : "";

  return (
    <div className="stock-editar-head" aria-label={modoReg ? "Registro electrónico" : "Caravana electrónica"}>
      <div className="stock-editar-head-block stock-editar-head-block--ids">
        <IconoDispositivoWifi className={iconClassName} />
        <div className="stock-editar-head-ids">
          {modoReg ? (
            <div className="stock-editar-head-id">
              <span className="stock-editar-head-id-label">REG</span>
              <span className="stock-editar-head-id-value num">{reg || "—"}</span>
            </div>
          ) : (
            <>
              <div className="stock-editar-head-id">
                <span className="stock-editar-head-id-label">EID</span>
                <span className="stock-editar-head-id-value num">{eid || "—"}</span>
              </div>
              <div className="stock-editar-head-id stock-editar-head-id--vid">
                <span className="stock-editar-head-id-label">VID</span>
                <span className="stock-editar-head-id-value num">{vid || "—"}</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="stock-editar-head-block stock-editar-head-block--metrics">
        <div className="stock-editar-head-metric">
          <span className="stock-editar-head-metric-label">Lecturas</span>
          <span className="stock-editar-head-metric-value num">
            {totalLecturas}
          </span>
        </div>
        <div className="stock-editar-head-metric">
          <span className="stock-editar-head-metric-label">Última</span>
          <span className="stock-editar-head-metric-value">{ultima || "—"}</span>
        </div>
      </div>

      {esCabanaPremium ? (
        <div className="stock-editar-head-block stock-editar-head-block--sel">
          <IconoSeleccionCabanaEstrella
            activo
            nombreCabana={nombreCabana}
            soloLectura
          />
          <span
            className="stock-editar-head-sel"
            aria-label={`Nombre: ${nombreCabana.trim() || "—"}`}
          >
            <span className="stock-editar-head-sel-icon" aria-hidden>
              <FichaLabelIconSvg icon="nombre" />
            </span>
            <span className="stock-editar-head-sel-text">
              {nombreCabana.trim() || "—"}
            </span>
          </span>
        </div>
      ) : null}
    </div>
  );
}
