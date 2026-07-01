import { useCallback, useEffect, useMemo, useState } from "react";
import { APP_NAME } from "../../brand";
import {
  fetchRubroVinculos,
  fetchRubroVinculosMapa,
  fetchRubros,
  fetchSubRubros,
  saveRubroVinculos,
} from "../../api";
import type { Rubro, RubroVinculoMapaItem, SubRubro } from "../../types";
import RubroVinculosMapaDiagrama from "./RubroVinculosMapaDiagrama";
import { PageModuleHeadRow } from "../PageModuleHead";

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onVolver: () => void;
  onCatalogosChanged: () => void;
}

export default function RubroVinculosConfig({
  apiOnline,
  onError,
  onSuccess,
  onVolver,
  onCatalogosChanged,
}: Props) {
  const [rubros, setRubros] = useState<Rubro[]>([]);
  const [subRubros, setSubRubros] = useState<SubRubro[]>([]);
  const [rubroId, setRubroId] = useState<number | "">("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filtroGrupo, setFiltroGrupo] = useState("");
  const [mapa, setMapa] = useState<RubroVinculoMapaItem[]>([]);
  const [mapaLoading, setMapaLoading] = useState(true);

  const loadMapa = useCallback(async () => {
    if (!apiOnline) {
      setMapa([]);
      setMapaLoading(false);
      return;
    }
    setMapaLoading(true);
    try {
      setMapa(await fetchRubroVinculosMapa());
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar mapa");
      setMapa([]);
    } finally {
      setMapaLoading(false);
    }
  }, [apiOnline, onError]);

  const loadCatalog = useCallback(async () => {
    if (!apiOnline) {
      setRubros([]);
      setSubRubros([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [r, s] = await Promise.all([fetchRubros(false), fetchSubRubros(false)]);
      setRubros(r);
      setSubRubros(s);
      await loadMapa();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, [apiOnline, onError, loadMapa]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (!apiOnline || rubroId === "") {
      setSelected(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const ids = await fetchRubroVinculos(Number(rubroId));
        if (!cancelled) setSelected(new Set(ids));
      } catch (e) {
        if (!cancelled) onError(e instanceof Error ? e.message : "Error al cargar vínculos");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiOnline, rubroId, onError]);

  const grupos = useMemo(() => {
    const set = new Set(subRubros.map((s) => s.grupo));
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [subRubros]);

  const subFiltrados = useMemo(() => {
    if (!filtroGrupo) return subRubros;
    return subRubros.filter((s) => s.grupo === filtroGrupo);
  }, [subRubros, filtroGrupo]);

  const porGrupo = useMemo(() => {
    const map = new Map<string, SubRubro[]>();
    for (const s of subFiltrados) {
      const list = map.get(s.grupo) ?? [];
      list.push(s);
      map.set(s.grupo, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, "es"));
  }, [subFiltrados]);

  const rubroActual = rubros.find((r) => r.id === rubroId);

  const mapaOrdenado = useMemo(() => {
    return [...mapa].sort((a, b) => {
      const diff = b.sub_rubros.length - a.sub_rubros.length;
      if (diff !== 0) return diff;
      return a.rubro.localeCompare(b.rubro, "es");
    });
  }, [mapa]);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGrupo = (items: SubRubro[], on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const s of items) {
        if (on) next.add(s.id);
        else next.delete(s.id);
      }
      return next;
    });
  };

  const guardar = async () => {
    if (rubroId === "") {
      onError("Seleccioná un rubro");
      return;
    }
    if (!apiOnline) {
      onError("API no conectada");
      return;
    }
    setSaving(true);
    try {
      await saveRubroVinculos(Number(rubroId), [...selected]);
      await loadMapa();
      onSuccess("Vínculos guardados. Al registrar gastos, el sub-rubro se filtrará automáticamente.");
      onCatalogosChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="subseccion-panel">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver a Rubros
      </button>

      <div className="card">
        <div className="form-header">
          <PageModuleHeadRow
            icon={{ source: "hub", id: "config_rubros" }}
            title="Configuración rubro ↔ sub-rubro"
            subtitle={
              <>
                Elegí un <strong>rubro</strong> y marcá qué <strong>sub-rubros</strong> son válidos al
                cargar gastos. Solo esas opciones aparecerán en el formulario cuando se seleccione ese
                rubro.
              </>
            }
          />
        </div>

        <div className="form-grid vinculos-config-grid">
          <div className="field span-2">
            <label htmlFor="vinculo-rubro">Rubro contable *</label>
            <select
              id="vinculo-rubro"
              value={rubroId === "" ? "" : String(rubroId)}
              onChange={(e) =>
                setRubroId(e.target.value === "" ? "" : Number(e.target.value))
              }
              disabled={loading}
            >
              <option value="">Seleccionar rubro...</option>
              {rubros.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                  {r.activo ? "" : " (inactivo)"}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="vinculo-filtro-grupo">Filtrar sub-rubros por grupo</label>
            <select
              id="vinculo-filtro-grupo"
              value={filtroGrupo}
              onChange={(e) => setFiltroGrupo(e.target.value)}
            >
              <option value="">Todos los grupos</option>
              {grupos.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div className="field vinculos-count">
            <span className="muted">
              {rubroActual
                ? `${selected.size} sub-rubro(s) vinculado(s) a «${rubroActual.nombre}»`
                : "Seleccioná un rubro para configurar"}
            </span>
          </div>
        </div>

        {rubroId !== "" && (
          <div className="vinculos-checklist">
            {loading ? (
              <p className="muted">Cargando catálogo...</p>
            ) : porGrupo.length === 0 ? (
              <p className="muted">No hay sub-rubros. Creálos en Ingresar sub-rubro.</p>
            ) : (
              porGrupo.map(([grupo, items]) => {
                const activos = items.filter((s) => s.activo);
                const allOn = activos.length > 0 && activos.every((s) => selected.has(s.id));
                return (
                  <section key={grupo} className="vinculos-grupo-block">
                    <div className="vinculos-grupo-head">
                      <strong>{grupo}</strong>
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={() => toggleGrupo(activos, !allOn)}
                      >
                        {allOn ? "Quitar grupo" : "Marcar grupo"}
                      </button>
                    </div>
                    <ul className="vinculos-check-list">
                      {items.map((s) => (
                        <li key={s.id}>
                          <label className={s.activo ? "" : "vinculo-inactivo"}>
                            <input
                              type="checkbox"
                              checked={selected.has(s.id)}
                              disabled={!s.activo}
                              onChange={() => toggle(s.id)}
                            />
                            {s.nombre}
                            {!s.activo && (
                              <span className="badge-muted"> inactivo</span>
                            )}
                          </label>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })
            )}
          </div>
        )}

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!apiOnline || rubroId === "" || saving}
            onClick={guardar}
          >
            {saving ? "Guardando..." : "Guardar vínculos"}
          </button>
        </div>
      </div>

      <div className="card vinculos-mapa-card">
        <div className="form-header">
          <PageModuleHeadRow
            icon={{ source: "hub", id: "config_rubros" }}
            title="Mapa rubro → sub-rubros"
            subtitle="Resumen de todos los vínculos configurados. Hacé clic en un rubro para editarlo arriba."
          />
          <p className="vinculos-mapa-leyenda muted">
            Todo parte del cuadro <strong>{APP_NAME}</strong>: líneas al <strong>rubro</strong> contable,
            luego al <strong>grupo</strong> y a cada <strong>sub-rubro</strong>. Clic en un rubro
            para editarlo arriba.
          </p>
        </div>

        {mapaLoading ? (
          <p className="muted">Cargando mapa...</p>
        ) : mapa.length === 0 ? (
          <p className="muted">No hay rubros en el catálogo.</p>
        ) : (
          <RubroVinculosMapaDiagrama
            mapa={mapaOrdenado}
            selectedRubroId={rubroId}
            onSelectRubro={(id) => setRubroId(id)}
          />
        )}
      </div>
    </div>
  );
}
