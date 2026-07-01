import { useMemo, useState } from "react";
import { bulkPatchStockEquinaDispositivos, type EmpresaOperativaStock } from "../../api";
import { useHeaderBackStep } from "../../header-back";
import type {
  DispositivoEmpresa,
  DispositivoEstado,
  DispositivoSexo,
  StockEquinaDispositivo,
} from "../../types";
import SubseccionInlinePanel from "../SubseccionInlinePanel";
import SelectEmpresaDispositivo, {
  EMPRESA_PENDIENTE,
} from "../stock/SelectEmpresaDispositivo";
import SelectEstadoDispositivo from "../stock/SelectEstadoDispositivo";
import SelectSexoDispositivo from "../stock/SelectSexoDispositivo";
import {
  listAniosNacimiento,
  MESES_NACIMIENTO,
  normalizarEstadoDispositivo,
  normalizarGrupoLibre,
  requiereFechaBaja,
} from "./stock-equina-utils";

interface Props {
  empresas: EmpresaOperativaStock[];
  onVolver: () => void;
  seleccionados: StockEquinaDispositivo[];
  totalFiltrados: number;
  apiOnline: boolean;
  onSeleccionarTodosFiltrados: () => void;
  onLimpiar: () => void;
  onAplicado: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

export default function StockEquinaBulkPanel({
  empresas,
  onVolver,
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
  const [aplicarGrupoLibre, setAplicarGrupoLibre] = useState(false);
  const [aplicarObservaciones, setAplicarObservaciones] = useState(false);

  const [empresa, setEmpresa] = useState<DispositivoEmpresa>("");
  const [sexo, setSexo] = useState<DispositivoSexo>("");
  const [nacimientoMes, setNacimientoMes] = useState<number | "">("");
  const [nacimientoAnio, setNacimientoAnio] = useState<number | "">("");
  const [estado, setEstado] = useState<DispositivoEstado>("VIVO");
  const [bajaMes, setBajaMes] = useState<number | "">("");
  const [bajaAnio, setBajaAnio] = useState<number | "">("");
  const [observaciones, setObservaciones] = useState("");
  const [grupoLibre, setGrupoLibre] = useState("");
  const [obsModoReemplazar, setObsModoReemplazar] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useHeaderBackStep(true, onVolver, "Stock Equino");

  const anios = useMemo(() => listAniosNacimiento(), []);
  const n = seleccionados.length;
  const puedeAplicar =
    apiOnline &&
    n > 0 &&
    (aplicarEmpresa ||
      aplicarSexo ||
      aplicarNacimiento ||
      aplicarEstado ||
      aplicarGrupoLibre ||
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
      patch.estado = normalizarEstadoDispositivo(estado);
      if (requiereFechaBaja(estado)) {
        patch.baja_mes = bajaMes === "" ? null : bajaMes;
        patch.baja_anio = bajaAnio === "" ? null : bajaAnio;
      }
    }
    if (aplicarGrupoLibre) patch.grupo_libre = grupoLibre;
    if (aplicarObservaciones) {
      patch.observaciones = observaciones;
      patch.observaciones_modo = obsModoReemplazar ? "reemplazar" : "agregar";
    }

    setGuardando(true);
    try {
      const result = await bulkPatchStockEquinaDispositivos(
        seleccionados.map((d) => d.clave),
        patch
      );
      const msg = `Actualizados ${result.actualizados} dispositivo${
        result.actualizados === 1 ? "" : "s"
      }.`;
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

  return (
    <SubseccionInlinePanel
      onVolver={onVolver}
      volverLabel="Volver a Stock Equino"
      icon={{ source: "hub", id: "stock_dispositivos" }}
      title={`Editar ${n} dispositivo${n === 1 ? "" : "s"}`}
      description="Marcá los campos que querés cambiar y aplicá."
      cardClassName="stock-bulk-inline"
      banner={
        n < totalFiltrados ? (
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
        ) : undefined
      }
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onVolver} disabled={guardando}>
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
        </>
      }
    >
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
            empresas={empresas}
            value={empresa}
            onChange={(e) =>
              setEmpresa(e === EMPRESA_PENDIENTE ? "" : (e as DispositivoEmpresa))
            }
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
                onChange={(e) => setBajaMes(e.target.value ? Number(e.target.value) : "")}
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
                onChange={(e) => setBajaAnio(e.target.value ? Number(e.target.value) : "")}
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

        <label className={`stock-bulk-modal-field${aplicarGrupoLibre ? " is-active" : ""}`}>
          <span className="stock-bulk-modal-field-head">
            <input
              type="checkbox"
              checked={aplicarGrupoLibre}
              disabled={camposDeshabilitados}
              onChange={(e) => setAplicarGrupoLibre(e.target.checked)}
            />
            Grupo
          </span>
          <input
            type="text"
            className="stock-observaciones-input mayusculas-auto"
            maxLength={48}
            placeholder="Texto libre (letras y números)…"
            value={grupoLibre}
            disabled={!aplicarGrupoLibre || camposDeshabilitados}
            onChange={(e) => setGrupoLibre(normalizarGrupoLibre(e.target.value))}
          />
        </label>

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
    </SubseccionInlinePanel>
  );
}
