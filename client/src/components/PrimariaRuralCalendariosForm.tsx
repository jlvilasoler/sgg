import { useMemo, useState } from "react";
import type {
  CuotaPrimariaRural,
  PrimariaRuralCalendariosStore,
  RegimenPrimariaRuralKey,
} from "../types/primaria-rural";
import { REGIMEN_PRIMARIA_RURAL_LABEL, shiftPrimariaCalendarioToYear } from "../types/primaria-rural";
import { safeExternalHref } from "../utils/safe-url";

interface Props {
  store: PrimariaRuralCalendariosStore;
  saving: boolean;
  onSave: (store: PrimariaRuralCalendariosStore) => void;
}

function cloneStore(store: PrimariaRuralCalendariosStore): PrimariaRuralCalendariosStore {
  return structuredClone(store);
}

function updateCuotaFecha(
  cuotas: CuotaPrimariaRural[],
  cuota: number,
  fecha: string,
): CuotaPrimariaRural[] {
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

const REGIMEN_ORDER: RegimenPrimariaRuralKey[] = ["con_explotacion", "sin_explotacion"];

export default function PrimariaRuralCalendariosForm({ store, saving, onSave }: Props) {
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
    <section className="venc-imp-form" aria-labelledby="venc-imp-primaria-form-title">
      <header className="venc-imp-form-head">
        <div>
          <h2 id="venc-imp-primaria-form-title">Impuesto Primaria (rural)</h2>
          <p className="venc-imp-form-sub">
            Calendario nacional DGI para padrones rurales. Actualizá fechas y links cuando la DGI publique
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
              calendario: shiftPrimariaCalendarioToYear(prev.calendario, prev.calendario.anio),
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
          Vencimientos DGI
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
          <FuenteLink url={c.fuenteUrl} label="Abrir vencimientos Primaria" />
        </label>

        <label className="venc-imp-form-url">
          Padrones rurales
          <input
            type="url"
            value={c.fuenteUrlPadrones}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                calendario: { ...prev.calendario, fuenteUrlPadrones: e.target.value },
              }))
            }
          />
          <FuenteLink url={c.fuenteUrlPadrones} label="Abrir padrones rurales DGI" />
        </label>

        <label className="venc-imp-form-url">
          Declaración jurada
          <input
            type="url"
            value={c.fuenteUrlDj}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                calendario: { ...prev.calendario, fuenteUrlDj: e.target.value },
              }))
            }
          />
          <FuenteLink url={c.fuenteUrlDj} label="Abrir info declaración jurada" />
        </label>

        <label className="venc-imp-form-url">
          Sobre pagos
          <input
            type="url"
            value={c.fuenteUrlPago}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                calendario: { ...prev.calendario, fuenteUrlPago: e.target.value },
              }))
            }
          />
          <FuenteLink url={c.fuenteUrlPago} label="Abrir info de pago DGI" />
        </label>

        <label className="venc-imp-form-cuota">
          <span>Declaración jurada (con explotación)</span>
          <input
            type="date"
            value={c.declaracionJuradaFecha}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                calendario: { ...prev.calendario, declaracionJuradaFecha: e.target.value },
              }))
            }
          />
        </label>

        <label className="venc-imp-form-nota">
          Nota declaración jurada
          <textarea
            rows={3}
            value={c.declaracionJuradaNota}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                calendario: { ...prev.calendario, declaracionJuradaNota: e.target.value },
              }))
            }
          />
        </label>

        <label className="venc-imp-form-nota">
          Notas generales (boleto, pago, etc.)
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

        <label className="venc-imp-form-nota">
          Boleto de pago
          <textarea
            rows={2}
            value={c.boletoNota}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                calendario: { ...prev.calendario, boletoNota: e.target.value },
              }))
            }
          />
        </label>

        <label className="venc-imp-form-nota">
          Exoneración pequeños productores
          <textarea
            rows={2}
            value={c.exoneracionNota}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                calendario: { ...prev.calendario, exoneracionNota: e.target.value },
              }))
            }
          />
        </label>

        {REGIMEN_ORDER.map((regimenKey) => {
          const regimen = c.regimens[regimenKey];
          return (
            <div key={regimenKey} className="venc-imp-form-regimen">
              <h4>{REGIMEN_PRIMARIA_RURAL_LABEL[regimenKey]}</h4>
              <label className="venc-imp-form-nota">
                Detalle del régimen
                <textarea
                  rows={2}
                  value={regimen.detalle}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      calendario: {
                        ...prev.calendario,
                        regimens: {
                          ...prev.calendario.regimens,
                          [regimenKey]: { ...regimen, detalle: e.target.value },
                        },
                      },
                    }))
                  }
                />
              </label>
              <div className="venc-imp-form-cuotas">
                {regimen.cuotas.map((item) => (
                  <label key={`${regimenKey}-${item.cuota}`} className="venc-imp-form-cuota">
                    <span>Cuota {item.cuota}</span>
                    <input
                      type="date"
                      value={item.fecha}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          calendario: {
                            ...prev.calendario,
                            regimens: {
                              ...prev.calendario.regimens,
                              [regimenKey]: {
                                ...regimen,
                                cuotas: updateCuotaFecha(regimen.cuotas, item.cuota, e.target.value),
                              },
                            },
                          },
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
            </div>
          );
        })}
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
          {saving ? "Guardando…" : "Actualizar calendario Primaria rural"}
        </button>
      </footer>
    </section>
  );
}
