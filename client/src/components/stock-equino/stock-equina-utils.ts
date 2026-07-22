import type { DispositivoEstado, DispositivoSexo, TipoBaja } from "../../types";

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

/** REG equino: prefijo EID y número VID juntos (ej. 600-000000000000000010). */
export function fmtRegEquino(eid: string, vid = ""): string {
  const { eid: e, vid: v } = splitEidVid(eid, vid);
  if (e && v) return `${e}-${v}`;
  if (v) return v;
  if (e) return e;
  return "";
}

/** Etiqueta legible para listados y buscadores (REG = EID-VID). */
export function etiquetaCaravana(d: {
  eid: string;
  vid: string;
  clave: string;
}): string {
  const reg = fmtRegEquino(d.eid, d.vid);
  if (reg) return reg;
  return d.clave;
}

/** True si el equino tiene ficha de cabaña (RP / nombre / origen). */
export function esEquinoCabana(d: {
  origen_alta?: string | null;
  nombre_animal?: string | null;
  nombre_cabana?: string | null;
  rp?: string | null;
  registro?: string | null;
  cabana_premium?: boolean | null;
}): boolean {
  return (
    String(d.origen_alta ?? "").trim().toLowerCase() === "cabana" ||
    Boolean(d.nombre_animal?.trim()) ||
    Boolean(d.nombre_cabana?.trim()) ||
    Boolean(d.rp?.trim()) ||
    Boolean(d.registro?.trim()) ||
    Boolean(d.cabana_premium)
  );
}

/** Etiqueta de baja: REG + datos de cabaña si existen. */
export function etiquetaBajaEquino(d: {
  eid: string;
  vid: string;
  clave: string;
  nombre_animal?: string | null;
  nombre_cabana?: string | null;
  rp?: string | null;
  registro?: string | null;
}): string {
  const partes = [etiquetaCaravana(d)];
  const detalle = detalleCabanaEquino(d);
  if (detalle) partes.push(detalle);
  return partes.join(" · ");
}

/** Solo datos de cabaña (sin REG), para subtítulos junto al REG. */
export function detalleCabanaEquino(d: {
  nombre_animal?: string | null;
  nombre_cabana?: string | null;
  rp?: string | null;
  registro?: string | null;
}): string {
  const partes: string[] = [];
  const nombre = d.nombre_animal?.trim() || d.nombre_cabana?.trim();
  if (nombre) partes.push(nombre);
  if (d.rp?.trim()) partes.push(`RP ${d.rp.trim()}`);
  if (d.registro?.trim()) partes.push(d.registro.trim());
  return partes.join(" · ");
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

/** Escala del cronograma: 60 años = 720 meses. */
export const MACHO_ESCALA_MAX_MESES = 720;
export const MACHO_FRONTERA_POTRILLO = 12;
export const MACHO_FRONTERA_POTRO = 36;
/** @deprecated Usar MACHO_FRONTERA_POTRILLO */
export const MACHO_FRONTERA_TERNERO = MACHO_FRONTERA_POTRILLO;
/** @deprecated Usar MACHO_FRONTERA_POTRO */
export const MACHO_FRONTERA_NOVILLO = MACHO_FRONTERA_POTRO;

export interface EtapaEvolucionMacho {
  id: "POTRILLO" | "POTRO" | "ADULTO";
  titulo: string;
  rango: string;
  desdeMes: number;
  hastaMes: number;
}

/** Etapas productivas para machos en la línea de tiempo. */
export const ETAPAS_EVOLUCION_MACHO: EtapaEvolucionMacho[] = [
  {
    id: "POTRILLO",
    titulo: "Potrillo",
    rango: "0 – 12 meses",
    desdeMes: 0,
    hastaMes: MACHO_FRONTERA_POTRILLO,
  },
  {
    id: "POTRO",
    titulo: "Potro",
    rango: "12 – 36 meses",
    desdeMes: MACHO_FRONTERA_POTRILLO,
    hastaMes: MACHO_FRONTERA_POTRO,
  },
  {
    id: "ADULTO",
    titulo: "Caballo / Padrillo",
    rango: "36 meses – 60 años",
    desdeMes: MACHO_FRONTERA_POTRO,
    hastaMes: MACHO_ESCALA_MAX_MESES,
  },
];

export function etapaMachoDesdeMeses(meses: number): EtapaEvolucionMacho {
  if (meses < MACHO_FRONTERA_POTRILLO) return ETAPAS_EVOLUCION_MACHO[0];
  if (meses < MACHO_FRONTERA_POTRO) return ETAPAS_EVOLUCION_MACHO[1];
  return ETAPAS_EVOLUCION_MACHO[2];
}

export function pctEscalaMeses(meses: number, max: number): number {
  return Math.min(100, Math.max(0, (meses / max) * 100));
}

const MACHO_SEGMENTO_PCT = 100 / 3;

/** Escala del cronograma: 60 años = 720 meses. */
export const HEMBRA_ESCALA_MAX_MESES = 720;
export const HEMBRA_FRONTERA_POTRANCA = 12;
export const HEMBRA_FRONTERA_POTRA = 36;
/** @deprecated Usar HEMBRA_FRONTERA_POTRANCA */
export const HEMBRA_FRONTERA_TERNERA = HEMBRA_FRONTERA_POTRANCA;
/** @deprecated */
export const HEMBRA_FRONTERA_VAQUILLONA = 24;
/** @deprecated Usar HEMBRA_FRONTERA_POTRA */
export const HEMBRA_FRONTERA_VAQUILLONA_MAS_2 = HEMBRA_FRONTERA_POTRA;

export interface EtapaEvolucionHembra {
  id: "POTRANCA" | "POTRA" | "YEGUA";
  titulo: string;
  rango: string;
  desdeMes: number;
  hastaMes: number;
}

/** Etapas productivas para hembras en la línea de tiempo. */
export const ETAPAS_EVOLUCION_HEMBRA: EtapaEvolucionHembra[] = [
  {
    id: "POTRANCA",
    titulo: "Potranca",
    rango: "0 – 12 meses",
    desdeMes: 0,
    hastaMes: HEMBRA_FRONTERA_POTRANCA,
  },
  {
    id: "POTRA",
    titulo: "Potra",
    rango: "12 – 36 meses",
    desdeMes: HEMBRA_FRONTERA_POTRANCA,
    hastaMes: HEMBRA_FRONTERA_POTRA,
  },
  {
    id: "YEGUA",
    titulo: "Yegua",
    rango: "36 meses – 60 años",
    desdeMes: HEMBRA_FRONTERA_POTRA,
    hastaMes: HEMBRA_ESCALA_MAX_MESES,
  },
];

export function etapaHembraDesdeMeses(meses: number): EtapaEvolucionHembra {
  if (meses < HEMBRA_FRONTERA_POTRANCA) return ETAPAS_EVOLUCION_HEMBRA[0];
  if (meses < HEMBRA_FRONTERA_POTRA) return ETAPAS_EVOLUCION_HEMBRA[1];
  return ETAPAS_EVOLUCION_HEMBRA[2];
}

const HEMBRA_SEGMENTO_PCT = 100 / 3;

/** Posición visual en la barra hembra: 3 tramos iguales. */
export function pctHembraVisual(meses: number): number {
  const m = Math.min(Math.max(0, meses), HEMBRA_ESCALA_MAX_MESES);
  if (m <= HEMBRA_FRONTERA_POTRANCA) {
    return (m / HEMBRA_FRONTERA_POTRANCA) * HEMBRA_SEGMENTO_PCT;
  }
  if (m <= HEMBRA_FRONTERA_POTRA) {
    const t =
      (m - HEMBRA_FRONTERA_POTRANCA) /
      (HEMBRA_FRONTERA_POTRA - HEMBRA_FRONTERA_POTRANCA);
    return HEMBRA_SEGMENTO_PCT + t * HEMBRA_SEGMENTO_PCT;
  }
  const t =
    (m - HEMBRA_FRONTERA_POTRA) /
    (HEMBRA_ESCALA_MAX_MESES - HEMBRA_FRONTERA_POTRA);
  return HEMBRA_SEGMENTO_PCT * 2 + t * HEMBRA_SEGMENTO_PCT;
}

/** Posición visual en la barra macho: 3 tramos iguales. */
export function pctMachoVisual(meses: number): number {
  const m = Math.min(Math.max(0, meses), MACHO_ESCALA_MAX_MESES);
  if (m <= MACHO_FRONTERA_POTRILLO) {
    return (m / MACHO_FRONTERA_POTRILLO) * MACHO_SEGMENTO_PCT;
  }
  if (m <= MACHO_FRONTERA_POTRO) {
    const t =
      (m - MACHO_FRONTERA_POTRILLO) /
      (MACHO_FRONTERA_POTRO - MACHO_FRONTERA_POTRILLO);
    return MACHO_SEGMENTO_PCT + t * MACHO_SEGMENTO_PCT;
  }
  const t =
    (m - MACHO_FRONTERA_POTRO) /
    (MACHO_ESCALA_MAX_MESES - MACHO_FRONTERA_POTRO);
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
  { label: "36 m", pct: MACHO_SEGMENTO_PCT * 2, align: "center" },
  { label: "720 m", pct: 100, align: "right" },
];

/** Hitos de meses alineados a los límites visuales del cronograma hembra (3 tramos). */
export const ESCALA_MARCAS_HEMBRA: readonly EscalaMarcaMeses[] = [
  { label: "0 m", pct: 0, align: "left" },
  { label: "12 m", pct: HEMBRA_SEGMENTO_PCT, align: "center" },
  { label: "36 m", pct: HEMBRA_SEGMENTO_PCT * 2, align: "center" },
  { label: "720 m", pct: 100, align: "right" },
];

/** Hitos en años (misma posición % que los meses de corte). */
export const ESCALA_MARCAS_ANIOS_MACHO: readonly EscalaMarcaMeses[] = [
  { label: "0 años", pct: 0, align: "left" },
  { label: "1 año", pct: MACHO_SEGMENTO_PCT, align: "center" },
  { label: "3 años", pct: MACHO_SEGMENTO_PCT * 2, align: "center" },
  { label: "60 años", pct: 100, align: "right" },
];

export const ESCALA_MARCAS_ANIOS_HEMBRA: readonly EscalaMarcaMeses[] = [
  { label: "0 años", pct: 0, align: "left" },
  { label: "1 año", pct: HEMBRA_SEGMENTO_PCT, align: "center" },
  { label: "3 años", pct: HEMBRA_SEGMENTO_PCT * 2, align: "center" },
  { label: "60 años", pct: 100, align: "right" },
];

/** Avance 0–100 % dentro de la etapa productiva actual (macho). */
export function progresoEtapaMacho(meses: number): number {
  const m = Math.min(Math.max(0, meses), MACHO_ESCALA_MAX_MESES);
  if (m <= MACHO_FRONTERA_POTRILLO) {
    return (m / MACHO_FRONTERA_POTRILLO) * 100;
  }
  if (m <= MACHO_FRONTERA_POTRO) {
    return (
      ((m - MACHO_FRONTERA_POTRILLO) /
        (MACHO_FRONTERA_POTRO - MACHO_FRONTERA_POTRILLO)) *
      100
    );
  }
  return (
    ((m - MACHO_FRONTERA_POTRO) /
      (MACHO_ESCALA_MAX_MESES - MACHO_FRONTERA_POTRO)) *
    100
  );
}

/** Convierte meses a años para mostrar (ej. 15 → "1,3"). */
export function fmtEdadAniosDesdeMeses(meses: number): string {
  const anios = meses / 12;
  const tieneResto = meses % 12 !== 0;
  return anios.toLocaleString("es-UY", {
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
  { value: "PERDIDO", label: "Extraviado" },
];

export const TIPOS_BAJA: ReadonlyArray<{
  value: TipoBaja;
  label: string;
}> = [
  { value: "VENTA_FRIGORIFICO", label: "Venta Frigorífico" },
  { value: "VENTA_PRODUCTOR", label: "Venta productor" },
  { value: "MUERTE", label: "Muerte" },
  { value: "PERDIDO", label: "Extraviado" },
];

export function fmtTipoBaja(tipo: TipoBaja | "" | undefined | null): string {
  if (tipo === "FRIGORIFICO") return "Frigorífico";
  return TIPOS_BAJA.find((t) => t.value === tipo)?.label ?? "—";
}

export function estadoDesdeTipoBaja(tipo: TipoBaja): DispositivoEstado {
  switch (tipo) {
    case "VENTA_FRIGORIFICO":
    case "VENTA_PRODUCTOR":
      return "VENDIDO";
    case "FRIGORIFICO":
      return "FRIGORIFICO";
    case "MUERTE":
      return "MUERTO";
    case "PERDIDO":
      return "PERDIDO";
  }
}

export function tipoBajaDesdeDispositivo(dispositivo: {
  estado: DispositivoEstado;
  tipo_baja?: TipoBaja | "" | null;
}): TipoBaja {
  const tb = dispositivo.tipo_baja;
  if (tb && tb !== "FRIGORIFICO" && TIPOS_BAJA.some((t) => t.value === tb)) {
    return tb;
  }
  switch (normalizarEstadoDispositivo(dispositivo.estado)) {
    case "MUERTO":
      return "MUERTE";
    case "PERDIDO":
      return "PERDIDO";
    case "VENDIDO":
    case "FRIGORIFICO":
      return "VENTA_FRIGORIFICO";
    default:
      return "VENTA_FRIGORIFICO";
  }
}

export function requiereFechaTipoBaja(_tipo: TipoBaja): boolean {
  return true;
}

export function fechaHoyIso(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

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

/** Dispositivo presente en stock activo (no baja ni vinculado a venta cerrada). */
export function dispositivoActivoEnStock(
  d: { estado: DispositivoEstado; clave: string },
  clavesVentasCerradas?: ReadonlySet<string>
): boolean {
  if (d.estado !== "VIVO") return false;
  if (clavesVentasCerradas?.has(d.clave)) return false;
  return true;
}

export function filtrarDispositivosActivosStock<T extends { estado: DispositivoEstado; clave: string }>(
  rows: ReadonlyArray<T>,
  clavesVentasCerradas?: ReadonlySet<string>
): T[] {
  return rows.filter((d) => dispositivoActivoEnStock(d, clavesVentasCerradas));
}

export function fmtRaza(raza: string | null | undefined): string {
  return String(raza ?? "").trim() || "—";
}

/** Estados que aparecen en Salidas del sistema (fuera del stock activo). */
export const ESTADOS_SALIDA_SISTEMA: ReadonlySet<DispositivoEstado> = new Set([
  "MUERTO",
  "VENDIDO",
  "FRIGORIFICO",
  "PERDIDO",
]);

export function esDispositivoSalidaSistema(estado: DispositivoEstado): boolean {
  return ESTADOS_SALIDA_SISTEMA.has(estado);
}

export interface SexoDispositivoCounts {
  machos: number;
  hembras: number;
  sinDefinir: number;
}

export function contarSexoDispositivos(
  dispositivos: ReadonlyArray<{ sexo?: string | null }>
): SexoDispositivoCounts {
  let machos = 0;
  let hembras = 0;
  let sinDefinir = 0;
  for (const d of dispositivos) {
    if (d.sexo === "MACHO") machos += 1;
    else if (d.sexo === "HEMBRA") hembras += 1;
    else sinDefinir += 1;
  }
  return { machos, hembras, sinDefinir };
}

/** Fuera del stock activo: baja registrada o vinculado a venta cerrada del simulador. */
export function esDispositivoFueraDeStock(
  d: { estado: DispositivoEstado; clave: string },
  clavesVentasCerradas?: ReadonlySet<string>
): boolean {
  return !dispositivoActivoEnStock(d, clavesVentasCerradas);
}

type DispositivoResumenRow = {
  estado: DispositivoEstado;
  clave: string;
  sexo?: string | null;
};

export interface StockEquinaResumenKpis<T extends DispositivoResumenRow> {
  activos: T[];
  salidas: T[];
  ventasSimulador: T[];
  muertos: T[];
  vendidos: T[];
  frigorifico: T[];
  perdidos: T[];
  vivoEnVenta: T[];
}

export function calcularResumenStockEquinaKpis<T extends DispositivoResumenRow>(
  dispositivos: ReadonlyArray<T>,
  ventasClaves: ReadonlySet<string>
): StockEquinaResumenKpis<T> {
  const activos: T[] = [];
  const salidas: T[] = [];
  const ventasSimulador: T[] = [];
  const muertos: T[] = [];
  const vendidos: T[] = [];
  const frigorifico: T[] = [];
  const perdidos: T[] = [];
  const vivoEnVenta: T[] = [];

  for (const d of dispositivos) {
    if (ventasClaves.has(d.clave)) ventasSimulador.push(d);
    if (dispositivoActivoEnStock(d, ventasClaves)) {
      activos.push(d);
      continue;
    }
    salidas.push(d);
    if (d.estado === "MUERTO") muertos.push(d);
    else if (d.estado === "VENDIDO") vendidos.push(d);
    else if (d.estado === "FRIGORIFICO") frigorifico.push(d);
    else if (d.estado === "PERDIDO") perdidos.push(d);
    else if (d.estado === "VIVO") vivoEnVenta.push(d);
  }

  return {
    activos,
    salidas,
    ventasSimulador,
    muertos,
    vendidos,
    frigorifico,
    perdidos,
    vivoEnVenta,
  };
}

export function fmtSalidasSistemaHint(
  kpis: Pick<
    StockEquinaResumenKpis<DispositivoResumenRow>,
    "muertos" | "vendidos" | "frigorifico" | "perdidos" | "vivoEnVenta"
  >
): string {
  const parts: string[] = [];
  if (kpis.muertos.length > 0) {
    parts.push(
      `${kpis.muertos.length} muerte${kpis.muertos.length === 1 ? "" : "s"}`
    );
  }
  if (kpis.vendidos.length > 0) {
    parts.push(
      `${kpis.vendidos.length} vendido${kpis.vendidos.length === 1 ? "" : "s"}`
    );
  }
  if (kpis.frigorifico.length > 0) {
    parts.push(
      `${kpis.frigorifico.length} frigorífico${kpis.frigorifico.length === 1 ? "" : ""}`
    );
  }
  if (kpis.perdidos.length > 0) {
    parts.push(
      `${kpis.perdidos.length} extraviado${kpis.perdidos.length === 1 ? "" : "s"}`
    );
  }
  if (kpis.vivoEnVenta.length > 0) {
    parts.push(
      `${kpis.vivoEnVenta.length} en venta sin baja aplicada`
    );
  }
  return parts.length > 0
    ? parts.join(" · ")
    : "Muertes, ventas, frigorífico y extraviados";
}

export function requiereFechaBaja(estado: DispositivoEstado): boolean {
  return (
    estado === "MUERTO" ||
    estado === "VENDIDO" ||
    estado === "FRIGORIFICO" ||
    estado === "PERDIDO"
  );
}

export function etiquetaFechaBaja(estado: DispositivoEstado): string {
  if (estado === "MUERTO") return "Muerte";
  if (estado === "VENDIDO") return "Venta";
  if (estado === "FRIGORIFICO") return "Frigorífico";
  if (estado === "PERDIDO") return "Extraviado";
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
const ANIO_NACIMIENTO_MIN = 1900;
export const GRUPO_ANIO_MIN = ANIO_NACIMIENTO_MIN;

/** Años para grupo GEN (1900 → actual). */
export function listAniosGrupo(): number[] {
  const max = new Date().getFullYear();
  const years: number[] = [];
  for (let y = max; y >= GRUPO_ANIO_MIN; y--) years.push(y);
  return years;
}

export function parseGrupoAnio(grupo: string): number | null {
  const t = grupo.trim().toUpperCase();
  const rango = t.match(/^GEN(\d{4})-(\d{4})$/);
  if (rango) {
    const inicio = Number(rango[1]);
    const fin = Number(rango[2]);
    const max = new Date().getFullYear() + 1;
    if (
      !Number.isInteger(inicio) ||
      !Number.isInteger(fin) ||
      fin !== inicio + 1 ||
      inicio < GRUPO_ANIO_MIN ||
      fin > max
    ) {
      return null;
    }
    return inicio;
  }
  const m = t.match(/^GEN(\d{4})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const max = new Date().getFullYear();
  if (!Number.isInteger(y) || y < GRUPO_ANIO_MIN || y > max) return null;
  return y;
}

/** Período GEN: 1 julio año X → 30 junio año X+1. */
export function aniosGeneracionDesdeNacimiento(
  mes: number | null,
  anio: number | null
): { inicio: number; fin: number } | null {
  if (
    anio === null ||
    !Number.isInteger(anio) ||
    mes === null ||
    !Number.isInteger(mes) ||
    mes < 1 ||
    mes > 12
  ) {
    return null;
  }
  if (mes >= 7) {
    return { inicio: anio, fin: anio + 1 };
  }
  return { inicio: anio - 1, fin: anio };
}

export function fmtGeneracionRango(mes: number | null, anio: number | null): string {
  const rango = aniosGeneracionDesdeNacimiento(mes, anio);
  if (!rango) return "—";
  return `${rango.inicio}-${rango.fin}`;
}

export function buildGrupo(mes: number | null, anio: number | null): string {
  const rango = aniosGeneracionDesdeNacimiento(mes, anio);
  if (rango) return `${GRUPO_PREFIX}${rango.inicio}-${rango.fin}`;
  if (anio) return `${GRUPO_PREFIX}${anio}`;
  return "";
}

export function fmtGrupo(grupo: string): string {
  return grupo.trim() || "—";
}

const GRUPO_LIBRE_MAX = 48;

export function normalizarGrupoLibre(val: string): string {
  return val
    .trim()
    .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s]/g, "")
    .slice(0, GRUPO_LIBRE_MAX);
}

export function fmtGrupoLibre(grupoLibre: string): string {
  return grupoLibre.trim() || "—";
}

export type EdadFiltroKey = "0_12" | "13_24" | "25_36" | "37_mas";

export const EDAD_FILTRO_OPCIONES: { key: EdadFiltroKey; label: string }[] = [
  { key: "0_12", label: "Hasta 12 meses" },
  { key: "13_24", label: "13 a 24 meses" },
  { key: "25_36", label: "25 a 36 meses" },
  { key: "37_mas", label: "Más de 36 meses" },
];

export function edadMesesDispositivo(d: {
  edad: number | null;
  nacimiento_mes: number | null;
  nacimiento_anio: number | null;
}): number | null {
  if (d.edad !== null && d.edad !== undefined) return d.edad;
  return calcularEdadMeses(d.nacimiento_mes, d.nacimiento_anio);
}

export function edadFiltroKey(d: {
  edad: number | null;
  nacimiento_mes: number | null;
  nacimiento_anio: number | null;
}): EdadFiltroKey | null {
  const meses = edadMesesDispositivo(d);
  if (meses === null) return null;
  if (meses <= 12) return "0_12";
  if (meses <= 24) return "13_24";
  if (meses <= 36) return "25_36";
  return "37_mas";
}

export const SIN_FECHA_NAC_FILTRO_KEY = "sin_fecha_nac";

export function dispositivoSinFechaNacimiento(d: {
  nacimiento_mes: number | null;
  nacimiento_anio: number | null;
}): boolean {
  return !d.nacimiento_mes || !d.nacimiento_anio;
}

export function coincideSinFechaNacFiltro(
  d: Parameters<typeof dispositivoSinFechaNacimiento>[0],
  filtro: Set<string>
): boolean {
  if (!filtro.has(SIN_FECHA_NAC_FILTRO_KEY)) return true;
  return dispositivoSinFechaNacimiento(d);
}

export function labelEdadFiltro(key: EdadFiltroKey): string {
  return EDAD_FILTRO_OPCIONES.find((o) => o.key === key)?.label ?? key;
}

export function grupoLibreFiltroKey(grupoLibre: string): string {
  return grupoLibre.trim();
}

export function labelGrupoLibreFiltro(key: string): string {
  return key.trim() || "Sin definir";
}

export function razaFiltroKey(raza: string | null | undefined): string {
  return String(raza ?? "").trim().toUpperCase();
}

export function labelRazaFiltro(key: string): string {
  return key.trim() || "Sin definir";
}

export function generacionFiltroKey(grupo: string | null | undefined): string {
  return String(grupo ?? "").trim().toUpperCase();
}

export function labelGeneracionFiltro(key: string): string {
  return key.trim() || "Sin definir";
}

export function ultimaLecturaMesFiltroKey(fecha: string | null | undefined): string {
  const f = String(fecha ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return "";
  return f.slice(0, 7);
}

const MESES_ULTIMA_LECTURA = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
] as const;

export function labelUltimaLecturaMesFiltro(key: string): string {
  if (!key.trim()) return "Sin lectura";
  const [y, m] = key.split("-");
  const mi = parseInt(m ?? "", 10) - 1;
  if (!y || mi < 0 || mi > 11) return key;
  return `${MESES_ULTIMA_LECTURA[mi]} ${y}`;
}

export type CategoriaFiltroKey =
  | "POTRANCA"
  | "POTRA"
  | "YEGUA"
  | "POTRILLO"
  | "POTRO"
  | "CABALLO"
  | "PADRILLO"
  | "SIN_SEXO";

export const CATEGORIA_FILTRO_HEMBRA: { key: CategoriaFiltroKey; label: string }[] = [
  { key: "POTRANCA", label: "Potranca" },
  { key: "POTRA", label: "Potra" },
  { key: "YEGUA", label: "Yegua" },
];

export const CATEGORIA_FILTRO_MACHO: { key: CategoriaFiltroKey; label: string }[] = [
  { key: "POTRILLO", label: "Potrillo" },
  { key: "POTRO", label: "Potro" },
  { key: "CABALLO", label: "Caballo" },
  { key: "PADRILLO", label: "Padrillo" },
];

export const CATEGORIA_FILTRO_OTROS: { key: CategoriaFiltroKey; label: string }[] = [
  { key: "SIN_SEXO", label: "Sin sexo definido" },
];

export const CATEGORIA_FILTRO_OPCIONES = [
  ...CATEGORIA_FILTRO_HEMBRA,
  ...CATEGORIA_FILTRO_MACHO,
  ...CATEGORIA_FILTRO_OTROS,
];

export function labelCategoriaFiltro(key: CategoriaFiltroKey): string {
  const all = CATEGORIA_FILTRO_OPCIONES;
  return all.find((o) => o.key === key)?.label ?? key;
}

/** Categorías de evolución a la fecha de referencia (hoy o fecha de baja). */
export function categoriasDispositivo(d: {
  sexo: DispositivoSexo;
  edad: number | null;
  nacimiento_mes: number | null;
  nacimiento_anio: number | null;
  estado: DispositivoEstado;
  baja_mes: number | null;
  baja_anio: number | null;
  categoria?: string | null;
  castrado?: boolean | null;
}): Set<CategoriaFiltroKey> {
  const catGuardada = String(d.categoria ?? "").trim().toUpperCase();
  if (
    catGuardada === "POTRANCA" ||
    catGuardada === "POTRA" ||
    catGuardada === "YEGUA" ||
    catGuardada === "POTRILLO" ||
    catGuardada === "POTRO" ||
    catGuardada === "CABALLO" ||
    catGuardada === "PADRILLO"
  ) {
    return new Set([catGuardada]);
  }

  if (!d.sexo) return new Set(["SIN_SEXO"]);
  if (dispositivoSinFechaNacimiento(d)) return new Set();

  const edadMeses = edadMesesDispositivo(d);
  if (edadMeses === null) return new Set();

  const meses = mesesReferenciaTimeline(
    d.estado,
    edadMeses,
    d.nacimiento_mes,
    d.nacimiento_anio,
    d.baja_mes,
    d.baja_anio
  );
  if (meses === null) return new Set();

  if (d.sexo === "HEMBRA") {
    const etapa = etapaHembraDesdeMeses(meses);
    return new Set([etapa.id]);
  }

  if (d.sexo === "MACHO") {
    const etapa = etapaMachoDesdeMeses(meses);
    if (etapa.id === "POTRILLO") return new Set(["POTRILLO"]);
    if (etapa.id === "POTRO") return new Set(["POTRO"]);
    if (d.castrado === true) return new Set(["CABALLO"]);
    if (d.castrado === false) return new Set(["PADRILLO"]);
    return new Set(["CABALLO", "PADRILLO"]);
  }

  return new Set(["SIN_SEXO"]);
}

export function coincideCategoriaFiltro(
  d: Parameters<typeof categoriasDispositivo>[0],
  filtro: Set<string>
): boolean {
  if (filtro.size === 0) return true;
  const cats = categoriasDispositivo(d);
  for (const key of filtro) {
    if (cats.has(key as CategoriaFiltroKey)) return true;
  }
  return false;
}

/** Años disponibles para nacimiento (actual hacia atrás). */
export function listAniosNacimiento(): number[] {
  const max = new Date().getFullYear();
  const years: number[] = [];
  for (let y = max; y >= ANIO_NACIMIENTO_MIN; y--) years.push(y);
  return years;
}
