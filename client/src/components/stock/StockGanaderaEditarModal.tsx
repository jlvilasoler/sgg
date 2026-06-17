import { useEffect, useMemo, useState } from "react";
import { saveStockGanaderaDispositivo } from "../../api";
import type {
  DispositivoEmpresa,
  DispositivoEstado,
  DispositivoSexo,
  StockGanaderaDispositivo,
} from "../../types";
import { fmtDate } from "../../utils";
import IconoDispositivoWifi from "./IconoDispositivoWifi";
import SelectEmpresaDispositivo from "./SelectEmpresaDispositivo";
import SelectEstadoDispositivo from "./SelectEstadoDispositivo";
import SelectGrupoDispositivo from "./SelectGrupoDispositivo";
import SelectSexoDispositivo from "./SelectSexoDispositivo";
import StockGanaderaEvolucionTimeline from "./StockGanaderaEvolucionTimeline";
import StockGanaderaHistorialCambiosModal from "./StockGanaderaHistorialCambiosModal";
import {
  buildGrupo,
  calcularEdadMeses,
  listAniosNacimiento,
  MESES_NACIMIENTO,
  normalizarEstadoDispositivo,
  normalizarGrupoLibre,
  requiereFechaBaja,
  resolverFechaBajaFormulario,
} from "./stock-ganadera-utils";

interface Props {
  dispositivo: StockGanaderaDispositivo;
  apiOnline: boolean;
  onClose: () => void;
  onSaved: (actualizado: StockGanaderaDispositivo) => void;
  onVerHistorial: () => void;
  onError: (msg: string) => void;
}

export default function StockGanaderaEditarModal({
  dispositivo,
  apiOnline,
  onClose,
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

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || guardando) return;
      if (verHistorialCambios) {
        setVerHistorialCambios(false);
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, guardando, verHistorialCambios]);

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
      onClose();
      return;
    }

    setGuardando(true);
    try {
      const guardado = await saveStockGanaderaDispositivo(
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
      onClose();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div
      className="stock-edit-overlay"
      role="presentation"
      onClick={() => !guardando && onClose()}
    >
      <div
        className="stock-ganadera-editar-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-ganadera-editar-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="stock-ganadera-editar-head">
          <div className="stock-ganadera-editar-head-main">
            <div className="stock-ganadera-editar-icon-wrap">
              <IconoDispositivoWifi className="stock-ganadera-editar-icon" />
            </div>
            <div className="stock-ganadera-editar-head-text">
              <p className="stock-ganadera-editar-kicker">Caravana electrónica</p>
              <h2 id="stock-ganadera-editar-titulo">Editar caravana</h2>
              <div className="stock-ganadera-editar-ids">
                <p className="stock-ganadera-editar-id-badge num">
                  EID {dispositivo.eid || "—"}
                </p>
                <p className="stock-ganadera-editar-id-badge stock-ganadera-editar-id-badge--vid num">
                  {dispositivo.vid || "—"}
                </p>
              </div>
              <p className="stock-ganadera-editar-eid-sub">
                <span className="stock-ganadera-editar-head-meta-item">
                  Últ. lectura{" "}
                  {fmtDate(dispositivo.ultima_fecha)}
                  {dispositivo.ultima_hora
                    ? ` ${dispositivo.ultima_hora}`
                    : ""}
                </span>
                <span className="stock-ganadera-editar-head-sep" aria-hidden>
                  ·
                </span>
                <span className="stock-ganadera-editar-head-meta-item">
                  Lecturas {dispositivo.total_lecturas}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            className="stock-ganadera-editar-close"
            onClick={onClose}
            disabled={guardando}
            aria-label="Cerrar"
          >
            ×
          </button>
        </header>

        <div className="stock-ganadera-editar-body">
          <section className="stock-ganadera-editar-panel" aria-label="Datos editables">
            <h3 className="stock-ganadera-editar-section-title">Ficha del animal</h3>

            <div className="stock-ganadera-editar-grid">
              <div className="stock-edit-row-4 stock-edit-field--full">
                <div className="stock-edit-field stock-edit-field--empresa">
                  <label htmlFor="modal-ganadera-empresa">Empresa</label>
                  <SelectEmpresaDispositivo
                    id="modal-ganadera-empresa"
                    value={empresa}
                    disabled={guardando || !apiOnline}
                    onChange={setEmpresa}
                  />
                </div>

                <div className="stock-edit-field stock-edit-field--sexo">
                  <label htmlFor="modal-ganadera-sexo">Sexo</label>
                  <SelectSexoDispositivo
                    id="modal-ganadera-sexo"
                    value={sexo}
                    disabled={guardando || !apiOnline}
                    onChange={setSexo}
                  />
                </div>

                <div className="stock-edit-field stock-edit-field--nacimiento">
                  <label htmlFor="modal-ganadera-nac-mes">
                    Fecha de nacimiento
                    <span className="stock-edit-label-hint">mes</span>
                  </label>
                  <select
                    id="modal-ganadera-nac-mes"
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
                  <label htmlFor="modal-ganadera-nac-anio">Año</label>
                  <select
                    id="modal-ganadera-nac-anio"
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
                <label htmlFor="modal-ganadera-edad">Edad calculada</label>
                <div
                  id="modal-ganadera-edad"
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
                <label htmlFor="modal-ganadera-grupo">Generación</label>
                <SelectGrupoDispositivo
                  id="modal-ganadera-grupo"
                  anio={nacimientoAnio}
                  disabled={guardando || !apiOnline}
                />
              </div>

              <div className="stock-edit-field">
                <label htmlFor="modal-ganadera-grupo-libre">Grupo</label>
                <input
                  id="modal-ganadera-grupo-libre"
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
                <label htmlFor="modal-ganadera-estado">Estado</label>
                <SelectEstadoDispositivo
                  id="modal-ganadera-estado"
                  value={estado}
                  disabled={guardando || !apiOnline}
                  onChange={setEstado}
                />
              </div>
              </div>
            </div>

            <StockGanaderaEvolucionTimeline
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
              <label htmlFor="modal-ganadera-obs">
                Observaciones
                <span className="stock-edit-label-hint">opcional</span>
              </label>
              <input
                id="modal-ganadera-obs"
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

        <footer className="stock-ganadera-editar-footer">
          <div className="stock-ganadera-editar-footer-links">
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
          <div className="stock-ganadera-editar-footer-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
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
        </footer>
      </div>

      {verHistorialCambios && (
        <StockGanaderaHistorialCambiosModal
          clave={dispositivo.clave}
          vid={dispositivo.vid}
          eid={dispositivo.eid}
          apiOnline={apiOnline}
          onClose={() => setVerHistorialCambios(false)}
          onError={onError}
        />
      )}
    </div>
  );
}
