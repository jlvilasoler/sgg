import { useMemo, useState } from "react";
import type { BpsCajaRuralCalendariosStore, CuotaBpsCajaRural } from "../types/bps-caja-rural";
import { shiftBpsCalendarioToYear } from "../types/bps-caja-rural";

interface Props {
  store: BpsCajaRuralCalendariosStore;
  saving: boolean;
  onSave: (store: BpsCajaRuralCalendariosStore) => void;
}

function cloneStore(store: BpsCajaRuralCalendariosStore): BpsCajaRuralCalendariosStore {
  return structuredClone(store);
}

function updateCuotaFecha(
  cuotas: CuotaBpsCajaRural[],
  cuota: number,
  fecha: string,
): CuotaBpsCajaRural[] {
  return cuotas.map((item) => (item.cuota === cuota ? { ...item, fecha } : item));
}

function FuenteLink({ url, label }: { url: string; label: string }) {
  const trimmed = url.trim();
  if (!trimmed) return null;
  return (
    <a href={trimmed} target="_blank" rel="noopener noreferrer" className="venc-imp-form-link">
      {label}
    </a>
  );
}

export default function BpsCajaRuralCalendariosForm({ store, saving, onSave }: Props) {
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

  const c = draft.calendario;

  return (
    <section className="venc-imp-form" aria-labelledby="venc-imp-bps-form-title">
      <header className="venc-imp-form-head">
        <div>
          <h2 id="venc-imp-bps-form-title">BPS Caja rural</h2>
          <p className="venc-imp-form-sub">
            Calendario nacional de aportes rurales BPS. Actualizá fechas y links cuando el BPS publique
            el ejercicio siguiente.
          </p>
          {updatedLabel && <p className="venc-imp-form-meta">{updatedLabel}</p>}
        </div>
        <button
          type="button"
          className="venc-imp-form-shift"
          onClick={() =>
            setDraft((prev) => ({
              ...prev,
              calendario: shiftBpsCalendarioToYear(prev.calendario, prev.calendario.anio),
            }))
          }
        >
          Ajustar fechas al ejercicio
        </button>
      </header>

      <article className="venc-imp-form-card venc-imp-form-card--wide">
        <header className="venc-imp-form-card-head">
          <h3>{c.titulo}</h3>
          <label className="venc-imp-form-anio">
            Ejercicio
            <input
              type="number"
              min={2000}
              max={2100}
              value={c.anio}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  calendario: {
                    ...prev.calendario,
                    anio: Number(e.target.value) || prev.calendario.anio,
                  },
                }))
              }
            />
          </label>
        </header>

        <label className="venc-imp-form-url">
          Subtítulo
          <input
            type="text"
            value={c.subtitulo}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                calendario: { ...prev.calendario, subtitulo: e.target.value },
              }))
            }
          />
        </label>

        <label className="venc-imp-form-url">
          Link oficial (información)
          <input
            type="url"
            value={c.fuenteUrl}
            placeholder="https://…"
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                calendario: { ...prev.calendario, fuenteUrl: e.target.value },
              }))
            }
          />
          <FuenteLink url={c.fuenteUrl} label="Abrir guía rural BPS" />
        </label>

        <label className="venc-imp-form-url">
          Link de pago / vencimientos BPS
          <input
            type="url"
            value={c.fuenteUrlPago}
            placeholder="https://www.bps.gub.uy/…"
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                calendario: { ...prev.calendario, fuenteUrlPago: e.target.value },
              }))
            }
          />
          <FuenteLink url={c.fuenteUrlPago} label="Abrir vencimientos BPS" />
        </label>

        <label className="venc-imp-form-nota">
          Notas (cuatrimestres, dígito de empresa, prórrogas, etc.)
          <textarea
            rows={4}
            value={c.fuenteNota}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                calendario: { ...prev.calendario, fuenteNota: e.target.value },
              }))
            }
          />
        </label>

        <div className="venc-imp-form-cuotas">
          {c.cuotas.map((item) => (
            <label key={item.cuota} className="venc-imp-form-cuota">
              <span>Cuatrimestre {item.cuota}</span>
              <input
                type="date"
                value={item.fecha}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    calendario: {
                      ...prev.calendario,
                      cuotas: updateCuotaFecha(prev.calendario.cuotas, item.cuota, e.target.value),
                    },
                  }))
                }
              />
            </label>
          ))}
        </div>
      </article>

      <footer className="venc-imp-form-actions">
        <button type="button" className="venc-imp-onboard-btn" onClick={() => setDraft(cloneStore(store))}>
          Descartar cambios
        </button>
        <button
          type="button"
          className="venc-imp-onboard-btn venc-imp-onboard-btn--primary"
          disabled={saving}
          onClick={() => onSave(draft)}
        >
          {saving ? "Guardando…" : "Actualizar calendario BPS"}
        </button>
      </footer>
    </section>
  );
}
