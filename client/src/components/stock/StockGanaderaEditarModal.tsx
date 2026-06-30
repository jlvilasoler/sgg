import { useCallback, useEffect, useMemo, useState } from "react";
import { saveCabanaSeleccion, saveStockGanaderaDispositivo, type EmpresaOperativaStock, type StockDispositivoFotoMeta } from "../../api";
import { useHeaderBackStep } from "../../header-back";
import type {
  AuthUser,
  DispositivoEmpresa,
  DispositivoEstado,
  DispositivoSexo,
  StockGanaderaDispositivo,
} from "../../types";
import IconoSeleccionCocarda from "./IconoSeleccionCocarda";
import SubseccionInlinePanel from "../SubseccionInlinePanel";
import StockEditarFichaStats from "./StockEditarFichaStats";
import StockEditarSectionTitle from "./StockEditarSectionTitle";
import StockEditarHeadPanel from "./StockEditarHeadPanel";
import SelectEmpresaDispositivo, {
  EMPRESA_PENDIENTE,
} from "./SelectEmpresaDispositivo";
import SelectRazaDispositivo from "./SelectRazaDispositivo";
import SelectSexoDispositivo from "./SelectSexoDispositivo";
import StockGanaderaEvolucionTimeline from "./StockGanaderaEvolucionTimeline";
import StockDispositivoFotoCard, {
  stockFotoMetaFromDispositivo,
} from "./StockDispositivoFotoCard";
import StockGanaderaHistorialCambiosPanel from "./StockGanaderaHistorialCambiosPanel";
import {
  buildGrupo,
  calcularEdadMeses,
  listAniosNacimiento,
  MESES_NACIMIENTO,
  normalizarEstadoDispositivo,
  normalizarGrupoLibre,
  normalizarRaza,
  fmtRaza,
  requiereFechaBaja,
  resolverFechaBajaFormulario,
} from "./stock-ganadera-utils";

interface Props {
  dispositivo: StockGanaderaDispositivo;
  empresas: EmpresaOperativaStock[];
  apiOnline: boolean;
  currentUser?: AuthUser | null;
  onVolver: () => void;
  volverLabel?: string;
  onSaved: (actualizado: StockGanaderaDispositivo) => void;
  onFotoMetaChange?: (meta: StockDispositivoFotoMeta) => void;
  onVerHistorial: () => void;
  onError: (msg: string) => void;
  onSuccess?: (msg: string, title?: string) => void;
  /** Al abrir desde VID: solo lectura hasta pulsar Editar. */
  modoInicial?: "ver" | "editar";
}

export default function StockGanaderaEditarPanel({
  dispositivo,
  empresas,
  apiOnline,
  currentUser,
  onVolver,
  volverLabel = "Volver a Stock Ganadero",
  onSaved,
  onFotoMetaChange,
  onVerHistorial,
  onError,
  onSuccess,
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
  const [raza, setRaza] = useState(dispositivo.raza ?? "");
  const [nombreCabana, setNombreCabana] = useState(dispositivo.nombre_cabana ?? "");
  const esCabanaPremium = Boolean(dispositivo.cabana_premium);
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

  const restablecerDesdeDispositivo = useCallback((d: StockGanaderaDispositivo) => {
    setEmpresa(d.empresa ?? "");
    setSexo(d.sexo ?? "");
    setNacimientoMes(d.nacimiento_mes);
    setNacimientoAnio(d.nacimiento_anio);
    setObservaciones(d.observaciones ?? "");
    setGrupoLibre(d.grupo_libre ?? "");
    setRaza(d.raza ?? "");
    setNombreCabana(d.nombre_cabana ?? "");
    setEstado(normalizarEstadoDispositivo(d.estado));
    setBajaMes(d.baja_mes);
    setBajaAnio(d.baja_anio);
  }, []);

  useEffect(() => {
    setModoEdicion(modoInicial);
    restablecerDesdeDispositivo(dispositivo);
    // Solo al cambiar de dispositivo; no resetear por sync de foto u otros metadatos.
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
    volverLabel.replace(/^Volver a /i, "").trim() || "Stock Ganadero";
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
    normalizarRaza(raza) !== normalizarRaza(dispositivo.raza ?? "") ||
    sexo !== (dispositivo.sexo ?? "") ||
    nacimientoMes !== dispositivo.nacimiento_mes ||
    nacimientoAnio !== dispositivo.nacimiento_anio ||
    observaciones.trim() !== (dispositivo.observaciones ?? "").trim() ||
    estado !== normalizarEstadoDispositivo(dispositivo.estado) ||
    bajaMes !== dispositivo.baja_mes ||
    bajaAnio !== dispositivo.baja_anio ||
    (esCabanaPremium &&
      nombreCabana.trim() !== (dispositivo.nombre_cabana ?? "").trim());

  const hayCambiosCabana =
    esCabanaPremium &&
    (nombreCabana.trim() !== (dispositivo.nombre_cabana ?? "").trim() ||
      normalizarRaza(raza) !== normalizarRaza(dispositivo.raza ?? "") ||
      observaciones.trim() !== (dispositivo.observaciones ?? "").trim());

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
      if (esCabanaPremium && !nombreCabana.trim()) {
        onError("Ingresá el nombre del animal de cabaña");
        return;
      }

      let guardado = dispositivo;
      const cambiosFicha =
        empresa !== (dispositivo.empresa ?? "") ||
        grupoActual !== (dispositivo.grupo ?? "").trim().toUpperCase() ||
        normalizarGrupoLibre(grupoLibre) !== normalizarGrupoLibre(dispositivo.grupo_libre ?? "") ||
        normalizarRaza(raza) !== normalizarRaza(dispositivo.raza ?? "") ||
        sexo !== (dispositivo.sexo ?? "") ||
        nacimientoMes !== dispositivo.nacimiento_mes ||
        nacimientoAnio !== dispositivo.nacimiento_anio ||
        observaciones.trim() !== (dispositivo.observaciones ?? "").trim() ||
        estado !== normalizarEstadoDispositivo(dispositivo.estado) ||
        bajaMes !== dispositivo.baja_mes ||
        bajaAnio !== dispositivo.baja_anio;

      if (cambiosFicha) {
        const data = await saveStockGanaderaDispositivo(
          dispositivo.clave,
          {
            sexo,
            empresa,
            grupo: grupoActual,
            grupo_libre: normalizarGrupoLibre(grupoLibre),
            raza: normalizarRaza(raza),
            nacimiento_mes: nacimientoMes,
            nacimiento_anio: nacimientoAnio,
            observaciones: observaciones.trim(),
            estado,
            baja_mes: requiereFechaBaja(estado) ? bajaMes : null,
            baja_anio: requiereFechaBaja(estado) ? bajaAnio : null,
          },
          dispositivo.eid
        );
        guardado = { ...dispositivo, ...data };
      }

      if (hayCambiosCabana) {
        await saveCabanaSeleccion([
          {
            clave: dispositivo.clave,
            nombre_cabana: nombreCabana.trim(),
            raza: normalizarRaza(raza),
            observaciones: observaciones.trim(),
          },
        ]);
        guardado = {
          ...guardado,
          cabana_premium: true,
          nombre_cabana: nombreCabana.trim(),
          raza: normalizarRaza(raza),
          observaciones: observaciones.trim(),
        };
      }

      onSaved(guardado);
      restablecerDesdeDispositivo(guardado);
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
      <StockGanaderaHistorialCambiosPanel
        clave={dispositivo.clave}
        vid={dispositivo.vid}
        eid={dispositivo.eid}
        apiOnline={apiOnline}
        onVolver={() => setVerHistorialCambios(false)}
        volverLabel={
          soloLectura ? "Volver al dispositivo" : "Volver a editar dispositivo"
        }
        onError={onError}
      />
    );
  }

  return (
    <SubseccionInlinePanel
      onVolver={onVolver}
      volverLabel={volverLabel}
      title={soloLectura ? "Dispositivo" : "Editar dispositivo"}
      cardClassName={`subseccion-inline-card stock-ganadera-editar-page${
        soloLectura ? " stock-ganadera-editar-page--solo-lectura" : ""
      }`}
      headAside={
        <StockEditarHeadPanel
          eid={dispositivo.eid}
          vid={dispositivo.vid}
          totalLecturas={dispositivo.total_lecturas}
          ultimaFecha={dispositivo.ultima_fecha}
          ultimaHora={dispositivo.ultima_hora}
          esCabanaPremium={esCabanaPremium}
          nombreCabana={nombreCabana}
          iconClassName="stock-ganadera-editar-icon stock-editar-head-signal"
        />
      }
      footer={
        <div className="stock-ganadera-editar-page-foot">
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
      <div className="stock-ganadera-editar-page-body">
        <section
          className="stock-ganadera-editar-panel"
          aria-label={soloLectura ? "Ficha del dispositivo" : "Datos editables"}
        >
            <div
              className={`stock-edit-ficha-card stock-editar-ficha${
                soloLectura ? " stock-edit-ficha-card--solo-lectura" : ""
              }`}
            >
              <StockEditarSectionTitle icon="ficha">Ficha del animal</StockEditarSectionTitle>

              <div className="stock-editar-ficha-toolbar">
                <div className="stock-editar-ficha-zone stock-editar-ficha-zone--ident">
                  <div className="stock-editar-ficha-cell">
                    <label className="stock-editar-ficha-label" htmlFor="edit-ganadera-empresa">
                      Empresa
                    </label>
                    <SelectEmpresaDispositivo
                      id="edit-ganadera-empresa"
                      empresas={empresas}
                      value={empresa}
                      disabled={camposDeshabilitados}
                      onChange={(e) =>
                        setEmpresa(e === EMPRESA_PENDIENTE ? "" : (e as DispositivoEmpresa))
                      }
                    />
                  </div>
                  <div className="stock-editar-ficha-cell">
                    <label className="stock-editar-ficha-label" htmlFor="edit-ganadera-raza">
                      Raza
                    </label>
                    <SelectRazaDispositivo
                      id="edit-ganadera-raza"
                      value={raza}
                      disabled={camposDeshabilitados}
                      apiOnline={apiOnline}
                      onError={onError}
                      onSuccess={onSuccess}
                      puedeEliminarRaza={!soloLectura && Boolean(currentUser?.es_super_admin)}
                      onChange={setRaza}
                    />
                  </div>
                </div>

                <div className="stock-editar-ficha-zone stock-editar-ficha-zone--sexo">
                  <div className="stock-editar-ficha-cell">
                    <label className="stock-editar-ficha-label" htmlFor="edit-ganadera-sexo">
                      Sexo
                    </label>
                    <SelectSexoDispositivo
                      id="edit-ganadera-sexo"
                      value={sexo}
                      disabled={camposDeshabilitados}
                      onChange={setSexo}
                    />
                  </div>
                </div>

                <div className="stock-editar-ficha-zone stock-editar-ficha-zone--nac">
                  <div className="stock-editar-ficha-cell">
                    <label className="stock-editar-ficha-label" htmlFor="edit-ganadera-nac-mes">
                      Nacimiento
                    </label>
                    <select
                      id="edit-ganadera-nac-mes"
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
                    <label className="stock-editar-ficha-label" htmlFor="edit-ganadera-nac-anio">
                      Año
                    </label>
                    <select
                      id="edit-ganadera-nac-anio"
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
                    <label className="stock-editar-ficha-label" htmlFor="edit-ganadera-grupo-libre">
                      Grupo
                    </label>
                    <input
                      id="edit-ganadera-grupo-libre"
                      type="text"
                      className="stock-observaciones-input mayusculas-auto"
                      maxLength={48}
                      placeholder="INGRESA GRUPO"
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
                  edadId="edit-ganadera-edad"
                  grupoId="edit-ganadera-grupo"
                  estadoId="edit-ganadera-estado"
                  nacimientoAnio={nacimientoAnio}
                  estado={estado}
                  disabled={camposDeshabilitados}
                  onEstadoChange={setEstado}
                />

                {esCabanaPremium ? (
                  <div
                    className="stock-edit-cabana-premium-box stock-edit-cabana-premium-box--gold stock-editar-ficha-sel"
                    aria-label="Datos de selección"
                  >
                    <span className="stock-edit-cabana-premium-tag">
                      <IconoSeleccionCocarda />
                      SELECCIÓN
                    </span>
                    <div className="stock-edit-cabana-premium-fields">
                      <label className="stock-edit-cabana-inline-field stock-edit-cabana-inline-field--nombre">
                        <span className="stock-edit-cabana-inline-label">Nombre</span>
                        <input
                          id="edit-ganadera-cabana-nombre"
                          type="text"
                          className="stock-edit-cabana-input mayusculas-auto"
                          maxLength={64}
                          placeholder="Selección, puro por cruza…"
                          value={nombreCabana}
                          readOnly={soloLectura}
                          disabled={!soloLectura && camposDeshabilitados}
                          onChange={(e) => setNombreCabana(e.target.value)}
                        />
                      </label>
                      <span
                        className="stock-edit-cabana-inline-field stock-edit-cabana-inline-field--ro"
                        title="Editá en el selector Raza de la ficha"
                      >
                        <span className="stock-edit-cabana-inline-label">Raza</span>
                        <span className="stock-edit-cabana-inline-val">{fmtRaza(raza)}</span>
                      </span>
                      <span
                        className="stock-edit-cabana-inline-field stock-edit-cabana-inline-field--ro"
                        title="Editá en Observaciones al final del formulario"
                      >
                        <span className="stock-edit-cabana-inline-label">Obs.</span>
                        <span className="stock-edit-cabana-inline-val stock-edit-cabana-inline-val--obs">
                          {observaciones.trim() || "—"}
                        </span>
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="stock-edit-evolucion-row">
              <StockDispositivoFotoCard
                modulo="ganadero"
                clave={dispositivo.clave}
                initialMeta={stockFotoMetaFromDispositivo(dispositivo)}
                soloLectura={soloLectura}
                disabled={!soloLectura && (guardando || !apiOnline)}
                onChange={(meta) => {
                  onFotoMetaChange?.(meta);
                }}
                onError={onError}
              />
              <StockGanaderaEvolucionTimeline
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
              <label htmlFor="edit-ganadera-obs">
                Observaciones
                <span className="stock-edit-label-hint">opcional</span>
              </label>
              <input
                id="edit-ganadera-obs"
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

/** @deprecated Usar StockGanaderaEditarPanel */
export { StockGanaderaEditarPanel as StockGanaderaEditarModal };
