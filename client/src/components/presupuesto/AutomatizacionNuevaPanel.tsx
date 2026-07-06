import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ChevronDown, ChevronUp, FileText, Search, X } from "lucide-react";
import type { Catalogos, Presupuesto } from "../../types";
import { fmtDate, fmtNum } from "../../utils/format";
import { empresaCorta } from "../../utils";
import { HUB_ICON_THEMES, HubMenuIcon } from "../icons/HubMenuIcons";
import AutomatizacionPlantillaForm from "./AutomatizacionPlantillaForm";
import {
  plantillaFormDesdePresupuesto,
  plantillaFormVacia,
  type AutomatizacionPlantillaFormState,
} from "./automatizacion-plantilla-form";

const AUTO_ICON_THEME = HUB_ICON_THEMES.presupuesto_automatizacion;

interface Props {
  gastos: Presupuesto[];
  catalogos: Catalogos;
  apiOnline: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (form: AutomatizacionPlantillaFormState) => void;
  onError: (msg: string) => void;
  onSuccess?: (msg: string, title?: string) => void;
}

function formatUsd(n: number): string {
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function tituloProveedor(row: Presupuesto): string {
  return row.razon_social_proveedor?.trim() || row.codigo_proveedor?.trim() || "Sin proveedor";
}

function tituloGasto(row: Presupuesto): string {
  const proveedor = tituloProveedor(row);
  const concepto = row.concepto?.trim();
  if (concepto && proveedor !== "Sin proveedor") return `${proveedor} · ${concepto}`;
  return concepto || proveedor || `Operación #${row.nro_registro}`;
}

function importesGasto(row: Presupuesto): string[] {
  const partes: string[] = [];
  if (row.pesos) partes.push(`$ ${fmtNum(row.pesos, 0)}`);
  if (row.dolares_usd) partes.push(`US$ ${fmtNum(row.dolares_usd, 0)}`);
  if (row.reales) partes.push(`R$ ${fmtNum(row.reales, 0)}`);
  if (!partes.length && row.saldo_usd) partes.push(formatUsd(row.saldo_usd));
  return partes;
}

function coincideBusqueda(row: Presupuesto, q: string): boolean {
  if (!q) return true;
  const hay = [
    row.razon_social_proveedor,
    row.codigo_proveedor,
    row.concepto,
    row.rubro,
    row.sub_rubro,
    row.nro_factura,
    row.empresa,
    row.responsable_gasto,
    row.observaciones,
    String(row.nro_registro),
    fmtDate(row.fecha),
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export default function AutomatizacionNuevaPanel({
  gastos,
  catalogos,
  apiOnline,
  busy,
  onClose,
  onSubmit,
  onError,
  onSuccess,
}: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [form, setForm] = useState<AutomatizacionPlantillaFormState>(plantillaFormVacia());
  const [moneySyncKey, setMoneySyncKey] = useState(0);
  const [origenLabel, setOrigenLabel] = useState("");
  const facturasViewportRef = useRef<HTMLDivElement>(null);
  const [canScrollFacturasUp, setCanScrollFacturasUp] = useState(false);
  const [canScrollFacturasDown, setCanScrollFacturasDown] = useState(false);

  useEffect(() => {
    setBusqueda("");
    setForm(plantillaFormVacia());
    setOrigenLabel("");
    setMoneySyncKey((k) => k + 1);
  }, []);

  const gastosOrdenados = useMemo(
    () =>
      [...gastos].sort((a, b) => {
        const fa = a.fecha ?? "";
        const fb = b.fecha ?? "";
        return fb.localeCompare(fa) || b.nro_registro - a.nro_registro;
      }),
    [gastos]
  );

  const q = busqueda.trim().toLowerCase();
  const gastosFiltrados = useMemo(
    () => gastosOrdenados.filter((g) => coincideBusqueda(g, q)),
    [gastosOrdenados, q]
  );

  const gastoSeleccionado = gastos.find((g) => g.id === form.presupuesto_id);

  const updateFacturasArrows = useCallback(() => {
    const el = facturasViewportRef.current;
    if (!el) return;
    const maxScroll = el.scrollHeight - el.clientHeight;
    setCanScrollFacturasUp(el.scrollTop > 4);
    setCanScrollFacturasDown(maxScroll > 4 && el.scrollTop < maxScroll - 4);
  }, []);

  useEffect(() => {
    const el = facturasViewportRef.current;
    if (!el) return;
    updateFacturasArrows();
    const raf = requestAnimationFrame(() => updateFacturasArrows());
    el.addEventListener("scroll", updateFacturasArrows, { passive: true });
    const ro = new ResizeObserver(updateFacturasArrows);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", updateFacturasArrows);
      ro.disconnect();
    };
  }, [gastosFiltrados.length, updateFacturasArrows]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      updateFacturasArrows();
      requestAnimationFrame(updateFacturasArrows);
    });
    return () => cancelAnimationFrame(raf);
  }, [gastoSeleccionado, updateFacturasArrows]);

  useEffect(() => {
    facturasViewportRef.current?.scrollTo({ top: 0 });
    updateFacturasArrows();
  }, [q, updateFacturasArrows]);

  useEffect(() => {
    if (!form.presupuesto_id) return;
    const el = facturasViewportRef.current;
    if (!el) return;
    const selected = el.querySelector<HTMLElement>('[role="option"][aria-selected="true"]');
    selected?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    requestAnimationFrame(() => updateFacturasArrows());
  }, [form.presupuesto_id, gastosFiltrados, updateFacturasArrows]);

  const scrollFacturas = (direction: -1 | 1) => {
    const el = facturasViewportRef.current;
    if (!el) return;
    const firstItem = el.querySelector<HTMLElement>('[role="option"]');
    const step = Math.max(
      83,
      firstItem?.offsetHeight ? firstItem.offsetHeight + 7 : Math.round(el.clientHeight * 0.82)
    );
    el.scrollBy({ top: direction * step, behavior: "smooth" });
  };

  const showFacturasNav = gastosFiltrados.length > 1;

  const seleccionarGasto = (g: Presupuesto) => {
    setForm(plantillaFormDesdePresupuesto(g));
    setOrigenLabel(`#${g.nro_registro} · ${fmtDate(g.fecha)} · ${tituloGasto(g)}`);
    setMoneySyncKey((k) => k + 1);
  };

  const patchForm = (patch: Partial<AutomatizacionPlantillaFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const guardar = () => {
    if (!form.presupuesto_id) {
      onError("Seleccioná una factura de la lista para copiar el movimiento.");
      return;
    }
    if (!form.nombre.trim()) {
      onError("Ingresá un nombre para la automatización.");
      return;
    }
    if (!form.empresa) {
      onError("Seleccioná la empresa del presupuesto.");
      return;
    }
    if (!form.rubro.trim()) {
      onError("Seleccioná el rubro.");
      return;
    }
    if (!form.concepto.trim()) {
      onError("El concepto es obligatorio.");
      return;
    }
    onSubmit(form);
  };

  const iconStyle = {
    "--sg-hub-icon-bg": AUTO_ICON_THEME.accentSoft,
    "--sg-hub-icon-fg": AUTO_ICON_THEME.accent,
  } as CSSProperties;

  return (
    <div
      className="presupuesto-auto-nueva presupuesto-auto-wizard presupuesto-module-page"
      role="region"
      aria-labelledby="pres-auto-crear-title"
    >
        <header className="presupuesto-auto-wizard-head">
          <div className="presupuesto-auto-wizard-head-main">
            <span className="sg-hub-module-icon presupuesto-auto-wizard-head-icon" style={iconStyle}>
              <HubMenuIcon id="presupuesto_automatizacion" />
            </span>
            <div className="presupuesto-auto-wizard-head-copy">
              <p className="sg-hub-panel-kicker">Presupuesto y gastos</p>
              <h2 id="pres-auto-crear-title" className="sg-hub-main-title presupuesto-auto-wizard-title">
                Nueva automatización
              </h2>
              <p className="sg-hub-main-sub">
                Elegí una factura ya ingresada, revisá los datos copiados y programá la repetición a
                futuro. El administrador de la cuenta aprobará cada pago mensual.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="sg-hub-icon-btn presupuesto-auto-wizard-close"
            aria-label="Cerrar"
            disabled={busy}
            onClick={onClose}
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="presupuesto-auto-wizard-workspace">
          <section
            className="sg-hub-panel presupuesto-auto-wizard-pick-panel"
            aria-label="Elegir factura"
          >
            <div className="sg-hub-panel-head">
              <div>
                <p className="sg-hub-panel-kicker">Paso 1</p>
                <h3 className="sg-hub-panel-title">Elegir factura</h3>
              </div>
              <span className="presupuesto-auto-wizard-count">
                {gastos.length} documento{gastos.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="presupuesto-hub-filters-box presupuesto-auto-wizard-search-box">
              <div className="presupuesto-auto-wizard-search field">
                <div className="presupuesto-auto-wizard-search-input">
                  <Search size={14} aria-hidden />
                  <input
                    id="auto-buscar-factura"
                    type="search"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar proveedor, concepto, rubro…"
                    aria-label="Buscar factura"
                  />
                </div>
              </div>
            </div>

            <div className="presupuesto-auto-wizard-facturas-carousel">
              <div className="presupuesto-auto-wizard-facturas-fade">
                <div
                  ref={facturasViewportRef}
                  className="presupuesto-auto-wizard-facturas-viewport"
                >
                  <ul
                    className="presupuesto-hub-recent-list presupuesto-auto-wizard-facturas"
                    role="listbox"
                    aria-label="Facturas ingresadas"
                  >
                    {gastosFiltrados.length === 0 ? (
                      <li className="presupuesto-hub-recent-empty">
                        <p className="presupuesto-hub-recent-empty-text">
                          {gastos.length === 0
                            ? "No hay gastos cargados todavía."
                            : "Ninguna factura coincide con la búsqueda."}
                        </p>
                      </li>
                    ) : (
                      gastosFiltrados.map((g) => {
                        const selected = form.presupuesto_id === g.id;
                        const proveedor = tituloProveedor(g);
                        const concepto = g.concepto?.trim();
                        const rubroLinea = [g.rubro, g.sub_rubro].filter(Boolean).join(" · ");
                        const importes = importesGasto(g);
                        const detallePartes = [
                          g.empresa ? empresaCorta(g.empresa) : null,
                          rubroLinea || null,
                          g.nro_factura?.trim() ? `Fc. ${g.nro_factura.trim()}` : null,
                          g.responsable_gasto?.trim() || null,
                        ].filter(Boolean);
                        const metaLinea = [
                          fmtDate(g.fecha),
                          `Op. #${g.nro_registro}`,
                          g.codigo_proveedor?.trim() ? `Prov. ${g.codigo_proveedor.trim()}` : null,
                          importes.length ? importes.join(" + ") : null,
                        ]
                          .filter(Boolean)
                          .join(" · ");
                        const tituloLinea =
                          concepto && concepto !== proveedor ? concepto : null;
                        return (
                          <li key={g.id}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={selected}
                              className={`presupuesto-hub-recent-item presupuesto-auto-wizard-factura${
                                selected ? " presupuesto-hub-recent-item--latest" : ""
                              }`}
                              onClick={() => seleccionarGasto(g)}
                              title={
                                g.observaciones?.trim() ||
                                (tituloLinea ? `${proveedor} · ${tituloLinea}` : proveedor)
                              }
                            >
                              <span className="presupuesto-hub-recent-icon" aria-hidden>
                                <FileText size={17} strokeWidth={1.65} />
                              </span>
                              <span className="presupuesto-hub-recent-body presupuesto-auto-factura-body">
                                <span className="presupuesto-hub-recent-top presupuesto-auto-factura-top">
                                  <span className="presupuesto-auto-factura-proveedor">{proveedor}</span>
                                  <span className="presupuesto-auto-factura-importes">
                                    {selected ? (
                                      <span className="presupuesto-hub-recent-badge">OK</span>
                                    ) : null}
                                    <span className="presupuesto-hub-recent-usd">
                                      {formatUsd(g.saldo_usd)}
                                    </span>
                                  </span>
                                </span>
                                {tituloLinea ? (
                                  <span className="presupuesto-auto-factura-concepto">{tituloLinea}</span>
                                ) : null}
                                {detallePartes.length > 0 ? (
                                  <span className="presupuesto-auto-factura-detalle muted">
                                    {detallePartes.join(" · ")}
                                  </span>
                                ) : null}
                                <span className="presupuesto-auto-factura-meta">{metaLinea}</span>
                              </span>
                            </button>
                          </li>
                        );
                      })
                    )}
                  </ul>
                </div>
              </div>
              <div
                className={`presupuesto-auto-wizard-facturas-nav${
                  showFacturasNav ? "" : " presupuesto-auto-wizard-facturas-nav--hidden"
                }`}
                aria-hidden={!showFacturasNav}
              >
                <button
                  type="button"
                  className="presupuesto-auto-wizard-facturas-btn"
                  disabled={!showFacturasNav || !canScrollFacturasUp}
                  aria-label="Facturas anteriores"
                  tabIndex={showFacturasNav ? 0 : -1}
                  onClick={() => scrollFacturas(-1)}
                >
                  <ChevronUp size={16} aria-hidden />
                </button>
                <button
                  type="button"
                  className="presupuesto-auto-wizard-facturas-btn"
                  disabled={!showFacturasNav || !canScrollFacturasDown}
                  aria-label="Facturas siguientes"
                  tabIndex={showFacturasNav ? 0 : -1}
                  onClick={() => scrollFacturas(1)}
                >
                  <ChevronDown size={16} aria-hidden />
                </button>
              </div>
            </div>
          </section>

          <section
            className="sg-hub-panel presupuesto-auto-wizard-config-panel"
            aria-label="Configurar automatización"
          >
            <div className="sg-hub-panel-head">
              <div>
                <p className="sg-hub-panel-kicker">Paso 2</p>
                <h3 className="sg-hub-panel-title">Configurar automatización</h3>
              </div>
            </div>

            {!gastoSeleccionado ? (
              <div className="presupuesto-hub-recent-empty presupuesto-auto-wizard-empty">
                <p className="presupuesto-hub-recent-empty-text">
                  Seleccioná una factura de la lista para copiar proveedor, rubro e importes.
                </p>
                <p className="muted">
                  Después podés modificar empresa, rubro, montos y la programación mensual.
                </p>
              </div>
            ) : (
              <div className="presupuesto-auto-wizard-form-wrap">
                <AutomatizacionPlantillaForm
                  form={form}
                  onChange={patchForm}
                  catalogos={catalogos}
                  apiOnline={apiOnline}
                  origenLabel={origenLabel}
                  moneySyncKey={moneySyncKey}
                  onError={onError}
                  onSuccess={onSuccess}
                />
              </div>
            )}

            <div className="presupuesto-auto-wizard-foot">
              <button
                type="button"
                className="sg-hub-cta sg-hub-cta--ghost"
                disabled={busy}
                onClick={onClose}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="sg-hub-cta"
                disabled={busy || !form.presupuesto_id}
                onClick={guardar}
              >
                Crear automatización
              </button>
            </div>
          </section>
        </div>
    </div>
  );
}
