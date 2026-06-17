import { useMemo, useState } from "react";
import { bulkPatchStockGanaderaDispositivos } from "../../api";
import type {
  DispositivoEmpresa,
  DispositivoEstado,
  DispositivoSexo,
  StockGanaderaDispositivo,
} from "../../types";
import SelectEmpresaDispositivo from "./SelectEmpresaDispositivo";
import SelectEstadoDispositivo from "./SelectEstadoDispositivo";
import SelectSexoDispositivo from "./SelectSexoDispositivo";
import {
  listAniosNacimiento,
  MESES_NACIMIENTO,
  normalizarEstadoDispositivo,
  requiereFechaBaja,
} from "./stock-ganadera-utils";

interface Props {
  open: boolean;
  onClose: () => void;
  seleccionados: StockGanaderaDispositivo[];
  totalFiltrados: number;
  apiOnline: boolean;
  onSeleccionarTodosFiltrados: () => void;
  onLimpiar: () => void;
  onAplicado: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

export default function StockGanaderaBulkModal({
  open,
  onClose,
  seleccionados,
  totalFiltrados,
  apiOnline,
  onSeleccionarTodosFiltrados,
  onLimpiar: _onLimpiar,
  onAplicado,
  onError,
  onSuccess,
}: Props) {
  const [aplicarEmpresa, setAplicarEmpresa] = useState(false);
  const [aplicarSexo, setAplicarSexo] = useState(false);
  const [aplicarNacimiento, setAplicarNacimiento] = useState(false);
  const [aplicarEstado, setAplicarEstado] = useState(false);
  const [aplicarObservaciones, setAplicarObservaciones] = useState(false);

  const [empresa, setEmpresa] = useState<DispositivoEmpresa>("");
  const [sexo, setSexo] = useState<DispositivoSexo>("");
  const [nacimientoMes, setNacimientoMes] = useState<number | "">("");
  const [nacimientoAnio, setNacimientoAnio] = useState<number | "">("");
  const [estado, setEstado] = useState<DispositivoEstado>("VIVO");
  const [bajaMes, setBajaMes] = useState<number | "">("");
  const [bajaAnio, setBajaAnio] = useState<number | "">("");
  const [observaciones, setObservaciones] = useState("");
  const [obsModoReemplazar, setObsModoReemplazar] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const anios = useMemo(() => listAniosNacimiento(), []);
  const n = seleccionados.length;
  const puedeAplicar =
    apiOnline &&
    n > 0 &&
    (aplicarEmpresa ||
      aplicarSexo ||
      aplicarNacimiento ||
      aplicarEstado ||
      aplicarObservaciones);

  const camposDeshabilitados = guardando;

  const aplicar = async () => {
    if (!puedeAplicar || guardando) return;

    const patch: Record<string, unknown> = {};

    if (aplicarEmpresa) patch.empresa = empresa;
    if (aplicarSexo) patch.sexo = sexo;
    if (aplicarNacimiento) {
      patch.nacimiento_mes = nacimientoMes === "" ? null : nacimientoMes;
      patch.nacimiento_anio = nacimientoAnio === "" ? null : nacimientoAnio;
    }
    if (aplicarEstado) {
      const est = normalizarEstadoDispositivo(estado);
      patch.estado = est;
      if (requiereFechaBaja(est)) {
        if (bajaMes === "" || bajaAnio === "") {
          onError("Para muerte, venta o frigorífico indicá mes y año de baja.");
          return;
        }
        patch.baja_mes = bajaMes;
        patch.baja_anio = bajaAnio;
      } else {
        patch.baja_mes = null;
        patch.baja_anio = null;
      }
    }

    const claves = seleccionados.map((d) => d.clave);
    const eids: Record<string, string> = {};
    for (const d of seleccionados) {
      eids[d.clave] = d.eid;
    }

    setGuardando(true);
    try {
      if (aplicarObservaciones && !obsModoReemplazar) {
        const textoNuevo = observaciones.trim();
        if (!textoNuevo) {
          onError("Escribí el texto a agregar en observaciones.");
          return;
        }
        let actualizados = 0;
        const errores: string[] = [];
        for (const d of seleccionados) {
          const devicePatch = { ...patch };
          const prev = (d.observaciones ?? "").trim();
          devicePatch.observaciones = prev ? `${prev}\n${textoNuevo}` : textoNuevo;
          try {
            const r = await bulkPatchStockGanaderaDispositivos(
              [d.clave],
              devicePatch,
              { [d.clave]: d.eid }
            );
            actualizados += r.actualizados;
            if (r.errores.length) errores.push(r.errores[0].mensaje);
          } catch (e) {
            errores.push(e instanceof Error ? e.message : "Error");
          }
        }
        if (actualizados === 0) {
          onError(errores[0] ?? "No se pudo actualizar ningún dispositivo.");
          return;
        }
        onSuccess(`Cambios aplicados a ${actualizados} dispositivo(s).`);
        if (errores.length) onError(errores[0]);
        onAplicado();
      onClose();
        return;
      }

      if (aplicarObservaciones) {
        patch.observaciones = observaciones.trim();
      }

      const result = await bulkPatchStockGanaderaDispositivos(claves, patch, eids);
      const msg =
        result.errores.length > 0
          ? `Actualizados ${result.actualizados} de ${claves.length}. ${result.errores.length} con error.`
          : `Cambios aplicados a ${result.actualizados} dispositivo(s).`;
      onSuccess(msg);
      if (result.errores.length > 0) {
        onError(result.errores[0].mensaje);
      }
      onAplicado();
      onClose();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al aplicar cambios");
    } finally {
      setGuardando(false);
    }
  };

  if (!open) return null;

  return (
    <div className="stock-bulk-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="stock-bulk-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-bulk-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="stock-bulk-modal-head">
          <div>
            <h2 id="stock-bulk-modal-title" className="stock-bulk-modal-title">
              Editar {n} dispositivo{n === 1 ? "" : "s"}
            </h2>
            <p className="stock-bulk-modal-sub muted">
              Marcá los campos que querés cambiar y aplicá.
            </p>
          </div>
          <button
            type="button"
            className="stock-bulk-modal-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </header>

        {n < totalFiltrados && (
          <div className="stock-bulk-modal-meta">
            <button
              type="button"
              className="stock-bulk-link"
              onClick={onSeleccionarTodosFiltrados}
              disabled={!apiOnline || guardando}
            >
              Incluir los {totalFiltrados} del filtro actual
            </button>
          </div>
        )}

        <div className="stock-bulk-modal-grid">
          <label className={`stock-bulk-modal-field${aplicarEmpresa ? " is-active" : ""}`}>
            <span className="stock-bulk-modal-field-head">
              <input
                type="checkbox"
                checked={aplicarEmpresa}
                disabled={camposDeshabilitados}
                onChange={(e) => setAplicarEmpresa(e.target.checked)}
              />
              Empresa
            </span>
            <SelectEmpresaDispositivo
              value={empresa}
              onChange={setEmpresa}
              disabled={!aplicarEmpresa || camposDeshabilitados}
            />
          </label>

          <label className={`stock-bulk-modal-field${aplicarSexo ? " is-active" : ""}`}>
            <span className="stock-bulk-modal-field-head">
              <input
                type="checkbox"
                checked={aplicarSexo}
                disabled={camposDeshabilitados}
                onChange={(e) => setAplicarSexo(e.target.checked)}
              />
              Sexo
            </span>
            <SelectSexoDispositivo
              value={sexo}
              onChange={setSexo}
              disabled={!aplicarSexo || camposDeshabilitados}
            />
          </label>

          <div className={`stock-bulk-modal-field${aplicarNacimiento ? " is-active" : ""}`}>
            <label className="stock-bulk-modal-field-head">
              <input
                type="checkbox"
                checked={aplicarNacimiento}
                disabled={camposDeshabilitados}
                onChange={(e) => setAplicarNacimiento(e.target.checked)}
              />
              Nacimiento
            </label>
            <div className="stock-bulk-nacimiento-inputs">
              <select
                className="stock-edit-select"
                value={nacimientoMes}
                disabled={!aplicarNacimiento || camposDeshabilitados}
                onChange={(e) =>
                  setNacimientoMes(e.target.value ? Number(e.target.value) : "")
                }
              >
                <option value="">Mes</option>
                {MESES_NACIMIENTO.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <select
                className="stock-edit-select"
                value={nacimientoAnio}
                disabled={!aplicarNacimiento || camposDeshabilitados}
                onChange={(e) =>
                  setNacimientoAnio(e.target.value ? Number(e.target.value) : "")
                }
              >
                <option value="">Año</option>
                {anios.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={`stock-bulk-modal-field${aplicarEstado ? " is-active" : ""}`}>
            <label className="stock-bulk-modal-field-head">
              <input
                type="checkbox"
                checked={aplicarEstado}
                disabled={camposDeshabilitados}
                onChange={(e) => setAplicarEstado(e.target.checked)}
              />
              Estado
            </label>
            <SelectEstadoDispositivo
              value={estado}
              onChange={setEstado}
              disabled={!aplicarEstado || camposDeshabilitados}
            />
            {aplicarEstado && requiereFechaBaja(estado) && (
              <div className="stock-bulk-nacimiento-inputs">
                <select
                  className="stock-edit-select"
                  value={bajaMes}
                  disabled={camposDeshabilitados}
                  onChange={(e) =>
                    setBajaMes(e.target.value ? Number(e.target.value) : "")
                  }
                >
                  <option value="">Mes baja</option>
                  {MESES_NACIMIENTO.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <select
                  className="stock-edit-select"
                  value={bajaAnio}
                  disabled={camposDeshabilitados}
                  onChange={(e) =>
                    setBajaAnio(e.target.value ? Number(e.target.value) : "")
                  }
                >
                  <option value="">Año baja</option>
                  {anios.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div
            className={`stock-bulk-modal-field stock-bulk-modal-field--full${
              aplicarObservaciones ? " is-active" : ""
            }`}
          >
            <label className="stock-bulk-modal-field-head">
              <input
                type="checkbox"
                checked={aplicarObservaciones}
                disabled={camposDeshabilitados}
                onChange={(e) => setAplicarObservaciones(e.target.checked)}
              />
              Observaciones
            </label>
            <div className="stock-bulk-obs-row">
              <label className="stock-bulk-obs-modo">
                <input
                  type="radio"
                  name="obs-modo"
                  checked={obsModoReemplazar}
                  disabled={!aplicarObservaciones || camposDeshabilitados}
                  onChange={() => setObsModoReemplazar(true)}
                />
                Reemplazar
              </label>
              <label className="stock-bulk-obs-modo">
                <input
                  type="radio"
                  name="obs-modo"
                  checked={!obsModoReemplazar}
                  disabled={!aplicarObservaciones || camposDeshabilitados}
                  onChange={() => setObsModoReemplazar(false)}
                />
                Agregar al final
              </label>
            </div>
            <textarea
              className="stock-bulk-obs-text"
              rows={3}
              placeholder="Texto para todos los seleccionados…"
              value={observaciones}
              disabled={!aplicarObservaciones || camposDeshabilitados}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </div>
        </div>

        <footer className="stock-bulk-modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={guardando}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!puedeAplicar || guardando}
            onClick={() => void aplicar()}
          >
            {guardando ? "Aplicando…" : `Aplicar a ${n}`}
          </button>
        </footer>
      </div>
    </div>
  );
}
