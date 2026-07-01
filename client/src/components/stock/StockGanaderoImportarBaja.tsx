import { useCallback, useId, useMemo, useRef, useState, type FormEvent } from "react";
import {
  importStockGanaderoBajaDispositivos,
  importStockGanaderoBajaFile,
  type TipoBaja,
} from "../../api";
import type { StockGanaderaDispositivo } from "../../types";
import BuscadorCaravanaActiva from "./BuscadorCaravanaActiva";
import { PageModuleHeadRow } from "../PageModuleHead";
import {
  etiquetaCaravana,
  fechaHoyIso,
  fmtTipoBaja,
  TIPOS_BAJA,
} from "./stock-ganadera-utils";

interface Props {
  apiOnline: boolean;
  onImported: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string, title?: string) => void;
  onVolver: () => void;
}

type ModoImport = "archivo" | "manual";

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

const COLUMNAS = ["EID", "VID", "Date", "Time", "Condición"] as const;
const EXTENSIONES_ACEPTADAS = [".txt", ".csv"] as const;

const TIPOS_BAJA_HINTS: Partial<Record<TipoBaja, string>> = {
  VENTA_FRIGORIFICO: "Dispositivos vendidos a frigorífico — estado Vendido",
  VENTA_PRODUCTOR: "Venta a productor — estado Vendido",
  MUERTE: "Muerte — estado Muerto",
  PERDIDO: "Extraviado — estado Extraviado",
};

function esArchivoStockValido(f: File): boolean {
  const name = f.name.toLowerCase();
  if (EXTENSIONES_ACEPTADAS.some((ext) => name.endsWith(ext))) return true;
  const mime = f.type.toLowerCase();
  return (
    mime === "text/plain" ||
    mime === "text/csv" ||
    mime === "application/csv" ||
    mime === "application/vnd.ms-excel"
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

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

export default function StockGanaderoImportarBaja({
  apiOnline,
  onImported,
  onError,
  onSuccess,
  onVolver,
}: Props) {
  const formId = useId();
  const [tipoBajaArchivo, setTipoBajaArchivo] = useState<TipoBaja>("VENTA_FRIGORIFICO");
  const [formTipoBaja, setFormTipoBaja] = useState<TipoBaja>("VENTA_FRIGORIFICO");
  const [formFecha, setFormFecha] = useState(fechaHoyIso);
  const [formNumeroGuia, setFormNumeroGuia] = useState("");
  const [formObservaciones, setFormObservaciones] = useState("");
  const [modo, setModo] = useState<ModoImport>("archivo");
  const [file, setFile] = useState<File | null>(null);
  const [seleccion, setSeleccion] = useState<StockGanaderaDispositivo | null>(null);
  const [pendientes, setPendientes] = useState<BajaPendiente[]>([]);
  const [confirmadas, setConfirmadas] = useState<BajaConfirmada[]>([]);
  const [listaRefresh, setListaRefresh] = useState(0);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const tipoArchivoLabel = fmtTipoBaja(tipoBajaArchivo);

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

  const pickFile = useCallback(
    (f: File | null) => {
      if (!f) {
        setFile(null);
        return;
      }
      if (!esArchivoStockValido(f)) {
        onError("Solo archivos .txt o .csv (export Tru-Test)");
        return;
      }
      setFile(f);
    },
    [onError]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (!apiOnline || importing) return;
      const f = e.dataTransfer.files?.[0];
      if (f) pickFile(f);
    },
    [apiOnline, importing, pickFile]
  );

  const importarArchivo = async () => {
    if (!file) {
      onError("Seleccioná un archivo .txt o .csv");
      return;
    }
    setImporting(true);
    try {
      const r = await importStockGanaderoBajaFile(file, tipoBajaArchivo);
      onSuccess(r.message, "Bajas importadas");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      onImported();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al importar bajas");
    } finally {
      setImporting(false);
    }
  };

  const aplicarBajas = async (
    items: BajaPendiente[],
    opts?: { limpiarPendientes?: boolean }
  ) => {
    if (!items.length) {
      onError("Ingresá al menos un dispositivo");
      return;
    }
    for (const item of items) {
      if (!validarMeta(item)) return;
    }

    setImporting(true);
    try {
      const r = await importStockGanaderoBajaDispositivos(
        items.map((item) => ({
          numero: item.clave,
          tipo_baja: item.tipo_baja,
          fecha: item.fecha,
          numero_guia: item.numero_guia || undefined,
          observaciones: item.observaciones || undefined,
        }))
      );
      onSuccess(r.message, "Bajas importadas");
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
      onError(e instanceof Error ? e.message : "Error al importar bajas");
    } finally {
      setImporting(false);
    }
  };

  const agregarPendiente = (e?: FormEvent) => {
    e?.preventDefault();
    if (!seleccion) {
      onError("Elegí una caravana activa del buscador");
      return;
    }
    const meta = metaFormulario();
    if (!validarMeta(meta)) return;
    if (pendientes.some((p) => p.clave === seleccion.clave)) {
      onError("Esa caravana ya está en la lista");
      return;
    }
    setPendientes((prev) => [
      ...prev,
      {
        id: nextBajaId(),
        clave: seleccion.clave,
        etiqueta: etiquetaCaravana(seleccion),
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
        etiqueta: etiquetaCaravana(seleccion),
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

  return (
    <div className="subseccion-panel">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver a Stock Ganadero
      </button>

      <div className="card stock-import-shell stock-import-shell--baja">
        <div className="form-header stock-import-head">
          <PageModuleHeadRow
            icon={{ source: "hub", id: "stock_baja" }}
            title="Importar bajas"
            subtitle="Marcá caravanas como vendidas, frigorífico, muerte u otras salidas. Salen del stock activo y quedan registradas en el dispositivo."
          />
        </div>

        {!apiOnline && (
          <div className="stock-import-offline" role="status">
            Conectá la API (puerto 3001) para importar bajas.
          </div>
        )}

        <div className="stock-ganadera-layout stock-import-layout">
          <aside
            className="stock-facet-sidebar stock-import-sidebar stock-import-sidebar--baja"
            aria-label="Opciones de baja"
          >
            <div className="stock-facet-sidebar-head stock-import-sidebar-head">
              <h3 className="stock-facet-sidebar-title">Baja</h3>
            </div>

            <div className="stock-facet-group">
              <div className="stock-facet-group-head">
                <h4 className="stock-facet-group-title">Archivo</h4>
              </div>
              <div className="stock-import-chips stock-import-chips--sidebar stock-import-chips--baja">
                {COLUMNAS.map((col) => (
                  <span key={col} className="stock-import-chip stock-import-chip--baja">
                    {col}
                  </span>
                ))}
              </div>
              <p className="stock-import-sidebar-note">
                El archivo usa columnas EID, Date, etc. La fecha del archivo define mes y
                año de baja.
              </p>
            </div>

            <div className="stock-facet-group">
              <div className="stock-facet-group-head">
                <h4 className="stock-facet-group-title">Carga manual</h4>
              </div>
              <p className="stock-import-sidebar-note">
                Elegí la caravana y completá <strong>tipo</strong>, <strong>fecha</strong>,{" "}
                <strong>número guía</strong> y <strong>observaciones</strong>. Se guardan en
                el dispositivo.
              </p>
              <p className="stock-import-sidebar-note">
                Solo aparecen dispositivos <strong>vivos</strong> en el stock.
              </p>
            </div>
          </aside>

          <div className="stock-ganadera-main stock-import-main">
            <div
              className="stock-import-tabs stock-import-tabs--baja"
              role="tablist"
              aria-label="Modo de importación de bajas"
            >
              <button
                type="button"
                role="tab"
                aria-selected={modo === "archivo"}
                className={`stock-import-tab${modo === "archivo" ? " is-active" : ""}`}
                onClick={() => setModo("archivo")}
              >
                Archivo .txt / .csv
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={modo === "manual"}
                className={`stock-import-tab${modo === "manual" ? " is-active" : ""}`}
                onClick={() => setModo("manual")}
              >
                Solo números
                {pendientes.length > 0 ? (
                  <span className="stock-import-tab-badge stock-import-tab-badge--baja">
                    {pendientes.length}
                  </span>
                ) : null}
              </button>
            </div>

            {modo === "archivo" ? (
              <section className="stock-import-pane" aria-label="Importar bajas desde archivo">
                <div className="stock-import-baja-datos stock-import-baja-datos--archivo">
                  <div className="field stock-import-field">
                    <label htmlFor={`${formId}-tipo-baja-archivo`}>Tipo de baja</label>
                    <select
                      id={`${formId}-tipo-baja-archivo`}
                      className="stock-import-select"
                      value={tipoBajaArchivo}
                      disabled={!apiOnline || importing}
                      onChange={(e) => setTipoBajaArchivo(e.target.value as TipoBaja)}
                    >
                      {TIPOS_BAJA.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    <p className="stock-import-field-hint muted">
                      {TIPOS_BAJA_HINTS[tipoBajaArchivo]}
                    </p>
                  </div>
                </div>

                <p className="stock-import-pane-hint">
                  Aplicando bajas como <strong>{tipoArchivoLabel}</strong>
                </p>
                <div
                  className={`stock-dropzone stock-dropzone--baja${dragOver ? " is-dragover" : ""}${file ? " has-file" : ""}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (apiOnline && !importing) setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  onClick={() => {
                    if (apiOnline && !importing && !file) inputRef.current?.click();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (apiOnline && !importing) inputRef.current?.click();
                    }
                  }}
                  role="button"
                  tabIndex={apiOnline && !importing ? 0 : -1}
                  aria-label="Zona para soltar archivo de bajas"
                >
                  <input
                    ref={inputRef}
                    type="file"
                    className="stock-dropzone-input"
                    accept=".txt,.csv,text/plain,text/csv"
                    disabled={!apiOnline || importing}
                    onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                  />

                  {file ? (
                    <div className="stock-file-preview">
                      <span className="stock-file-icon" aria-hidden>
                        ✓
                      </span>
                      <div className="stock-file-meta">
                        <strong className="stock-file-name">{file.name}</strong>
                        <span>{formatBytes(file.size)}</span>
                      </div>
                      <button
                        type="button"
                        className="stock-file-clear"
                        disabled={importing}
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                          if (inputRef.current) inputRef.current.value = "";
                        }}
                        aria-label="Quitar archivo"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="stock-dropzone-graphic" aria-hidden>
                        ↑
                      </span>
                      <p className="stock-dropzone-title">Soltá el archivo aquí</p>
                      <p className="stock-dropzone-sub">
                        Lista de caravanas a dar de baja · Tru-Test o lector RFID
                      </p>
                    </>
                  )}
                </div>

                <div className="stock-import-pane-foot">
                  <button
                    type="button"
                    className="btn stock-import-btn stock-import-btn--baja"
                    disabled={!apiOnline || importing || !file}
                    onClick={() => void importarArchivo()}
                  >
                    {importing ? (
                      <>
                        <span className="stock-import-spinner" aria-hidden />
                        Procesando…
                      </>
                    ) : (
                      `Aplicar bajas (${tipoArchivoLabel})`
                    )}
                  </button>
                </div>
              </section>
            ) : (
              <section className="stock-import-pane" aria-label="Baja manual por número">
                <form
                  id={formId}
                  className="stock-import-form stock-import-form--solo-numero"
                  onSubmit={agregarPendiente}
                >
                  <div className="field stock-import-field stock-import-field--numero">
                    <label htmlFor={`${formId}-buscador`}>Caravana activa</label>
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
                      <div className="stock-import-seleccion-activa">
                        <span className="stock-import-seleccion-label">Seleccionada:</span>
                        <strong className="num">{etiquetaCaravana(seleccion)}</strong>
                        <button
                          type="button"
                          className="stock-import-seleccion-clear"
                          aria-label="Quitar selección"
                          onClick={() => setSeleccion(null)}
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <p className="stock-import-field-hint muted">
                        Abrí el listado o escribí para filtrar. Solo caravanas con estado{" "}
                        <strong>Vivo</strong>.
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

                  <div className="stock-import-form-actions stock-import-form-actions--baja">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={!apiOnline || importing}
                      onClick={limpiarTodo}
                      title="Borra la selección, pendientes y el listado de bajas"
                    >
                      Limpiar todo
                    </button>
                    <button
                      type="submit"
                      className="btn btn-secondary stock-import-btn-secondary--baja"
                      disabled={!apiOnline || importing || !seleccion}
                      title="Suma la caravana a la lista para dar de baja varias juntas"
                    >
                      Agregar y buscar otra
                    </button>
                    <button
                      type="button"
                      className="btn stock-import-btn stock-import-btn--baja"
                      disabled={!apiOnline || importing || !seleccion}
                      onClick={confirmarSeleccion}
                      title="Da de baja solo la caravana seleccionada"
                    >
                      Confirmar baja
                    </button>
                  </div>
                </form>

                {pendientes.length > 0 ? (
                  <div className="stock-import-queue">
                    <div className="stock-import-queue-head">
                      <h4>Pendientes de confirmar</h4>
                      <span className="muted">{pendientes.length}</span>
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
                            aria-label="Quitar dispositivo"
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
                  <div className="stock-import-queue stock-import-queue--confirmadas">
                    <div className="stock-import-queue-head">
                      <h4>Bajas confirmadas en esta sesión</h4>
                      <span className="muted">{confirmadas.length}</span>
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
                    Completá los datos de baja, elegí la caravana y pulsá{" "}
                    <strong>Confirmar baja</strong>. Aparecerá acá el listado de bajas
                    realizadas.
                  </p>
                )}

                <div className="stock-import-pane-foot">
                  <button
                    type="button"
                    className="btn stock-import-btn stock-import-btn--baja"
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
