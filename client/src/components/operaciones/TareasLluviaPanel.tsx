import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Check,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Loader2,
  Sun,
  X,
} from "lucide-react";
import { upsertOperativaLluvia } from "../../api";
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

function formatMmInput(mm: number | null | undefined): string {
  if (mm == null || !Number.isFinite(mm) || mm < 0) return "";
  const rounded = Math.round(mm * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function parseMmInput(raw: string): number | null {
  const trimmed = raw.trim().replace(",", ".");
  if (!trimmed) return 0;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0 || n > 9999) return null;
  return Math.round(n * 10) / 10;
}

function climaDesdeMm(mm: number, pending: boolean): ClimaInfo {
  const n = Number.isFinite(mm) ? mm : 0;
  const size = 28;
  const stroke = 1.75;
  if (n <= 0) {
    return {
      nivel: "clear",
      label: pending ? "Sin precipitación prevista" : "Sin lluvia",
      detail: pending ? "Cielo estable según yr.no" : "Día seco registrado",
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
      icon: <Cloud size={size} strokeWidth={stroke} />,
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
      return <CloudSun size={size} strokeWidth={stroke} />;
    case "storm":
      return <CloudLightning size={size} strokeWidth={stroke} />;
  }
}

function intensidadPct(mm: number): number {
  if (!Number.isFinite(mm) || mm <= 0) return 0;
  return Math.min(100, Math.round((Math.log10(mm + 1) / Math.log10(41)) * 100));
}

type SaveState = "idle" | "saving" | "saved" | "error";

export default function TareasLluviaPanel({
  fecha,
  apiOnline,
  puedeEditar,
  elementosMapa,
  lluvias,
  onChange,
  onError,
  onSuccess,
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

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const draftsInitRef = useRef("");

  useEffect(() => {
    const key = `${fecha}|${establecimientos.map((e) => e.id ?? 0).join(",")}|${lluvias
      .map((l) => `${l.marcador_id ?? 0}:${l.mm}:${l.estado}`)
      .join("|")}`;
    if (draftsInitRef.current === key) return;
    draftsInitRef.current = key;
    const next: Record<string, string> = {};
    for (const est of establecimientos) {
      const k = String(est.id ?? 0);
      const row = lluviaByKey.get(k);
      next[k] = formatMmInput(row?.mm ?? row?.yr_mm);
    }
    for (const row of lluvias) {
      const k = String(row.marcador_id ?? 0);
      if (next[k] === undefined) next[k] = formatMmInput(row.mm ?? row.yr_mm);
    }
    setDrafts(next);
    setSaveState({});
  }, [fecha, establecimientos, lluvias, lluviaByKey]);

  const totalConfirmado = useMemo(
    () =>
      lluvias
        .filter((r) => r.estado === "confirmado")
        .reduce((sum, row) => sum + (Number.isFinite(row.mm) ? row.mm : 0), 0),
    [lluvias],
  );

  const totalSugerido = useMemo(
    () =>
      lluvias
        .filter((r) => r.estado === "sugerido" && r.fuente === "yr")
        .reduce((sum, row) => sum + (Number.isFinite(row.mm) ? row.mm : 0), 0),
    [lluvias],
  );

  const replaceRow = (marcadorId: number | null, saved: OperativaLluviaDia | null) => {
    const key = String(marcadorId ?? 0);
    const without = lluvias.filter((r) => String(r.marcador_id ?? 0) !== key);
    onChange(saved ? [...without, saved] : without);
  };

  const guardar = async (marcadorId: number | null) => {
    if (!puedeEditar || !apiOnline) return;
    const key = String(marcadorId ?? 0);
    const row = lluviaByKey.get(key);
    if (row?.fuente === "yr" && row.estado === "sugerido") return;

    const parsed = parseMmInput(drafts[key] ?? "");
    if (parsed == null) {
      onError("Ingresá un valor válido de mm (0 a 9999).");
      setSaveState((s) => ({ ...s, [key]: "error" }));
      return;
    }
    const current = row?.mm ?? 0;
    if (parsed === current || (parsed === 0 && !row)) {
      setSaveState((s) => ({ ...s, [key]: "idle" }));
      return;
    }
    setSaveState((s) => ({ ...s, [key]: "saving" }));
    try {
      const saved = await upsertOperativaLluvia({
        fecha,
        marcador_id: marcadorId,
        mm: parsed,
      });
      replaceRow(marcadorId, saved);
      setDrafts((d) => ({ ...d, [key]: formatMmInput(saved?.mm ?? 0) }));
      setSaveState((s) => ({ ...s, [key]: "saved" }));
      window.setTimeout(() => {
        setSaveState((s) => (s[key] === "saved" ? { ...s, [key]: "idle" } : s));
      }, 1400);
    } catch (e) {
      setSaveState((s) => ({ ...s, [key]: "error" }));
      onError(e instanceof Error ? e.message : "No se pudo guardar la lluvia");
    }
  };

  const confirmarYr = async (marcadorId: number | null) => {
    if (!puedeEditar || !apiOnline) return;
    const key = String(marcadorId ?? 0);
    const parsed = parseMmInput(drafts[key] ?? "");
    if (parsed == null || parsed <= 0) {
      onError("Indicá los mm a confirmar (mayor a 0).");
      return;
    }
    setBusyKey(key);
    try {
      const saved = await upsertOperativaLluvia({
        fecha,
        marcador_id: marcadorId,
        mm: parsed,
      });
      replaceRow(marcadorId, saved);
      setDrafts((d) => ({ ...d, [key]: formatMmInput(saved?.mm ?? parsed) }));
      onSuccess?.(
        saved
          ? `Lluvia confirmada: ${formatMmInput(saved.mm)} mm`
          : "Registro de lluvia eliminado",
      );
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo confirmar la lluvia");
    } finally {
      setBusyKey(null);
    }
  };

  const descartarYr = async (marcadorId: number | null) => {
    if (!puedeEditar || !apiOnline) return;
    const key = String(marcadorId ?? 0);
    setBusyKey(key);
    try {
      await upsertOperativaLluvia({ fecha, marcador_id: marcadorId, mm: 0 });
      replaceRow(marcadorId, null);
      setDrafts((d) => ({ ...d, [key]: "" }));
      onSuccess?.("Sugerencia de yr.no descartada");
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo descartar");
    } finally {
      setBusyKey(null);
    }
  };

  const filas = useMemo(() => {
    const list = [...establecimientos];
    const ids = new Set(list.map((e) => String(e.id ?? 0)));
    for (const row of lluvias) {
      const k = String(row.marcador_id ?? 0);
      if (!ids.has(k) && row.fuente === "yr") {
        list.push({
          id: row.marcador_id,
          nombre: row.marcador_nombre?.trim() || "Campo (yr.no)",
        });
        ids.add(k);
      }
    }
    return list;
  }, [establecimientos, lluvias]);

  const haySugeridos = lluvias.some((r) => r.estado === "sugerido" && r.fuente === "yr");
  const heroMm = totalConfirmado > 0 ? totalConfirmado : haySugeridos ? totalSugerido : 0;
  const heroPending = totalConfirmado <= 0 && haySugeridos;
  const clima = climaDesdeMm(heroMm, heroPending);
  const showRainFx = clima.nivel === "drizzle" || clima.nivel === "rain" || clima.nivel === "heavy" || clima.nivel === "storm";

  return (
    <section
      className={`wx-board is-${clima.nivel}${heroPending ? " is-pending" : ""}${totalConfirmado > 0 ? " is-confirmed" : ""}`}
      aria-label="Clima y lluvia del día"
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

      <header className="wx-hero">
        <div className="wx-hero-icon" aria-hidden>
          {clima.icon}
        </div>
        <div className="wx-hero-copy">
          <p className="wx-kicker">{heroPending ? "Pronóstico · yr.no" : "Condición del día"}</p>
          <h3 className="wx-condition">{clima.label}</h3>
          <p className="wx-detail">{clima.detail}</p>
        </div>
        <div className="wx-hero-metric">
          <span className="wx-metric-value">
            {formatMmInput(heroMm) || "0"}
            <small>mm</small>
          </span>
          <span className="wx-metric-label">
            {totalConfirmado > 0 ? "Total confirmado" : haySugeridos ? "Total previsto" : "Sin registro"}
          </span>
        </div>
      </header>

      <div className="wx-stations" role="list">
        {filas.map((est) => {
          const key = String(est.id ?? 0);
          const row = lluviaByKey.get(key);
          const yrSugerido = row?.fuente === "yr" && row.estado === "sugerido";
          const yrConfirmado = row?.fuente === "yr" && row.estado === "confirmado";
          const state = saveState[key] ?? "idle";
          const busy = busyKey === key;
          const mmShown = drafts[key] ?? "";
          const mmNum = parseMmInput(mmShown) ?? 0;
          const localClima = climaDesdeMm(mmNum, yrSugerido);
          const bar = intensidadPct(mmNum);

          if (yrSugerido) {
            return (
              <article key={key} className={`wx-station is-sugerido is-${localClima.nivel}`} role="listitem">
                <div className="wx-station-left">
                  <span className="wx-station-icon" aria-hidden>
                    {climaIconSmall(localClima.nivel)}
                  </span>
                  <div className="wx-station-meta">
                    <div className="wx-station-title-row">
                      <strong className="wx-station-name">{est.nombre}</strong>
                      <span className="wx-badge">yr.no</span>
                    </div>
                    <p className="wx-station-cond">{localClima.label}</p>
                    <div className="wx-bar" aria-hidden>
                      <span className="wx-bar-fill" style={{ width: `${bar}%` }} />
                    </div>
                  </div>
                </div>
                <div className="wx-station-right">
                  <div className="wx-meter">
                    <input
                      className="wx-input"
                      type="text"
                      inputMode="decimal"
                      value={mmShown}
                      disabled={!puedeEditar || !apiOnline || busy}
                      onChange={(e) =>
                        setDrafts((d) => ({
                          ...d,
                          [key]: e.target.value.replace(/[^\d.,]/g, ""),
                        }))
                      }
                      aria-label={`Milímetros sugeridos en ${est.nombre}`}
                    />
                    <span className="wx-unit">mm</span>
                  </div>
                  {puedeEditar ? (
                    <div className="wx-actions">
                      <button
                        type="button"
                        className="wx-btn wx-btn--ok"
                        disabled={!apiOnline || busy}
                        onClick={() => void confirmarYr(est.id)}
                      >
                        {busy ? <Loader2 size={14} className="wx-spin" /> : <Check size={14} />}
                        Confirmar
                      </button>
                      <button
                        type="button"
                        className="wx-btn wx-btn--ghost"
                        disabled={!apiOnline || busy}
                        onClick={() => void descartarYr(est.id)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          }

          return (
            <article
              key={key}
              className={`wx-station is-row is-${localClima.nivel}${yrConfirmado ? " is-yr" : ""}${state === "saved" ? " is-saved" : ""}`}
              role="listitem"
            >
              <div className="wx-station-left">
                <span className="wx-station-icon" aria-hidden>
                  {climaIconSmall(localClima.nivel)}
                </span>
                <div className="wx-station-meta">
                  <div className="wx-station-title-row">
                    <label className="wx-station-name" htmlFor={`lluvia-mm-${key}`}>
                      {est.nombre}
                    </label>
                    {yrConfirmado ? <span className="wx-badge">yr.no</span> : null}
                  </div>
                  <p className="wx-station-cond">{localClima.label}</p>
                  <div className="wx-bar" aria-hidden>
                    <span className="wx-bar-fill" style={{ width: `${bar}%` }} />
                  </div>
                </div>
              </div>
              <div className="wx-station-right">
                <div className="wx-meter">
                  <input
                    id={`lluvia-mm-${key}`}
                    className="wx-input"
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={mmShown}
                    disabled={!puedeEditar || !apiOnline || state === "saving"}
                    onChange={(e) => {
                      setDrafts((d) => ({
                        ...d,
                        [key]: e.target.value.replace(/[^\d.,]/g, ""),
                      }));
                      setSaveState((s) => ({ ...s, [key]: "idle" }));
                    }}
                    onBlur={() => void guardar(est.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    aria-label={`Milímetros de lluvia en ${est.nombre}`}
                  />
                  <span className="wx-unit">mm</span>
                  <span className="wx-status" aria-live="polite">
                    {state === "saving" ? <Loader2 size={14} className="wx-spin" /> : null}
                    {state === "saved" ? <Check size={14} strokeWidth={2.5} /> : null}
                  </span>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {!puedeEditar ? (
        <p className="wx-hint">Solo lectura: no podés editar la lluvia.</p>
      ) : (
        <p className="wx-hint">
          {haySugeridos
            ? "Confirmá solo si realmente llovió en ese establecimiento."
            : "Los mm se guardan al salir del campo o con Enter."}
        </p>
      )}
    </section>
  );
}
