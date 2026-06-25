import { useCallback, useEffect, useState } from "react";
import {
  createTipoDocumentoGasto,
  deleteTipoDocumentoGasto,
  fetchTiposDocumentoGasto,
  updateTipoDocumentoGasto,
} from "../../api";
import { useHeaderBackStep } from "../../header-back";
import type { TipoDocumentoGasto, TipoDocumentoGastoForm } from "../../types";
import {
  BROU_MAPEO_DEFAULT,
  COMISION_CONFIG_DEFAULT,
  GASTO_DESTINO_LABELS,
  type ComisionDocumentoConfig,
  type GastoDestinoId,
  type GastoMapeoCampos,
  esTipoDocumentoBrou,
  isGastoCampoId,
  normalizeComisionConfig,
  normalizeGastoMapeo,
} from "../../utils/gasto-campos";
import SubseccionInlinePanel from "../SubseccionInlinePanel";
import { IconCancelar, IconConfirmar } from "../icons/ActionIcons";
import ComisionConfigPanel from "./ComisionConfigPanel";
import MapeoDesdeDocumento from "./MapeoDesdeDocumento";

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onVolver: () => void;
}

type Vista = "listado" | "editor";

function emptyForm(): TipoDocumentoGastoForm {
  return {
    nombre: "",
    descripcion: "",
    origen: "",
    activo: true,
    campos_habilitados: ["empresa", "fecha", "proveedor", "concepto", "importes", "rubro"],
    campos_requeridos: ["empresa", "fecha", "proveedor", "concepto", "importes", "rubro"],
    valores_defecto: {},
    mapeo_campos: { ...BROU_MAPEO_DEFAULT },
    comision_config: normalizeComisionConfig(COMISION_CONFIG_DEFAULT),
  };
}

function rowToForm(row: TipoDocumentoGasto): TipoDocumentoGastoForm {
  return {
    nombre: row.nombre,
    descripcion: row.descripcion,
    origen: row.origen,
    activo: row.activo,
    campos_habilitados: row.campos_habilitados.filter(isGastoCampoId),
    campos_requeridos: row.campos_requeridos.filter(isGastoCampoId),
    valores_defecto: { ...row.valores_defecto },
    mapeo_campos: normalizeGastoMapeo(row.mapeo_campos),
    comision_config: normalizeComisionConfig(row.comision_config),
  };
}

export default function TiposDocumentoGasto({
  apiOnline,
  onError,
  onSuccess,
  onVolver,
}: Props) {
  const [vista, setVista] = useState<Vista>("listado");
  const [rows, setRows] = useState<TipoDocumentoGasto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<TipoDocumentoGastoForm>(emptyForm);
  const [titulosPdf, setTitulosPdf] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!apiOnline) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setRows(await fetchTiposDocumentoGasto());
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudieron cargar los tipos");
    } finally {
      setLoading(false);
    }
  }, [apiOnline, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const volverListado = useCallback(() => {
    setVista("listado");
    setEditId(null);
    setForm(emptyForm());
    setTitulosPdf([]);
  }, []);

  useHeaderBackStep(vista === "editor", volverListado, "Tipos para Ingresar gasto");

  const abrirNuevo = () => {
    setEditId(null);
    setForm(emptyForm());
    setVista("editor");
  };

  const abrirEditar = (row: TipoDocumentoGasto) => {
    setEditId(row.id);
    setForm(rowToForm(row));
    setVista("editor");
  };

  const setMapeoCompleto = (mapeo: GastoMapeoCampos) => {
    setForm((f) => ({ ...f, mapeo_campos: mapeo }));
  };

  const setComisionConfig = (comision_config: ComisionDocumentoConfig) => {
    setForm((f) => ({ ...f, comision_config }));
  };

  const mostrarComision = esTipoDocumentoBrou(form);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiOnline) {
      onError("Sin conexión con la API");
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await updateTipoDocumentoGasto(editId, form);
        onSuccess("Tipo de documento actualizado");
      } else {
        await createTipoDocumentoGasto(form);
        onSuccess("Tipo de documento creado");
      }
      volverListado();
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const eliminar = async (row: TipoDocumentoGasto) => {
    if (!apiOnline) {
      onError("Sin conexión con la API");
      return;
    }
    if (!window.confirm(`¿Eliminar «${row.nombre}»?`)) return;
    try {
      await deleteTipoDocumentoGasto(row.id);
      onSuccess("Tipo eliminado");
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo eliminar");
    }
  };

  if (vista === "editor") {
    return (
      <SubseccionInlinePanel
        onVolver={volverListado}
        volverLabel="Volver al listado"
        title={editId ? "Editar tipo de documento" : "Nuevo tipo de documento"}
        description="Definí de qué dato del comprobante se completa cada campo del gasto (ej. extracto BROU)."
      >
        <form className="doc-tipo-gasto-form" onSubmit={guardar}>
          <div className="form-grid">
            <div className="field span-2">
              <label htmlFor="doc-tipo-nombre">Nombre *</label>
              <input
                id="doc-tipo-nombre"
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej. BROU — Transferencias"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="doc-tipo-origen">Origen / banco</label>
              <input
                id="doc-tipo-origen"
                value={form.origen}
                onChange={(e) => setForm((f) => ({ ...f, origen: e.target.value }))}
                placeholder="Ej. BROU"
              />
            </div>
            <div className="field inline-check span-2">
              <label>
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
                />
                Activo (visible al ingresar gastos)
              </label>
            </div>
            <div className="field span-3">
              <label htmlFor="doc-tipo-desc">Descripción</label>
              <textarea
                id="doc-tipo-desc"
                rows={2}
                value={form.descripcion}
                onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                placeholder="Uso previsto de este documento"
              />
            </div>
          </div>

          <div className="doc-tipo-mapeo-block">
            <h3>Conexiones con el documento</h3>

            <MapeoDesdeDocumento
              apiOnline={apiOnline}
              mapeo={normalizeGastoMapeo(form.mapeo_campos)}
              onMapeoChange={setMapeoCompleto}
              onError={onError}
              onTitulosDetectados={setTitulosPdf}
            />
          </div>

          {mostrarComision ? (
            <div className="doc-tipo-mapeo-block doc-tipo-comision-block">
              <h3>Comisión bancaria (registro aparte)</h3>
              <p className="muted doc-tipo-comision-intro">
                Cuando el comprobante BROU incluye comisión, el sistema puede crear un segundo
                registro en la tabla de documentos ingresados. Configurá qué campos lleva ese
                registro.
              </p>
              <ComisionConfigPanel
                apiOnline={apiOnline}
                config={normalizeComisionConfig(form.comision_config)}
                titulosDisponibles={titulosPdf}
                onChange={setComisionConfig}
                onError={onError}
                onSuccess={onSuccess}
              />
            </div>
          ) : null}

          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={volverListado}>
              <IconCancelar /> Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || !apiOnline}>
              <IconConfirmar /> {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </SubseccionInlinePanel>
    );
  }

  return (
    <SubseccionInlinePanel
      onVolver={onVolver}
      volverLabel="Volver a Documentos Digitales"
      title="Tipos de documento para gastos"
      description="Cada tipo define de qué dato del comprobante se completa cada campo del gasto (ej. transferencias BROU a proveedores)."
    >
      <div className="doc-tipo-toolbar">
        <button type="button" className="btn btn-primary" onClick={abrirNuevo} disabled={!apiOnline}>
          + Nuevo tipo
        </button>
      </div>

      {loading ? (
        <p className="muted">Cargando tipos…</p>
      ) : rows.length === 0 ? (
        <div className="rrhh-empty-state documentos-digitales-empty">
          <h3>Sin tipos configurados</h3>
          <p className="muted">
            Creá un tipo para BROU, facturas u otros documentos y definí sus conexiones de campos.
          </p>
        </div>
      ) : (
        <div className="doc-tipo-list">
          {rows.map((row) => (
            <article key={row.id} className="doc-tipo-card">
              <div className="doc-tipo-card-head">
                <div>
                  <h3>{row.nombre}</h3>
                  {row.origen ? (
                    <span className="doc-tipo-origen-badge">{row.origen}</span>
                  ) : null}
                  {!row.activo ? (
                    <span className="doc-tipo-inactivo-badge">Inactivo</span>
                  ) : null}
                </div>
                <div className="doc-tipo-card-actions">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => abrirEditar(row)}>
                    Editar
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-danger-text"
                    onClick={() => void eliminar(row)}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
              {row.descripcion ? <p className="muted doc-tipo-card-desc">{row.descripcion}</p> : null}
              <div className="doc-tipo-chips">
                {(Object.entries(normalizeGastoMapeo(row.mapeo_campos)) as [
                  GastoDestinoId,
                  string,
                ][]).map(([destino, etiqueta]) => (
                  <span key={destino} className="doc-tipo-chip">
                    {GASTO_DESTINO_LABELS[destino]} ← {etiqueta}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </SubseccionInlinePanel>
  );
}
