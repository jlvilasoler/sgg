import type { BrouImporte, PresupuestoForm } from "../../types";
import { PageModuleHeadRow } from "../PageModuleHead";
import ImporteMoneda from "../ImporteMoneda";
import {
  importeDesdeRegistro,
  inferirMonedaDesdeRegistro,
  type MonedaGasto,
} from "../../utils/importeMoneda";

interface Props {
  payload: PresupuestoForm;
  comision?: BrouImporte | null;
  concepto: string;
  onConceptoChange: (value: string) => void;
  manual?: boolean;
  apiOnline?: boolean;
  fecha?: string;
  manualMoney?: Pick<
    PresupuestoForm,
    "pesos" | "dolares_usd" | "reales" | "tc_usd" | "tc_reales" | "saldo_usd"
  >;
  onManualMoneyChange?: (
    patch: Pick<
      PresupuestoForm,
      "pesos" | "dolares_usd" | "reales" | "tc_usd" | "tc_reales" | "saldo_usd"
    >
  ) => void;
  manualSyncKey?: number;
}

const MONEDA_LABEL: Record<MonedaGasto, string> = {
  UYU: "Pesos ($)",
  USD: "Dólares (USD)",
  BRL: "Reales (R$)",
};

function formatFechaDisplay(iso: string): string {
  if (!iso.trim()) return "—";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return iso;
}

function formatImporte(moneda: MonedaGasto, valor: number): string {
  if (valor <= 0) return "—";
  const sym = moneda === "USD" ? "U$S" : moneda === "BRL" ? "R$" : "$";
  return `${sym} ${valor.toLocaleString("es-UY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function CampoPreview({
  id,
  label,
  value,
  span2,
}: {
  id: string;
  label: string;
  value: string;
  span2?: boolean;
}) {
  if (!value.trim() || value === "—") return null;
  return (
    <div className={`field${span2 ? " span-2" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <input id={id} type="text" readOnly className="input-readonly" value={value} />
    </div>
  );
}

export default function ComisionBrouPreviewForm({
  payload,
  comision,
  concepto,
  onConceptoChange,
  manual = false,
  apiOnline = false,
  fecha = "",
  manualMoney,
  onManualMoneyChange,
  manualSyncKey = 0,
}: Props) {
  let moneda = inferirMonedaDesdeRegistro(payload);
  let importe = importeDesdeRegistro(moneda, payload);
  if (importe <= 0 && comision && comision.valor > 0) {
    moneda = comision.moneda === "USD" ? "USD" : "UYU";
    importe = comision.valor;
  }
  const proveedor =
    payload.codigo_proveedor && payload.razon_social_proveedor
      ? `${payload.codigo_proveedor} — ${payload.razon_social_proveedor}`
      : payload.razon_social_proveedor || payload.codigo_proveedor || "";

  const equivalenteUsd =
    payload.saldo_usd > 0
      ? `${payload.saldo_usd.toLocaleString("es-UY", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} USD`
      : "";

  return (
    <div className="card form-card comision-brou-preview-card">
      <div className="form-header comision-brou-preview-header">
        <span className="comision-brou-preview-badge">Comisión bancaria</span>
        <PageModuleHeadRow
          icon={{ source: "app", id: "registro" }}
          title="Comisión bancaria (operación separada)"
          subtitle={
            manual ? (
              <>
                Complete los datos de la comisión que se registrará como un{" "}
                <strong>segundo gasto</strong> al guardar.
              </>
            ) : (
              <>
                Vista previa de los datos que se registrarán como un{" "}
                <strong>segundo gasto</strong> al guardar la transferencia.
              </>
            )
          }
        />
      </div>

      <div className="form-grid">
        <CampoPreview id="com-prev-empresa" label="Empresa" value={payload.empresa} />
        <CampoPreview
          id="com-prev-nro-op"
          label="N° operación (documento BROU)"
          value={payload.nro_operacion_origen}
        />
        <CampoPreview
          id="com-prev-fecha"
          label="Fecha"
          value={formatFechaDisplay(payload.fecha)}
        />
        <CampoPreview
          id="com-prev-proveedor"
          label="Proveedor"
          value={proveedor}
          span2
        />
        <CampoPreview id="com-prev-factura" label="Nro. factura" value={payload.nro_factura} />
        <CampoPreview id="com-prev-rubro" label="Rubro" value={payload.rubro} />
        <CampoPreview id="com-prev-sub-rubro" label="Sub-rubro" value={payload.sub_rubro} />
        <CampoPreview
          id="com-prev-responsable"
          label="Presupuesto asignado"
          value={payload.responsable_gasto}
        />
        <div className="field span-2">
          <label htmlFor="com-prev-concepto">Concepto</label>
          <input
            id="com-prev-concepto"
            type="text"
            value={concepto}
            onChange={(e) => onConceptoChange(e.target.value)}
            placeholder="Concepto de la comisión…"
          />
        </div>
        {manual && manualMoney && onManualMoneyChange ? (
          <div className="field span-2 comision-brou-preview-importe">
            <ImporteMoneda
              fecha={fecha || payload.fecha}
              apiOnline={apiOnline}
              pesos={manualMoney.pesos}
              dolares_usd={manualMoney.dolares_usd}
              reales={manualMoney.reales}
              tc_usd={manualMoney.tc_usd || payload.tc_usd}
              tc_reales={manualMoney.tc_reales}
              saldo_usd={manualMoney.saldo_usd}
              syncKey={manualSyncKey}
              onMoneyChange={onManualMoneyChange}
            />
          </div>
        ) : (
          <>
            <div className="field">
              <label htmlFor="com-prev-moneda">Moneda</label>
              <input
                id="com-prev-moneda"
                type="text"
                readOnly
                className="input-readonly"
                value={importe > 0 ? MONEDA_LABEL[moneda] : "—"}
              />
            </div>
            <div className="field">
              <label htmlFor="com-prev-importe">Importe (comisión)</label>
              <input
                id="com-prev-importe"
                type="text"
                readOnly
                className="input-readonly"
                value={formatImporte(moneda, importe)}
              />
            </div>
            {equivalenteUsd ? (
              <div className="field">
                <label htmlFor="com-prev-equiv">Equivalente USD</label>
                <input
                  id="com-prev-equiv"
                  type="text"
                  readOnly
                  className="input-readonly"
                  value={equivalenteUsd}
                />
              </div>
            ) : null}
          </>
        )}
        <CampoPreview
          id="com-prev-obs"
          label="Observaciones"
          value={payload.observaciones}
          span2
        />
      </div>
    </div>
  );
}
