import type { DispositivoEstado } from "../../types";

/** Longitud del prefijo EID en RFID Tru-Test (ej. 858). */
export const EID_PREFIX_LEN = 3;

/** Separa prefijo EID (858) y número de dispositivo VID. */
export function splitEidVid(
  eid: string,
  vid = ""
): { eid: string; vid: string } {
  const vidTrim = vid.trim();
  const vidDigits = vidTrim.replace(/\D/g, "");
  const eidDigits = eid.replace(/\D/g, "");

  if (vidDigits) {
    const eidPart =
      eidDigits.length >= EID_PREFIX_LEN
        ? eidDigits.slice(0, EID_PREFIX_LEN)
        : eidDigits || eid.trim();
    return { eid: eidPart, vid: vidDigits };
  }

  if (eidDigits.length > EID_PREFIX_LEN) {
    return {
      eid: eidDigits.slice(0, EID_PREFIX_LEN),
      vid: eidDigits.slice(EID_PREFIX_LEN),
    };
  }

  return { eid: eidDigits || eid.trim(), vid: "" };
}

/** Clave única del dispositivo (todos los dígitos del RFID). */
export function dispositivoClave(eid: string, vid = ""): string {
  const { eid: e, vid: v } = splitEidVid(eid, vid);
  const ed = e.replace(/\D/g, "");
  const vd = v.replace(/\D/g, "");
  return vd ? ed + vd : ed;
}

export const MESES_NACIMIENTO = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
] as const;

export function fmtNacimiento(mes: number | null, anio: number | null): string {
  if (!mes || !anio) return "—";
  const nombre = MESES_NACIMIENTO.find((m) => m.value === mes)?.label;
  return nombre ? `${nombre} ${anio}` : "—";
}

/** Edad en meses desde mes/año de nacimiento hasta hoy. */
export function calcularEdadMeses(
  mes: number | null,
  anio: number | null
): number | null {
  if (!mes || !anio) return null;
  const now = new Date();
  const mesActual = now.getMonth() + 1;
  const anioActual = now.getFullYear();
  return Math.max(0, (anioActual - anio) * 12 + (mesActual - mes));
}

export function fmtEdadMeses(mes: number | null, anio: number | null): string {
  const edad = calcularEdadMeses(mes, anio);
  if (edad === null) return "SIN FECHA DE NACIMIENTO";
  return `${edad} meses`;
}

export const MACHO_ESCALA_MAX_MESES = 120;
export const MACHO_FRONTERA_TERNERO = 12;
export const MACHO_FRONTERA_NOVILLO = 24;

export interface EtapaEvolucionMacho {
  id: "TERNERO" | "JOVEN_1_2" | "MAS_2";
  titulo: string;
  rango: string;
  desdeMes: number;
  hastaMes: number;
}

/** Etapas productivas para machos en la línea de tiempo. */
export const ETAPAS_EVOLUCION_MACHO: EtapaEvolucionMacho[] = [
  {
    id: "TERNERO",
    titulo: "Ternero",
    rango: "0 – 12 meses",
    desdeMes: 0,
    hastaMes: MACHO_FRONTERA_TERNERO,
  },
  {
    id: "JOVEN_1_2",
    titulo: "Novillo / Toro",
    rango: "1 – 2 años",
    desdeMes: MACHO_FRONTERA_TERNERO,
    hastaMes: MACHO_FRONTERA_NOVILLO,
  },
  {
    id: "MAS_2",
    titulo: "Novillo / Toro",
    rango: "+2 años",
    desdeMes: MACHO_FRONTERA_NOVILLO,
    hastaMes: MACHO_ESCALA_MAX_MESES,
  },
];

export function etapaMachoDesdeMeses(meses: number): EtapaEvolucionMacho {
  if (meses < MACHO_FRONTERA_TERNERO) return ETAPAS_EVOLUCION_MACHO[0];
  if (meses < MACHO_FRONTERA_NOVILLO) return ETAPAS_EVOLUCION_MACHO[1];
  return ETAPAS_EVOLUCION_MACHO[2];
}

export function pctEscalaMeses(meses: number, max: number): number {
  return Math.min(100, Math.max(0, (meses / max) * 100));
}

const MACHO_SEGMENTO_PCT = 100 / 3;

export const HEMBRA_ESCALA_MAX_MESES = 120;
export const HEMBRA_FRONTERA_TERNERA = 12;
export const HEMBRA_FRONTERA_VAQUILLONA = 24;
export const HEMBRA_FRONTERA_VAQUILLONA_MAS_2 = 36;

export interface EtapaEvolucionHembra {
  id: "TERNERA" | "VAQUILLONA" | "VAQUILLONA_MAS_2" | "VACA";
  titulo: string;
  rango: string;
  desdeMes: number;
  hastaMes: number;
}

/** Etapas productivas para hembras en la línea de tiempo. */
export const ETAPAS_EVOLUCION_HEMBRA: EtapaEvolucionHembra[] = [
  {
    id: "TERNERA",
    titulo: "Ternera",
    rango: "0 – 12 meses",
    desdeMes: 0,
    hastaMes: HEMBRA_FRONTERA_TERNERA,
  },
  {
    id: "VAQUILLONA",
    titulo: "Vaquillona",
    rango: "1 – 2 años",
    desdeMes: HEMBRA_FRONTERA_TERNERA,
    hastaMes: HEMBRA_FRONTERA_VAQUILLONA,
  },
  {
    id: "VAQUILLONA_MAS_2",
    titulo: "Vaquillona",
    rango: "+2 años · 24 – 36 m",
    desdeMes: HEMBRA_FRONTERA_VAQUILLONA,
    hastaMes: HEMBRA_FRONTERA_VAQUILLONA_MAS_2,
  },
  {
    id: "VACA",
    titulo: "Vaca",
    rango: "36 – 120 meses",
    desdeMes: HEMBRA_FRONTERA_VAQUILLONA_MAS_2,
    hastaMes: HEMBRA_ESCALA_MAX_MESES,
  },
];

export function etapaHembraDesdeMeses(meses: number): EtapaEvolucionHembra {
  if (meses < HEMBRA_FRONTERA_TERNERA) return ETAPAS_EVOLUCION_HEMBRA[0];
  if (meses < HEMBRA_FRONTERA_VAQUILLONA) return ETAPAS_EVOLUCION_HEMBRA[1];
  if (meses < HEMBRA_FRONTERA_VAQUILLONA_MAS_2) return ETAPAS_EVOLUCION_HEMBRA[2];
  return ETAPAS_EVOLUCION_HEMBRA[3];
}

const HEMBRA_SEGMENTO_PCT = 100 / 4;

/** Posición visual en la barra hembra: 4 tramos iguales. */
export function pctHembraVisual(meses: number): number {
  const m = Math.min(Math.max(0, meses), HEMBRA_ESCALA_MAX_MESES);
  if (m <= HEMBRA_FRONTERA_TERNERA) {
    return (m / HEMBRA_FRONTERA_TERNERA) * HEMBRA_SEGMENTO_PCT;
  }
  if (m <= HEMBRA_FRONTERA_VAQUILLONA) {
    const t =
      (m - HEMBRA_FRONTERA_TERNERA) /
      (HEMBRA_FRONTERA_VAQUILLONA - HEMBRA_FRONTERA_TERNERA);
    return HEMBRA_SEGMENTO_PCT + t * HEMBRA_SEGMENTO_PCT;
  }
  if (m <= HEMBRA_FRONTERA_VAQUILLONA_MAS_2) {
    const t =
      (m - HEMBRA_FRONTERA_VAQUILLONA) /
      (HEMBRA_FRONTERA_VAQUILLONA_MAS_2 - HEMBRA_FRONTERA_VAQUILLONA);
    return HEMBRA_SEGMENTO_PCT * 2 + t * HEMBRA_SEGMENTO_PCT;
  }
  const t =
    (m - HEMBRA_FRONTERA_VAQUILLONA_MAS_2) /
    (HEMBRA_ESCALA_MAX_MESES - HEMBRA_FRONTERA_VAQUILLONA_MAS_2);
  return HEMBRA_SEGMENTO_PCT * 3 + t * HEMBRA_SEGMENTO_PCT;
}

/** Posición visual en la barra macho: 3 tramos iguales (ternero / 1-2a / +2a). */
export function pctMachoVisual(meses: number): number {
  const m = Math.min(Math.max(0, meses), MACHO_ESCALA_MAX_MESES);
  if (m <= MACHO_FRONTERA_TERNERO) {
    return (m / MACHO_FRONTERA_TERNERO) * MACHO_SEGMENTO_PCT;
  }
  if (m <= MACHO_FRONTERA_NOVILLO) {
    const t =
      (m - MACHO_FRONTERA_TERNERO) /
      (MACHO_FRONTERA_NOVILLO - MACHO_FRONTERA_TERNERO);
    return MACHO_SEGMENTO_PCT + t * MACHO_SEGMENTO_PCT;
  }
  const t =
    (m - MACHO_FRONTERA_NOVILLO) /
    (MACHO_ESCALA_MAX_MESES - MACHO_FRONTERA_NOVILLO);
  return MACHO_SEGMENTO_PCT * 2 + t * MACHO_SEGMENTO_PCT;
}

export type EscalaMarcaAlineacion = "left" | "center" | "right";

export interface EscalaMarcaMeses {
  label: string;
  pct: number;
  align: EscalaMarcaAlineacion;
}

/** Hitos de meses alineados a los límites visuales del cronograma macho (3 tramos). */
export const ESCALA_MARCAS_MACHO: readonly EscalaMarcaMeses[] = [
  { label: "0 m", pct: 0, align: "left" },
  { label: "12 m", pct: MACHO_SEGMENTO_PCT, align: "center" },
  { label: "24 m", pct: MACHO_SEGMENTO_PCT * 2, align: "center" },
  { label: "120 m", pct: 100, align: "right" },
];

/** Hitos de meses alineados a los límites visuales del cronograma hembra (4 tramos). */
export const ESCALA_MARCAS_HEMBRA: readonly EscalaMarcaMeses[] = [
  { label: "0 m", pct: 0, align: "left" },
  { label: "12 m", pct: HEMBRA_SEGMENTO_PCT, align: "center" },
  { label: "24 m", pct: HEMBRA_SEGMENTO_PCT * 2, align: "center" },
  { label: "36 m", pct: HEMBRA_SEGMENTO_PCT * 3, align: "center" },
  { label: "120 m", pct: 100, align: "right" },
];

/** Hitos en años (misma posición % que los meses de corte). */
export const ESCALA_MARCAS_ANIOS_MACHO: readonly EscalaMarcaMeses[] = [
  { label: "0 años", pct: 0, align: "left" },
  { label: "1 año", pct: MACHO_SEGMENTO_PCT, align: "center" },
  { label: "2 años", pct: MACHO_SEGMENTO_PCT * 2, align: "center" },
  { label: "10 años", pct: 100, align: "right" },
];

export const ESCALA_MARCAS_ANIOS_HEMBRA: readonly EscalaMarcaMeses[] = [
  { label: "0 años", pct: 0, align: "left" },
  { label: "1 año", pct: HEMBRA_SEGMENTO_PCT, align: "center" },
  { label: "2 años", pct: HEMBRA_SEGMENTO_PCT * 2, align: "center" },
  { label: "3 años", pct: HEMBRA_SEGMENTO_PCT * 3, align: "center" },
  { label: "10 años", pct: 100, align: "right" },
];

/** Avance 0–100 % dentro de la etapa productiva actual (macho). */
export function progresoEtapaMacho(meses: number): number {
  const m = Math.min(Math.max(0, meses), MACHO_ESCALA_MAX_MESES);
  if (m <= MACHO_FRONTERA_TERNERO) {
    return (m / MACHO_FRONTERA_TERNERO) * 100;
  }
  if (m <= MACHO_FRONTERA_NOVILLO) {
    return (
      ((m - MACHO_FRONTERA_TERNERO) /
        (MACHO_FRONTERA_NOVILLO - MACHO_FRONTERA_TERNERO)) *
      100
    );
  }
  return (
    ((m - MACHO_FRONTERA_NOVILLO) /
      (MACHO_ESCALA_MAX_MESES - MACHO_FRONTERA_NOVILLO)) *
    100
  );
}

/** Convierte meses a años para mostrar (ej. 15 → "1,3"). */
export function fmtEdadAniosDesdeMeses(meses: number): string {
  const anios = meses / 12;
  const tieneResto = meses % 12 !== 0;
  return anios.toLocaleString("es-AR", {
    minimumFractionDigits: tieneResto ? 1 : 0,
    maximumFractionDigits: tieneResto ? 1 : 0,
  });
}

export const ESTADOS_DISPOSITIVO: ReadonlyArray<{
  value: DispositivoEstado;
  label: string;
}> = [
  { value: "VIVO", label: "Vivo" },
  { value: "MUERTO", label: "Muerto" },
  { value: "VENDIDO", label: "Vendido" },
  { value: "FRIGORIFICO", label: "Frigorífico" },
];

export function fmtEstadoDispositivo(estado: DispositivoEstado): string {
  return ESTADOS_DISPOSITIVO.find((e) => e.value === estado)?.label ?? "Vivo";
}

export function normalizarEstadoDispositivo(
  estado: DispositivoEstado | undefined | null
): DispositivoEstado {
  if (estado && ESTADOS_DISPOSITIVO.some((e) => e.value === estado)) {
    return estado;
  }
  return "VIVO";
}

export function requiereFechaBaja(estado: DispositivoEstado): boolean {
  return estado === "MUERTO" || estado === "VENDIDO" || estado === "FRIGORIFICO";
}

export function etiquetaFechaBaja(estado: DispositivoEstado): string {
  if (estado === "MUERTO") return "Muerte";
  if (estado === "VENDIDO") return "Venta";
  if (estado === "FRIGORIFICO") return "Frigorífico";
  return "";
}

/** Meses transcurridos entre dos fechas (mes/año). */
export function calcularMesesEntreFechas(
  desdeMes: number | null,
  desdeAnio: number | null,
  hastaMes: number | null,
  hastaAnio: number | null
): number | null {
  if (!desdeMes || !desdeAnio || !hastaMes || !hastaAnio) return null;
  return Math.max(0, (hastaAnio - desdeAnio) * 12 + (hastaMes - desdeMes));
}

export function fechaBajaPorDefecto(): { mes: number; anio: number } {
  const now = new Date();
  return { mes: now.getMonth() + 1, anio: now.getFullYear() };
}

/** ISO YYYY-MM-DD → mes/año (misma lógica que importación de bajas). */
export function fechaIsoAMesAnio(
  fecha: string
): { mes: number; anio: number } | null {
  const m = fecha.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const anio = Number(m[1]);
  const mes = Number(m[2]);
  if (!Number.isInteger(anio) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    return null;
  }
  return { mes, anio };
}

/** Meses para el pin del cronograma: fecha de baja si aplica, si no edad actual. */
export function mesesReferenciaTimeline(
  estado: DispositivoEstado,
  edadMeses: number | null,
  nacimientoMes: number | null,
  nacimientoAnio: number | null,
  bajaMes: number | null,
  bajaAnio: number | null
): number | null {
  if (edadMeses === null) return null;
  if (requiereFechaBaja(estado) && bajaMes && bajaAnio) {
    const mesesBaja = calcularMesesEntreFechas(
      nacimientoMes,
      nacimientoAnio,
      bajaMes,
      bajaAnio
    );
    if (mesesBaja !== null) return mesesBaja;
  }
  return edadMeses;
}

export function resolverFechaBajaFormulario(
  estado: DispositivoEstado,
  bajaMesActual: number | null,
  bajaAnioActual: number | null,
  bajaMesGuardado: number | null,
  bajaAnioGuardado: number | null,
  ultimaFechaLectura: string
): { mes: number | null; anio: number | null } {
  if (!requiereFechaBaja(estado)) {
    return { mes: null, anio: null };
  }
  if (bajaMesActual && bajaAnioActual) {
    return { mes: bajaMesActual, anio: bajaAnioActual };
  }
  if (bajaMesGuardado && bajaAnioGuardado) {
    return { mes: bajaMesGuardado, anio: bajaAnioGuardado };
  }
  const desdeLectura = fechaIsoAMesAnio(ultimaFechaLectura);
  if (desdeLectura) return desdeLectura;
  const hoy = fechaBajaPorDefecto();
  return { mes: hoy.mes, anio: hoy.anio };
}

export const GRUPO_PREFIX = "GEN";
export const GRUPO_ANIO_MIN = 2000;

const ANIO_NACIMIENTO_MIN = 2020;

/** Años para grupo GEN (2000 → actual). */
export function listAniosGrupo(): number[] {
  const max = new Date().getFullYear();
  const years: number[] = [];
  for (let y = max; y >= GRUPO_ANIO_MIN; y--) years.push(y);
  return years;
}

export function parseGrupoAnio(grupo: string): number | null {
  const m = grupo.trim().toUpperCase().match(/^GEN(\d{4})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const max = new Date().getFullYear();
  if (!Number.isInteger(y) || y < GRUPO_ANIO_MIN || y > max) return null;
  return y;
}

export function buildGrupo(anio: number | null): string {
  if (!anio) return "";
  return `${GRUPO_PREFIX}${anio}`;
}

export function fmtGrupo(grupo: string): string {
  return grupo.trim() || "—";
}

/** Años disponibles para nacimiento (actual hacia atrás). */
export function listAniosNacimiento(): number[] {
  const max = new Date().getFullYear();
  const years: number[] = [];
  for (let y = max; y >= ANIO_NACIMIENTO_MIN; y--) years.push(y);
  return years;
}
