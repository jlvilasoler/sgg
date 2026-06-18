import { useEffect, type ReactNode } from "react";
import type { Presupuesto } from "../types";
import { empresaClass, fmtDate, fmtNum, formatNumeroOperacion } from "../utils";
import LogoSgg from "./LogoSgg";

interface Props {
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
  destacado,
  ancho,
}: {
  label: string;
  value: string | number | null | undefined;
  mono?: boolean;
  empty?: string;
  destacado?: boolean;
  ancho?: "full";
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
    <div
      className={[
        "pd-campo",
        destacado ? "pd-campo--destacado" : "",
        ancho === "full" ? "pd-campo--full" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="pd-campo-label">{label}</span>
      <span
        className={[
          "pd-campo-valor",
          mono ? "pd-campo-valor--mono" : "",
          vacio ? "pd-campo-valor--vacio" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        title={texto !== empty ? texto : undefined}
      >
        {texto}
      </span>
    </div>
  );
}

function Seccion({
  titulo,
  icono,
  children,
  grid = "dos",
  clase,
}: {
  titulo: string;
  icono: ReactNode;
  children: ReactNode;
  grid?: "dos" | "tres" | "uno";
  clase?: string;
}) {
  return (
    <section className={`pd-seccion${clase ? ` ${clase}` : ""}`}>
      <header className="pd-seccion-head">
        <span className="pd-seccion-icon" aria-hidden>
          {icono}
        </span>
        <h4 className="pd-seccion-titulo">{titulo}</h4>
      </header>
      <div
        className={[
          "pd-seccion-grid",
          grid === "tres" ? "pd-seccion-grid--tres" : "",
          grid === "uno" ? "pd-seccion-grid--uno" : "",
        ]
          .filter(Boolean)
          .join(" ")}
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

function IconClose() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function PresupuestoDetalleModal({ row, onClose }: Props) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

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
    },
    {
      id: "USD" as const,
      label: "Dólares",
      valor: row.dolares_usd,
      activo: principal === "USD",
    },
    {
      id: "BRL" as const,
      label: "Reales",
      valor: row.reales,
      activo: principal === "BRL",
    },
  ];

  return (
    <div className="pd-overlay" role="presentation" onClick={onClose}>
      <div
        className="pd-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pd-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="pd-brand">
          <div className="pd-brand-inner">
            <LogoSgg className="pd-brand-logo" />
            <div className="pd-brand-text">
              <span className="pd-brand-scg">SGG</span>
              <span className="pd-brand-sub">Sistema de Gestión Ganadera</span>
            </div>
          </div>
          <button type="button" className="pd-brand-close" onClick={onClose} aria-label="Cerrar">
            <IconClose />
          </button>
        </header>

        <div className="pd-hero">
          <div className="pd-hero-top">
            <div className="pd-hero-meta">
              <span className="pd-kicker">Detalle de operación</span>
              <h2 id="pd-titulo" className="pd-op-num">
                N° {nroOp}
              </h2>
            </div>
            <span className={`pd-empresa-badge empresa-badge ${empresaClass(row.empresa)}`}>
              {row.empresa}
            </span>
          </div>

          <div className="pd-concepto-card">
            <span className="pd-concepto-label">Concepto</span>
            <p className="pd-concepto-texto">{row.concepto}</p>
            <div className="pd-chips">
              <span className="pd-chip pd-chip--rubro">{row.rubro}</span>
              {row.sub_rubro?.trim() ? (
                <>
                  <span className="pd-chip-sep" aria-hidden>
                    ›
                  </span>
                  <span className="pd-chip pd-chip--sub">{row.sub_rubro}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="pd-body">
          <section className="pd-finanzas" aria-label="Importes y cotizaciones">
            <div className="pd-finanzas-montos">
              {montos.map((m) => (
                <div
                  key={m.id}
                  className={`pd-monto-card${m.activo ? " pd-monto-card--activo" : ""}`}
                >
                  <span className="pd-monto-label">{m.label}</span>
                  <span className="pd-monto-valor">
                    {m.id === "UYU"
                      ? `$ ${fmtNum(m.valor)}`
                      : m.id === "USD"
                        ? `${fmtNum(m.valor)} USD`
                        : `${fmtNum(m.valor)} R$`}
                  </span>
                  {m.activo ? <span className="pd-monto-tag">Moneda ingresada</span> : null}
                </div>
              ))}
              <div className="pd-monto-card pd-monto-card--total">
                <span className="pd-monto-label">Total equivalente</span>
                <span className="pd-monto-valor pd-monto-valor--total">
                  {fmtNum(row.saldo_usd)} USD
                </span>
              </div>
            </div>
            <div className="pd-finanzas-tc">
              <span>
                TC USD → $U: <strong>{fmtNum(row.tc_usd, 4)}</strong>
              </span>
              <span className="pd-finanzas-tc-sep" aria-hidden />
              <span>
                TC R$ → USD: <strong>{fmtNum(row.tc_reales, 4)}</strong>
              </span>
            </div>
          </section>

          <div className="pd-grid-2">
            <Seccion titulo="Datos generales" icono={<IconDoc />}>
              <Campo label="Fecha operación" value={fmtDate(row.fecha)} />
              <Campo label="N° de factura" value={row.nro_factura} mono />
              <Campo label="N° de registro" value={nroOp} mono />
              <Campo label="Alta en sistema" value={fmtDateTime(row.creado_en)} />
              {ingresado ? <Campo label="Ingresado por" value={ingresado} /> : null}
            </Seccion>

            <Seccion titulo="Proveedor" icono={<IconBuilding />}>
              <Campo label="Código" value={row.codigo_proveedor} mono />
              <Campo
                label="Razón social"
                value={row.razon_social_proveedor}
                destacado
                ancho="full"
              />
            </Seccion>
          </div>

          <div className="pd-grid-2 pd-grid-2--bottom">
            <Seccion titulo="Clasificación y presupuesto" icono={<IconTag />} grid="tres">
              <Campo label="Rubro" value={row.rubro} />
              <Campo label="Sub-rubro" value={row.sub_rubro} />
              <Campo label="Presupuesto asignado" value={row.responsable_gasto} />
              {cedula ? <Campo label="Cédula funcionario" value={cedula} mono /> : null}
            </Seccion>

            <Seccion titulo="Observaciones" icono={<IconNote />} grid="uno" clase="pd-seccion--obs">
              <p className={`pd-obs${obs ? "" : " pd-obs--vacio"}`} title={obs || undefined}>
                {obs || "Sin observaciones registradas."}
              </p>
            </Seccion>
          </div>
        </div>

        <footer className="pd-footer">
          <p className="pd-footer-hint">Presioná Esc para cerrar</p>
          <button type="button" className="btn btn-secondary pd-btn-cerrar" onClick={onClose}>
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  );
}
