import { useEffect, useMemo, useState } from "react";
import { fetchEmpresasOperativas } from "../../api";
import type { Catalogos } from "../../types";
import { grupoClaveOrden, grupoTituloCanon, rubroTituloCanon } from "../../utils/grupoRubro";
import ImporteMoneda from "../ImporteMoneda";
import SelectorProveedor from "../SelectorProveedor";
import {
  INTERVALO_MESES_OPCIONES,
  programacionResumen,
  type AutomatizacionPlantillaFormState,
} from "./automatizacion-plantilla-form";

interface Props {
  form: AutomatizacionPlantillaFormState;
  onChange: (patch: Partial<AutomatizacionPlantillaFormState>) => void;
  catalogos: Catalogos;
  apiOnline: boolean;
  origenLabel?: string;
  showActivo?: boolean;
  moneySyncKey?: number;
  onError: (msg: string) => void;
  onSuccess?: (msg: string, title?: string) => void;
}

export default function AutomatizacionPlantillaForm({
  form,
  onChange,
  catalogos,
  apiOnline,
  origenLabel,
  showActivo = false,
  moneySyncKey = 0,
  onError,
  onSuccess,
}: Props) {
  const [empresas, setEmpresas] = useState<string[]>(catalogos.empresas);

  useEffect(() => {
    if (!apiOnline) return;
    void fetchEmpresasOperativas()
      .then((list) => {
        if (list.length) setEmpresas(list);
      })
      .catch(() => undefined);
  }, [apiOnline]);

  const catalogoRubros = useMemo(
    () => ({
      rubros: catalogos.rubros,
      sub_rubros_por_rubro: catalogos.sub_rubros_por_rubro,
    }),
    [catalogos.rubros, catalogos.sub_rubros_por_rubro]
  );

  const rubroCanon = form.rubro ? grupoTituloCanon(form.rubro) : "";

  const rubroOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of catalogoRubros.rubros) {
      const key = grupoClaveOrden(grupoTituloCanon(r));
      if (!seen.has(key)) seen.set(key, grupoTituloCanon(r));
    }
    if (rubroCanon) {
      const key = grupoClaveOrden(rubroCanon);
      if (!seen.has(key)) seen.set(key, rubroCanon);
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b, "es"));
  }, [catalogoRubros.rubros, rubroCanon]);

  const subRubros = useMemo(() => {
    if (!rubroCanon) return [];
    const map = catalogoRubros.sub_rubros_por_rubro;
    let base = map[rubroCanon] ?? [];
    if (!base.length) {
      const clave = grupoClaveOrden(rubroCanon);
      for (const [k, items] of Object.entries(map)) {
        if (grupoClaveOrden(rubroTituloCanon(k)) === clave) base = items;
      }
    }
    const extra = form.sub_rubro && !base.includes(form.sub_rubro) ? [form.sub_rubro] : [];
    return [...base, ...extra];
  }, [catalogoRubros.sub_rubros_por_rubro, rubroCanon, form.sub_rubro]);

  return (
    <div className="presupuesto-auto-form presupuesto-auto-form--compact">
      {origenLabel ? (
        <p className="presupuesto-auto-form-origen muted" title="Factura de origen">
          Origen: <strong>{origenLabel}</strong>
        </p>
      ) : null}

      <section className="presupuesto-auto-form-section" aria-label="Programación">
        <h3 className="presupuesto-auto-form-section-title">Programación</h3>
        <div className="presupuesto-auto-form-grid presupuesto-auto-form-grid--sched">
          <div className="field">
            <label htmlFor="auto-fecha-inicio">Desde (primer pago automático)</label>
            <input
              id="auto-fecha-inicio"
              type="date"
              value={form.fecha_inicio.slice(0, 10)}
              onChange={(e) => onChange({ fecha_inicio: e.target.value })}
            />
          </div>
          <div className="field field--narrow">
            <label htmlFor="auto-dia-mes">Día</label>
            <input
              id="auto-dia-mes"
              type="number"
              min={1}
              max={31}
              value={form.dia_mes}
              onChange={(e) =>
                onChange({
                  dia_mes: Math.min(31, Math.max(1, Number(e.target.value) || 1)),
                })
              }
            />
          </div>
          <div className="field">
            <label htmlFor="auto-intervalo">Frecuencia</label>
            <select
              id="auto-intervalo"
              value={form.intervalo_meses}
              onChange={(e) => onChange({ intervalo_meses: Number(e.target.value) || 1 })}
            >
              {INTERVALO_MESES_OPCIONES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="presupuesto-auto-form-resumen">{programacionResumen(form)}</p>
        <div className="field">
          <label htmlFor="auto-nombre">Nombre de la regla</label>
          <input
            id="auto-nombre"
            type="text"
            value={form.nombre}
            onChange={(e) => onChange({ nombre: e.target.value })}
            placeholder="Ej. Alquiler, Internet, Sueldo…"
          />
        </div>
      </section>

      <section className="presupuesto-auto-form-section" aria-label="Clasificación">
        <h3 className="presupuesto-auto-form-section-title">Clasificación</h3>
        <div className="presupuesto-auto-form-grid">
          <div className="field">
            <label htmlFor="auto-empresa">Empresa</label>
            <select
              id="auto-empresa"
              value={form.empresa}
              onChange={(e) => onChange({ empresa: e.target.value })}
            >
              <option value="">Seleccionar…</option>
              {empresas.map((emp) => (
                <option key={emp} value={emp}>
                  {emp}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="auto-rubro">Rubro</label>
            <select
              id="auto-rubro"
              value={rubroCanon}
              onChange={(e) => {
                const rubro = e.target.value;
                onChange({ rubro, sub_rubro: "" });
              }}
            >
              <option value="">Seleccionar…</option>
              {rubroOptions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="auto-sub-rubro">Sub-rubro</label>
            <select
              id="auto-sub-rubro"
              value={form.sub_rubro}
              onChange={(e) => onChange({ sub_rubro: e.target.value })}
              disabled={!rubroCanon}
            >
              <option value="">—</option>
              {subRubros.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="auto-responsable">Responsable</label>
            <select
              id="auto-responsable"
              value={form.responsable_gasto}
              onChange={(e) => onChange({ responsable_gasto: e.target.value })}
            >
              <option value="">—</option>
              {catalogos.responsables.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field presupuesto-auto-form-proveedor">
          <label>Proveedor</label>
          <SelectorProveedor
            apiOnline={apiOnline}
            codigo={form.codigo_proveedor}
            razonSocial={form.razon_social_proveedor}
            onSelect={(cod, razon) =>
              onChange({ codigo_proveedor: cod, razon_social_proveedor: razon })
            }
            onError={onError}
            onSuccess={onSuccess}
          />
        </div>
      </section>

      <section className="presupuesto-auto-form-section" aria-label="Detalle e importes">
        <h3 className="presupuesto-auto-form-section-title">Detalle e importes</h3>
        <div className="presupuesto-auto-form-grid presupuesto-auto-form-grid--detail">
          <div className="field">
            <label htmlFor="auto-concepto">Concepto</label>
            <input
              id="auto-concepto"
              type="text"
              value={form.concepto}
              onChange={(e) => onChange({ concepto: e.target.value })}
            />
          </div>
          <div className="field field--factura">
            <label htmlFor="auto-factura">Nº factura</label>
            <input
              id="auto-factura"
              type="text"
              value={form.nro_factura}
              onChange={(e) => onChange({ nro_factura: e.target.value })}
            />
          </div>
          <div className="field presupuesto-auto-form-span-full">
            <label htmlFor="auto-obs">Observaciones</label>
            <input
              id="auto-obs"
              type="text"
              value={form.observaciones}
              onChange={(e) => onChange({ observaciones: e.target.value })}
            />
          </div>
        </div>
        <ImporteMoneda
          fecha={form.fecha_inicio}
          apiOnline={apiOnline}
          pesos={form.pesos}
          dolares_usd={form.dolares_usd}
          reales={form.reales}
          tc_usd={form.tc_usd}
          tc_reales={form.tc_reales}
          saldo_usd={form.saldo_usd}
          syncKey={moneySyncKey}
          onMoneyChange={(patch) => onChange(patch)}
        />
      </section>

      {showActivo ? (
        <label className="presupuesto-auto-check">
          <input
            type="checkbox"
            checked={form.activo}
            onChange={(e) => onChange({ activo: e.target.checked })}
          />
          Automatización activa
        </label>
      ) : null}
    </div>
  );
}
