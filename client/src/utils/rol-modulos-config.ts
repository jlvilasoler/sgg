import type { Modulo, Rol, RolPermisosConfig, RolPermisosInput } from "../types";
import { MODULOS_SOLO_ADMIN } from "./auth-permissions";

/** Secciones del menú que el superadmin puede asignar por tipo de cuenta. */
export const MODULOS_CONFIGURABLES = [
  "presupuesto",
  "configuracion",
  "divisas",
  "precios_ganado",
  "simulador_venta_ganado",
  "rrhh",
  "ventas",
  "stock",
  "asistente",
] as const satisfies readonly Modulo[];

export type ModuloConfigurable = (typeof MODULOS_CONFIGURABLES)[number];

/** Siempre habilitado — no configurable. */
export const MODULO_TODOS: Modulo = "chat";

export type ModoEdicionModulo = "lectura" | "edicion";

export const MODULO_PERMISO_HINTS: Record<ModuloConfigurable, string> = {
  presupuesto: "Gastos, listados, resumen y vencimientos impositivos.",
  configuracion: "Proveedores, rubros, catálogos y parámetros operativos.",
  divisas: "Cotizaciones y tipos de cambio.",
  precios_ganado: "Referencias y tablas de precios del ganado.",
  simulador_venta_ganado: "Simulaciones de venta y escenarios.",
  rrhh: "Personal, sueldos y nómina.",
  ventas: "Ingresos por ventas, arrendamientos y agricultura.",
  stock: "Stock ganadero y equino, potreros y movimientos.",
  asistente: "Consultas rápidas sobre stock, gastos, precios y cotizaciones.",
};

export function isModuloSoloAdmin(modulo: Modulo): boolean {
  return MODULOS_SOLO_ADMIN.includes(modulo);
}

export function rolPermisosToInput(config: RolPermisosConfig): RolPermisosInput {
  const modulos: Partial<Record<Modulo, boolean>> = {};
  const modulos_solo_lectura: Partial<Record<Modulo, boolean>> = {};
  for (const m of config.modulos) {
    if (m.modulo === MODULO_TODOS) continue;
    // Admin: solo se edita Asistente; el resto se ignora en el draft.
    if (config.rol === "admin") {
      if (m.modulo === "asistente") modulos.asistente = m.acceso;
      continue;
    }
    if (isModuloSoloAdmin(m.modulo)) continue;
    modulos[m.modulo] = m.acceso;
    if (m.solo_lectura) modulos_solo_lectura[m.modulo] = true;
  }
  return {
    puede_escribir: config.puede_escribir,
    modulos,
    modulos_solo_lectura,
  };
}

export function isModuloHabilitado(draft: RolPermisosInput, modulo: Modulo): boolean {
  return Boolean(draft.modulos[modulo]);
}

export function modoEdicionModulo(
  draft: RolPermisosInput,
  rol: Rol,
  modulo: Modulo,
): ModoEdicionModulo {
  if (rol === "consulta" || !draft.puede_escribir) return "lectura";
  if (draft.modulos_solo_lectura?.[modulo]) return "lectura";
  return "edicion";
}

export function modoEdicionModuloLabel(modo: ModoEdicionModulo): string {
  return modo === "edicion" ? "Ver y editar" : "Solo lectura";
}

export function countModulosHabilitados(
  draft: RolPermisosInput | null | undefined,
  rol?: Rol,
): number {
  if (rol === "admin") {
    const base = MODULOS_CONFIGURABLES.length - 1 + MODULOS_SOLO_ADMIN.length;
    const asistenteOn = draft ? isModuloHabilitado(draft, "asistente") : true;
    return base + (asistenteOn ? 1 : 0);
  }
  if (!draft) return 0;
  return MODULOS_CONFIGURABLES.filter((m) => isModuloHabilitado(draft, m)).length;
}

export function toggleModuloPermiso(
  draft: RolPermisosInput,
  rol: Rol,
  modulo: Modulo,
  activo: boolean,
): RolPermisosInput {
  if (modulo === MODULO_TODOS) return draft;
  // Superadmin: único permiso editable del Administrador = Asistente.
  if (rol === "admin") {
    if (modulo !== "asistente") return draft;
    return {
      ...draft,
      modulos: { ...draft.modulos, asistente: activo },
      modulos_solo_lectura: { ...draft.modulos_solo_lectura, asistente: false },
    };
  }
  if (isModuloSoloAdmin(modulo)) return draft;
  if (activo) {
    const modo: ModoEdicionModulo =
      rol === "consulta" || !draft.puede_escribir ? "lectura" : "edicion";
    return {
      ...draft,
      modulos: { ...draft.modulos, [modulo]: true },
      modulos_solo_lectura: {
        ...draft.modulos_solo_lectura,
        [modulo]: modo === "lectura",
      },
    };
  }
  return {
    ...draft,
    modulos: { ...draft.modulos, [modulo]: false },
  };
}

export function setModoEdicionModulo(
  draft: RolPermisosInput,
  modulo: Modulo,
  modo: ModoEdicionModulo,
): RolPermisosInput {
  return {
    ...draft,
    modulos_solo_lectura: {
      ...draft.modulos_solo_lectura,
      [modulo]: modo === "lectura",
    },
  };
}

export function marcarTodosModulosPermiso(draft: RolPermisosInput, rol: Rol): RolPermisosInput {
  const modo: ModoEdicionModulo =
    rol === "consulta" || !draft.puede_escribir ? "lectura" : "edicion";
  const modulos: Partial<Record<Modulo, boolean>> = { ...draft.modulos };
  const modulos_solo_lectura: Partial<Record<Modulo, boolean>> = {
    ...draft.modulos_solo_lectura,
  };
  for (const modulo of MODULOS_CONFIGURABLES) {
    modulos[modulo] = true;
    modulos_solo_lectura[modulo] = modo === "lectura";
  }
  return { ...draft, modulos, modulos_solo_lectura };
}

export function desmarcarTodosModulosPermiso(draft: RolPermisosInput): RolPermisosInput {
  const modulos: Partial<Record<Modulo, boolean>> = { ...draft.modulos };
  for (const modulo of MODULOS_CONFIGURABLES) {
    modulos[modulo] = false;
  }
  return { ...draft, modulos };
}
