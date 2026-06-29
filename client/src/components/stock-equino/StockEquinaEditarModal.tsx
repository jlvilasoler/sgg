import { useEffect, useMemo, useState } from "react";
import { saveStockEquinaDispositivo, type EmpresaOperativaStock } from "../../api";
import { useHeaderBackStep } from "../../header-back";
import type {
  DispositivoEmpresa,
  DispositivoEstado,
  DispositivoSexo,
  StockEquinaDispositivo,
} from "../../types";
import { fmtDate } from "../../utils";
import SubseccionInlinePanel from "../SubseccionInlinePanel";
import IconoDispositivoWifi from "../stock/IconoDispositivoWifi";
import SelectEmpresaDispositivo, {
  EMPRESA_PENDIENTE,
} from "../stock/SelectEmpresaDispositivo";
import SelectEstadoDispositivo from "../stock/SelectEstadoDispositivo";
import SelectGrupoDispositivo from "../stock/SelectGrupoDispositivo";
import SelectSexoDispositivo from "../stock/SelectSexoDispositivo";
import StockEquinaEvolucionTimeline from "./StockEquinaEvolucionTimeline";
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
  onVerHistorial: () => void;
  onError: (msg: string) => void;
}

export default function StockEquinaEditarPanel({
  dispositivo,
  empresas,
  apiOnline,
  onVolver,
  volverLabel = "Volver a Stock Equino",
  onSaved,
  onVerHistorial,
  onError,
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
    if (!apiOnline || guardando) return;
    if (!hayCambios) {
      onVolver();
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
      onVolver();
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
        volverLabel="Volver a editar caravana"
        onError={onError}
      />
    );
  }

  return (
    <SubseccionInlinePanel
      onVolver={onVolver}
      volverLabel={volverLabel}
      title="Editar caravana"
      description={
        <>
          EID <span className="num">{dispositivo.eid || "—"}</span>
          {" · "}
          VID <span className="num">{dispositivo.vid || "—"}</span>
          {" · "}
          Últ. lectura {fmtDate(dispositivo.ultima_fecha)}
          {dispositivo.ultima_hora ? ` ${dispositivo.ultima_hora}` : ""}
        </>
      }
      cardClassName="subseccion-inline-card stock-equina-editar-page"
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
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onVolver}
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
          </div>
        </div>
      }
    >
      <div className="stock-equina-editar-hero">
        <div className="stock-equina-editar-hero-main">
          <span className="stock-equina-editar-hero-icon" aria-hidden>
            <IconoDispositivoWifi className="stock-equina-editar-icon" />
          </span>
          <div className="stock-equina-editar-hero-text">
            <span className="stock-equina-editar-hero-kicker">Caravana electrónica</span>
            <div className="stock-equina-editar-hero-ids">
              <span className="stock-equina-editar-hero-badge num">
                EID {dispositivo.eid || "—"}
              </span>
              <span className="stock-equina-editar-hero-badge stock-equina-editar-hero-badge--vid num">
                {dispositivo.vid || "—"}
              </span>
            </div>
            <p className="stock-equina-editar-hero-meta muted">
              {dispositivo.total_lecturas} lectura
              {dispositivo.total_lecturas === 1 ? "" : "s"} registrada
              {dispositivo.total_lecturas === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      </div>

      <div className="stock-equina-editar-page-body">
        <section className="stock-equina-editar-panel" aria-label="Datos editables">
            <h3 className="stock-equina-editar-section-title">Ficha del animal</h3>

            <div className="stock-equina-editar-grid">
              <div className="stock-edit-row-4 stock-edit-field--full">
                <div className="stock-edit-field stock-edit-field--empresa">
                  <label htmlFor="edit-equina-empresa">Empresa</label>
                  <SelectEmpresaDispositivo
                    id="edit-equina-empresa"
                    empresas={empresas}
                    value={empresa}
                    disabled={guardando || !apiOnline}
                    onChange={(e) =>
                      setEmpresa(e === EMPRESA_PENDIENTE ? "" : (e as DispositivoEmpresa))
                    }
                  />
                </div>

                <div className="stock-edit-field stock-edit-field--sexo">
                  <label htmlFor="edit-equina-sexo">Sexo</label>
                  <SelectSexoDispositivo
                    id="edit-equina-sexo"
                    value={sexo}
                    disabled={guardando || !apiOnline}
                    onChange={setSexo}
                  />
                </div>

                <div className="stock-edit-field stock-edit-field--nacimiento">
                  <label htmlFor="edit-equina-nac-mes">
                    Fecha de nacimiento
                    <span className="stock-edit-label-hint">mes</span>
                  </label>
                  <select
                    id="edit-equina-nac-mes"
                    className="stock-nacimiento-mes stock-edit-select"
                    value={nacimientoMes ?? ""}
                    disabled={guardando || !apiOnline}
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

                <div className="stock-edit-field stock-edit-field--nacimiento-anio">
                  <label htmlFor="edit-equina-nac-anio">Año</label>
                  <select
                    id="edit-equina-nac-anio"
                    className="stock-nacimiento-anio stock-edit-select"
                    value={nacimientoAnio ?? ""}
                    disabled={guardando || !apiOnline}
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

              <div className="stock-edit-row-3 stock-edit-field--full">
              <div className="stock-edit-field stock-edit-field--edad">
                <label htmlFor="edit-equina-edad">Edad calculada</label>
                <div
                  id="edit-equina-edad"
                  className={`stock-edit-edad-card${
                    edadMeses === null ? " stock-edit-edad-card--empty" : ""
                  }`}
                >
                  {edadMeses === null ? (
                    <>
                      <span className="stock-edit-edad-empty-title">
                        Sin fecha de nacimiento
                      </span>
                      <span className="stock-edit-edad-empty-hint">
                        Elegí mes y año para calcular
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="stock-edit-edad-num">{edadMeses}</span>
                      <span className="stock-edit-edad-unit">meses</span>
                    </>
                  )}
                </div>
              </div>

              <div className="stock-edit-field stock-edit-field--grupo">
                <label htmlFor="edit-equina-grupo">Generación</label>
                <SelectGrupoDispositivo
                  id="edit-equina-grupo"
                  anio={nacimientoAnio}
                  disabled={guardando || !apiOnline}
                />
              </div>

              <div className="stock-edit-field">
                <label htmlFor="edit-equina-grupo-libre">Grupo</label>
                <input
                  id="edit-equina-grupo-libre"
                  type="text"
                  className="stock-observaciones-input mayusculas-auto"
                  maxLength={48}
                  placeholder="Texto libre (letras y números)…"
                  value={grupoLibre}
                  disabled={guardando || !apiOnline}
                  onChange={(e) => setGrupoLibre(normalizarGrupoLibre(e.target.value))}
                />
              </div>

              <div className="stock-edit-field stock-edit-field--estado">
                <label htmlFor="edit-equina-estado">Estado</label>
                <SelectEstadoDispositivo
                  id="edit-equina-estado"
                  value={estado}
                  disabled={guardando || !apiOnline}
                  onChange={setEstado}
                />
              </div>
              </div>
            </div>

            <StockEquinaEvolucionTimeline
              nacimientoMes={nacimientoMes}
              nacimientoAnio={nacimientoAnio}
              edadMeses={edadMeses}
              sexo={sexo}
              estado={estado}
              bajaMes={bajaMes}
              bajaAnio={bajaAnio}
              editandoBaja
              bajaDisabled={guardando || !apiOnline}
              onBajaMesChange={setBajaMes}
              onBajaAnioChange={setBajaAnio}
            />

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
                disabled={guardando || !apiOnline}
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
