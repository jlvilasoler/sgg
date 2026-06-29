import { useMemo } from "react";
import type { DispositivoEstado, DispositivoSexo } from "../../types";
import IconoAnimalEvolucion from "./IconoAnimalEvolucion";
import {
  calcularMesesEntreFechas,
  ETAPAS_EVOLUCION_HEMBRA,
  ETAPAS_EVOLUCION_MACHO,
  ESCALA_MARCAS_HEMBRA,
  ESCALA_MARCAS_MACHO,
  ESCALA_MARCAS_ANIOS_HEMBRA,
  ESCALA_MARCAS_ANIOS_MACHO,
  etapaHembraDesdeMeses,
  etapaMachoDesdeMeses,
  etiquetaFechaBaja,
  fmtEdadAniosDesdeMeses,
  fmtNacimiento,
  HEMBRA_ESCALA_MAX_MESES,
  listAniosNacimiento,
  MACHO_ESCALA_MAX_MESES,
  MESES_NACIMIENTO,
  mesesReferenciaTimeline,
  pctEscalaMeses,
  pctHembraVisual,
  pctMachoVisual,
  requiereFechaBaja,
  type EscalaMarcaMeses,
} from "./stock-equina-utils";

const MAX_MESES_GENERAL = 120;
const MARCAS_GENERAL = [24, 48, 72, 96, 120] as const;

interface Props {
  nacimientoMes: number | null;
  nacimientoAnio: number | null;
  edadMeses: number | null;
  sexo?: DispositivoSexo;
  estado?: DispositivoEstado;
  bajaMes?: number | null;
  bajaAnio?: number | null;
  onBajaMesChange?: (mes: number | null) => void;
  onBajaAnioChange?: (anio: number | null) => void;
  editandoBaja?: boolean;
  bajaDisabled?: boolean;
}

interface FechasEvolucionProps {
  nacimientoMes: number | null;
  nacimientoAnio: number | null;
  nacimientoLabel: string;
  estado?: DispositivoEstado;
  bajaMes?: number | null;
  bajaAnio?: number | null;
  onBajaMesChange?: (mes: number | null) => void;
  onBajaAnioChange?: (anio: number | null) => void;
  editandoBaja?: boolean;
  bajaDisabled?: boolean;
}

function FechasEvolucion({
  nacimientoMes,
  nacimientoAnio,
  nacimientoLabel,
  estado = "VIVO",
  bajaMes = null,
  bajaAnio = null,
  onBajaMesChange,
  onBajaAnioChange,
  editandoBaja = false,
  bajaDisabled = false,
}: FechasEvolucionProps) {
  const muestraBaja = requiereFechaBaja(estado);
  const etiquetaBaja = etiquetaFechaBaja(estado);
  const mesBajaVida = useMemo(
    () => calcularMesesEntreFechas(nacimientoMes, nacimientoAnio, bajaMes, bajaAnio),
    [nacimientoMes, nacimientoAnio, bajaMes, bajaAnio]
  );
  const bajaLabel = fmtNacimiento(bajaMes, bajaAnio);
  const aniosBaja = useMemo(() => listAniosNacimiento(), []);

  return (
    <div className="stock-evolucion-fechas">
      <div className="stock-evolucion-fechas-izq">
        <p className="stock-evolucion-nacimiento">
          Nacimiento: <strong>{nacimientoLabel}</strong>
          <span className="stock-evolucion-nacimiento-sub"> · mes 0</span>
        </p>
      </div>

      {muestraBaja && (
        <div className="stock-evolucion-fechas-der">
          {editandoBaja && onBajaMesChange && onBajaAnioChange ? (
            <div className="stock-evolucion-baja-edit">
              <span className="stock-evolucion-baja-label">{etiquetaBaja}:</span>
              <select
                className="stock-evolucion-baja-select"
                value={bajaMes ?? ""}
                disabled={bajaDisabled}
                aria-label={`Mes de ${etiquetaBaja.toLowerCase()}`}
                onChange={(e) =>
                  onBajaMesChange(e.target.value ? Number(e.target.value) : null)
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
                className="stock-evolucion-baja-select stock-evolucion-baja-select--anio"
                value={bajaAnio ?? ""}
                disabled={bajaDisabled}
                aria-label={`Año de ${etiquetaBaja.toLowerCase()}`}
                onChange={(e) =>
                  onBajaAnioChange(e.target.value ? Number(e.target.value) : null)
                }
              >
                <option value="">Año</option>
                {aniosBaja.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="stock-evolucion-nacimiento stock-evolucion-baja-texto">
              {etiquetaBaja}:{" "}
              <strong>{bajaMes && bajaAnio ? bajaLabel : "—"}</strong>
              {mesBajaVida !== null && (
                <span className="stock-evolucion-nacimiento-sub">
                  {" "}
                  · mes {mesBajaVida}
                </span>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function claseSexo(sexo?: DispositivoSexo): string {
  if (sexo === "MACHO") return "stock-evolucion--macho";
  if (sexo === "HEMBRA") return "stock-evolucion--hembra";
  return "stock-evolucion--sin-sexo";
}

function claseEstado(estado?: DispositivoEstado): string {
  if (estado === "MUERTO") return "stock-evolucion--muerto";
  if (estado === "VENDIDO") return "stock-evolucion--vendido";
  if (estado === "FRIGORIFICO") return "stock-evolucion--frigorifico";
  return "";
}

function AnimalMarcador({
  posicionPct,
  pref,
  sexo,
}: {
  posicionPct: number;
  pref: string;
  sexo: DispositivoSexo;
}) {
  const inicio = posicionPct < 4;
  return (
    <div
      className={`${pref}-vaca${inicio ? ` ${pref}-vaca--inicio` : ""}`}
      style={{ left: `${posicionPct}%` }}
      aria-hidden
    >
      <IconoAnimalEvolucion sexo={sexo} className={`${pref}-vaca-img`} />
    </div>
  );
}

interface ChartMachoProps {
  edadMeses: number;
  mesesPin: number;
  estado: DispositivoEstado;
  etapaActivaId: string;
}

interface ChartEtapasProps {
  edadMeses: number;
  mesesPin: number;
  estado: DispositivoEstado;
  etapaActivaId: string;
  etapas: ReadonlyArray<{ id: string; titulo: string; rango: string }>;
  etapa: { id: string; titulo: string; rango: string };
  posicionPct: number;
  escalaMax: number;
  claseBase: "macho" | "hembra";
  escalaMarcas: readonly EscalaMarcaMeses[];
  escalaMarcasAnios: readonly EscalaMarcaMeses[];
}

function claseEscalaMarca(align: EscalaMarcaMeses["align"]): string {
  if (align === "left") return "stock-evo-escala-marca--left";
  if (align === "right") return "stock-evo-escala-marca--right";
  return "stock-evo-escala-marca--center";
}

function FilaEscalaMarcas({
  marcas,
  className,
  variant,
}: {
  marcas: readonly EscalaMarcaMeses[];
  className: string;
  variant: "anios" | "meses";
}) {
  return (
    <div className={className} aria-hidden>
      {marcas.map((marca) => (
        <span
          key={`${variant}-${marca.label}-${marca.pct}`}
          className={`stock-evo-escala-marca stock-evo-escala-marca--${variant} ${claseEscalaMarca(marca.align)}`}
          style={{ left: `${marca.pct}%` }}
        >
          {marca.label}
        </span>
      ))}
    </div>
  );
}

function ChartEtapas({
  edadMeses,
  mesesPin,
  estado,
  etapaActivaId,
  etapas,
  etapa,
  posicionPct,
  escalaMax,
  claseBase,
  escalaMarcas,
  escalaMarcasAnios,
}: ChartEtapasProps) {
  const pref = `stock-evo-${claseBase}`;
  const superaMax = mesesPin > escalaMax;
  const enBaja = requiereFechaBaja(estado);
  const etiquetaBaja = etiquetaFechaBaja(estado);

  return (
    <div className={pref}>
      <div className={`${pref}-resumen`}>
        <div className={`${pref}-edad`}>
          <strong>{mesesPin}</strong>
          <span>meses</span>
          <span className={`${pref}-edad-sep`}>·</span>
          <strong>{fmtEdadAniosDesdeMeses(mesesPin)}</strong>
          <span>años</span>
          {enBaja && edadMeses !== mesesPin && (
            <span className={`${pref}-edad-baja-ref`}>
              · edad actual {edadMeses} m
            </span>
          )}
        </div>
        <div
          className={`${pref}-cat ${pref}-cat--${etapa.id.toLowerCase()}`}
        >
          {etapa.titulo}
          <span>{etapa.rango}</span>
        </div>
      </div>

      <div className={`${pref}-board`}>
        {etapas.map((e, idx) => {
          const activa = e.id === etapaActivaId;
          return (
            <div
              key={e.id}
              className={`${pref}-col ${pref}-col--${e.id.toLowerCase()}${
                activa ? ` ${pref}-col--activa` : ""
              }`}
            >
              <div className={`${pref}-card`}>
                <span className={`${pref}-card-n`}>{idx + 1}</span>
                <span className={`${pref}-card-titulo`}>{e.titulo}</span>
                <span className={`${pref}-card-rango`}>{e.rango}</span>
                {activa && (
                  <span className={`${pref}-card-ahora`}>
                    {enBaja ? etiquetaBaja : "Ahora"}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        <div className={`${pref}-track-wrap`}>
          <div className={`${pref}-track`} role="img" aria-hidden>
            {etapas.length === 4 && (
              <span className={`${pref}-track-div ${pref}-track-div--75`} />
            )}
            <div
              className={`${pref}-track-fill`}
              style={{ width: `${posicionPct}%` }}
            />
            <div
              className={`${pref}-pin${
                posicionPct < 4 ? ` ${pref}-pin--inicio` : ""
              }`}
              style={{ left: `${posicionPct}%` }}
              title={
                enBaja
                  ? `${etiquetaBaja}: ${mesesPin} meses`
                  : `${mesesPin} meses`
              }
            >
              <span className={`${pref}-pin-dot`} />
              <span className={`${pref}-pin-label`}>{mesesPin} m</span>
            </div>
          </div>
          <div className={`${pref}-campo`}>
            <span className={`${pref}-pasto`} aria-hidden />
            <span className={`${pref}-suelo`} aria-hidden />
            <AnimalMarcador
              posicionPct={posicionPct}
              pref={pref}
              sexo={claseBase === "macho" ? "MACHO" : "HEMBRA"}
            />
          </div>
        </div>

        <div className={`${pref}-escala-wrap`}>
          <div className={`${pref}-track-escala`}>
            <div
              className={`${pref}-track ${pref}-track--escala`}
              role="img"
              aria-hidden
            >
              {etapas.length === 4 && (
                <span className={`${pref}-track-div ${pref}-track-div--75`} />
              )}
              <div
                className={`${pref}-track-fill`}
                style={{ width: `${posicionPct}%` }}
              />
            </div>
          </div>

          <div className={`${pref}-escala-leyenda`}>
            <FilaEscalaMarcas
              marcas={escalaMarcasAnios}
              className={`${pref}-escala-anios`}
              variant="anios"
            />

            <FilaEscalaMarcas
              marcas={escalaMarcas}
              className={`${pref}-escala`}
              variant="meses"
            />
          </div>
        </div>
      </div>

      {superaMax && (
        <p className="stock-evolucion-nota">
          Supera los {escalaMax} meses de referencia ({mesesPin} meses).
        </p>
      )}
    </div>
  );
}

function ChartMacho({ edadMeses, mesesPin, estado, etapaActivaId }: ChartMachoProps) {
  const etapa = etapaMachoDesdeMeses(mesesPin);
  return (
    <ChartEtapas
      edadMeses={edadMeses}
      mesesPin={mesesPin}
      estado={estado}
      etapaActivaId={etapaActivaId}
      etapas={ETAPAS_EVOLUCION_MACHO}
      etapa={etapa}
      posicionPct={pctMachoVisual(mesesPin)}
      escalaMax={MACHO_ESCALA_MAX_MESES}
      claseBase="macho"
      escalaMarcas={ESCALA_MARCAS_MACHO}
      escalaMarcasAnios={ESCALA_MARCAS_ANIOS_MACHO}
    />
  );
}

interface ChartHembraProps {
  edadMeses: number;
  mesesPin: number;
  estado: DispositivoEstado;
  etapaActivaId: string;
}

function ChartHembra({ edadMeses, mesesPin, estado, etapaActivaId }: ChartHembraProps) {
  const etapa = etapaHembraDesdeMeses(mesesPin);
  return (
    <ChartEtapas
      edadMeses={edadMeses}
      mesesPin={mesesPin}
      estado={estado}
      etapaActivaId={etapaActivaId}
      etapas={ETAPAS_EVOLUCION_HEMBRA}
      etapa={etapa}
      posicionPct={pctHembraVisual(mesesPin)}
      escalaMax={HEMBRA_ESCALA_MAX_MESES}
      claseBase="hembra"
      escalaMarcas={ESCALA_MARCAS_HEMBRA}
      escalaMarcasAnios={ESCALA_MARCAS_ANIOS_HEMBRA}
    />
  );
}

function ChartGeneral({
  edadMeses: _edadMeses,
  mesesPin,
  estado,
  posicionPct,
}: {
  edadMeses: number;
  mesesPin: number;
  estado: DispositivoEstado;
  posicionPct: number;
}) {
  const superaMax = mesesPin > MAX_MESES_GENERAL;
  const enBaja = requiereFechaBaja(estado);
  const etiquetaBaja = etiquetaFechaBaja(estado);

  return (
    <div className="stock-evolucion-pro stock-evolucion-pro--general">
      <div className="stock-evolucion-pro-lane">
        <div className="stock-evolucion-pro-track-wrap">
          <div
            className="stock-evolucion-pro-track stock-evolucion-pro-track--general"
            role="img"
            aria-hidden
          >
            <div
              className="stock-evolucion-pro-trail stock-evolucion-pro-trail--general"
              style={{ width: `${posicionPct}%` }}
            />
            {MARCAS_GENERAL.map((m) => (
              <div
                key={m}
                className="stock-evolucion-pro-tick"
                style={{ left: `${pctEscalaMeses(m, MAX_MESES_GENERAL)}%` }}
              >
                <span className="stock-evolucion-pro-tick-line" />
                <span className="stock-evolucion-pro-tick-num">{m}</span>
              </div>
            ))}
            <div
              className={`stock-evolucion-pointer stock-evolucion-pointer--general${
                posicionPct < 4 ? " stock-evolucion-pointer--inicio" : ""
              }`}
              style={{ left: `${posicionPct}%` }}
              title={
                enBaja
                  ? `${etiquetaBaja}: ${mesesPin} meses`
                  : `${mesesPin} meses`
              }
            >
              <span className="stock-evolucion-pointer-dot" />
              <span className="stock-evolucion-pointer-tag">
                {mesesPin}
                <small>m</small>
              </span>
            </div>
          </div>
        </div>
        <div
          className="stock-evolucion-pro-marks stock-evolucion-pro-marks--general"
          aria-hidden
        >
          <span style={{ left: "0%" }}>Nacimiento</span>
          <span style={{ left: "100%" }}>{MAX_MESES_GENERAL} meses</span>
        </div>
      </div>
      {superaMax && (
        <p className="stock-evolucion-nota">
          El animal supera los {MAX_MESES_GENERAL} meses de la escala ({mesesPin}{" "}
          meses).
        </p>
      )}
    </div>
  );
}

export default function StockEquinaEvolucionTimeline({
  nacimientoMes,
  nacimientoAnio,
  edadMeses,
  sexo,
  estado = "VIVO",
  bajaMes = null,
  bajaAnio = null,
  onBajaMesChange,
  onBajaAnioChange,
  editandoBaja = false,
  bajaDisabled = false,
}: Props) {
  const esMacho = sexo === "MACHO";
  const esHembra = sexo === "HEMBRA";
  const conEtapas = esMacho || esHembra;
  const sinFecha = !nacimientoMes || !nacimientoAnio || edadMeses === null;

  const nacimientoLabel = fmtNacimiento(nacimientoMes, nacimientoAnio);
  const mesesPin = useMemo(
    () =>
      mesesReferenciaTimeline(
        estado,
        edadMeses,
        nacimientoMes,
        nacimientoAnio,
        bajaMes,
        bajaAnio
      ),
    [estado, edadMeses, nacimientoMes, nacimientoAnio, bajaMes, bajaAnio]
  );
  const posicionGeneral = useMemo(
    () =>
      mesesPin === null ? 0 : pctEscalaMeses(mesesPin, MAX_MESES_GENERAL),
    [mesesPin]
  );

  if (sinFecha) {
    return (
      <section
        className={`stock-evolucion ${claseSexo(sexo)} ${claseEstado(estado)}`}
        aria-label="Línea de tiempo de evolución"
      >
        <div className="stock-evolucion-head">
          <div className="stock-evolucion-head-main">
            <h4 className="stock-evolucion-title">Evolución del animal</h4>
            <FechasEvolucion
              nacimientoMes={nacimientoMes}
              nacimientoAnio={nacimientoAnio}
              nacimientoLabel={nacimientoLabel}
              estado={estado}
              bajaMes={bajaMes}
              bajaAnio={bajaAnio}
              onBajaMesChange={onBajaMesChange}
              onBajaAnioChange={onBajaAnioChange}
              editandoBaja={editandoBaja}
              bajaDisabled={bajaDisabled}
            />
          </div>
          <span className="stock-evolucion-rango">
            {esMacho
              ? "Ternero · Novillo/Toro · +2 años"
              : esHembra
                ? "Ternera · Vaquillona · +2 años · Vaca"
                : `0 – ${MAX_MESES_GENERAL} meses`}
          </span>
        </div>
        <div className="stock-evolucion-empty">
          {esMacho ? (
            <>
              Completá la fecha de nacimiento para ver la evolución por etapas:
              Ternero (0–12 meses), Novillo/Toro (1–2 años) y Novillo/Toro (+2
              años).
            </>
          ) : esHembra ? (
            <>
              Completá la fecha de nacimiento para ver la evolución por etapas:
              Ternera (0–12 meses), Vaquillona (1–2 años), Vaquillona (+2 años,
              24–36 meses) y Vaca (36–120 meses).
            </>
          ) : (
            <>
              Completá la fecha de nacimiento para ver la línea de tiempo desde
              el nacimiento hasta los {MAX_MESES_GENERAL} meses.
            </>
          )}
        </div>
      </section>
    );
  }

  const etapaMacho =
    esMacho && mesesPin !== null ? etapaMachoDesdeMeses(mesesPin) : null;
  const etapaHembra =
    esHembra && mesesPin !== null ? etapaHembraDesdeMeses(mesesPin) : null;

  return (
    <section
      className={`stock-evolucion ${claseSexo(sexo)} ${claseEstado(estado)}${
        conEtapas ? ` stock-evolucion--${esMacho ? "macho" : "hembra"}-etapas` : ""
      }`}
      aria-label="Línea de tiempo de evolución del animal"
    >
      <div className="stock-evolucion-head">
        <div className="stock-evolucion-head-main">
          <h4 className="stock-evolucion-title">Evolución del animal</h4>
          <FechasEvolucion
            nacimientoMes={nacimientoMes}
            nacimientoAnio={nacimientoAnio}
            nacimientoLabel={nacimientoLabel}
            estado={estado}
            bajaMes={bajaMes}
            bajaAnio={bajaAnio}
            onBajaMesChange={onBajaMesChange}
            onBajaAnioChange={onBajaAnioChange}
            editandoBaja={editandoBaja}
            bajaDisabled={bajaDisabled}
          />
        </div>
      </div>

      <div className="stock-evolucion-chart">
        {esMacho && etapaMacho && mesesPin !== null ? (
          <ChartMacho
            edadMeses={edadMeses}
            mesesPin={mesesPin}
            estado={estado}
            etapaActivaId={etapaMacho.id}
          />
        ) : esHembra && etapaHembra && mesesPin !== null ? (
          <ChartHembra
            edadMeses={edadMeses}
            mesesPin={mesesPin}
            estado={estado}
            etapaActivaId={etapaHembra.id}
          />
        ) : mesesPin !== null ? (
          <ChartGeneral
            edadMeses={edadMeses}
            mesesPin={mesesPin}
            estado={estado}
            posicionPct={posicionGeneral}
          />
        ) : null}
      </div>
    </section>
  );
}
