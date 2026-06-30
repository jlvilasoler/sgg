import IconoDispositivoWifi from "./IconoDispositivoWifi";
import IconoSeleccionCabanaEstrella from "./IconoSeleccionCabanaEstrella";
import IconoSeleccionCocarda from "./IconoSeleccionCocarda";
import { fmtDate } from "../../utils";

interface Props {
  eid: string;
  vid: string;
  totalLecturas: number;
  ultimaFecha: string;
  ultimaHora?: string | null;
  esCabanaPremium?: boolean;
  nombreCabana?: string;
  iconClassName?: string;
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
}: Props) {
  const ultima =
    fmtDate(ultimaFecha) + (ultimaHora?.trim() ? ` ${ultimaHora.trim()}` : "");

  return (
    <div className="stock-editar-head" aria-label="Caravana electrónica">
      <div className="stock-editar-head-block stock-editar-head-block--ids">
        <IconoDispositivoWifi className={iconClassName} />
        <div className="stock-editar-head-ids">
          <div className="stock-editar-head-id">
            <span className="stock-editar-head-id-label">EID</span>
            <span className="stock-editar-head-id-value num">{eid || "—"}</span>
          </div>
          <div className="stock-editar-head-id stock-editar-head-id--vid">
            <span className="stock-editar-head-id-label">VID</span>
            <span className="stock-editar-head-id-value num">{vid || "—"}</span>
          </div>
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
          {nombreCabana.trim() ? (
            <span className="stock-editar-head-sel">
              <IconoSeleccionCocarda />
              <span className="stock-editar-head-sel-text">
                {nombreCabana.trim()}
              </span>
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
