import { type ReactNode } from "react";
import { useHeaderBackStep } from "../header-back";
import type { Presupuesto } from "../types";
import { empresaClass, fmtDate, fmtNum, formatNumeroOperacion } from "../utils";
import { IconCancelar } from "./icons/ActionIcons";
import SubseccionInlinePanel from "./SubseccionInlinePanel";

interface Props {
  row: Presupuesto;
  onVolver: () => void;
  volverLabel?: string;
}

interface ModalProps {
  row: Presupuesto;
  onClose: () => void;
}

type MonedaPrincipal = "UYU" | "USD" | "BRL";

function fmtDateTime(iso?: string | null): string {
  if (!iso?.trim()) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.trim();
  return d.toLocaleString("es-UY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function monedaPrincipal(row: Presupuesto): MonedaPrincipal {
  if ((row.dolares_usd ?? 0) > 0) return "USD";
  if ((row.reales ?? 0) > 0) return "BRL";
  return "UYU";
}

function Campo({
  label,
  value,
  mono,
  empty = "—",
  full,
}: {
  label: string;
  value: string | number | null | undefined;
  mono?: boolean;
  empty?: string;
  full?: boolean;
}) {
  const raw =
    value === null || value === undefined
      ? ""
      : typeof value === "number"
        ? String(value)
        : String(value);
  const texto = raw.trim() || empty;
  const vacio = texto === empty;

  return (
    <div className={`presupuesto-detalle-campo${full ? " presupuesto-detalle-campo--full" : ""}`}>
      <span className="presupuesto-detalle-label">{label}</span>
      <span
        className={[
          "presupuesto-detalle-valor",
          mono ? " num" : "",
          vacio ? " presupuesto-detalle-valor--vacio" : "",
        ].join("")}
        title={texto !== empty ? texto : undefined}
      >
        {texto}
      </span>
    </div>
  );
}

function Bloque({
  titulo,
  icono,
  children,
  cols = 2,
}: {
  titulo: string;
  icono: ReactNode;
  children: ReactNode;
  cols?: 1 | 2 | 3;
}) {
  return (
    <section className="presupuesto-detalle-block">
      <h3 className="presupuesto-detalle-block-title">
        <span className="presupuesto-detalle-block-icon" aria-hidden>
          {icono}
        </span>
        {titulo}
      </h3>
      <div
        className={[
          "presupuesto-detalle-fields",
          cols === 3 ? " presupuesto-detalle-fields--3" : "",
          cols === 1 ? " presupuesto-detalle-fields--1" : "",
        ].join("")}
      >
        {children}
      </div>
    </section>
  );
}

function IconDoc() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M14 2v6h6M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function IconTag() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle cx="7" cy="7" r="1.5" fill="currentColor" />
    </svg>
  );
}

function IconBuilding() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4M9 9h.01M15 9h.01M9 13h.01M15 13h.01"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconNote() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M14 2v6h6M8 13h8M8 17h6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function DetalleContenido({ row }: { row: Presupuesto }) {
  const cedula = (row.funcionario_cedula ?? "").trim();
  const obs = (row.observaciones ?? "").trim();
  const ingresado =
    (row.ingresado_por_nombre ?? "").trim() || (row.ingresado_por_email ?? "").trim();
  const principal = monedaPrincipal(row);
  const nroOp = formatNumeroOperacion(row.nro_registro);

  const montos = [
    {
      id: "UYU" as const,
      label: "Pesos",
      valor: row.pesos,
      activo: principal === "UYU",
      fmt: (v: number) => `$ ${fmtNum(v)}`,
    },
    {
      id: "USD" as const,
      label: "Dólares",
      valor: row.dolares_usd,
      activo: principal === "USD",
      fmt: (v: number) => `${fmtNum(v)} USD`,
    },
    {
      id: "BRL" as const,
      label: "Reales",
      valor: row.reales,
      activo: principal === "BRL",
      fmt: (v: number) => `${fmtNum(v)} R$`,
    },
  ] as const;

  return (
    <>
      <div className="presupuesto-detalle-hero">
        <div className="presupuesto-detalle-hero-top">
          <div className="presupuesto-detalle-hero-badges">
            <span className="presupuesto-detalle-op num">N° {nroOp}</span>
            <span
              className={`presupuesto-detalle-empresa empresa-badge ${empresaClass(row.empresa)}`}
            >
              {row.empresa}
            </span>
          </div>
          <div className="presupuesto-detalle-chips">
            <span className="presupuesto-detalle-chip presupuesto-detalle-chip--rubro">
              {row.rubro}
            </span>
            {row.sub_rubro?.trim() ? (
              <>
                <span className="presupuesto-detalle-chip-sep" aria-hidden>
                  ›
                </span>
                <span className="presupuesto-detalle-chip presupuesto-detalle-chip--sub">
                  {row.sub_rubro}
                </span>
              </>
            ) : null}
          </div>
        </div>
        <p className="presupuesto-detalle-concepto">{row.concepto}</p>
      </div>

      <section className="presupuesto-detalle-finanzas" aria-label="Importes y cotizaciones">
        <div className="presupuesto-detalle-montos">
          {montos.map((m) => (
            <div
              key={m.id}
              className={`presupuesto-detalle-monto${
                m.activo ? " presupuesto-detalle-monto--activo" : ""
              }`}
            >
              <span className="presupuesto-detalle-monto-k">{m.label}</span>
              <span className="presupuesto-detalle-monto-v num">{m.fmt(m.valor)}</span>
              {m.activo ? (
                <span className="presupuesto-detalle-monto-tag">Moneda ingresada</span>
              ) : null}
            </div>
          ))}
          <div className="presupuesto-detalle-monto presupuesto-detalle-monto--total">
            <span className="presupuesto-detalle-monto-k">Total equivalente</span>
            <span className="presupuesto-detalle-monto-v presupuesto-detalle-monto-v--total num">
              {fmtNum(row.saldo_usd)} USD
            </span>
          </div>
        </div>
        <div className="presupuesto-detalle-tc">
          <span>
            TC USD → $U: <strong className="num">{fmtNum(row.tc_usd, 4)}</strong>
          </span>
          <span className="presupuesto-detalle-tc-sep" aria-hidden />
          <span>
            TC R$ → USD: <strong className="num">{fmtNum(row.tc_reales, 4)}</strong>
          </span>
        </div>
      </section>

      <div className="presupuesto-detalle-body">
        <div className="presupuesto-detalle-grid">
          <Bloque titulo="Datos generales" icono={<IconDoc />}>
            <Campo label="Fecha operación" value={fmtDate(row.fecha)} />
            <Campo label="N° de factura" value={row.nro_factura} mono />
            <Campo label="N° de registro" value={nroOp} mono />
            <Campo label="Alta en sistema" value={fmtDateTime(row.creado_en)} />
            {ingresado ? <Campo label="Ingresado por" value={ingresado} full /> : null}
          </Bloque>

          <Bloque titulo="Proveedor" icono={<IconBuilding />}>
            <Campo label="Código" value={row.codigo_proveedor} mono />
            <Campo label="Razón social" value={row.razon_social_proveedor} full />
          </Bloque>

          <Bloque titulo="Clasificación y presupuesto" icono={<IconTag />} cols={3}>
            <Campo label="Rubro" value={row.rubro} />
            <Campo label="Sub-rubro" value={row.sub_rubro} />
            <Campo label="Presupuesto asignado" value={row.responsable_gasto} />
            {cedula ? <Campo label="Cédula funcionario" value={cedula} mono /> : null}
          </Bloque>

          <Bloque titulo="Observaciones" icono={<IconNote />} cols={1}>
            <p
              className={`presupuesto-detalle-obs${obs ? "" : " presupuesto-detalle-obs--vacio"}`}
              title={obs || undefined}
            >
              {obs || "Sin observaciones registradas."}
            </p>
          </Bloque>
        </div>
      </div>
    </>
  );
}

export default function PresupuestoDetallePanel({
  row,
  onVolver,
  volverLabel = "Volver al listado",
}: Props) {
  const backDestination =
    volverLabel.replace(/^Volver al?\s+/i, "").trim() || "Listado";
  useHeaderBackStep(true, onVolver, backDestination);

  return (
    <SubseccionInlinePanel
      onVolver={onVolver}
      volverLabel={volverLabel}
      title="Detalle de operación"
      description={`Operación del ${fmtDate(row.fecha)}${
        row.nro_factura?.trim() ? ` · Factura ${row.nro_factura.trim()}` : ""
      }`}
      cardClassName="subseccion-inline-card presupuesto-detalle-page"
      footer={
        <button type="button" className="btn btn-ghost" onClick={onVolver}>
          Volver
        </button>
      }
    >
      <DetalleContenido row={row} />
    </SubseccionInlinePanel>
  );
}

/** Detalle de operación dentro de un modal sobre la tabla. */
export function PresupuestoDetalleModalView({ row, onClose }: ModalProps) {
  return (
    <div
      className="pd-overlay presupuesto-detalle-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="presupuesto-detalle-modal-title"
      onClick={onClose}
    >
      <div
        className="pd-dialog presupuesto-detalle-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="presupuesto-detalle-modal-head">
          <div>
            <p className="presupuesto-detalle-modal-kicker">Detalle de operación</p>
            <h2 id="presupuesto-detalle-modal-title" className="presupuesto-detalle-modal-title">
              Operación del {fmtDate(row.fecha)}
              {row.nro_factura?.trim() ? ` · Factura ${row.nro_factura.trim()}` : ""}
            </h2>
          </div>
          <button
            type="button"
            className="btn btn-icon-only presupuesto-detalle-modal-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <IconCancelar size={18} />
          </button>
        </header>
        <div className="presupuesto-detalle-modal-body">
          <DetalleContenido row={row} />
        </div>
      </div>
    </div>
  );
}

/** @deprecated Usar PresupuestoDetallePanel */
export { PresupuestoDetallePanel as PresupuestoDetalleModal };
