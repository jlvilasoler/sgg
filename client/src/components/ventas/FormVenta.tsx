import { useEffect, useMemo, useState } from "react";
import {
  createIngresoVenta,
  fetchSiguienteNumeroOperacionVenta,
  fetchTipoCambioParaFecha,
  updateIngresoVenta,
} from "../../api";
import type { IngresoVenta, IngresoVentaForm } from "../../types";
import { formatNumeroOperacion, todayIso, fmtNum } from "../../utils";
import { aMayusculas } from "../../utils/formText";
import { calcularTotalUsdVenta } from "../../utils/importeMoneda";
import SelectorProveedor from "../SelectorProveedor";

interface Props {
  editRow: IngresoVenta | null;
  apiOnline: boolean;
  onSaved: () => void;
  onCancelEdit: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string, title?: string) => void;
  onVolver: () => void;
}

const CAMPOS_TEXTO = [
  "codigo_proveedor",
  "razon_social_proveedor",
  "concepto",
  "nro_factura",
] as const;

function rowToForm(row: IngresoVenta): IngresoVentaForm {
  const { id: _id, nro_registro: _n, total_usd: _t, creado_en: _c, ...rest } = row;
  const base = { ...rest };
  for (const k of CAMPOS_TEXTO) {
    const v = base[k];
    if (typeof v === "string") base[k] = aMayusculas(v);
  }
  return base;
}

const initial = (): IngresoVentaForm => ({
  fecha: todayIso(),
  codigo_proveedor: "",
  razon_social_proveedor: "",
  concepto: "",
  nro_factura: "",
  pesos: 0,
  dolares_usd: 0,
  tc_usd: 0,
});

export default function FormVenta({
  editRow,
  apiOnline,
  onSaved,
  onCancelEdit,
  onError,
  onSuccess,
  onVolver,
}: Props) {
  const [form, setForm] = useState<IngresoVentaForm>(initial);
  const [numeroOperacion, setNumeroOperacion] = useState("");
  const [tcAuto, setTcAuto] = useState(false);
  const [tcFecha, setTcFecha] = useState("");

  const totalUsd = useMemo(
    () => calcularTotalUsdVenta(form.pesos, form.dolares_usd, form.tc_usd),
    [form.pesos, form.dolares_usd, form.tc_usd]
  );

  useEffect(() => {
    if (editRow) {
      setForm(rowToForm(editRow));
      setNumeroOperacion(formatNumeroOperacion(editRow.nro_registro));
      return;
    }
    setForm(initial());
    if (!apiOnline) {
      setNumeroOperacion("");
      return;
    }
    fetchSiguienteNumeroOperacionVenta()
      .then((d) => setNumeroOperacion(d.numero_operacion))
      .catch(() => setNumeroOperacion(""));
  }, [editRow, apiOnline]);

  useEffect(() => {
    if (!form.fecha || !apiOnline || editRow) return;
    let cancelled = false;
    fetchTipoCambioParaFecha("UYU_USD", form.fecha)
      .then((row) => {
        if (cancelled || !row || row.valor <= 0) return;
        setForm((f) => ({ ...f, tc_usd: row.valor }));
        setTcAuto(true);
        setTcFecha(row.fecha_tc);
      })
      .catch(() => {
        if (!cancelled) setTcAuto(false);
      });
    return () => {
      cancelled = true;
    };
  }, [form.fecha, apiOnline, editRow]);

  const set = <K extends keyof IngresoVentaForm>(key: K, value: IngresoVentaForm[K]) => {
    const sinMayus = key === "fecha";
    const val =
      typeof value === "string" && !sinMayus
        ? (aMayusculas(value) as IngresoVentaForm[K])
        : value;
    setForm((f) => ({ ...f, [key]: val }));
    if (key === "tc_usd") setTcAuto(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiOnline) {
      onError("Iniciá la API con npm run dev en la carpeta del proyecto");
      return;
    }
    if (!form.concepto.trim()) {
      onError("Ingresá el concepto");
      return;
    }
    if (form.pesos <= 0 && form.dolares_usd <= 0) {
      onError("Ingresá un importe en pesos o en dólares");
      return;
    }
    if (form.pesos > 0 && form.tc_usd <= 0) {
      onError("Ingresá el tipo de cambio (TC) para convertir pesos a USD");
      return;
    }
    try {
      if (editRow) {
        await updateIngresoVenta(editRow.id, form);
        onSuccess("Los cambios se guardaron.", "Documento actualizado");
      } else {
        const reg = await createIngresoVenta(form);
        onSuccess(
          `Nro. de operación: ${formatNumeroOperacion(reg.nro_registro)}`,
          "Ingreso por venta registrado"
        );
      }
      setForm(initial());
      if (apiOnline) {
        fetchSiguienteNumeroOperacionVenta()
          .then((d) => setNumeroOperacion(d.numero_operacion))
          .catch(() => setNumeroOperacion(""));
      } else {
        setNumeroOperacion("");
      }
      onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al guardar");
    }
  };

  return (
    <div className="subseccion-panel">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver a Ingresos por ventas
      </button>

      <form className="card form-card" onSubmit={handleSubmit}>
        <div className="form-header">
          <h2>
            {editRow
              ? `Editar documento — Operación N° ${formatNumeroOperacion(editRow.nro_registro)}`
              : "Documentos a ingresar por ventas"}
          </h2>
          <p className="muted">Registro de ingresos por ventas — tabla INGRESOS_VENTAS</p>
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="venta-nro-operacion">Número de operación</label>
            <input
              id="venta-nro-operacion"
              type="text"
              readOnly
              className="input-readonly"
              value={numeroOperacion}
              placeholder={apiOnline ? "Asignando…" : "Sin conexión"}
              aria-readonly="true"
            />
          </div>

          <div className="field">
            <label htmlFor="venta-fecha">Fecha *</label>
            <input
              type="date"
              id="venta-fecha"
              required
              value={form.fecha}
              onChange={(e) => set("fecha", e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="venta-nro-factura">Nro. factura</label>
            <input
              id="venta-nro-factura"
              value={form.nro_factura}
              onChange={(e) => set("nro_factura", e.target.value)}
            />
          </div>

          <SelectorProveedor
            apiOnline={apiOnline}
            codigo={form.codigo_proveedor}
            razonSocial={form.razon_social_proveedor}
            onSelect={(cod, razon) => {
              set("codigo_proveedor", cod);
              set("razon_social_proveedor", razon);
            }}
            onError={onError}
            onSuccess={onSuccess}
          />

          <div className="field span-3">
            <label htmlFor="venta-concepto">Concepto *</label>
            <input
              id="venta-concepto"
              type="text"
              required
              placeholder="Ej: Venta novillos, faena, hacienda…"
              value={form.concepto}
              onChange={(e) => set("concepto", e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="field money">
            <label htmlFor="venta-pesos">Pesos $</label>
            <input
              id="venta-pesos"
              type="number"
              step="0.01"
              min={0}
              value={form.pesos || ""}
              onChange={(e) => set("pesos", Number(e.target.value) || 0)}
            />
          </div>

          <div className="field money">
            <label htmlFor="venta-usd">Dólares USD</label>
            <input
              id="venta-usd"
              type="number"
              step="0.01"
              min={0}
              value={form.dolares_usd || ""}
              onChange={(e) => set("dolares_usd", Number(e.target.value) || 0)}
            />
          </div>

          <div className="field">
            <label htmlFor="venta-tc">TC (pesos uruguayos por 1 USD)</label>
            <input
              id="venta-tc"
              type="number"
              step="0.0001"
              min={0}
              value={form.tc_usd || ""}
              onChange={(e) => set("tc_usd", Number(e.target.value) || 0)}
            />
            {tcAuto && tcFecha && (
              <p className="hint-muted">
                TC del {tcFecha} (catálogo Divisas). Podés modificarlo.
              </p>
            )}
            {!apiOnline && (
              <p className="hint-muted">Sin API: ingresá el TC manualmente.</p>
            )}
          </div>

          <div className="field money importe-moneda-usd">
            <label>Total USD</label>
            <output className="importe-usd-output" aria-live="polite">
              {fmtNum(totalUsd)} USD
            </output>
            <p className="hint-muted">
              Pesos ÷ TC + dólares directos.
            </p>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            {editRow ? "Actualizar documento" : "Guardar ingreso"}
          </button>
          {editRow && (
            <button type="button" className="btn btn-secondary" onClick={onCancelEdit}>
              Cancelar edición
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setForm(initial());
              onCancelEdit();
            }}
          >
            Limpiar formulario
          </button>
        </div>
      </form>
    </div>
  );
}
