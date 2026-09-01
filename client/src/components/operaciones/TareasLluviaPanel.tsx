import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Check,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  Loader2,
  Pencil,
  Sun,
} from "lucide-react";
import { upsertOperativaLluvia } from "../../api";
import type { CampoMapaElemento, OperativaLluviaDia } from "../../types";
import { parseCampoMapaObjetoTipo } from "../campo/campo-mapa-objetos";
import {
  claveNombreEstablecimiento,
  dedupeMarcadoresMapaByNombre,
} from "../campo/campo-establecimiento-dedupe";

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
type FuenteUi = "manual" | "auto" | null;

interface ClimaInfo {
  nivel: ClimaNivel;
  label: string;
  detail: string;
  icon: ReactNode;
}

function establecimientosDesdeMapa(elementos: CampoMapaElemento[]): EstablecimientoOpcion[] {
  const marcadores = dedupeMarcadoresMapaByNombre(
    elementos
      .filter((item) => item.tipo === "marcador" && parseCampoMapaObjetoTipo(item.metadata) == null)
      .map((item) => ({ id: item.id as number, nombre: item.nombre.trim() || "Sin nombre" })),
  )
    .slice()
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .map((item) => ({ id: item.id as number | null, nombre: item.nombre }));
  if (marcadores.length > 0) return marcadores;
  return [{ id: null, nombre: "Campo (sin ubicación en mapa)" }];
}

function formatMm(mm: number | null | undefined): string {
  if (mm == null || !Number.isFinite(mm) || mm < 0) return "0";
  const rounded = Math.round(mm * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function parseMmInput(raw: string): number | null {
  const cleaned = raw.trim().replace(",", ".");
  if (!cleaned) return 0;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 10) / 10;
}

function climaDesdeMm(mm: number): ClimaInfo {
  const n = Number.isFinite(mm) ? mm : 0;
  const size = 28;
  const stroke = 1.75;
  if (n <= 0) {
    return {
      nivel: "clear",
      label: "Sin precipitación",
      detail: "Cargá los mm reales si llovió",
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

function mmActual(row: OperativaLluviaDia | undefined): number {
  if (!row) return 0;
  const mm = row.mm ?? row.auto_mm ?? 0;
  return Number.isFinite(mm) ? mm : 0;
}

function fuenteDe(row: OperativaLluviaDia | undefined): FuenteUi {
  if (!row) return null;
  return row.fuente === "manual" ? "manual" : "auto";
}

function lluviaDeEstablecimiento(
  map: Map<string, OperativaLluviaDia>,
  est: EstablecimientoOpcion,
): OperativaLluviaDia | undefined {
  const byId = map.get(String(est.id ?? 0));
  const nameKey = claveNombreEstablecimiento(est.nombre);
  const byName = nameKey ? map.get(`name:${nameKey}`) : undefined;
  if (!byId) return byName;
  if (!byName) return byId;
  return mmActual(byName) >= mmActual(byId) ? byName : byId;
}

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
    // Preferir la fila con más mm cuando hay copias del mismo establecimiento.
    const byId = new Map<string, OperativaLluviaDia>();
    const byName = new Map<string, OperativaLluviaDia>();
    for (const row of lluvias) {
      const idKey = String(row.marcador_id ?? 0);
      const prevId = byId.get(idKey);
      if (!prevId || (Number(row.mm) || 0) >= (Number(prevId.mm) || 0)) {
        byId.set(idKey, row);
      }
      const nameKey = claveNombreEstablecimiento(row.marcador_nombre) || `id:${idKey}`;
      const prevName = byName.get(nameKey);
      if (!prevName || (Number(row.mm) || 0) >= (Number(prevName.mm) || 0)) {
        byName.set(nameKey, row);
      }
    }
    const map = new Map<string, OperativaLluviaDia>();
    for (const [idKey, row] of byId) map.set(idKey, row);
    for (const [nameKey, row] of byName) map.set(`name:${nameKey}`, row);
    return map;
  }, [lluvias]);

  const filas = useMemo(() => {
    const list = [...establecimientos];
    const ids = new Set(list.map((e) => String(e.id ?? 0)));
    const names = new Set(
      list.map((e) => claveNombreEstablecimiento(e.nombre)).filter(Boolean),
    );
    for (const row of lluvias) {
      const nameKey = claveNombreEstablecimiento(row.marcador_nombre);
      if (nameKey && names.has(nameKey)) continue;
      const k = String(row.marcador_id ?? 0);
      if (!ids.has(k)) {
        list.push({
          id: row.marcador_id,
          nombre: row.marcador_nombre?.trim() || "Campo",
        });
        ids.add(k);
        if (nameKey) names.add(nameKey);
      }
    }
    return list;
  }, [establecimientos, lluvias]);

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const focusedKeyRef = useRef<string | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDrafts((prev) => {
      const next: Record<string, string> = {};
      for (const est of filas) {
        const key = String(est.id ?? 0);
        // No pisar lo que el usuario está escribiendo.
        if (
          (focusedKeyRef.current === key || savingKey === key) &&
          prev[key] != null
        ) {
          next[key] = prev[key]!;
          continue;
        }
        next[key] = formatMm(mmActual(lluviaDeEstablecimiento(lluviaByKey, est)));
      }
      return next;
    });
  }, [fecha, filas, lluviaByKey, savingKey]);

  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    [],
  );

  const maxMm = useMemo(
    () =>
      filas.reduce((max, est) => {
        const key = String(est.id ?? 0);
        const draft = parseMmInput(drafts[key] ?? "");
        const n = draft ?? mmActual(lluviaDeEstablecimiento(lluviaByKey, est));
        return n > max ? n : max;
      }, 0),
    [filas, drafts, lluviaByKey],
  );

  const climaBoard = climaDesdeMm(maxMm);
  const showRainFx =
    climaBoard.nivel === "drizzle" ||
    climaBoard.nivel === "rain" ||
    climaBoard.nivel === "heavy" ||
    climaBoard.nivel === "storm";

  const editable = puedeEditar && apiOnline;

  const guardar = async (est: EstablecimientoOpcion, force = false) => {
    if (!editable) return;
    const key = String(est.id ?? 0);
    if (savingKey && savingKey !== key) return;
    const parsed = parseMmInput(draftsRef.current[key] ?? "");
    if (parsed == null) {
      onError("Indicá un valor válido de milímetros (0 o más).");
      setDrafts((prev) => ({
        ...prev,
        [key]: formatMm(mmActual(lluviaDeEstablecimiento(lluviaByKey, est))),
      }));
      return;
    }

    const row = lluviaDeEstablecimiento(lluviaByKey, est);
    const actual = mmActual(row);
    if (!force && parsed === actual) {
      setDrafts((prev) => ({ ...prev, [key]: formatMm(parsed) }));
      return;
    }
    if (!force && parsed === 0 && !row) {
      setDrafts((prev) => ({ ...prev, [key]: "0" }));
      return;
    }

    setSavingKey(key);
    try {
      const saved = await upsertOperativaLluvia({
        fecha,
        marcador_id: est.id,
        mm: parsed,
      });
      const nameKey = claveNombreEstablecimiento(est.nombre);
      const without = lluvias.filter((r) => {
        if (String(r.marcador_id ?? 0) === key) return false;
        if (nameKey && claveNombreEstablecimiento(r.marcador_nombre) === nameKey) return false;
        return true;
      });
      onChange(saved ? [...without, saved] : without);
      setDrafts((prev) => ({ ...prev, [key]: formatMm(parsed) }));
      setSavedKey(key);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSavedKey(null), 1800);
      onSuccess?.(
        parsed > 0
          ? `Lluvia manual guardada: ${formatMm(parsed)} mm · ${est.nombre}`
          : `Lluvia borrada en ${est.nombre}`,
      );
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo guardar la lluvia.");
      setDrafts((prev) => ({
        ...prev,
        [key]: formatMm(mmActual(lluviaDeEstablecimiento(lluviaByKey, est))),
      }));
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <section
      className={`wx-board wx-board--stations-only is-${climaBoard.nivel}`}
      aria-label="Lluvia del día por establecimiento"
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

      <p className="wx-kicker wx-stations-kicker">Lluvia del día</p>
      <p className="wx-hint">
        {editable
          ? "Podés corregir los mm de la app con el valor real. Azul = automático · Verde = manual."
          : apiOnline
            ? "Solo lectura: no tenés permiso para editar lluvia."
            : "Sin conexión: no se puede guardar lluvia."}
      </p>
      <div className="wx-fuente-legend" aria-hidden>
        <span className="wx-fuente-chip wx-fuente-chip--auto">Automática</span>
        <span className="wx-fuente-chip wx-fuente-chip--manual">Manual</span>
      </div>

      <div className="wx-stations" role="list">
        {filas.map((est) => {
          const key = String(est.id ?? 0);
          const row = lluviaDeEstablecimiento(lluviaByKey, est);
          const draftParsed = parseMmInput(drafts[key] ?? "");
          const mm = draftParsed ?? mmActual(row);
          const localClima = climaDesdeMm(mm);
          const bar = intensidadPct(mm);
          const isSaving = savingKey === key;
          const isSaved = savedKey === key;
          const fuente = fuenteDe(row);
          const draftStr = (drafts[key] ?? "").trim().replace(",", ".");
          const actualStr = formatMm(mmActual(row));
          const valueDirty = draftStr !== actualStr;

          const autoRef =
            row?.auto_mm != null && Number.isFinite(row.auto_mm) && row.fuente === "manual"
              ? row.auto_mm
              : null;

          return (
            <article
              key={key}
              className={[
                "wx-station",
                "is-row",
                `is-${localClima.nivel}`,
                fuente === "manual" ? "is-fuente-manual" : "",
                fuente === "auto" ? "is-fuente-auto" : "",
                row?.estado === "sugerido" ? "is-sugerido" : "",
              ]
                .filter(Boolean)
                .join(" ")}
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
                    {fuente === "manual" ? (
                      <span className="wx-badge wx-badge--manual">Manual</span>
                    ) : fuente === "auto" ? (
                      <span className="wx-badge wx-badge--auto">Automática</span>
                    ) : null}
                  </div>
                  <p className="wx-station-cond">{localClima.label}</p>
                  {autoRef != null && row?.fuente === "manual" ? (
                    <p className="wx-station-auto-ref">App midió {formatMm(autoRef)} mm</p>
                  ) : fuente === "auto" && editable ? (
                    <p className="wx-station-auto-ref">Tocá el valor para corregirlo</p>
                  ) : null}
                  <div className="wx-bar" aria-hidden>
                    <span className="wx-bar-fill" style={{ width: `${bar}%` }} />
                  </div>
                </div>
              </div>
              <div className="wx-station-right">
                {editable ? (
                  <div className="wx-edit-block">
                    <label
                      className={`wx-meter wx-meter--editable${fuente === "manual" ? " is-manual" : " is-auto"}${focusedKey === key ? " is-focused" : ""}`}
                      aria-label={`Milímetros reales en ${est.nombre}`}
                    >
                      <Pencil size={12} className="wx-meter-pencil" aria-hidden />
                      <input
                        className="wx-input"
                        type="text"
                        inputMode="decimal"
                        value={drafts[key] ?? "0"}
                        disabled={isSaving}
                        title="Escribí los mm reales y salí del campo o tocá Guardar"
                        onFocus={(e) => {
                          focusedKeyRef.current = key;
                          setFocusedKey(key);
                          e.currentTarget.select();
                        }}
                        onChange={(e) =>
                          setDrafts((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        onBlur={() => {
                          focusedKeyRef.current = null;
                          setFocusedKey(null);
                          void guardar(est);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                      />
                      <span className="wx-unit">mm</span>
                      <span className="wx-status" aria-live="polite">
                        {isSaving ? (
                          <Loader2 size={14} className="spin" aria-label="Guardando" />
                        ) : isSaved ? (
                          <Check size={14} aria-label="Guardado" />
                        ) : null}
                      </span>
                    </label>
                    {valueDirty ? (
                      <button
                        type="button"
                        className="wx-btn wx-btn--ok"
                        disabled={isSaving}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => void guardar(est, true)}
                      >
                        Guardar
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div
                    className={`wx-readout${fuente === "manual" ? " is-manual" : " is-auto"}`}
                    aria-label={`${formatMm(mm)} milímetros`}
                  >
                    <span className="wx-readout-value">{formatMm(mm)}</span>
                    <span className="wx-readout-unit">mm</span>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
