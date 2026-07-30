import { useMemo, type ReactNode } from "react";
import {
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  Sun,
} from "lucide-react";
import type { CampoMapaElemento, OperativaLluviaDia } from "../../types";
import { parseCampoMapaObjetoTipo } from "../campo/campo-mapa-objetos";

interface EstablecimientoOpcion {
  id: number | null;
  nombre: string;
}

interface Props {
  fecha: string;
  apiOnline: boolean;
  puedeEditar: boolean;
  elementosMapa: CampoMapaElemento[];
  lluvias: OperativaLluviaDia[];
  onChange: (rows: OperativaLluviaDia[]) => void;
  onError: (msg: string) => void;
  onSuccess?: (msg: string) => void;
}

type ClimaNivel = "clear" | "mist" | "drizzle" | "rain" | "heavy" | "storm";

interface ClimaInfo {
  nivel: ClimaNivel;
  label: string;
  detail: string;
  icon: ReactNode;
}

function establecimientosDesdeMapa(elementos: CampoMapaElemento[]): EstablecimientoOpcion[] {
  const marcadores = elementos
    .filter((item) => item.tipo === "marcador" && parseCampoMapaObjetoTipo(item.metadata) == null)
    .slice()
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .map((item) => ({ id: item.id as number | null, nombre: item.nombre.trim() || "Sin nombre" }));
  if (marcadores.length > 0) return marcadores;
  return [{ id: null, nombre: "Campo (sin ubicación en mapa)" }];
}

function formatMm(mm: number | null | undefined): string {
  if (mm == null || !Number.isFinite(mm) || mm < 0) return "0";
  const rounded = Math.round(mm * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function climaDesdeMm(mm: number): ClimaInfo {
  const n = Number.isFinite(mm) ? mm : 0;
  const size = 28;
  const stroke = 1.75;
  if (n <= 0) {
    return {
      nivel: "clear",
      label: "Sin precipitación",
      detail: "Según el pronóstico del día",
      icon: <Sun size={size} strokeWidth={stroke} />,
    };
  }
  if (n < 0.5) {
    return {
      nivel: "mist",
      label: "Llovizna mínima",
      detail: "Apenas perceptible",
      icon: <CloudFog size={size} strokeWidth={stroke} />,
    };
  }
  if (n < 2) {
    return {
      nivel: "drizzle",
      label: "Llovizna",
      detail: "Precipitación liviana",
      icon: <CloudDrizzle size={size} strokeWidth={stroke} />,
    };
  }
  if (n < 8) {
    return {
      nivel: "rain",
      label: "Lluvia",
      detail: "Precipitación moderada",
      icon: <CloudRain size={size} strokeWidth={stroke} />,
    };
  }
  if (n < 20) {
    return {
      nivel: "heavy",
      label: "Lluvia intensa",
      detail: "Acumulación importante",
      icon: <CloudRain size={size} strokeWidth={stroke} />,
    };
  }
  return {
    nivel: "storm",
    label: "Tormenta / muy intensa",
    detail: "Alta acumulación del día",
    icon: <CloudLightning size={size} strokeWidth={stroke} />,
  };
}

function climaIconSmall(nivel: ClimaNivel): ReactNode {
  const size = 18;
  const stroke = 2;
  switch (nivel) {
    case "clear":
      return <Sun size={size} strokeWidth={stroke} />;
    case "mist":
      return <CloudFog size={size} strokeWidth={stroke} />;
    case "drizzle":
      return <CloudDrizzle size={size} strokeWidth={stroke} />;
    case "rain":
      return <CloudRain size={size} strokeWidth={stroke} />;
    case "heavy":
      return <CloudRain size={size} strokeWidth={stroke} />;
    case "storm":
      return <CloudLightning size={size} strokeWidth={stroke} />;
  }
}

function intensidadPct(mm: number): number {
  if (!Number.isFinite(mm) || mm <= 0) return 0;
  return Math.min(100, Math.round((Math.log10(mm + 1) / Math.log10(41)) * 100));
}

export default function TareasLluviaPanel({
  elementosMapa,
  lluvias,
}: Props) {
  const establecimientos = useMemo(
    () => establecimientosDesdeMapa(elementosMapa),
    [elementosMapa],
  );

  const lluviaByKey = useMemo(() => {
    const map = new Map<string, OperativaLluviaDia>();
    for (const row of lluvias) {
      map.set(String(row.marcador_id ?? 0), row);
    }
    return map;
  }, [lluvias]);

  const filas = useMemo(() => {
    const list = [...establecimientos];
    const ids = new Set(list.map((e) => String(e.id ?? 0)));
    for (const row of lluvias) {
      const k = String(row.marcador_id ?? 0);
      if (!ids.has(k) && row.fuente === "auto") {
        list.push({
          id: row.marcador_id,
          nombre: row.marcador_nombre?.trim() || "Campo",
        });
        ids.add(k);
      }
    }
    return list;
  }, [establecimientos, lluvias]);

  const maxMm = useMemo(
    () =>
      filas.reduce((max, est) => {
        const row = lluviaByKey.get(String(est.id ?? 0));
        const mm = row?.mm ?? row?.auto_mm ?? 0;
        const n = Number.isFinite(mm) ? mm : 0;
        return n > max ? n : max;
      }, 0),
    [filas, lluviaByKey],
  );

  const climaBoard = climaDesdeMm(maxMm);
  const showRainFx =
    climaBoard.nivel === "drizzle" ||
    climaBoard.nivel === "rain" ||
    climaBoard.nivel === "heavy" ||
    climaBoard.nivel === "storm";

  return (
    <section
      className={`wx-board wx-board--stations-only is-${climaBoard.nivel}`}
      aria-label="Clima del día por establecimiento"
    >
      <div className="wx-board-sky" aria-hidden>
        {showRainFx ? (
          <div className="wx-rain">
            {Array.from({ length: 14 }, (_, i) => (
              <span key={i} className={`wx-drop wx-drop--${(i % 5) + 1}`} />
            ))}
          </div>
        ) : null}
        <div className="wx-glow" />
      </div>

      <p className="wx-kicker wx-stations-kicker">Clima del día</p>

      <div className="wx-stations" role="list">
        {filas.map((est) => {
          const key = String(est.id ?? 0);
          const row = lluviaByKey.get(key);
          const mm = row?.mm ?? row?.auto_mm ?? 0;
          const localClima = climaDesdeMm(mm);
          const bar = intensidadPct(mm);

          return (
            <article
              key={key}
              className={`wx-station is-row is-${localClima.nivel}`}
              role="listitem"
            >
              <div className="wx-station-left">
                <span
                  className={`wx-station-icon wx-icon-anim wx-icon-anim--${localClima.nivel}`}
                  aria-hidden
                >
                  {climaIconSmall(localClima.nivel)}
                </span>
                <div className="wx-station-meta">
                  <div className="wx-station-title-row">
                    <strong className="wx-station-name">{est.nombre}</strong>
                  </div>
                  <p className="wx-station-cond">{localClima.label}</p>
                  <div className="wx-bar" aria-hidden>
                    <span className="wx-bar-fill" style={{ width: `${bar}%` }} />
                  </div>
                </div>
              </div>
              <div className="wx-station-right">
                <div className="wx-readout" aria-label={`${formatMm(mm)} milímetros`}>
                  <span className="wx-readout-value">{formatMm(mm)}</span>
                  <span className="wx-readout-unit">mm</span>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
