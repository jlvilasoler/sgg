import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Loader2,
  Sun,
} from "lucide-react";
import { fetchOperativaClimaActual } from "../../api";
import type { ClimaActualEstablecimiento, ClimaCondicion } from "../../types";

interface Props {
  apiOnline: boolean;
}

function formatTemp(c: number | null): string {
  if (c == null || !Number.isFinite(c)) return "—";
  const rounded = Math.round(c);
  return `${rounded}°`;
}

function climaIcon(condicion: ClimaCondicion, size = 18): ReactNode {
  const stroke = 1.75;
  switch (condicion) {
    case "clear":
    case "fair":
      return <Sun size={size} strokeWidth={stroke} />;
    case "partlycloudy":
      return <CloudSun size={size} strokeWidth={stroke} />;
    case "cloudy":
      return <Cloud size={size} strokeWidth={stroke} />;
    case "fog":
      return <CloudFog size={size} strokeWidth={stroke} />;
    case "drizzle":
      return <CloudDrizzle size={size} strokeWidth={stroke} />;
    case "rain":
      return <CloudRain size={size} strokeWidth={stroke} />;
    case "heavy":
      return <CloudRain size={size} strokeWidth={stroke} />;
    case "sleet":
    case "snow":
      return <CloudSnow size={size} strokeWidth={stroke} />;
    case "storm":
      return <CloudLightning size={size} strokeWidth={stroke} />;
    default:
      return <Cloud size={size} strokeWidth={stroke} />;
  }
}

export default function HomeClimaActualBar({ apiOnline }: Props) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ClimaActualEstablecimiento[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!apiOnline) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOperativaClimaActual();
      setItems(data);
    } catch {
      setError("No se pudo cargar el clima.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [apiOnline]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!apiOnline) return null;
  if (!loading && !error && items.length === 0) return null;

  const heroCondicion = items.find((i) => i.condicion !== "unknown")?.condicion ?? "clear";

  return (
    <section
      className={`home-wx-now wx-board wx-board--now is-${heroCondicion}`}
      aria-label="Clima actual por establecimiento"
    >
      <div className="wx-board-sky" aria-hidden>
        <div className="wx-glow" />
      </div>

      <div className="home-wx-now-inner">
        {loading || error ? (
          <div className="home-wx-now-head">
            {loading ? (
              <span className="home-wx-now-status">
                <Loader2 size={12} className="wx-spin" aria-hidden />
                Actualizando…
              </span>
            ) : (
              <span className="home-wx-now-status is-error">{error}</span>
            )}
          </div>
        ) : null}

        {!loading && !error && items.length > 0 ? (
          <div className="home-wx-now-list" role="list">
            {items.map((est) => (
              <article
                key={est.marcador_id}
                className={`home-wx-now-card is-${est.condicion}`}
                role="listitem"
                title={
                  est.error
                    ? est.error
                    : `${est.nombre}: ${est.condicion_label}${
                        est.precipitacion_1h_mm != null && est.precipitacion_1h_mm > 0
                          ? ` · ${est.precipitacion_1h_mm} mm/h`
                          : ""
                      }`
                }
              >
                <span
                  className={`home-wx-now-icon home-wx-now-icon--${est.condicion}`}
                  aria-hidden
                >
                  {climaIcon(est.condicion)}
                </span>
                <div className="home-wx-now-copy">
                  <strong className="home-wx-now-name">{est.nombre}</strong>
                  <span className="home-wx-now-cond">{est.condicion_label}</span>
                </div>
                <span className="home-wx-now-temp">{formatTemp(est.temperatura_c)}</span>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
