import type { Db } from "./db/pg-client.js";
import { shouldBypassStockEmpresaVisibilidad } from "./user-stock-visibilidad-db.js";

/**
 * Claves de acceso por empresa (más granulares que Modulo de rol).
 * stock_* se separan aunque el rol use el módulo único "stock".
 */
export const EMPRESA_MODULOS = [
  "presupuesto", // Contabilidad / presupuesto y gastos
  "stock_ganadero",
  "stock_equino",
  "stock_ovino",
  "campo_mapa",
  "tareas_operativas",
  "ventas",
  "rrhh",
  "divisas",
  "precios_ganado",
  "simulador_venta_ganado",
] as const;

export type EmpresaModuloKey = (typeof EMPRESA_MODULOS)[number];

export const EMPRESA_MODULO_LABELS: Record<EmpresaModuloKey, string> = {
  presupuesto: "Contabilidad",
  stock_ganadero: "Stock ganadero",
  stock_equino: "Stock equino",
  stock_ovino: "Stock ovino",
  campo_mapa: "Mapa del campo",
  tareas_operativas: "Tareas operativas",
  ventas: "Ingresos por ventas",
  rrhh: "Recursos Humanos",
  divisas: "Divisas",
  precios_ganado: "Precios de Ganado",
  simulador_venta_ganado: "Simulador de ventas",
};

export function isEmpresaModuloKey(value: unknown): value is EmpresaModuloKey {
  return (
    typeof value === "string" &&
    (EMPRESA_MODULOS as readonly string[]).includes(value)
  );
}

export function normalizeEmpresaModuloKeys(raw: unknown): EmpresaModuloKey[] {
  if (!Array.isArray(raw)) return [];
  const out: EmpresaModuloKey[] = [];
  for (const item of raw) {
    if (isEmpresaModuloKey(item) && !out.includes(item)) out.push(item);
  }
  return out;
}

/** Mapea path de API → clave de acceso por empresa. */
export function empresaModuloFromApiPath(path: string): EmpresaModuloKey | null {
  const p = path.toLowerCase();
  if (
    p.startsWith("/api/presupuesto") ||
    p.startsWith("/api/resumen") ||
    p.startsWith("/api/vencimientos-impuestos") ||
    p.startsWith("/api/catalogos") ||
    p.startsWith("/api/empresas-operativas")
  ) {
    return "presupuesto";
  }
  if (p.startsWith("/api/stock-ganadero")) return "stock_ganadero";
  if (p.startsWith("/api/stock-equino")) return "stock_equino";
  if (p.startsWith("/api/stock-ovino")) return "stock_ovino";
  if (
    p.startsWith("/api/campo-potreros") ||
    p.startsWith("/api/campo-mapa-elementos")
  ) {
    return "campo_mapa";
  }
  if (p.startsWith("/api/operativa-tareas")) return "tareas_operativas";
  if (
    p.startsWith("/api/ingresos-ventas") ||
    p.startsWith("/api/venta-sub-rubros") ||
    p.startsWith("/api/venta-sub-rubro-items") ||
    p.startsWith("/api/venta-grupo-iconos")
  ) {
    return "ventas";
  }
  if (p.startsWith("/api/funcionarios") || p.startsWith("/api/rrhh")) return "rrhh";
  if (p.startsWith("/api/divisas")) return "divisas";
  if (p.startsWith("/api/precios-ganado")) return "precios_ganado";
  if (p.startsWith("/api/simulador-venta-ganado")) return "simulador_venta_ganado";
  // Configuración y Asistente: siempre disponibles (no se restringen por empresa).
  return null;
}

type VisibilidadUser = {
  id: number;
  rol?: string;
  es_super_admin?: boolean;
  es_admin_plataforma?: boolean;
  es_admin_cuenta?: boolean;
};

export async function initUserEmpresaModuloVisibilidadTable(db: Db): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS USER_EMPRESA_MODULO_VISIBILIDAD (
        user_id INTEGER NOT NULL REFERENCES USERS(id) ON DELETE CASCADE,
        empresa_operativa_id INTEGER NOT NULL REFERENCES EMPRESAS_OPERATIVAS(id) ON DELETE CASCADE,
        modulo TEXT NOT NULL,
        visible INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, empresa_operativa_id, modulo)
      )`
    )
    .run();
  try {
    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_user_emp_mod_visib_user
         ON USER_EMPRESA_MODULO_VISIBILIDAD(user_id)`
      )
      .run();
  } catch {
    /* índice opcional */
  }
}

export async function listDeniedModulosForUserEmpresa(
  db: Db,
  userId: number,
  empresaOperativaId: number
): Promise<EmpresaModuloKey[]> {
  const rows = (await db
    .prepare(
      `SELECT modulo
       FROM USER_EMPRESA_MODULO_VISIBILIDAD
       WHERE user_id = ? AND empresa_operativa_id = ? AND visible = 0`
    )
    .all(userId, empresaOperativaId)) as { modulo: string }[];
  return normalizeEmpresaModuloKeys(rows.map((r) => r.modulo));
}

export async function listAllDeniedModulosForUser(
  db: Db,
  userId: number
): Promise<Array<{ empresa_id: number; modulo: EmpresaModuloKey }>> {
  const rows = (await db
    .prepare(
      `SELECT empresa_operativa_id AS empresa_id, modulo
       FROM USER_EMPRESA_MODULO_VISIBILIDAD
       WHERE user_id = ? AND visible = 0`
    )
    .all(userId)) as { empresa_id: number; modulo: string }[];
  const out: Array<{ empresa_id: number; modulo: EmpresaModuloKey }> = [];
  for (const r of rows) {
    if (!isEmpresaModuloKey(r.modulo)) continue;
    out.push({ empresa_id: Number(r.empresa_id), modulo: r.modulo });
  }
  return out;
}

export function emptyModulosMap(allVisible = true): Record<EmpresaModuloKey, boolean> {
  const map = {} as Record<EmpresaModuloKey, boolean>;
  for (const key of EMPRESA_MODULOS) map[key] = allVisible;
  return map;
}

export function modulosMapFromDenied(
  denied: EmpresaModuloKey[]
): Record<EmpresaModuloKey, boolean> {
  const deniedSet = new Set(denied);
  const map = {} as Record<EmpresaModuloKey, boolean>;
  for (const key of EMPRESA_MODULOS) map[key] = !deniedSet.has(key);
  return map;
}

/**
 * Reemplaza denegaciones de módulos para (user, empresa).
 * Solo acepta claves válidas. Vacío = todos los módulos habilitados.
 */
export async function setDeniedModulosForUserEmpresa(
  db: Db,
  userId: number,
  empresaOperativaId: number,
  denegados: EmpresaModuloKey[]
): Promise<void> {
  const unique = normalizeEmpresaModuloKeys(denegados);
  await db
    .prepare(
      `DELETE FROM USER_EMPRESA_MODULO_VISIBILIDAD
       WHERE user_id = ? AND empresa_operativa_id = ?`
    )
    .run(userId, empresaOperativaId);
  for (const modulo of unique) {
    await db
      .prepare(
        `INSERT INTO USER_EMPRESA_MODULO_VISIBILIDAD
          (user_id, empresa_operativa_id, modulo, visible)
         VALUES (?, ?, ?, 0)`
      )
      .run(userId, empresaOperativaId, modulo);
  }
}

export async function userPuedeModuloEnEmpresa(
  db: Db,
  user: VisibilidadUser,
  empresaOperativaId: number,
  modulo: EmpresaModuloKey
): Promise<boolean> {
  if (shouldBypassStockEmpresaVisibilidad(user)) return true;
  const denied = await listDeniedModulosForUserEmpresa(db, user.id, empresaOperativaId);
  return !denied.includes(modulo);
}

/**
 * Quita nombres de empresas donde el usuario tiene denegado el módulo.
 * Si empresa completa ya está fuera del scope, no cambia nada.
 */
export async function applyModuloVisibilidadToNombres(
  db: Db,
  user: VisibilidadUser,
  cuentaId: number,
  nombres: string[],
  modulo: EmpresaModuloKey
): Promise<string[]> {
  if (shouldBypassStockEmpresaVisibilidad(user)) return nombres;
  if (nombres.length === 0) return nombres;

  const deniedEmpresas = (await db
    .prepare(
      `SELECT eo.nombre
       FROM USER_EMPRESA_MODULO_VISIBILIDAD m
       INNER JOIN EMPRESAS_OPERATIVAS eo ON eo.id = m.empresa_operativa_id
       WHERE m.user_id = ?
         AND m.modulo = ?
         AND m.visible = 0
         AND eo.cuenta_id = ?`
    )
    .all(user.id, modulo, cuentaId)) as { nombre: string }[];

  if (deniedEmpresas.length === 0) return nombres;
  const denied = new Set(
    deniedEmpresas.map((r) => String(r.nombre ?? "").trim().toUpperCase()).filter(Boolean)
  );
  return nombres.filter((n) => !denied.has(String(n ?? "").trim().toUpperCase()));
}

export async function applyModuloVisibilidadToCodigos(
  db: Db,
  user: VisibilidadUser,
  cuentaId: number,
  codigos: string[],
  modulo: EmpresaModuloKey
): Promise<string[]> {
  if (shouldBypassStockEmpresaVisibilidad(user)) return codigos;
  if (codigos.length === 0) return codigos;

  const deniedEmpresas = (await db
    .prepare(
      `SELECT eo.codigo
       FROM USER_EMPRESA_MODULO_VISIBILIDAD m
       INNER JOIN EMPRESAS_OPERATIVAS eo ON eo.id = m.empresa_operativa_id
       WHERE m.user_id = ?
         AND m.modulo = ?
         AND m.visible = 0
         AND eo.cuenta_id = ?`
    )
    .all(user.id, modulo, cuentaId)) as { codigo: string }[];

  if (deniedEmpresas.length === 0) return codigos;
  const denied = new Set(
    deniedEmpresas
      .map((r) => String(r.codigo ?? "").trim().toUpperCase())
      .filter(Boolean)
  );
  return codigos.filter((c) => !denied.has(String(c ?? "").trim().toUpperCase()));
}

export async function loadDeniedModulosByUsers(
  db: Db,
  empresaOperativaId: number,
  userIds: number[]
): Promise<Map<number, EmpresaModuloKey[]>> {
  const map = new Map<number, EmpresaModuloKey[]>();
  if (userIds.length === 0) return map;
  const placeholders = userIds.map(() => "?").join(",");
  const rows = (await db
    .prepare(
      `SELECT user_id, modulo
       FROM USER_EMPRESA_MODULO_VISIBILIDAD
       WHERE empresa_operativa_id = ?
         AND visible = 0
         AND user_id IN (${placeholders})`
    )
    .all(empresaOperativaId, ...userIds)) as { user_id: number; modulo: string }[];

  for (const r of rows) {
    if (!isEmpresaModuloKey(r.modulo)) continue;
    const uid = Number(r.user_id);
    const list = map.get(uid) ?? [];
    list.push(r.modulo);
    map.set(uid, list);
  }
  return map;
}
