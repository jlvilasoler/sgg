import { useEffect, type ReactNode } from "react";
import type { Presupuesto } from "../types";
import { empresaClass, fmtDate, fmtNum, formatNumeroOperacion } from "../utils";
import LogoHereford from "./LogoHereford";

interface Props {
  row: Presupuesto;
  onClose: () => void;
}

function Campo({
  label,
  value,
  mono,
  empty = "—",
}: {
  label: string;
  value: string | number | null | undefined;
  mono?: boolean;
  empty?: string;
}) {
  const raw =
    value === null || value === undefined
      ? ""
      : typeof value === "number"
        ? String(value)
        : String(value);
  const texto = raw.trim() || empty;
  return (
    <div className="presupuesto-detalle-item">
      <span className="presupuesto-detalle-label">{label}</span>
      <span
        className={`presupuesto-detalle-value${mono ? " presupuesto-detalle-value--mono" : ""}`}
      >
        {texto}
      </span>
    </div>
  );
}

function Seccion({
  titulo,
  children,
  grid = "dos",
}: {
  titulo: string;
  children: ReactNode;
  grid?: "dos" | "tres";
}) {
  return (
    <section className="presupuesto-detalle-seccion">
      <h4 className="presupuesto-detalle-seccion-titulo">{titulo}</h4>
      <div
        className={`presupuesto-detalle-seccion-grid${
          grid === "tres" ? " presupuesto-detalle-seccion-grid--tres" : ""
        }`}
      >
        {children}
      </div>
    </section>
  );
}

export default function PresupuestoDetalleModal({ row, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const cedula = (row.funcionario_cedula ?? "").trim();

  return (
    <div
      className="presupuesto-modal-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="presupuesto-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="presupuesto-detalle-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="presupuesto-modal-brand">
          <div className="presupuesto-modal-brand-inner">
            <LogoHereford className="presupuesto-modal-logo" />
            <div className="presupuesto-modal-brand-text">
              <span className="presupuesto-modal-scg">SGG</span>
              <span className="presupuesto-modal-scg-sub">
                Sistema de Gestión Ganadera
              </span>
            </div>
          </div>
          <button
            type="button"
            className="presupuesto-modal-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </header>

        <div className="presupuesto-modal-hero">
          <div className="presupuesto-modal-hero-main">
            <p className="presupuesto-modal-kicker">Detalle de operación</p>
            <h2 id="presupuesto-detalle-titulo" className="presupuesto-modal-op">
              N° {formatNumeroOperacion(row.nro_registro)}
            </h2>
          </div>
          <span
            className={`empresa-badge presupuesto-modal-empresa ${empresaClass(row.empresa)}`}
          >
            {row.empresa}
          </span>
        </div>

        <div className="presupuesto-modal-body">
          <div className="presupuesto-modal-columns">
            <div className="presupuesto-modal-col">
              <Seccion titulo="Datos generales">
                <Campo label="Fecha" value={fmtDate(row.fecha)} />
                <Campo
                  label="N° de registro"
                  value={formatNumeroOperacion(row.nro_registro)}
                  mono
                />
                <Campo label="Registrado" value={row.creado_en ?? ""} />
                <Campo label="N° de factura" value={row.nro_factura} />
              </Seccion>
              <Seccion titulo="Proveedor">
                <Campo label="Código proveedor" value={row.codigo_proveedor} mono />
                <Campo label="Razón social" value={row.razon_social_proveedor} />
              </Seccion>
            </div>
            <div className="presupuesto-modal-col">
              <Seccion titulo="Clasificación">
                <Campo label="Concepto" value={row.concepto} />
                <Campo label="Rubro" value={row.rubro} />
                <Campo label="Sub-rubro" value={row.sub_rubro} />
                <Campo label="Presupuesto asignado" value={row.responsable_gasto} />
                {cedula ? <Campo label="Cédula funcionario" value={cedula} mono /> : null}
              </Seccion>
            </div>
          </div>

          <Seccion titulo="Importes y cotizaciones" grid="tres">
            <Campo label="Pesos ($)" value={`${fmtNum(row.pesos)}`} mono />
            <Campo label="Dólares (USD)" value={`${fmtNum(row.dolares_usd)} USD`} mono />
            <Campo label="Reales (R$)" value={`${fmtNum(row.reales)} R$`} mono />
            <Campo
              label="Tipo de cambio USD (TC U$)"
              value={fmtNum(row.tc_usd, 4)}
              mono
            />
            <Campo
              label="Tipo de cambio R$ (TC R$)"
              value={fmtNum(row.tc_reales, 4)}
              mono
            />
            <Campo label="Total USD" value={`${fmtNum(row.saldo_usd)} USD`} mono />
          </Seccion>

          <section className="presupuesto-detalle-seccion presupuesto-detalle-seccion--obs">
            <h4 className="presupuesto-detalle-seccion-titulo">Observaciones</h4>
            <p className="presupuesto-detalle-obs">
              {(row.observaciones ?? "").trim() || "Sin observaciones registradas."}
            </p>
          </section>
        </div>

        <footer className="presupuesto-modal-footer">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  );
}
