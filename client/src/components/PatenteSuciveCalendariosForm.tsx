import { useMemo, useState } from "react";
import type { CuotaPatenteSucive, PatenteSuciveCalendariosStore } from "../types/patente-sucive";
import { shiftPatenteCalendarioToYear } from "../types/patente-sucive";
import { safeExternalHref } from "../utils/safe-url";

interface Props {
  store: PatenteSuciveCalendariosStore;
  saving: boolean;
  onSave: (store: PatenteSuciveCalendariosStore) => void;
}

function cloneStore(store: PatenteSuciveCalendariosStore): PatenteSuciveCalendariosStore {
  return structuredClone(store);
}

function updateCuotaFecha(
  cuotas: CuotaPatenteSucive[],
  cuota: number,
  fecha: string,
): CuotaPatenteSucive[] {
  return cuotas.map((item) => (item.cuota === cuota ? { ...item, fecha } : item));
}

function FuenteLink({ url, label }: { url: string; label: string }) {
  const href = safeExternalHref(url);
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="venc-imp-form-link">
      {label}
    </a>
  );
}

export default function PatenteSuciveCalendariosForm({ store, saving, onSave }: Props) {
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
    <section className="venc-imp-form" aria-labelledby="venc-imp-patente-form-title">
      <header className="venc-imp-form-head">
        <div>
          <h2 id="venc-imp-patente-form-title">Patente de rodados (SUCIVE)</h2>
          <p className="venc-imp-form-sub">
            Calendario nacional único para todo Uruguay. Actualizá fechas y links cuando SUCIVE publique
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
              calendario: shiftPatenteCalendarioToYear(prev.calendario, prev.calendario.anio),
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
          <FuenteLink url={c.fuenteUrl} label="Abrir información oficial" />
        </label>

        <label className="venc-imp-form-url">
          Link de pago / consulta SUCIVE
          <input
            type="url"
            value={c.fuenteUrlPago}
            placeholder="https://www.sucive.gub.uy/…"
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                calendario: { ...prev.calendario, fuenteUrlPago: e.target.value },
              }))
            }
          />
          <FuenteLink url={c.fuenteUrlPago} label="Abrir SUCIVE" />
        </label>

        <label className="venc-imp-form-nota">
          Notas (descuentos, feriados, etc.)
          <textarea
            rows={3}
            value={c.fuenteNota}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                calendario: { ...prev.calendario, fuenteNota: e.target.value },
              }))
            }
          />
        </label>

        <label className="venc-imp-form-url venc-imp-form-check-row">
          <input
            type="checkbox"
            checked={c.primeraCuotaPagoContado}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                calendario: { ...prev.calendario, primeraCuotaPagoContado: e.target.checked },
              }))
            }
          />
          Pago contado anual en la 1ª cuota
        </label>

        <div className="venc-imp-form-cuotas">
          {c.cuotas.map((item) => (
            <label key={item.cuota} className="venc-imp-form-cuota">
              <span>Cuota {item.cuota}</span>
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
          {saving ? "Guardando…" : "Actualizar calendario SUCIVE"}
        </button>
      </footer>
    </section>
  );
}
