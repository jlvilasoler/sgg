import { useCallback, useEffect, useState } from "react";
import { CloudRain, Loader2, MapPin, RefreshCw } from "lucide-react";
import { fetchEstablecimientosYr, updateEstablecimientoYr } from "../../api";
import type { EstablecimientoYr } from "../../types";

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onVolver: () => void;
}

function fmtCoord(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(4);
}

export default function ConfigUbicacionEstablecimientos({
  apiOnline,
  onError,
  onSuccess,
  onVolver,
}: Props) {
  const [rows, setRows] = useState<EstablecimientoYr[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, { lat: string; lon: string }>>({});

  const load = useCallback(async () => {
    if (!apiOnline) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchEstablecimientosYr();
      setRows(data);
      const next: Record<number, { lat: string; lon: string }> = {};
      for (const r of data) {
        next[r.marcador_id] = {
          lat: r.lat != null ? String(r.lat) : r.lat_mapa != null ? String(r.lat_mapa) : "",
          lon: r.lon != null ? String(r.lon) : r.lon_mapa != null ? String(r.lon_mapa) : "",
        };
      }
      setDrafts(next);
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudieron cargar los establecimientos");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [apiOnline, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const parseCoord = (raw: string): number | null => {
    const t = raw.trim().replace(",", ".");
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : NaN;
  };

  const guardar = async (row: EstablecimientoYr, activo: boolean) => {
    if (!apiOnline || savingId != null) return;
    const d = drafts[row.marcador_id] ?? { lat: "", lon: "" };
    const latN = parseCoord(d.lat);
    const lonN = parseCoord(d.lon);
    let lat: number | null = null;
    let lon: number | null = null;
    if (d.lat.trim() || d.lon.trim()) {
      if (latN == null || Number.isNaN(latN) || latN < -90 || latN > 90) {
        onError(`Latitud inválida en «${row.nombre}».`);
        return;
      }
      if (lonN == null || Number.isNaN(lonN) || lonN < -180 || lonN > 180) {
        onError(`Longitud inválida en «${row.nombre}».`);
        return;
      }
      lat = latN;
      lon = lonN;
    } else if (row.lat_mapa != null && row.lon_mapa != null) {
      lat = row.lat_mapa;
      lon = row.lon_mapa;
    } else if (activo) {
      onError(`«${row.nombre}» no tiene coordenadas en el mapa. Marcá el punto en Mapa del campo.`);
      return;
    }

    setSavingId(row.marcador_id);
    try {
      const saved = await updateEstablecimientoYr(row.marcador_id, { activo, lat, lon });
      setRows((prev) => prev.map((r) => (r.marcador_id === saved.marcador_id ? saved : r)));
      setDrafts((prev) => ({
        ...prev,
        [saved.marcador_id]: {
          lat: saved.lat != null ? String(saved.lat) : "",
          lon: saved.lon != null ? String(saved.lon) : "",
        },
      }));
      onSuccess(
        activo
          ? `«${saved.nombre}» con captura automática de lluvia`
          : `«${saved.nombre}» desactivado (sin captura automática)`,
      );
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="subseccion-panel config-ubicacion-establecimientos">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver a Administración de Cuenta
      </button>

      <section className="card config-ubicacion-est-card">
        <header className="config-ubicacion-est-head">
          <span className="config-ubicacion-est-icon" aria-hidden>
            <CloudRain size={20} />
          </span>
          <div>
            <p className="sg-hub-panel-kicker" style={{ margin: 0 }}>
              Precipitaciones · yr.no
            </p>
            <h2 className="config-ubicacion-est-title">Ubicación Establecimientos</h2>
            <p className="muted config-ubicacion-est-sub">
              Cada día se guarda automáticamente el total de mm según yr.no en cada establecimiento
              (sin confirmación). Desactivá un punto solo si no querés seguimiento ahí.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm config-ubicacion-est-refresh"
            disabled={!apiOnline || loading}
            onClick={() => void load()}
            title="Actualizar lista del mapa"
          >
            <RefreshCw size={14} aria-hidden />
            Actualizar
          </button>
        </header>

        {loading ? (
          <p className="muted" style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center" }}>
            <Loader2 size={14} className="tareas-op-lluvia-spin" /> Cargando establecimientos…
          </p>
        ) : rows.length === 0 ? (
          <div className="config-ubicacion-est-empty">
            <MapPin size={28} strokeWidth={1.5} aria-hidden />
            <p>
              No hay ubicaciones (marcadores) en el mapa de la cuenta. Creá establecimientos en{" "}
              <strong>Tareas → Mapa del campo</strong> y volvé acá para activar yr.no.
            </p>
          </div>
        ) : (
          <ul className="config-ubicacion-est-list">
            {rows.map((row) => {
              const busy = savingId === row.marcador_id;
              const d = drafts[row.marcador_id] ?? { lat: "", lon: "" };
              return (
                <li
                  key={row.marcador_id}
                  className={`config-ubicacion-est-row${row.activo ? " is-activo" : ""}`}
                >
                  <div className="config-ubicacion-est-row-main">
                    <div className="config-ubicacion-est-row-title">
                      <strong>{row.nombre}</strong>
                      {row.activo ? (
                        <span className="config-ubicacion-est-badge">Captura automática</span>
                      ) : (
                        <span className="config-ubicacion-est-badge is-off">Inactivo</span>
                      )}
                    </div>
                    <p className="config-ubicacion-est-mapa muted">
                      Mapa: {fmtCoord(row.lat_mapa)}, {fmtCoord(row.lon_mapa)}
                      {row.yr_ultima_sync
                        ? ` · Última sync: ${new Date(row.yr_ultima_sync).toLocaleString("es-UY")}`
                        : ""}
                    </p>
                    <div className="config-ubicacion-est-coords">
                      <label>
                        Lat
                        <input
                          type="text"
                          inputMode="decimal"
                          value={d.lat}
                          disabled={busy || !apiOnline}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [row.marcador_id]: { ...d, lat: e.target.value },
                            }))
                          }
                        />
                      </label>
                      <label>
                        Lon
                        <input
                          type="text"
                          inputMode="decimal"
                          value={d.lon}
                          disabled={busy || !apiOnline}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [row.marcador_id]: { ...d, lon: e.target.value },
                            }))
                          }
                        />
                      </label>
                    </div>
                  </div>
                  <div className="config-ubicacion-est-row-actions">
                    {row.activo ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={!apiOnline || busy}
                          onClick={() => void guardar(row, true)}
                        >
                          {busy ? "…" : "Guardar"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={!apiOnline || busy}
                          onClick={() => void guardar(row, false)}
                        >
                          Desactivar
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={!apiOnline || busy || (!row.tiene_coords && !d.lat.trim())}
                        onClick={() => void guardar(row, true)}
                      >
                        {busy ? "…" : "Activar captura"}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
