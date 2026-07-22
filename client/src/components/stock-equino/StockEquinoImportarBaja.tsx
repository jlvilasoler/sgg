import { useCallback, useId, useMemo, useState, type FormEvent } from "react";
import { importStockEquinoBajaDispositivos, type TipoBaja } from "../../api";
import type { StockEquinaDispositivo } from "../../types";
import BuscadorCaravanaActiva from "./BuscadorCaravanaActiva";
import { PageModuleHeadRow } from "../PageModuleHead";
import {
  detalleCabanaEquino,
  etiquetaBajaEquino,
  etiquetaCaravana,
  fechaHoyIso,
  fmtTipoBaja,
  TIPOS_BAJA,
} from "./stock-equina-utils";

interface Props {
  apiOnline: boolean;
  onImported: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string, title?: string) => void;
  onVolver: () => void;
  embedded?: boolean;
}

interface BajaItemMeta {
  tipo_baja: TipoBaja;
  fecha: string;
  numero_guia: string;
  observaciones: string;
}

interface BajaPendiente extends BajaItemMeta {
  id: string;
  clave: string;
  etiqueta: string;
}

interface BajaConfirmada extends BajaItemMeta {
  id: string;
  clave: string;
  etiqueta: string;
}

/** Identificadores reales del equino (genérico + cabaña). */
const CAMPOS_EQUINO = ["REG", "RP", "Nombre", "Registro"] as const;

const TIPOS_BAJA_HINTS: Partial<Record<TipoBaja, string>> = {
  VENTA_FRIGORIFICO: "Equinos vendidos a frigorífico — estado Vendido",
  VENTA_PRODUCTOR: "Venta a productor — estado Vendido",
  MUERTE: "Muerte — estado Muerto",
  PERDIDO: "Extraviado — estado Extraviado",
};

function fmtFechaCorta(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

let bajaIdSeq = 0;
function nextBajaId(): string {
  bajaIdSeq += 1;
  return `baja-${bajaIdSeq}`;
}

export default function StockEquinoImportarBaja({
  apiOnline,
  onImported,
  onError,
  onSuccess,
  onVolver,
  embedded = false,
}: Props) {
  const formId = useId();
  const [formTipoBaja, setFormTipoBaja] = useState<TipoBaja>("VENTA_FRIGORIFICO");
  const [formFecha, setFormFecha] = useState(fechaHoyIso);
  const [formNumeroGuia, setFormNumeroGuia] = useState("");
  const [formObservaciones, setFormObservaciones] = useState("");
  const [seleccion, setSeleccion] = useState<StockEquinaDispositivo | null>(null);
  const [pendientes, setPendientes] = useState<BajaPendiente[]>([]);
  const [confirmadas, setConfirmadas] = useState<BajaConfirmada[]>([]);
  const [listaRefresh, setListaRefresh] = useState(0);
  const [importing, setImporting] = useState(false);

  const excludeClaves = useMemo(
    () => new Set(pendientes.map((p) => p.clave)),
    [pendientes]
  );

  const metaFormulario = useCallback(
    (): BajaItemMeta => ({
      tipo_baja: formTipoBaja,
      fecha: formFecha,
      numero_guia: formNumeroGuia.trim(),
      observaciones: formObservaciones.trim(),
    }),
    [formTipoBaja, formFecha, formNumeroGuia, formObservaciones]
  );

  const validarMeta = (meta: BajaItemMeta): boolean => {
    if (!meta.fecha.trim()) {
      onError("Ingresá la fecha de baja");
      return false;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.fecha.trim())) {
      onError("Fecha inválida. Use formato AAAA-MM-DD");
      return false;
    }
    return true;
  };

  const aplicarBajas = async (
    items: BajaPendiente[],
    opts?: { limpiarPendientes?: boolean }
  ) => {
    if (!items.length) {
      onError("Ingresá al menos un equino");
      return;
    }
    for (const item of items) {
      if (!validarMeta(item)) return;
    }

    setImporting(true);
    try {
      const r = await importStockEquinoBajaDispositivos(
        items.map((item) => ({
          numero: item.clave,
          tipo_baja: item.tipo_baja,
          fecha: item.fecha,
          numero_guia: item.numero_guia || undefined,
          observaciones: item.observaciones || undefined,
        }))
      );
      onSuccess(r.message, "Bajas registradas");
      setConfirmadas((prev) => [
        ...prev,
        ...items.map((item) => ({
          id: nextBajaId(),
          clave: item.clave,
          etiqueta: item.etiqueta,
          tipo_baja: item.tipo_baja,
          fecha: item.fecha,
          numero_guia: item.numero_guia,
          observaciones: item.observaciones,
        })),
      ]);
      if (opts?.limpiarPendientes) {
        const claves = new Set(items.map((i) => i.clave));
        setPendientes((prev) => prev.filter((p) => !claves.has(p.clave)));
      }
      setSeleccion(null);
      setListaRefresh((k) => k + 1);
      onImported();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al registrar bajas");
    } finally {
      setImporting(false);
    }
  };

  const agregarPendiente = (e?: FormEvent) => {
    e?.preventDefault();
    if (!seleccion) {
      onError("Elegí un equino activo del buscador");
      return;
    }
    const meta = metaFormulario();
    if (!validarMeta(meta)) return;
    if (pendientes.some((p) => p.clave === seleccion.clave)) {
      onError("Ese equino ya está en la lista");
      return;
    }
    setPendientes((prev) => [
      ...prev,
      {
        id: nextBajaId(),
        clave: seleccion.clave,
        etiqueta: etiquetaBajaEquino(seleccion),
        ...meta,
      },
    ]);
    setSeleccion(null);
  };

  const confirmarSeleccion = () => {
    if (!seleccion) return;
    const meta = metaFormulario();
    if (!validarMeta(meta)) return;
    void aplicarBajas([
      {
        id: nextBajaId(),
        clave: seleccion.clave,
        etiqueta: etiquetaBajaEquino(seleccion),
        ...meta,
      },
    ]);
  };

  const quitarPendiente = (id: string) => {
    setPendientes((prev) => prev.filter((p) => p.id !== id));
  };

  const limpiarTodo = () => {
    setSeleccion(null);
    setPendientes([]);
    setConfirmadas([]);
    setFormNumeroGuia("");
    setFormObservaciones("");
    setFormFecha(fechaHoyIso());
    setFormTipoBaja("VENTA_FRIGORIFICO");
  };

  const renderBajaMeta = (row: BajaItemMeta) => (
    <span className="stock-import-baja-meta muted">
      {fmtTipoBaja(row.tipo_baja)} · {fmtFechaCorta(row.fecha)}
      {row.numero_guia ? ` · Guía ${row.numero_guia}` : ""}
      {row.observaciones ? ` · ${row.observaciones}` : ""}
    </span>
  );

  const btnGhost = embedded ? "sg-hub-cta sg-hub-cta--ghost" : "btn btn-ghost";
  const btnSecondary = embedded
    ? "sg-hub-cta sg-hub-cta--ghost"
    : "btn btn-secondary stock-import-btn-secondary--baja";
  const btnPrimary = embedded ? "sg-hub-cta" : "btn stock-import-btn stock-import-btn--baja";

  const offlineBanner = !apiOnline ? (
    <div className="stock-import-offline" role="status">
      Conectá la API (puerto 3001) para registrar bajas.
    </div>
  ) : null;

  const manualPane = (
    <section className="stock-import-pane" aria-label="Baja por número de equino">
      <form
        id={formId}
        className="stock-import-form stock-import-form--solo-numero"
        onSubmit={agregarPendiente}
      >
        <div className={embedded ? "stock-baja-form-fields-box" : undefined}>
          <div className="field stock-import-field stock-import-field--numero">
            <label htmlFor={`${formId}-buscador`}>Equino activo</label>
            <BuscadorCaravanaActiva
              id={`${formId}-buscador`}
              apiOnline={apiOnline}
              disabled={importing}
              variant="baja"
              excludeClaves={excludeClaves}
              refreshKey={listaRefresh}
              onError={onError}
              onSelect={setSeleccion}
            />
            {seleccion ? (
              <div
                className={`stock-import-seleccion-activa${
                  embedded ? " stock-import-seleccion-activa--hub" : ""
                }`}
              >
                <span className="stock-import-seleccion-label">Seleccionado:</span>
                <strong className="num">{etiquetaCaravana(seleccion)}</strong>
                <button
                  type="button"
                  className="stock-import-seleccion-clear"
                  aria-label="Quitar selección"
                  onClick={() => setSeleccion(null)}
                >
                  ×
                </button>
                {detalleCabanaEquino(seleccion) ? (
                  <span className="stock-import-seleccion-extra muted">
                    {detalleCabanaEquino(seleccion)}
                  </span>
                ) : null}
              </div>
            ) : (
              <p className="stock-import-field-hint muted">
                Buscá por <strong>REG</strong>, número, <strong>RP</strong>, nombre o registro
                genealógico. Solo equinos con estado <strong>Vivo</strong> (genéricos y cabaña).
              </p>
            )}
          </div>

          <div className="stock-import-baja-datos">
            <div className="field stock-import-field">
              <label htmlFor={`${formId}-tipo-baja`}>Tipo de baja</label>
              <select
                id={`${formId}-tipo-baja`}
                className="stock-import-select"
                value={formTipoBaja}
                disabled={!apiOnline || importing}
                onChange={(e) => setFormTipoBaja(e.target.value as TipoBaja)}
              >
                {TIPOS_BAJA.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <p className="stock-import-field-hint muted">{TIPOS_BAJA_HINTS[formTipoBaja]}</p>
            </div>

            <div className="field stock-import-field">
              <label htmlFor={`${formId}-fecha`}>Fecha de baja</label>
              <input
                id={`${formId}-fecha`}
                type="date"
                className="stock-import-date"
                value={formFecha}
                disabled={!apiOnline || importing}
                onChange={(e) => setFormFecha(e.target.value)}
              />
            </div>

            <div className="field stock-import-field">
              <label htmlFor={`${formId}-guia`}>Número guía</label>
              <input
                id={`${formId}-guia`}
                type="text"
                className="stock-import-text"
                value={formNumeroGuia}
                disabled={!apiOnline || importing}
                placeholder="Opcional"
                onChange={(e) => setFormNumeroGuia(e.target.value)}
              />
            </div>

            <div className="field stock-import-field stock-import-field--obs">
              <label htmlFor={`${formId}-obs`}>Observaciones</label>
              <textarea
                id={`${formId}-obs`}
                className="stock-import-textarea"
                rows={2}
                value={formObservaciones}
                disabled={!apiOnline || importing}
                placeholder="Opcional"
                onChange={(e) => setFormObservaciones(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div
          className={`stock-import-form-actions stock-import-form-actions--baja${
            embedded ? " stock-import-form-actions--hub" : ""
          }`}
        >
          <button
            type="button"
            className={btnGhost}
            disabled={!apiOnline || importing}
            onClick={limpiarTodo}
            title="Borra la selección, pendientes y el listado de bajas"
          >
            Limpiar todo
          </button>
          <button
            type="submit"
            className={btnSecondary}
            disabled={!apiOnline || importing || !seleccion}
            title="Suma el equino a la lista para dar de baja varios juntos"
          >
            Agregar y buscar otro
          </button>
          <button
            type="button"
            className={btnPrimary}
            disabled={!apiOnline || importing || !seleccion}
            onClick={confirmarSeleccion}
            title="Da de baja solo el equino seleccionado"
          >
            Confirmar baja
          </button>
        </div>
      </form>

      {pendientes.length > 0 ? (
        <div
          className={`stock-import-queue${
            embedded ? " stock-baja-hub-box stock-baja-hub-box--queue" : ""
          }`}
        >
          <div className="stock-import-queue-head">
            {embedded ? (
              <>
                <p className="sg-hub-panel-kicker">Lista temporal</p>
                <h4 className="stock-baja-hub-title">Pendientes de confirmar</h4>
              </>
            ) : (
              <h4>Pendientes de confirmar</h4>
            )}
            <span className={`muted${embedded ? " stock-baja-queue-count" : ""}`}>
              {pendientes.length}
            </span>
          </div>
          <ul className="stock-import-numero-lista">
            {pendientes.map((row) => (
              <li key={row.id} className="stock-import-numero-item">
                <div className="stock-import-numero-item-body">
                  <span className="stock-import-numero-valor num">{row.etiqueta}</span>
                  {renderBajaMeta(row)}
                </div>
                <button
                  type="button"
                  className="stock-import-queue-remove"
                  aria-label="Quitar equino"
                  disabled={importing}
                  onClick={() => quitarPendiente(row.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {confirmadas.length > 0 ? (
        <div
          className={`stock-import-queue stock-import-queue--confirmadas${
            embedded ? " stock-baja-hub-box stock-baja-hub-box--queue" : ""
          }`}
        >
          <div className="stock-import-queue-head">
            {embedded ? (
              <>
                <p className="sg-hub-panel-kicker">Sesión</p>
                <h4 className="stock-baja-hub-title">Bajas confirmadas</h4>
              </>
            ) : (
              <h4>Bajas confirmadas en esta sesión</h4>
            )}
            <span className={`muted${embedded ? " stock-baja-queue-count" : ""}`}>
              {confirmadas.length}
            </span>
          </div>
          <ul className="stock-import-numero-lista stock-import-numero-lista--confirmadas">
            {confirmadas.map((row) => (
              <li
                key={row.id}
                className="stock-import-numero-item stock-import-numero-item--confirmada"
              >
                <span className="stock-import-numero-check" aria-hidden>
                  ✓
                </span>
                <div className="stock-import-numero-item-body">
                  <span className="stock-import-numero-valor num">{row.etiqueta}</span>
                  {renderBajaMeta(row)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="stock-import-queue-empty muted">
          Completá los datos de baja, elegí el equino y pulsá <strong>Confirmar baja</strong>.
          Aparecerá acá el listado de bajas realizadas.
        </p>
      )}

      <div className={`stock-import-pane-foot${embedded ? " stock-import-pane-foot--hub" : ""}`}>
        <button
          type="button"
          className={btnPrimary}
          disabled={!apiOnline || importing || pendientes.length === 0}
          onClick={() => void aplicarBajas(pendientes, { limpiarPendientes: true })}
        >
          {importing ? (
            <>
              <span className="stock-import-spinner" aria-hidden />
              Procesando…
            </>
          ) : (
            `Confirmar ${pendientes.length} baja(s)`
          )}
        </button>
      </div>
    </section>
  );

  const panel = embedded ? (
    <>
      {offlineBanner}
      <div className="stock-baja-hub-workspace">
        <section className="stock-baja-hub-box" aria-label="Guía de baja">
          <header className="stock-baja-hub-head-box">
            <p className="sg-hub-panel-kicker">Baja</p>
            <h2 className="stock-baja-hub-title">Equinos fuera del stock</h2>
            <p className="stock-baja-hub-sub muted">
              Marcá equinos como vendidos, frigorífico, muerte u otras salidas. Salen del stock
              activo y quedan registrados en la ficha.
            </p>
          </header>
          <div className="stock-import-chips stock-import-chips--hub">
            {CAMPOS_EQUINO.map((col) => (
              <span key={col} className="stock-import-chip stock-import-chip--hub">
                {col}
              </span>
            ))}
          </div>
          <p className="stock-baja-hub-note muted">
            La baja es <strong>solo por números</strong>: buscá por REG (genéricos) o por RP,
            nombre y registro (cabaña). Completá tipo, fecha, guía y observaciones.
          </p>
        </section>

        <section className="stock-baja-hub-box stock-baja-hub-box--main" aria-label="Registrar bajas">
          {manualPane}
        </section>
      </div>
    </>
  ) : (
    <div className="card stock-import-shell stock-import-shell--baja">
      <div className="form-header stock-import-head">
        <PageModuleHeadRow
          icon={{ source: "hub", id: "stock_baja" }}
          title="Baja de equinos"
          subtitle="Marcá equinos como vendidos, frigorífico, muerte u otras salidas. Solo por número (REG, RP, nombre o registro)."
        />
      </div>

      {offlineBanner}

      <div className="stock-equina-layout stock-import-layout">
        <aside
          className="stock-facet-sidebar stock-import-sidebar stock-import-sidebar--baja"
          aria-label="Opciones de baja"
        >
          <div className="stock-facet-sidebar-head stock-import-sidebar-head">
            <h3 className="stock-facet-sidebar-title">Baja</h3>
          </div>

          <div className="stock-facet-group">
            <div className="stock-facet-group-head">
              <h4 className="stock-facet-group-title">Solo números</h4>
            </div>
            <div className="stock-import-chips stock-import-chips--sidebar stock-import-chips--baja">
              {CAMPOS_EQUINO.map((col) => (
                <span key={col} className="stock-import-chip stock-import-chip--baja">
                  {col}
                </span>
              ))}
            </div>
            <p className="stock-import-sidebar-note">
              Genéricos: buscá por <strong>REG</strong> (EID-VID). Cabaña: también por{" "}
              <strong>RP</strong>, <strong>nombre</strong> o <strong>registro</strong>.
            </p>
            <p className="stock-import-sidebar-note">
              Completá <strong>tipo</strong>, <strong>fecha</strong>, <strong>número guía</strong> y{" "}
              <strong>observaciones</strong>. Solo aparecen equinos <strong>vivos</strong>.
            </p>
          </div>
        </aside>

        <div className="stock-equina-main stock-import-main">{manualPane}</div>
      </div>
    </div>
  );

  if (embedded) return panel;

  return (
    <div className="subseccion-panel">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver a Stock Equino
      </button>
      {panel}
    </div>
  );
}
