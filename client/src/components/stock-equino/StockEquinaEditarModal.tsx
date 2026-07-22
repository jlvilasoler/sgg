import { useCallback, useEffect, useMemo, useState } from "react";
import { saveStockEquinaDispositivo, type EmpresaOperativaStock, type StockDispositivoFotoMeta } from "../../api";
import { useHeaderBackStep } from "../../header-back";
import type {
  DispositivoEmpresa,
  DispositivoEstado,
  DispositivoSexo,
  StockEquinaDispositivo,
  AuthUser,
} from "../../types";
import SubseccionInlinePanel from "../SubseccionInlinePanel";
import StockEditarFichaLabel from "../stock/StockEditarFichaLabel";
import StockEditarFichaStats from "../stock/StockEditarFichaStats";
import StockEditarSectionTitle from "../stock/StockEditarSectionTitle";
import StockEditarHeadPanel from "../stock/StockEditarHeadPanel";
import SelectEmpresaDispositivo, {
  EMPRESA_PENDIENTE,
} from "../stock/SelectEmpresaDispositivo";
import SelectSexoDispositivo from "../stock/SelectSexoDispositivo";
import SelectPotreroDispositivo from "../stock/SelectPotreroDispositivo";
import SelectEstadoDispositivo from "../stock/SelectEstadoDispositivo";
import StockEquinaEvolucionTimeline from "./StockEquinaEvolucionTimeline";
import StockDispositivoFotoCard, {
  stockFotoMetaFromDispositivo,
} from "../stock/StockDispositivoFotoCard";
import StockEquinaHistorialCambiosPanel from "./StockEquinaHistorialCambiosPanel";
import StockControlSanitarioModal from "../stock/StockControlSanitarioModal";
import StockEquinoAruArbolModal from "./StockEquinoAruArbolModal";
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
import { normalizarPotrero } from "../stock/stock-ganadera-utils";

interface Props {
  dispositivo: StockEquinaDispositivo;
  empresas: EmpresaOperativaStock[];
  apiOnline: boolean;
  currentUser?: AuthUser | null;
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
  currentUser = null,
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
  const [potrero, setPotrero] = useState(dispositivo.potrero ?? "");
  const [rp, setRp] = useState(dispositivo.rp ?? "");
  const [nombreAnimal, setNombreAnimal] = useState(dispositivo.nombre_animal ?? "");
  const [registro, setRegistro] = useState(dispositivo.registro ?? "");
  const [premios, setPremios] = useState(dispositivo.premios ?? "");
  const [estado, setEstado] = useState<DispositivoEstado>(
    normalizarEstadoDispositivo(dispositivo.estado)
  );
  const [bajaMes, setBajaMes] = useState<number | null>(dispositivo.baja_mes);
  const [bajaAnio, setBajaAnio] = useState<number | null>(dispositivo.baja_anio);
  const [guardando, setGuardando] = useState(false);
  const [verHistorialCambios, setVerHistorialCambios] = useState(false);
  const [controlSanitarioOpen, setControlSanitarioOpen] = useState(false);
  const [aruArbolOpen, setAruArbolOpen] = useState(false);
  const [modoEdicion, setModoEdicion] = useState<"ver" | "editar">(modoInicial);
  const soloLectura = modoEdicion === "ver";
  const camposDeshabilitados = soloLectura || guardando || !apiOnline;
  const esAnimalCabana = Boolean(
    rp.trim() || nombreAnimal.trim() || registro.trim()
  );

  const restablecerDesdeDispositivo = useCallback((d: StockEquinaDispositivo) => {
    setEmpresa(d.empresa ?? "");
    setSexo(d.sexo ?? "");
    setNacimientoMes(d.nacimiento_mes);
    setNacimientoAnio(d.nacimiento_anio);
    setObservaciones(d.observaciones ?? "");
    setGrupoLibre(d.grupo_libre ?? "");
    setPotrero(d.potrero ?? "");
    setRp(d.rp ?? "");
    setNombreAnimal(d.nombre_animal ?? "");
    setRegistro(d.registro ?? "");
    setPremios(d.premios ?? "");
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
    () => buildGrupo(nacimientoMes, nacimientoAnio),
    [nacimientoMes, nacimientoAnio]
  );

  const animalIdDefault = useMemo(
    () => dispositivo.vid.trim() || dispositivo.clave || dispositivo.eid.trim(),
    [dispositivo.vid, dispositivo.clave, dispositivo.eid]
  );

  const animalCategoriaLoteDefault = useMemo(() => {
    const parts = [grupoActual, grupoLibre.trim()].filter(Boolean);
    return parts.join(" · ");
  }, [grupoActual, grupoLibre]);

  const hayCambios =
    empresa !== (dispositivo.empresa ?? "") ||
    grupoActual !== (dispositivo.grupo ?? "").trim().toUpperCase() ||
    normalizarGrupoLibre(grupoLibre) !== normalizarGrupoLibre(dispositivo.grupo_libre ?? "") ||
    normalizarPotrero(potrero) !== normalizarPotrero(dispositivo.potrero ?? "") ||
    sexo !== (dispositivo.sexo ?? "") ||
    nacimientoMes !== dispositivo.nacimiento_mes ||
    nacimientoAnio !== dispositivo.nacimiento_anio ||
    observaciones.trim() !== (dispositivo.observaciones ?? "").trim() ||
    rp.trim() !== (dispositivo.rp ?? "").trim() ||
    nombreAnimal.trim() !== (dispositivo.nombre_animal ?? "").trim() ||
    registro.trim() !== (dispositivo.registro ?? "").trim() ||
    premios.trim() !== (dispositivo.premios ?? "").trim() ||
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
          potrero: normalizarPotrero(potrero),
          nacimiento_mes: nacimientoMes,
          nacimiento_anio: nacimientoAnio,
          observaciones: observaciones.trim(),
          estado,
          baja_mes: requiereFechaBaja(estado) ? bajaMes : null,
          baja_anio: requiereFechaBaja(estado) ? bajaAnio : null,
          rp: rp.trim(),
          nombre_animal: nombreAnimal.trim(),
          registro: registro.trim(),
          premios: premios.trim(),
        },
        dispositivo.eid
      );

      const actualizado: StockEquinaDispositivo = {
        ...dispositivo,
        ...guardado,
        rp: guardado.rp ?? rp.trim(),
        nombre_animal: guardado.nombre_animal ?? nombreAnimal.trim(),
        registro: guardado.registro ?? registro.trim(),
        premios: guardado.premios ?? premios.trim(),
        origen_alta:
          (guardado.rp ?? rp).trim() || (guardado.nombre_animal ?? nombreAnimal).trim()
            ? dispositivo.origen_alta === "generico"
              ? "cabana"
              : dispositivo.origen_alta || "cabana"
            : dispositivo.origen_alta,
      };
      onSaved(actualizado);
      restablecerDesdeDispositivo(actualizado);
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
    <>
    <SubseccionInlinePanel
      onVolver={onVolver}
      volverLabel={volverLabel}
      icon={{ source: "hub", id: "stock_dispositivos" }}
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
          modoReg
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
              className={`stock-edit-ficha-card stock-editar-ficha stock-editar-ficha--equino${
                soloLectura ? " stock-edit-ficha-card--solo-lectura" : ""
              }`}
            >
              <StockEditarSectionTitle icon="ficha">Ficha del animal</StockEditarSectionTitle>

              <div className="stock-editar-ficha-toolbar stock-editar-ficha-toolbar--equino">
                <div className="stock-editar-ficha-zone stock-editar-ficha-zone--ident">
                  <div className="stock-editar-ficha-cell">
                    <StockEditarFichaLabel icon="empresa" htmlFor="edit-equina-empresa">
                      Empresa
                    </StockEditarFichaLabel>
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
                    <StockEditarFichaLabel icon="sexo" htmlFor="edit-equina-sexo">
                      Sexo
                    </StockEditarFichaLabel>
                    <SelectSexoDispositivo
                      id="edit-equina-sexo"
                      value={sexo}
                      disabled={camposDeshabilitados}
                      onChange={setSexo}
                    />
                  </div>
                </div>

                <div className="stock-editar-ficha-zone stock-editar-ficha-zone--potrero">
                  <div className="stock-editar-ficha-cell">
                    <StockEditarFichaLabel icon="potrero" htmlFor="edit-equina-potrero">
                      Potrero
                    </StockEditarFichaLabel>
                    <SelectPotreroDispositivo
                      id="edit-equina-potrero"
                      value={potrero}
                      onChange={setPotrero}
                      disabled={camposDeshabilitados}
                      apiOnline={apiOnline}
                      onError={onError}
                    />
                  </div>
                </div>

                <div className="stock-editar-ficha-zone stock-editar-ficha-zone--nac">
                  <div className="stock-editar-ficha-cell">
                    <StockEditarFichaLabel icon="nacimiento" htmlFor="edit-equina-nac-mes">
                      Nacimiento
                    </StockEditarFichaLabel>
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
                    <StockEditarFichaLabel icon="anio" htmlFor="edit-equina-nac-anio">
                      Año
                    </StockEditarFichaLabel>
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
                    <StockEditarFichaLabel icon="grupo" htmlFor="edit-equina-grupo-libre">
                      Grupo
                    </StockEditarFichaLabel>
                    <input
                      id="edit-equina-grupo-libre"
                      type="text"
                      className="stock-observaciones-input mayusculas-auto"
                      maxLength={48}
                      placeholder="Nombre de grupo"
                      value={grupoLibre}
                      readOnly={soloLectura}
                      disabled={!soloLectura && camposDeshabilitados}
                      onChange={(e) => setGrupoLibre(normalizarGrupoLibre(e.target.value))}
                    />
                  </div>
                </div>

                <div className="stock-editar-ficha-zone stock-editar-ficha-zone--estado">
                  <div className="stock-editar-ficha-cell">
                    <StockEditarFichaLabel icon="estado" htmlFor="edit-equina-estado">
                      Estado
                    </StockEditarFichaLabel>
                    <SelectEstadoDispositivo
                      id="edit-equina-estado"
                      value={estado}
                      disabled={camposDeshabilitados}
                      onChange={setEstado}
                    />
                  </div>
                  {esAnimalCabana ? (
                    <div className="stock-editar-ficha-cell stock-editar-ficha-cell--aru-arbol">
                      <span className="stock-editar-ficha-label-spacer" aria-hidden>
                        &nbsp;
                      </span>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm stock-editar-aru-arbol-btn"
                        disabled={!apiOnline || guardando}
                        title="Ver árbol genealógico en ARU"
                        onClick={() => setAruArbolOpen(true)}
                      >
                        Árbol genealógico
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="stock-editar-ficha-foot stock-editar-ficha-foot--equino">
                <StockEditarFichaStats
                  edadMeses={edadMeses}
                  edadId="edit-equina-edad"
                  grupoId="edit-equina-grupo"
                  estadoId="edit-equina-estado-stat"
                  nacimientoMes={nacimientoMes}
                  nacimientoAnio={nacimientoAnio}
                  estado={estado}
                  disabled={camposDeshabilitados}
                  onEstadoChange={setEstado}
                  ocultarEstado
                />

                <div
                  className={`stock-edit-cabana-premium-box stock-edit-cabana-premium-box--gold stock-editar-ficha-sel stock-editar-ficha-sel--equino${
                    soloLectura ? " stock-edit-cabana-premium-box--ro" : ""
                  }`}
                  aria-label="Datos de identificación"
                >
                  <div className="stock-edit-cabana-premium-fields">
                    <div className="stock-edit-cabana-inline-field stock-edit-cabana-inline-field--rp">
                      <StockEditarFichaLabel icon="grupo" htmlFor="edit-equina-rp" variant="cabana">
                        RP
                      </StockEditarFichaLabel>
                      <input
                        id="edit-equina-rp"
                        type="text"
                        className="stock-edit-cabana-input mayusculas-auto"
                        maxLength={64}
                        placeholder="Registro particular…"
                        value={rp}
                        readOnly={soloLectura}
                        disabled={!soloLectura && camposDeshabilitados}
                        onChange={(e) => setRp(e.target.value)}
                        autoComplete="off"
                      />
                    </div>
                    <div className="stock-edit-cabana-inline-field stock-edit-cabana-inline-field--nombre">
                      <StockEditarFichaLabel
                        icon="nombre"
                        htmlFor="edit-equina-nombre"
                        variant="cabana"
                      >
                        Nombre animal
                      </StockEditarFichaLabel>
                      <input
                        id="edit-equina-nombre"
                        type="text"
                        className="stock-edit-cabana-input mayusculas-auto"
                        maxLength={120}
                        placeholder="Nombre…"
                        value={nombreAnimal}
                        readOnly={soloLectura}
                        disabled={!soloLectura && camposDeshabilitados}
                        onChange={(e) => setNombreAnimal(e.target.value)}
                        autoComplete="off"
                      />
                    </div>
                    <div className="stock-edit-cabana-inline-field stock-edit-cabana-inline-field--registro">
                      <StockEditarFichaLabel
                        icon="raza"
                        htmlFor="edit-equina-registro"
                        variant="cabana"
                      >
                        Registro
                      </StockEditarFichaLabel>
                      <input
                        id="edit-equina-registro"
                        type="text"
                        className="stock-edit-cabana-input mayusculas-auto"
                        maxLength={120}
                        placeholder="Registro genealógico…"
                        value={registro}
                        readOnly={soloLectura}
                        disabled={!soloLectura && camposDeshabilitados}
                        onChange={(e) => setRegistro(e.target.value)}
                        autoComplete="off"
                      />
                    </div>
                    <div className="stock-edit-cabana-inline-field stock-edit-cabana-inline-field--obs">
                      <StockEditarFichaLabel
                        icon="observaciones"
                        htmlFor="edit-equina-premios"
                        variant="cabana"
                      >
                        Premios
                      </StockEditarFichaLabel>
                      <textarea
                        id="edit-equina-premios"
                        className="stock-edit-cabana-input stock-edit-cabana-textarea"
                        rows={1}
                        maxLength={2000}
                        placeholder="Premios que ganó…"
                        value={premios}
                        readOnly={soloLectura}
                        disabled={!soloLectura && camposDeshabilitados}
                        onChange={(e) => setPremios(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
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

            <div className="stock-edit-observaciones-row">
              <button
                type="button"
                className="btn btn-ghost stock-control-sanitario-trigger"
                onClick={() => setControlSanitarioOpen(true)}
                disabled={guardando}
                title="Registro de remedios y controles sanitarios"
              >
                Control Sanitario
              </button>
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
            </div>
        </section>
      </div>
    </SubseccionInlinePanel>
    <StockControlSanitarioModal
      open={controlSanitarioOpen}
      onClose={() => setControlSanitarioOpen(false)}
      modulo="equino"
      clave={dispositivo.clave}
      vid={dispositivo.vid}
      eid={dispositivo.eid}
      animalCategoriaLoteDefault={animalCategoriaLoteDefault}
      animalIdDefault={animalIdDefault}
      desdeDispositivo
      apiOnline={apiOnline}
      soloLectura={soloLectura}
      currentUser={currentUser}
      onError={onError}
    />
    <StockEquinoAruArbolModal
      open={aruArbolOpen}
      onClose={() => setAruArbolOpen(false)}
      registro={registro}
      rp={rp}
      nombre={nombreAnimal}
      sexo={sexo}
      onError={onError}
    />
    </>
  );
}

/** @deprecated Usar StockEquinaEditarPanel */
export { StockEquinaEditarPanel as StockEquinaEditarModal };
