import { useCallback, useEffect, useMemo, useState } from "react";
import { saveStockEquinaDispositivo, type EmpresaOperativaStock, type StockDispositivoFotoMeta } from "../../api";
import { useHeaderBackStep } from "../../header-back";
import type {
  DispositivoEmpresa,
  DispositivoEstado,
  DispositivoSexo,
  StockEquinaDispositivo,
} from "../../types";
import SubseccionInlinePanel from "../SubseccionInlinePanel";
import StockEditarFichaStats from "../stock/StockEditarFichaStats";
import StockEditarHeadPanel from "../stock/StockEditarHeadPanel";
import SelectEmpresaDispositivo, {
  EMPRESA_PENDIENTE,
} from "../stock/SelectEmpresaDispositivo";
import SelectSexoDispositivo from "../stock/SelectSexoDispositivo";
import StockEquinaEvolucionTimeline from "./StockEquinaEvolucionTimeline";
import StockDispositivoFotoCard, {
  stockFotoMetaFromDispositivo,
} from "../stock/StockDispositivoFotoCard";
import StockEquinaHistorialCambiosPanel from "./StockEquinaHistorialCambiosPanel";
import {
  buildGrupo,
  calcularEdadMeses,
  listAniosNacimiento,
  MESES_NACIMIENTO,
  normalizarEstadoDispositivo,
  normalizarGrupoLibre,
  requiereFechaBaja,
  resolverFechaBajaFormulario,
} from "./stock-equina-utils";

interface Props {
  dispositivo: StockEquinaDispositivo;
  empresas: EmpresaOperativaStock[];
  apiOnline: boolean;
  onVolver: () => void;
  volverLabel?: string;
  onSaved: (actualizado: StockEquinaDispositivo) => void;
  onFotoMetaChange?: (meta: StockDispositivoFotoMeta) => void;
  onVerHistorial: () => void;
  onError: (msg: string) => void;
  /** Al abrir desde VID: solo lectura hasta pulsar Editar. */
  modoInicial?: "ver" | "editar";
}

export default function StockEquinaEditarPanel({
  dispositivo,
  empresas,
  apiOnline,
  onVolver,
  volverLabel = "Volver a Stock Equino",
  onSaved,
  onFotoMetaChange,
  onVerHistorial,
  onError,
  modoInicial = "ver",
}: Props) {
  const [empresa, setEmpresa] = useState<DispositivoEmpresa>(
    dispositivo.empresa ?? ""
  );
  const [sexo, setSexo] = useState<DispositivoSexo>(dispositivo.sexo ?? "");
  const [nacimientoMes, setNacimientoMes] = useState<number | null>(
    dispositivo.nacimiento_mes
  );
  const [nacimientoAnio, setNacimientoAnio] = useState<number | null>(
    dispositivo.nacimiento_anio
  );
  const [observaciones, setObservaciones] = useState(dispositivo.observaciones ?? "");
  const [grupoLibre, setGrupoLibre] = useState(dispositivo.grupo_libre ?? "");
  const [estado, setEstado] = useState<DispositivoEstado>(
    normalizarEstadoDispositivo(dispositivo.estado)
  );
  const [bajaMes, setBajaMes] = useState<number | null>(dispositivo.baja_mes);
  const [bajaAnio, setBajaAnio] = useState<number | null>(dispositivo.baja_anio);
  const [guardando, setGuardando] = useState(false);
  const [verHistorialCambios, setVerHistorialCambios] = useState(false);
  const [modoEdicion, setModoEdicion] = useState<"ver" | "editar">(modoInicial);
  const soloLectura = modoEdicion === "ver";
  const camposDeshabilitados = soloLectura || guardando || !apiOnline;

  const restablecerDesdeDispositivo = useCallback((d: StockEquinaDispositivo) => {
    setEmpresa(d.empresa ?? "");
    setSexo(d.sexo ?? "");
    setNacimientoMes(d.nacimiento_mes);
    setNacimientoAnio(d.nacimiento_anio);
    setObservaciones(d.observaciones ?? "");
    setGrupoLibre(d.grupo_libre ?? "");
    setEstado(normalizarEstadoDispositivo(d.estado));
    setBajaMes(d.baja_mes);
    setBajaAnio(d.baja_anio);
  }, []);

  useEffect(() => {
    setModoEdicion(modoInicial);
    restablecerDesdeDispositivo(dispositivo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispositivo.clave, modoInicial]);

  const cancelarEdicion = () => {
    if (modoEdicion === "editar" && modoInicial === "ver") {
      restablecerDesdeDispositivo(dispositivo);
      setModoEdicion("ver");
      return;
    }
    onVolver();
  };

  const backDestination =
    volverLabel.replace(/^Volver a /i, "").trim() || "Stock Equino";
  useHeaderBackStep(!verHistorialCambios, onVolver, backDestination);

  const aniosNacimiento = useMemo(() => listAniosNacimiento(), []);
  const edadMeses = useMemo(
    () => calcularEdadMeses(nacimientoMes, nacimientoAnio),
    [nacimientoMes, nacimientoAnio]
  );

  useEffect(() => {
    const { mes, anio } = resolverFechaBajaFormulario(
      estado,
      bajaMes,
      bajaAnio,
      dispositivo.baja_mes,
      dispositivo.baja_anio,
      dispositivo.ultima_fecha
    );
    if (mes !== bajaMes) setBajaMes(mes);
    if (anio !== bajaAnio) setBajaAnio(anio);
  }, [estado, dispositivo.clave]);

  const grupoActual = useMemo(
    () => buildGrupo(nacimientoAnio),
    [nacimientoAnio]
  );

  const hayCambios =
    empresa !== (dispositivo.empresa ?? "") ||
    grupoActual !== (dispositivo.grupo ?? "").trim().toUpperCase() ||
    normalizarGrupoLibre(grupoLibre) !== normalizarGrupoLibre(dispositivo.grupo_libre ?? "") ||
    sexo !== (dispositivo.sexo ?? "") ||
    nacimientoMes !== dispositivo.nacimiento_mes ||
    nacimientoAnio !== dispositivo.nacimiento_anio ||
    observaciones.trim() !== (dispositivo.observaciones ?? "").trim() ||
    estado !== normalizarEstadoDispositivo(dispositivo.estado) ||
    bajaMes !== dispositivo.baja_mes ||
    bajaAnio !== dispositivo.baja_anio;

  const guardar = async () => {
    if (!apiOnline || guardando || soloLectura) return;
    if (!hayCambios) {
      if (modoInicial === "ver") {
        setModoEdicion("ver");
      } else {
        onVolver();
      }
      return;
    }

    setGuardando(true);
    try {
      const guardado = await saveStockEquinaDispositivo(
        dispositivo.clave,
        {
          sexo,
          empresa,
          grupo: grupoActual,
          grupo_libre: normalizarGrupoLibre(grupoLibre),
          nacimiento_mes: nacimientoMes,
          nacimiento_anio: nacimientoAnio,
          observaciones: observaciones.trim(),
          estado,
          baja_mes: requiereFechaBaja(estado) ? bajaMes : null,
          baja_anio: requiereFechaBaja(estado) ? bajaAnio : null,
        },
        dispositivo.eid
      );

      onSaved({ ...dispositivo, ...guardado });
      restablecerDesdeDispositivo({ ...dispositivo, ...guardado });
      if (modoInicial === "ver") {
        setModoEdicion("ver");
      } else {
        onVolver();
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setGuardando(false);
    }
  };

  if (verHistorialCambios) {
    return (
      <StockEquinaHistorialCambiosPanel
        clave={dispositivo.clave}
        vid={dispositivo.vid}
        eid={dispositivo.eid}
        apiOnline={apiOnline}
        onVolver={() => setVerHistorialCambios(false)}
        volverLabel={soloLectura ? "Volver a la caravana" : "Volver a editar caravana"}
        onError={onError}
      />
    );
  }

  return (
    <SubseccionInlinePanel
      onVolver={onVolver}
      volverLabel={volverLabel}
      title={soloLectura ? "Caravana" : "Editar caravana"}
      cardClassName={`subseccion-inline-card stock-equina-editar-page${
        soloLectura ? " stock-equina-editar-page--solo-lectura" : ""
      }`}
      headAside={
        <StockEditarHeadPanel
          eid={dispositivo.eid}
          vid={dispositivo.vid}
          totalLecturas={dispositivo.total_lecturas}
          ultimaFecha={dispositivo.ultima_fecha}
          ultimaHora={dispositivo.ultima_hora}
          iconClassName="stock-equina-editar-icon stock-editar-head-signal"
        />
      }
      footer={
        <div className="stock-equina-editar-page-foot">
          <div className="stock-equina-editar-footer-links">
            <button
              type="button"
              className="stock-edit-link-btn"
              onClick={onVerHistorial}
              disabled={guardando}
            >
              Historial de lecturas →
            </button>
            <button
              type="button"
              className="stock-edit-link-btn stock-edit-link-btn--audit"
              onClick={() => setVerHistorialCambios(true)}
              disabled={guardando || !apiOnline}
            >
              Historial de cambios →
            </button>
          </div>
          <div className="stock-equina-editar-footer-actions">
            {soloLectura ? (
              <>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={onVolver}
                  disabled={guardando}
                >
                  Volver
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setModoEdicion("editar")}
                  disabled={guardando || !apiOnline}
                >
                  Editar
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={cancelarEdicion}
                  disabled={guardando}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void guardar()}
                  disabled={guardando || !apiOnline}
                >
                  {guardando ? "Guardando…" : "Guardar cambios"}
                </button>
              </>
            )}
          </div>
        </div>
      }
    >
      <div className="stock-equina-editar-page-body">
        <section
          className="stock-equina-editar-panel"
          aria-label={soloLectura ? "Ficha de la caravana" : "Datos editables"}
        >
            <div
              className={`stock-edit-ficha-card stock-editar-ficha${
                soloLectura ? " stock-edit-ficha-card--solo-lectura" : ""
              }`}
            >
              <h3 className="stock-editar-ficha-title">Ficha del animal</h3>

              <div className="stock-editar-ficha-toolbar">
                <div className="stock-editar-ficha-zone stock-editar-ficha-zone--ident">
                  <div className="stock-editar-ficha-cell">
                    <label className="stock-editar-ficha-label" htmlFor="edit-equina-empresa">
                      Empresa
                    </label>
                    <SelectEmpresaDispositivo
                      id="edit-equina-empresa"
                      empresas={empresas}
                      value={empresa}
                      disabled={camposDeshabilitados}
                      onChange={(e) =>
                        setEmpresa(e === EMPRESA_PENDIENTE ? "" : (e as DispositivoEmpresa))
                      }
                    />
                  </div>
                </div>

                <div className="stock-editar-ficha-zone stock-editar-ficha-zone--sexo">
                  <div className="stock-editar-ficha-cell">
                    <label className="stock-editar-ficha-label" htmlFor="edit-equina-sexo">
                      Sexo
                    </label>
                    <SelectSexoDispositivo
                      id="edit-equina-sexo"
                      value={sexo}
                      disabled={camposDeshabilitados}
                      onChange={setSexo}
                    />
                  </div>
                </div>

                <div className="stock-editar-ficha-zone stock-editar-ficha-zone--nac">
                  <div className="stock-editar-ficha-cell">
                    <label className="stock-editar-ficha-label" htmlFor="edit-equina-nac-mes">
                      Nacimiento
                    </label>
                    <select
                      id="edit-equina-nac-mes"
                      className="stock-nacimiento-mes stock-edit-select"
                      value={nacimientoMes ?? ""}
                      disabled={camposDeshabilitados}
                      onChange={(e) =>
                        setNacimientoMes(
                          e.target.value ? Number(e.target.value) : null
                        )
                      }
                    >
                      <option value="">Mes</option>
                      {MESES_NACIMIENTO.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="stock-editar-ficha-cell stock-editar-ficha-cell--anio">
                    <label className="stock-editar-ficha-label" htmlFor="edit-equina-nac-anio">
                      Año
                    </label>
                    <select
                      id="edit-equina-nac-anio"
                      className="stock-nacimiento-anio stock-edit-select"
                      value={nacimientoAnio ?? ""}
                      disabled={camposDeshabilitados}
                      onChange={(e) =>
                        setNacimientoAnio(
                          e.target.value ? Number(e.target.value) : null
                        )
                      }
                    >
                      <option value="">Año</option>
                      {aniosNacimiento.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="stock-editar-ficha-zone stock-editar-ficha-zone--grupo">
                  <div className="stock-editar-ficha-cell">
                    <label className="stock-editar-ficha-label" htmlFor="edit-equina-grupo-libre">
                      Grupo
                    </label>
                    <input
                      id="edit-equina-grupo-libre"
                      type="text"
                      className="stock-observaciones-input mayusculas-auto"
                      maxLength={48}
                      placeholder="Texto libre (letras y números)…"
                      value={grupoLibre}
                      readOnly={soloLectura}
                      disabled={!soloLectura && camposDeshabilitados}
                      onChange={(e) => setGrupoLibre(normalizarGrupoLibre(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              <div className="stock-editar-ficha-foot">
                <StockEditarFichaStats
                  edadMeses={edadMeses}
                  edadId="edit-equina-edad"
                  grupoId="edit-equina-grupo"
                  estadoId="edit-equina-estado"
                  nacimientoAnio={nacimientoAnio}
                  estado={estado}
                  disabled={camposDeshabilitados}
                  onEstadoChange={setEstado}
                />
              </div>
            </div>

            <div className="stock-edit-evolucion-row">
              <StockDispositivoFotoCard
                modulo="equino"
                clave={dispositivo.clave}
                initialMeta={stockFotoMetaFromDispositivo(dispositivo)}
                soloLectura={soloLectura}
                disabled={!soloLectura && (guardando || !apiOnline)}
                onChange={(meta) => {
                  onFotoMetaChange?.(meta);
                }}
                onError={onError}
              />
              <StockEquinaEvolucionTimeline
                nacimientoMes={nacimientoMes}
                nacimientoAnio={nacimientoAnio}
                edadMeses={edadMeses}
                sexo={sexo}
                estado={estado}
                bajaMes={bajaMes}
                bajaAnio={bajaAnio}
                editandoBaja={!soloLectura}
                bajaDisabled={camposDeshabilitados}
                onBajaMesChange={setBajaMes}
                onBajaAnioChange={setBajaAnio}
              />
            </div>

            <div className="stock-edit-field stock-edit-field--observaciones">
              <label htmlFor="edit-equina-obs">
                Observaciones
                <span className="stock-edit-label-hint">opcional</span>
              </label>
              <input
                id="edit-equina-obs"
                type="text"
                className="stock-observaciones-input"
                maxLength={2000}
                placeholder="Notas manuales sobre la caravana…"
                value={observaciones}
                readOnly={soloLectura}
                disabled={!soloLectura && camposDeshabilitados}
                onChange={(e) => setObservaciones(e.target.value)}
              />
            </div>
        </section>
      </div>
    </SubseccionInlinePanel>
  );
}

/** @deprecated Usar StockEquinaEditarPanel */
export { StockEquinaEditarPanel as StockEquinaEditarModal };
