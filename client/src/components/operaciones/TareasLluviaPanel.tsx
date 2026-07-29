import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CloudRain, Loader2, X } from "lucide-react";
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
    // Incluir sugerencias yr de marcadores que no estén en la lista (legacy null)
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

  // Filas a mostrar: establecimientos + sugerencias yr huérfanas (cuenta legacy)
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

  return (
    <section className="tareas-op-lluvia" aria-label="Lluvia del día">
      <header className="tareas-op-lluvia-head">
        <span className="tareas-op-lluvia-icon" aria-hidden>
          <CloudRain size={16} strokeWidth={2} />
        </span>
        <div className="tareas-op-lluvia-copy">
          <p className="tareas-op-lluvia-title">Lluvia del día</p>
          <p className="tareas-op-lluvia-sub">
            {totalConfirmado > 0
              ? `Confirmado: ${formatMmInput(totalConfirmado)} mm`
              : haySugeridos
                ? "Total del día según yr.no — confirmá si coincide con el campo"
                : "Sin dato yr.no para este día. Cargá los mm a mano."}
          </p>
        </div>
      </header>

      <ul className="tareas-op-lluvia-list">
        {filas.map((est) => {
          const key = String(est.id ?? 0);
          const row = lluviaByKey.get(key);
          const yrSugerido = row?.fuente === "yr" && row.estado === "sugerido";
          const yrConfirmado = row?.fuente === "yr" && row.estado === "confirmado";
          const state = saveState[key] ?? "idle";
          const busy = busyKey === key;

          if (yrSugerido) {
            return (
              <li key={key} className="tareas-op-lluvia-yr is-sugerido">
                <div className="tareas-op-lluvia-yr-top">
                  <span className="tareas-op-lluvia-yr-badge">yr.no</span>
                  <strong className="tareas-op-lluvia-yr-place">{est.nombre}</strong>
                </div>
                <p className="tareas-op-lluvia-yr-msg">
                  Total del día (yr.no):{" "}
                  <strong>{formatMmInput(row.yr_mm ?? row.mm)} mm</strong>. Confirmá o ajustá.
                </p>
                <div className="tareas-op-lluvia-yr-actions">
                  <div className="tareas-op-lluvia-input-wrap">
                    <input
                      className="tareas-op-lluvia-input"
                      type="text"
                      inputMode="decimal"
                      value={drafts[key] ?? ""}
                      disabled={!puedeEditar || !apiOnline || busy}
                      onChange={(e) =>
                        setDrafts((d) => ({
                          ...d,
                          [key]: e.target.value.replace(/[^\d.,]/g, ""),
                        }))
                      }
                      aria-label={`Milímetros sugeridos en ${est.nombre}`}
                    />
                    <span className="tareas-op-lluvia-unit" aria-hidden>
                      mm
                    </span>
                  </div>
                  {puedeEditar ? (
                    <>
                      <button
                        type="button"
                        className="tareas-op-lluvia-btn tareas-op-lluvia-btn--ok"
                        disabled={!apiOnline || busy}
                        onClick={() => void confirmarYr(est.id)}
                      >
                        {busy ? <Loader2 size={14} className="tareas-op-lluvia-spin" /> : <Check size={14} />}
                        Confirmar
                      </button>
                      <button
                        type="button"
                        className="tareas-op-lluvia-btn tareas-op-lluvia-btn--no"
                        disabled={!apiOnline || busy}
                        onClick={() => void descartarYr(est.id)}
                      >
                        <X size={14} />
                        Descartar
                      </button>
                    </>
                  ) : null}
                </div>
              </li>
            );
          }

          return (
            <li
              key={key}
              className={`tareas-op-lluvia-row${yrConfirmado ? " is-yr-confirmado" : ""}`}
            >
              <label className="tareas-op-lluvia-label" htmlFor={`lluvia-mm-${key}`}>
                {est.nombre}
                {yrConfirmado ? (
                  <span className="tareas-op-lluvia-yr-mini">yr.no</span>
                ) : null}
              </label>
              <div className="tareas-op-lluvia-input-wrap">
                <input
                  id={`lluvia-mm-${key}`}
                  className="tareas-op-lluvia-input"
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={drafts[key] ?? ""}
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
                <span className="tareas-op-lluvia-unit" aria-hidden>
                  mm
                </span>
                <span className="tareas-op-lluvia-status" aria-live="polite">
                  {state === "saving" ? (
                    <Loader2 size={14} className="tareas-op-lluvia-spin" />
                  ) : null}
                  {state === "saved" ? <Check size={14} /> : null}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {!puedeEditar ? (
        <p className="tareas-op-lluvia-hint">Solo lectura: no podés editar la lluvia.</p>
      ) : (
        <p className="tareas-op-lluvia-hint">
          {haySugeridos
            ? "Confirmá solo si realmente llovió en ese establecimiento."
            : "Los mm se guardan al salir del campo o con Enter."}
        </p>
      )}
    </section>
  );
}
