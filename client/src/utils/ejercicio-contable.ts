/** Ejercicio contable agropecuario. Por defecto Uruguay/IMEBA: 1/7 → 30/6. */

import type { AuthUser } from "../types";

export interface EjercicioContable {
  /** Año calendario en que empieza el ejercicio. Ej.: 2025 → 2025/2026 */
  anioInicio: number;
  label: string;
  desde: string;
  hasta: string;
}

/** Configuración de inicio del ejercicio fiscal (mes 1-12, día 1-31). */
export interface EjercicioConfig {
  inicioMes: number;
  inicioDia: number;
}

export const EJERCICIO_CONFIG_DEFAULT: EjercicioConfig = { inicioMes: 7, inicioDia: 1 };

const DIAS_POR_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Normaliza y valida la configuración (con defaults 1/7). */
export function normalizeEjercicioConfig(
  cfg?: Partial<EjercicioConfig> | null,
): EjercicioConfig {
  let mes = Number(cfg?.inicioMes);
  if (!Number.isFinite(mes) || mes < 1 || mes > 12) mes = EJERCICIO_CONFIG_DEFAULT.inicioMes;
  mes = Math.floor(mes);
  let dia = Number(cfg?.inicioDia);
  if (!Number.isFinite(dia) || dia < 1) dia = EJERCICIO_CONFIG_DEFAULT.inicioDia;
  dia = Math.floor(dia);
  const maxDia = DIAS_POR_MES[mes - 1];
  if (dia > maxDia) dia = maxDia;
  return { inicioMes: mes, inicioDia: dia };
}

/** Configuración del ejercicio a partir del usuario logueado (cuenta). */
export function ejercicioConfigFromUser(
  user: Pick<AuthUser, "ejercicio_inicio_mes" | "ejercicio_inicio_dia"> | null | undefined,
): EjercicioConfig {
  return normalizeEjercicioConfig({
    inicioMes: user?.ejercicio_inicio_mes,
    inicioDia: user?.ejercicio_inicio_dia,
  });
}

/** Año de inicio del ejercicio vigente según la fecha de referencia. */
export function anioInicioEjercicioVigente(
  ref: Date = new Date(),
  cfg?: Partial<EjercicioConfig> | null,
): number {
  const { inicioMes, inicioDia } = normalizeEjercicioConfig(cfg);
  const inicioEsteAnio = new Date(ref.getFullYear(), inicioMes - 1, inicioDia);
  return ref < inicioEsteAnio ? ref.getFullYear() - 1 : ref.getFullYear();
}

export function ejercicioDesdeHasta(
  anioInicio: number,
  cfg?: Partial<EjercicioConfig> | null,
): { desde: string; hasta: string } {
  const { inicioMes, inicioDia } = normalizeEjercicioConfig(cfg);
  const desde = `${anioInicio}-${pad2(inicioMes)}-${pad2(inicioDia)}`;
  const fin = new Date(anioInicio + 1, inicioMes - 1, inicioDia);
  fin.setDate(fin.getDate() - 1);
  const hasta = `${fin.getFullYear()}-${pad2(fin.getMonth() + 1)}-${pad2(fin.getDate())}`;
  return { desde, hasta };
}

function labelDesdeIso(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}/${m}/${y}`;
}

export function labelEjercicio(
  anioInicio: number,
  cfg?: Partial<EjercicioConfig> | null,
): string {
  const { desde, hasta } = ejercicioDesdeHasta(anioInicio, cfg);
  return `${labelDesdeIso(desde)} al ${labelDesdeIso(hasta)}`;
}

export function ejercicioVigente(
  ref: Date = new Date(),
  cfg?: Partial<EjercicioConfig> | null,
): EjercicioContable {
  const config = normalizeEjercicioConfig(cfg);
  const anioInicio = anioInicioEjercicioVigente(ref, config);
  const { desde, hasta } = ejercicioDesdeHasta(anioInicio, config);
  return { anioInicio, label: labelEjercicio(anioInicio, config), desde, hasta };
}

export function listarEjerciciosContables(opts?: {
  cantidadAtras?: number;
  cantidadAdelante?: number;
  ref?: Date;
  cfg?: Partial<EjercicioConfig> | null;
}): EjercicioContable[] {
  const cantidadAtras = opts?.cantidadAtras ?? 6;
  const cantidadAdelante = opts?.cantidadAdelante ?? 1;
  const config = normalizeEjercicioConfig(opts?.cfg);
  const vigente = anioInicioEjercicioVigente(opts?.ref, config);
  const list: EjercicioContable[] = [];
  for (let y = vigente + cantidadAdelante; y >= vigente - cantidadAtras; y--) {
    const { desde, hasta } = ejercicioDesdeHasta(y, config);
    list.push({ anioInicio: y, label: labelEjercicio(y, config), desde, hasta });
  }
  return list;
}

export function esEjercicioVigente(
  anioInicio: number,
  ref: Date = new Date(),
  cfg?: Partial<EjercicioConfig> | null,
): boolean {
  return anioInicio === anioInicioEjercicioVigente(ref, cfg);
}
