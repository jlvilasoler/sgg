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
  seleccionados: StockGanaderaDispositivo[];
  totalFiltrados: number;
  apiOnline: boolean;
  onSeleccionarTodosFiltrados: () => void;
  onLimpiar: () => void;
  onAplicado: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

export default function StockGanaderaBulkPanel({
  seleccionados,
  totalFiltrados,
  apiOnline,
  onSeleccionarTodosFiltrados,
  onLimpiar,
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
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al aplicar cambios");
    } finally {
      setGuardando(false);
    }
  };

  if (n === 0) return null;

  return (
    <section className="stock-bulk-panel" aria-label="Edición masiva">
      <div className="stock-bulk-panel-head">
        <div className="stock-bulk-panel-count">
          <strong>{n}</strong> seleccionado{n === 1 ? "" : "s"}
          {n < totalFiltrados && (
            <button
              type="button"
              className="stock-bulk-link"
              onClick={onSeleccionarTodosFiltrados}
            >
              Seleccionar los {totalFiltrados} del filtro
            </button>
          )}
        </div>
        <button type="button" className="stock-bulk-link" onClick={onLimpiar}>
          Quitar selección
        </button>
      </div>

      <p className="stock-bulk-panel-hint muted">
        Marcá los campos que querés cambiar y aplicá a todos los seleccionados.
      </p>

      <div className="stock-bulk-panel-grid">
        <label className="stock-bulk-field">
          <input
            type="checkbox"
            checked={aplicarEmpresa}
            onChange={(e) => setAplicarEmpresa(e.target.checked)}
          />
          <span className="stock-bulk-field-label">Empresa</span>
          <SelectEmpresaDispositivo
            value={empresa}
            onChange={setEmpresa}
            disabled={!aplicarEmpresa || guardando}
          />
        </label>

        <label className="stock-bulk-field">
          <input
            type="checkbox"
            checked={aplicarSexo}
            onChange={(e) => setAplicarSexo(e.target.checked)}
          />
          <span className="stock-bulk-field-label">Sexo</span>
          <SelectSexoDispositivo
            value={sexo}
            onChange={setSexo}
            disabled={!aplicarSexo || guardando}
          />
        </label>

        <div className="stock-bulk-field stock-bulk-field--nacimiento">
          <label className="stock-bulk-field-check">
            <input
              type="checkbox"
              checked={aplicarNacimiento}
              onChange={(e) => setAplicarNacimiento(e.target.checked)}
            />
            <span className="stock-bulk-field-label">Nacimiento</span>
          </label>
          <div className="stock-bulk-nacimiento-inputs">
            <select
              className="stock-edit-select"
              value={nacimientoMes}
              disabled={!aplicarNacimiento || guardando}
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
              disabled={!aplicarNacimiento || guardando}
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

        <div className="stock-bulk-field stock-bulk-field--estado">
          <label className="stock-bulk-field-check">
            <input
              type="checkbox"
              checked={aplicarEstado}
              onChange={(e) => setAplicarEstado(e.target.checked)}
            />
            <span className="stock-bulk-field-label">Estado</span>
          </label>
          <SelectEstadoDispositivo
            value={estado}
            onChange={setEstado}
            disabled={!aplicarEstado || guardando}
          />
          {aplicarEstado && requiereFechaBaja(estado) && (
            <div className="stock-bulk-nacimiento-inputs">
              <select
                className="stock-edit-select"
                value={bajaMes}
                disabled={guardando}
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
                disabled={guardando}
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

        <div className="stock-bulk-field stock-bulk-field--obs span-all">
          <label className="stock-bulk-field-check">
            <input
              type="checkbox"
              checked={aplicarObservaciones}
              onChange={(e) => setAplicarObservaciones(e.target.checked)}
            />
            <span className="stock-bulk-field-label">Observaciones</span>
          </label>
          <label className="stock-bulk-obs-modo">
            <input
              type="radio"
              name="obs-modo"
              checked={obsModoReemplazar}
              disabled={!aplicarObservaciones || guardando}
              onChange={() => setObsModoReemplazar(true)}
            />
            Reemplazar
          </label>
          <label className="stock-bulk-obs-modo">
            <input
              type="radio"
              name="obs-modo"
              checked={!obsModoReemplazar}
              disabled={!aplicarObservaciones || guardando}
              onChange={() => setObsModoReemplazar(false)}
            />
            Agregar al final
          </label>
          <textarea
            className="stock-bulk-obs-text"
            rows={2}
            placeholder="Texto para todos los seleccionados…"
            value={observaciones}
            disabled={!aplicarObservaciones || guardando}
            onChange={(e) => setObservaciones(e.target.value)}
          />
        </div>
      </div>

      <div className="stock-bulk-panel-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!puedeAplicar || guardando}
          onClick={() => void aplicar()}
        >
          {guardando ? "Aplicando…" : `Aplicar a ${n} dispositivo${n === 1 ? "" : "s"}`}
        </button>
      </div>
    </section>
  );
}
