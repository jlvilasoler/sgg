import {
  diasRestantesLabel,
  semaforoVencimientoCuota,
} from "../../utils/contribucion-rural-common";
import type { VencImpCuotaConsolidada } from "../../utils/vencimientos-impuestos-total";

interface Props {
  item: VencImpCuotaConsolidada;
  onClick?: () => void;
}

export default function HomeVencProximoBanner({ item, onClick }: Props) {
  const semaforo = semaforoVencimientoCuota(item.fecha);
  const escudoCls = ["venc-imp-banner-next-escudo", item.escudoClassName]
    .filter(Boolean)
    .join(" ");
  const subtitulo =
    item.impuestoLabel !== item.titulo ? item.impuestoLabel : item.cuotaLabel;
  const ariaParts = [
    item.titulo,
    subtitulo,
    item.fechaLabel,
    diasRestantesLabel(item.diasRestantes),
  ];

  const inner = (
    <>
      <span className="venc-imp-banner-next-accent" aria-hidden />
      <img
        src={item.escudoSrc}
        alt=""
        className={escudoCls}
        loading="lazy"
        decoding="async"
      />
      <div className="venc-imp-banner-next-body home-venc-proximo-body">
        <div className="home-venc-proximo-top">
          <span className="venc-imp-banner-next-label">
            <span className="venc-imp-banner-next-dot" aria-hidden />
            Próximo vencimiento
          </span>
          <span className="venc-imp-banner-next-dias home-venc-proximo-dias">
            {diasRestantesLabel(item.diasRestantes)}
          </span>
        </div>
        <strong className="home-venc-proximo-titulo">{item.titulo}</strong>
        <span className="home-venc-proximo-meta">
          <span className="venc-imp-banner-next-sub home-venc-proximo-sub">{subtitulo}</span>
          <span className="home-venc-proximo-meta-sep" aria-hidden>
            ·
          </span>
          <span className="venc-imp-banner-next-fecha home-venc-proximo-fecha">
            {item.fechaLabel}
          </span>
        </span>
      </div>
    </>
  );

  const className = `venc-imp-banner-next home-venc-proximo-banner venc-imp-banner-next--${semaforo.nivel}`;

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        aria-label={ariaParts.join(" · ")}
        onClick={onClick}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={className} role="status" aria-label={ariaParts.join(" · ")}>
      {inner}
    </div>
  );
}
