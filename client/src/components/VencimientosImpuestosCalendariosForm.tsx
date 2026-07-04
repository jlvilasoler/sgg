import { useMemo, useState } from "react";
import type {
  ContribucionRuralCalendariosStore,
  ContribucionRuralJurisdiccionConfig,
  ContribucionRuralJurisdiccionId,
  CuotaContribucionRural,
} from "../types/contribucion-rural";
import {
  CONTRIBUCION_RURAL_JURISDICCION_ORDER,
  shiftJurisdiccionDatesToYear,
} from "../types/contribucion-rural";
import { safeExternalHref, safeExternalHostname } from "../utils/safe-url";

interface Props {
  store: ContribucionRuralCalendariosStore;
  saving: boolean;
  onSave: (store: ContribucionRuralCalendariosStore) => void;
}

function cloneStore(store: ContribucionRuralCalendariosStore): ContribucionRuralCalendariosStore {
  return structuredClone(store);
}

function updateJurisdiccion(
  store: ContribucionRuralCalendariosStore,
  id: ContribucionRuralJurisdiccionId,
  patch: Partial<ContribucionRuralJurisdiccionConfig>,
): ContribucionRuralCalendariosStore {
  return {
    ...store,
    jurisdicciones: {
      ...store.jurisdicciones,
      [id]: { ...store.jurisdicciones[id], ...patch },
    },
  };
}

function updateCuotaFecha(
  cuotas: CuotaContribucionRural[],
  cuota: number,
  fecha: string,
): CuotaContribucionRural[] {
  return cuotas.map((item) => (item.cuota === cuota ? { ...item, fecha } : item));
}

function FuenteLink({ url }: { url: string }) {
  const href = safeExternalHref(url);
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="venc-imp-form-link">
      Abrir {safeExternalHostname(url)}
    </a>
  );
}

function CuotasEditor({
  cuotas,
  onChange,
}: {
  cuotas: CuotaContribucionRural[];
  onChange: (next: CuotaContribucionRural[]) => void;
}) {
  return (
    <div className="venc-imp-form-cuotas">
      {cuotas.map((item) => (
        <label key={item.cuota} className="venc-imp-form-cuota">
          <span>Cuota {item.cuota}</span>
          <input
            type="date"
            value={item.fecha}
            onChange={(e) => onChange(updateCuotaFecha(cuotas, item.cuota, e.target.value))}
          />
        </label>
      ))}
    </div>
  );
}

export default function VencimientosImpuestosCalendariosForm({ store, saving, onSave }: Props) {
  const [draft, setDraft] = useState(() => cloneStore(store));

  const updatedLabel = useMemo(() => {
    if (!store.updatedAt) return null;
    const when = new Date(store.updatedAt).toLocaleString("es-UY", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    return store.updatedBy ? `Última actualización: ${when} · ${store.updatedBy}` : `Última actualización: ${when}`;
  }, [store.updatedAt, store.updatedBy]);

  const applyYearToAll = () => {
    setDraft((prev) => ({
      ...prev,
      jurisdicciones: Object.fromEntries(
        CONTRIBUCION_RURAL_JURISDICCION_ORDER.map((id) => {
          const j = prev.jurisdicciones[id];
          return [id, shiftJurisdiccionDatesToYear(j, j.anio)];
        }),
      ) as ContribucionRuralCalendariosStore["jurisdicciones"],
    }));
  };

  return (
    <section className="venc-imp-form" aria-labelledby="venc-imp-form-title">
      <header className="venc-imp-form-head">
        <div>
          <h2 id="venc-imp-form-title">Actualización de calendarios</h2>
          <p className="venc-imp-form-sub">
            Ingresá el link oficial de cada intendencia y ajustá las fechas cuando publiquen el
            calendario del año siguiente. Luego presioná <strong>Actualizar calendarios</strong>.
          </p>
          {updatedLabel && <p className="venc-imp-form-meta">{updatedLabel}</p>}
        </div>
        <button type="button" className="venc-imp-form-shift" onClick={applyYearToAll}>
          Ajustar fechas al ejercicio
        </button>
      </header>

      <div className="venc-imp-form-grid">
        {CONTRIBUCION_RURAL_JURISDICCION_ORDER.map((id) => {
          const j = draft.jurisdicciones[id];
          return (
            <article key={id} className="venc-imp-form-card">
              <header className="venc-imp-form-card-head">
                <h3>{j.label}</h3>
                <label className="venc-imp-form-anio">
                  Ejercicio
                  <input
                    type="number"
                    min={2000}
                    max={2100}
                    value={j.anio}
                    onChange={(e) =>
                      setDraft((prev) =>
                        updateJurisdiccion(prev, id, { anio: Number(e.target.value) || j.anio }),
                      )
                    }
                  />
                </label>
              </header>

              <label className="venc-imp-form-url">
                Link oficial
                <input
                  type="url"
                  value={j.fuenteUrl}
                  placeholder="https://..."
                  onChange={(e) =>
                    setDraft((prev) => updateJurisdiccion(prev, id, { fuenteUrl: e.target.value }))
                  }
                />
              </label>
              <FuenteLink url={j.fuenteUrl} />

              {j.planes ? (
                <div className="venc-imp-form-planes">
                  {(["12", "6", "4"] as const).map((planKey) => (
                    <details key={planKey} className="venc-imp-form-plan" open={planKey === "12"}>
                      <summary>{j.planes![planKey].label}</summary>
                      <CuotasEditor
                        cuotas={j.planes![planKey].cuotas}
                        onChange={(cuotas) =>
                          setDraft((prev) => {
                            const current = prev.jurisdicciones[id];
                            return updateJurisdiccion(prev, id, {
                              planes: {
                                ...current.planes!,
                                [planKey]: { ...current.planes![planKey], cuotas },
                              },
                            });
                          })
                        }
                      />
                    </details>
                  ))}
                </div>
              ) : (
                <CuotasEditor
                  cuotas={j.cuotas ?? []}
                  onChange={(cuotas) =>
                    setDraft((prev) => updateJurisdiccion(prev, id, { cuotas }))
                  }
                />
              )}

              <label className="venc-imp-form-nota">
                Nota al pie (opcional)
                <input
                  type="text"
                  value={j.fuenteNota}
                  onChange={(e) =>
                    setDraft((prev) => updateJurisdiccion(prev, id, { fuenteNota: e.target.value }))
                  }
                />
              </label>
            </article>
          );
        })}
      </div>

      <div className="venc-imp-form-actions">
        <button
          type="button"
          className="venc-imp-form-save"
          disabled={saving}
          onClick={() => onSave(draft)}
        >
          {saving ? "Actualizando…" : "Actualizar calendarios"}
        </button>
      </div>
    </section>
  );
}
