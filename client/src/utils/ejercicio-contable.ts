/** Ejercicio contable agropecuario (Uruguay/IMEBA): 1/7 → 30/6. */

export interface EjercicioContable {
  /** Año calendario en que empieza el ejercicio (julio). Ej.: 2025 → 2025/2026 */
  anioInicio: number;
  label: string;
  desde: string;
  hasta: string;
}

/** Año de inicio del ejercicio vigente según la fecha de referencia. */
export function anioInicioEjercicioVigente(ref: Date = new Date()): number {
  return ref.getMonth() < 6 ? ref.getFullYear() - 1 : ref.getFullYear();
}

export function ejercicioDesdeHasta(anioInicio: number): { desde: string; hasta: string } {
  return {
    desde: `${anioInicio}-07-01`,
    hasta: `${anioInicio + 1}-06-30`,
  };
}

export function labelEjercicio(anioInicio: number): string {
  return `1/7/${anioInicio} al 30/6/${anioInicio + 1}`;
}

export function ejercicioVigente(ref: Date = new Date()): EjercicioContable {
  const anioInicio = anioInicioEjercicioVigente(ref);
  const { desde, hasta } = ejercicioDesdeHasta(anioInicio);
  return { anioInicio, label: labelEjercicio(anioInicio), desde, hasta };
}

export function listarEjerciciosContables(opts?: {
  cantidadAtras?: number;
  cantidadAdelante?: number;
  ref?: Date;
}): EjercicioContable[] {
  const cantidadAtras = opts?.cantidadAtras ?? 6;
  const cantidadAdelante = opts?.cantidadAdelante ?? 1;
  const vigente = anioInicioEjercicioVigente(opts?.ref);
  const list: EjercicioContable[] = [];
  for (let y = vigente + cantidadAdelante; y >= vigente - cantidadAtras; y--) {
    const { desde, hasta } = ejercicioDesdeHasta(y);
    list.push({ anioInicio: y, label: labelEjercicio(y), desde, hasta });
  }
  return list;
}

export function esEjercicioVigente(anioInicio: number, ref: Date = new Date()): boolean {
  return anioInicio === anioInicioEjercicioVigente(ref);
}
