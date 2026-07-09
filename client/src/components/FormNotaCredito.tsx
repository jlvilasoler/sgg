import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createPresupuesto,
  fetchEmpresasOperativas,
  fetchFacturasParaNc,
  fetchSiguienteNumeroOperacion,
  uploadPresupuestoDocumento,
} from "../api";
import type {
  AuthUser,
  Catalogos,
  Empresa,
  PresupuestoFacturaParaNc,
  PresupuestoForm,
} from "../types";
import { formatNumeroOperacion, fmtNum, todayIso } from "../utils";
import { aMayusculas } from "../utils/formText";
import ImporteMoneda from "./ImporteMoneda";
import SelectorProveedor from "./SelectorProveedor";
import { PageModuleHeadRow } from "./PageModuleHead";

interface Props {
  catalogos: Catalogos;
  currentUser: AuthUser;
  apiOnline: boolean;
  onSaved: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string, title?: string) => void;
}

type ModoNc = "total" | "parcial";

export default function FormNotaCredito({
  catalogos,
  currentUser: _currentUser,
  apiOnline,
  onSaved,
  onError,
  onSuccess,
}: Props) {
  const [empresa, setEmpresa] = useState<Empresa | "">("");
  const [empresasCuenta, setEmpresasCuenta] = useState<string[]>(
    () => catalogos.empresas ?? [],
  );
  const [fecha, setFecha] = useState(todayIso());
  const [codigoProveedor, setCodigoProveedor] = useState("");
  const [razonProveedor, setRazonProveedor] = useState("");
  const [facturas, setFacturas] = useState<PresupuestoFacturaParaNc[]>([]);
  const [loadingFacturas, setLoadingFacturas] = useState(false);
  const [origenId, setOrigenId] = useState<number | "">("");
  const [modo, setModo] = useState<ModoNc>("total");
  const [nroNotaCredito, setNroNotaCredito] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [concepto, setConcepto] = useState("");
  const [money, setMoney] = useState({
    pesos: 0,
    dolares_usd: 0,
    reales: 0,
    tc_usd: 0,
    tc_reales: 0,
    saldo_usd: 0,
  });
  const [documentoArchivo, setDocumentoArchivo] = useState<File | null>(null);
  const [nroPreview, setNroPreview] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!apiOnline) return;
    void fetchEmpresasOperativas()
      .then((list) => {
        if (list.length) setEmpresasCuenta(list);
      })
      .catch(() => {
        /* keep catalogos */
      });
  }, [apiOnline]);

  useEffect(() => {
    if (!apiOnline) return;
    void fetchSiguienteNumeroOperacion()
      .then((r) => setNroPreview(r.nro_registro))
      .catch(() => setNroPreview(null));
  }, [apiOnline, saving]);

  const origen = useMemo(
    () => facturas.find((f) => f.id === origenId) ?? null,
    [facturas, origenId],
  );

  const cargarFacturas = useCallback(async () => {
    if (!apiOnline || !codigoProveedor.trim()) {
      setFacturas([]);
      setOrigenId("");
      return;
    }
    setLoadingFacturas(true);
    try {
      const data = await fetchFacturasParaNc({
        codigo_proveedor: codigoProveedor.trim(),
        empresa: empresa || undefined,
      });
      setFacturas(data);
      setOrigenId((prev) =>
        typeof prev === "number" && data.some((f) => f.id === prev) ? prev : "",
      );
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudieron cargar las facturas");
      setFacturas([]);
    } finally {
      setLoadingFacturas(false);
    }
  }, [apiOnline, codigoProveedor, empresa, onError]);

  useEffect(() => {
    void cargarFacturas();
  }, [cargarFacturas]);

  useEffect(() => {
    if (!origen) {
      setMoney({
        pesos: 0,
        dolares_usd: 0,
        reales: 0,
        tc_usd: 0,
        tc_reales: 0,
        saldo_usd: 0,
      });
      return;
    }
    const scale =
      Math.abs(origen.saldo_usd) > 0.0001
        ? origen.saldo_pendiente_usd / Math.abs(origen.saldo_usd)
        : 1;
    const pos = (n: number) => Math.round(Math.abs(n) * scale * 100) / 100;
    setMoney({
      pesos: pos(origen.pesos),
      dolares_usd: pos(origen.dolares_usd),
      reales: pos(origen.reales),
      tc_usd: origen.tc_usd,
      tc_reales: origen.tc_reales,
      saldo_usd: Math.round(origen.saldo_pendiente_usd * 100) / 100,
    });
    setModo("total");
    setConcepto(
      origen.nro_factura?.trim()
        ? `NC — Factura ${origen.nro_factura.trim()}`
        : `NC — Op. ${origen.nro_registro}`,
    );
  }, [origen]);

  const resetForm = () => {
    setOrigenId("");
    setModo("total");
    setNroNotaCredito("");
    setObservaciones("");
    setConcepto("");
    setDocumentoArchivo(null);
    setMoney({
      pesos: 0,
      dolares_usd: 0,
      reales: 0,
      tc_usd: 0,
      tc_reales: 0,
      saldo_usd: 0,
    });
    void cargarFacturas();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresa) {
      onError("Seleccioná la empresa.");
      return;
    }
    if (!codigoProveedor.trim()) {
      onError("Seleccioná el proveedor.");
      return;
    }
    if (!origen) {
      onError("Seleccioná la factura o gasto a anular.");
      return;
    }
    if (!nroNotaCredito.trim()) {
      onError("Ingresá el número de la nota de crédito.");
      return;
    }
    if (modo === "parcial" && !(money.saldo_usd > 0)) {
      onError("Ingresá el importe de la nota de crédito parcial.");
      return;
    }
    if (modo === "parcial" && money.saldo_usd > origen.saldo_pendiente_usd + 0.02) {
      onError(
        `El importe supera el saldo pendiente (USD ${fmtNum(origen.saldo_pendiente_usd)}).`,
      );
      return;
    }

    setSaving(true);
    try {
      const payload: PresupuestoForm & {
        tipo_comprobante: "NOTA_CREDITO";
        presupuesto_origen_id: number;
        nro_nota_credito: string;
        modo_nc: ModoNc;
      } = {
        empresa,
        fecha,
        codigo_proveedor: origen.codigo_proveedor,
        razon_social_proveedor: origen.razon_social_proveedor,
        concepto: aMayusculas(concepto.trim()) ||
          (origen.nro_factura?.trim()
            ? `NC — FACTURA ${origen.nro_factura.trim()}`
            : `NC — OP. ${origen.nro_registro}`),
        observaciones: aMayusculas(observaciones.trim()),
        rubro: origen.rubro,
        sub_rubro: origen.sub_rubro,
        responsable_gasto: origen.responsable_gasto,
        funcionario_cedula: origen.funcionario_cedula,
        nro_factura: origen.nro_factura,
        nro_operacion_origen: "",
        pesos: money.pesos,
        dolares_usd: money.dolares_usd,
        reales: money.reales,
        tc_usd: money.tc_usd,
        tc_reales: money.tc_reales,
        saldo_usd: money.saldo_usd,
        tipo_comprobante: "NOTA_CREDITO",
        presupuesto_origen_id: origen.id,
        nro_nota_credito: aMayusculas(nroNotaCredito.trim()),
        modo_nc: modo,
      };

      const created = await createPresupuesto(payload);
      if (documentoArchivo) {
        try {
          await uploadPresupuestoDocumento(created.id, documentoArchivo);
        } catch (docErr) {
          onError(
            `La NC se guardó, pero el comprobante NO se adjuntó: ${
              docErr instanceof Error ? docErr.message : "error"
            }.`,
          );
        }
      }
      onSuccess(
        `Nota de crédito N° ${formatNumeroOperacion(created.nro_registro)} registrada.`,
        "Nota de crédito",
      );
      resetForm();
      onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : "No se pudo guardar la nota de crédito.");
    } finally {
      setSaving(false);
    }
  };

  const aplicarSaldoTotal = () => {
    if (!origen) return;
    const scale =
      Math.abs(origen.saldo_usd) > 0.0001
        ? origen.saldo_pendiente_usd / Math.abs(origen.saldo_usd)
        : 1;
    const pos = (n: number) => Math.round(Math.abs(n) * scale * 100) / 100;
    setMoney({
      pesos: pos(origen.pesos),
      dolares_usd: pos(origen.dolares_usd),
      reales: pos(origen.reales),
      tc_usd: origen.tc_usd,
      tc_reales: origen.tc_reales,
      saldo_usd: Math.round(origen.saldo_pendiente_usd * 100) / 100,
    });
  };

  return (
    <div className="form-gasto-layout presupuesto-form--hub">
      <form className="card form-card gasto-factura-card gasto-nc-card" onSubmit={handleSubmit}>
        <div className="form-header">
          <span className="gasto-factura-badge gasto-nc-badge">Nota de crédito</span>
          <PageModuleHeadRow
            icon={{ source: "hub", id: "presupuesto_nota_credito" }}
            title="Ingresar nota de crédito"
            subtitle="Vinculá la NC a una factura ya cargada del mismo proveedor (total o parcial)."
          />
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="nc-empresa">Empresa *</label>
            <select
              id="nc-empresa"
              required
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value as Empresa | "")}
            >
              <option value="">Seleccionar...</option>
              {empresasCuenta.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="nc-nro-op">Número de operación</label>
            <input
              id="nc-nro-op"
              type="text"
              readOnly
              className="input-readonly"
              value={
                nroPreview != null
                  ? formatNumeroOperacion(nroPreview)
                  : apiOnline
                    ? "Asignando…"
                    : "Sin conexión"
              }
              placeholder={apiOnline ? "Asignando…" : "Sin conexión"}
              aria-readonly="true"
              title="Número único asignado por el sistema al guardar"
            />
          </div>

          <div className="field">
            <label htmlFor="nc-fecha">Fecha *</label>
            <input
              type="date"
              id="nc-fecha"
              required
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>

          <SelectorProveedor
            apiOnline={apiOnline}
            codigo={codigoProveedor}
            razonSocial={razonProveedor}
            onSelect={(cod, razon) => {
              setCodigoProveedor(cod);
              setRazonProveedor(aMayusculas(razon));
              setOrigenId("");
            }}
            onError={onError}
          />

          <div className="field">
            <label htmlFor="nc-nro">Nro. nota de crédito *</label>
            <input
              id="nc-nro"
              required
              value={nroNotaCredito}
              onChange={(e) => setNroNotaCredito(e.target.value)}
              placeholder="Número del documento NC…"
              autoComplete="off"
            />
          </div>

          <div className="field span-3">
            <label htmlFor="nc-origen">Factura / gasto a anular *</label>
            <select
              id="nc-origen"
              required
              value={origenId === "" ? "" : String(origenId)}
              disabled={!codigoProveedor || loadingFacturas}
              onChange={(e) =>
                setOrigenId(e.target.value ? Number(e.target.value) : "")
              }
            >
              <option value="">
                {!codigoProveedor
                  ? "Primero elegí un proveedor…"
                  : loadingFacturas
                    ? "Cargando facturas…"
                    : facturas.length === 0
                      ? "Sin facturas con saldo pendiente"
                      : "Seleccionar factura…"}
              </option>
              {facturas.map((f) => (
                <option key={f.id} value={f.id}>
                  {fmtDateShort(f.fecha)} · Op. {formatNumeroOperacion(f.nro_registro)}
                  {f.nro_factura ? ` · Fact. ${f.nro_factura}` : ""} · Pend. USD{" "}
                  {fmtNum(f.saldo_pendiente_usd)}
                </option>
              ))}
            </select>
            {origen ? (
              <div className="nc-origen-resumen" role="status">
                <span>
                  Original <strong>USD {fmtNum(origen.saldo_usd)}</strong>
                </span>
                <span className="nc-origen-resumen-sep" aria-hidden>
                  ·
                </span>
                <span>
                  NC aplicadas <strong>USD {fmtNum(Math.abs(origen.nc_aplicadas_usd))}</strong>
                </span>
                <span className="nc-origen-resumen-sep" aria-hidden>
                  ·
                </span>
                <span>
                  Pendiente <strong>USD {fmtNum(origen.saldo_pendiente_usd)}</strong>
                </span>
                <span className="nc-origen-resumen-sep" aria-hidden>
                  ·
                </span>
                <span className="nc-origen-resumen-rubro">
                  {origen.rubro}
                  {origen.sub_rubro ? ` / ${origen.sub_rubro}` : ""}
                </span>
              </div>
            ) : null}
          </div>

          <div className="field">
            <span className="field-action-label" id="nc-modo-label">
              Tipo de anulación *
            </span>
            <div
              className="listado-fecha-modalidad"
              role="group"
              aria-labelledby="nc-modo-label"
            >
              <button
                type="button"
                className={`listado-fecha-modalidad-btn${modo === "total" ? " is-active" : ""}`}
                disabled={!origen}
                aria-pressed={modo === "total"}
                onClick={() => {
                  setModo("total");
                  aplicarSaldoTotal();
                }}
              >
                Total
              </button>
              <button
                type="button"
                className={`listado-fecha-modalidad-btn${modo === "parcial" ? " is-active" : ""}`}
                disabled={!origen}
                aria-pressed={modo === "parcial"}
                onClick={() => setModo("parcial")}
              >
                Parcial
              </button>
            </div>
          </div>

          <div className="field span-2">
            <label htmlFor="nc-concepto">Concepto</label>
            <input
              id="nc-concepto"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder="Se completa al elegir la factura…"
              autoComplete="off"
            />
          </div>

          {origen && modo === "total" ? (
            <div className="field span-3">
              <p className="nc-saldo-total-hint">
                Se anulará el saldo pendiente completo:{" "}
                <strong>USD {fmtNum(origen.saldo_pendiente_usd)}</strong>
              </p>
            </div>
          ) : null}

          {origen && modo === "parcial" ? (
            <>
              <ImporteMoneda
                fecha={fecha}
                apiOnline={apiOnline}
                pesos={money.pesos}
                dolares_usd={money.dolares_usd}
                reales={money.reales}
                tc_usd={money.tc_usd}
                tc_reales={money.tc_reales}
                saldo_usd={money.saldo_usd}
                syncKey={origen.id}
                onMoneyChange={(patch) => setMoney((prev) => ({ ...prev, ...patch }))}
              />
              <p className="field-hint nc-importe-max-hint">
                Máximo pendiente: USD {fmtNum(origen.saldo_pendiente_usd)}
              </p>
            </>
          ) : null}

          <div className="field span-2">
            <label htmlFor="nc-obs">Observaciones</label>
            <textarea
              id="nc-obs"
              rows={3}
              placeholder="Detalle adicional de la operación (opcional)…"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="nc-doc">Comprobante (opcional)</label>
            <input
              id="nc-doc"
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => setDocumentoArchivo(e.target.files?.[0] ?? null)}
            />
            {documentoArchivo ? (
              <p className="field-hint">{documentoArchivo.name}</p>
            ) : null}
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving || !apiOnline}>
            {saving ? "Guardando…" : "Guardar"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={resetForm}
            disabled={saving}
          >
            Limpiar formulario
          </button>
        </div>
      </form>
    </div>
  );
}

function fmtDateShort(iso: string): string {
  if (!iso || iso.length < 10) return iso;
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
