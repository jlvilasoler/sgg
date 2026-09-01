import type { Db } from "./db/pg-client.js";
import { SIN_EMPRESAS_SCOPE } from "./empresas-cuenta-db.js";

export type StockEmpresaVisibilidadItem = {
  id: number;
  nombre: string;
  codigo: string;
  rut: string;
  dicose: string;
  activo: boolean;
  visible: boolean;
};

export function shouldBypassStockEmpresaVisibilidad(user: {
  rol?: string;
  es_super_admin?: boolean;
  es_admin_plataforma?: boolean;
  es_admin_cuenta?: boolean;
}): boolean {
  if (user.es_super_admin || user.es_admin_plataforma || user.es_admin_cuenta) {
    return true;
  }
  return user.rol === "admin";
}

export async function initUserStockVisibilidadTable(db: Db): Promise<void> {
  // Requiere USERS y EMPRESAS_OPERATIVAS ya creadas.
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS USER_STOCK_EMPRESA_VISIBILIDAD (
        user_id INTEGER NOT NULL REFERENCES USERS(id) ON DELETE CASCADE,
        empresa_operativa_id INTEGER NOT NULL REFERENCES EMPRESAS_OPERATIVAS(id) ON DELETE CASCADE,
        visible INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, empresa_operativa_id)
      )`
    )
    .run();
  try {
    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_user_stock_visib_user
         ON USER_STOCK_EMPRESA_VISIBILIDAD(user_id)`
      )
      .run();
  } catch {
    /* índice opcional */
  }
}

/** IDs de empresas operativas denegadas (opt-out). Vacío = ve todo. */
export async function listDeniedEmpresaOperativaIds(
  db: Db,
  userId: number
): Promise<number[]> {
  const rows = (await db
    .prepare(
      `SELECT empresa_operativa_id AS id
       FROM USER_STOCK_EMPRESA_VISIBILIDAD
       WHERE user_id = ? AND visible = 0`
    )
    .all(userId)) as { id: number }[];
  return rows
    .map((r) => Number(r.id))
    .filter((id) => Number.isFinite(id) && id > 0);
}

async function codigosDeEmpresas(
  db: Db,
  empresaIds: number[]
): Promise<string[]> {
  if (empresaIds.length === 0) return [];
  const placeholders = empresaIds.map(() => "?").join(",");
  const rows = (await db
    .prepare(
      `SELECT codigo FROM EMPRESAS_OPERATIVAS WHERE id IN (${placeholders})`
    )
    .all(...empresaIds)) as { codigo: string }[];
  return rows
    .map((r) => String(r.codigo ?? "").trim().toUpperCase())
    .filter(Boolean);
}

/**
 * Quita del scope de códigos las empresas denegadas al usuario.
 * undefined = sin filtro de empresas (superadmin puro).
 */
export async function applyStockEmpresaVisibilidadToCodigos(
  db: Db,
  user: {
    id: number;
    rol?: string;
    es_super_admin?: boolean;
    es_admin_plataforma?: boolean;
    es_admin_cuenta?: boolean;
  },
  codigos: string[] | undefined
): Promise<string[] | undefined> {
  if (codigos === undefined) return undefined;
  if (shouldBypassStockEmpresaVisibilidad(user)) return codigos;
  if (codigos.length === 1 && codigos[0] === SIN_EMPRESAS_SCOPE) return codigos;

  const deniedIds = await listDeniedEmpresaOperativaIds(db, user.id);
  if (deniedIds.length === 0) return codigos;

  const deniedSet = new Set(await codigosDeEmpresas(db, deniedIds));
  if (deniedSet.size === 0) return codigos;

  const filtered = codigos.filter(
    (c) => !deniedSet.has(String(c ?? "").trim().toUpperCase())
  );
  if (filtered.length === 0) return [SIN_EMPRESAS_SCOPE];
  return filtered;
}

export async function listStockEmpresasVisibilidadForUser(
  db: Db,
  userId: number,
  cuentaId: number
): Promise<StockEmpresaVisibilidadItem[]> {
  const denied = new Set(await listDeniedEmpresaOperativaIds(db, userId));
  const rows = (await db
    .prepare(
      `SELECT id, nombre, codigo, rut, dicose, activo
       FROM EMPRESAS_OPERATIVAS
       WHERE cuenta_id = ?
       ORDER BY LOWER(nombre) ASC`
    )
    .all(cuentaId)) as {
    id: number;
    nombre: string;
    codigo: string;
    rut: string | null;
    dicose: string | null;
    activo: number | boolean;
  }[];

  return rows.map((r) => {
    const id = Number(r.id);
    return {
      id,
      nombre: String(r.nombre ?? ""),
      codigo: String(r.codigo ?? ""),
      rut: String(r.rut ?? ""),
      dicose: String(r.dicose ?? ""),
      activo: Boolean(r.activo),
      visible: !denied.has(id),
    };
  });
}

/**
 * Reemplaza denegadas del usuario. Solo ids de la cuenta indicada.
 * Vacío = vuelve al default (ve todo).
 */
export async function setDeniedEmpresaOperativaIds(
  db: Db,
  userId: number,
  cuentaId: number,
  denegadas: number[]
): Promise<void> {
  const unique = [
    ...new Set(
      denegadas
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n) && n > 0)
    ),
  ];

  let validIds: number[] = [];
  if (unique.length > 0) {
    const placeholders = unique.map(() => "?").join(",");
    const rows = (await db
      .prepare(
        `SELECT id FROM EMPRESAS_OPERATIVAS
         WHERE cuenta_id = ? AND id IN (${placeholders})`
      )
      .all(cuentaId, ...unique)) as { id: number }[];
    validIds = rows.map((r) => Number(r.id));
  }

  await db
    .prepare(`DELETE FROM USER_STOCK_EMPRESA_VISIBILIDAD WHERE user_id = ?`)
    .run(userId);

  for (const empresaId of validIds) {
    await db
      .prepare(
        `INSERT INTO USER_STOCK_EMPRESA_VISIBILIDAD (user_id, empresa_operativa_id, visible)
         VALUES (?, ?, 0)`
      )
      .run(userId, empresaId);
  }
}

type VisibilidadUser = {
  id: number;
  rol?: string;
  es_super_admin?: boolean;
  es_admin_plataforma?: boolean;
  es_admin_cuenta?: boolean;
};

async function deniedEmpresaIdsOfCuenta(
  db: Db,
  userId: number,
  cuentaId: number
): Promise<Set<number>> {
  const denied = await listDeniedEmpresaOperativaIds(db, userId);
  if (denied.length === 0) return new Set();
  const placeholders = denied.map(() => "?").join(",");
  const rows = (await db
    .prepare(
      `SELECT id FROM EMPRESAS_OPERATIVAS
       WHERE cuenta_id = ? AND id IN (${placeholders})`
    )
    .all(cuentaId, ...denied)) as { id: number }[];
  return new Set(rows.map((r) => Number(r.id)));
}

/** Filtra nombres de empresas denegadas al usuario (misma cuenta). */
export async function applyEmpresaVisibilidadToNombres(
  db: Db,
  user: VisibilidadUser,
  cuentaId: number,
  nombres: string[]
): Promise<string[]> {
  if (shouldBypassStockEmpresaVisibilidad(user)) return nombres;
  const deniedIds = await deniedEmpresaIdsOfCuenta(db, user.id, cuentaId);
  if (deniedIds.size === 0) return nombres;
  const placeholders = [...deniedIds].map(() => "?").join(",");
  const rows = (await db
    .prepare(
      `SELECT nombre FROM EMPRESAS_OPERATIVAS
       WHERE cuenta_id = ? AND id IN (${placeholders})`
    )
    .all(cuentaId, ...deniedIds)) as { nombre: string }[];
  const deniedNames = new Set(
    rows.map((r) => String(r.nombre ?? "").trim().toUpperCase()).filter(Boolean)
  );
  if (deniedNames.size === 0) return nombres;
  return nombres.filter(
    (n) => !deniedNames.has(String(n ?? "").trim().toUpperCase())
  );
}

/** Filtra códigos de empresas denegadas al usuario (misma cuenta). */
export async function applyEmpresaVisibilidadToCodigosCuenta(
  db: Db,
  user: VisibilidadUser,
  cuentaId: number,
  codigos: string[]
): Promise<string[]> {
  if (shouldBypassStockEmpresaVisibilidad(user)) return codigos;
  const deniedIds = await deniedEmpresaIdsOfCuenta(db, user.id, cuentaId);
  if (deniedIds.size === 0) return codigos;
  const deniedSet = new Set(await codigosDeEmpresas(db, [...deniedIds]));
  if (deniedSet.size === 0) return codigos;
  return codigos.filter(
    (c) => !deniedSet.has(String(c ?? "").trim().toUpperCase())
  );
}

export async function filterEmpresasOperativasByVisibilidad<
  T extends { id: number },
>(db: Db, user: VisibilidadUser, empresas: T[]): Promise<T[]> {
  if (shouldBypassStockEmpresaVisibilidad(user)) return empresas;
  const denied = new Set(await listDeniedEmpresaOperativaIds(db, user.id));
  if (denied.size === 0) return empresas;
  return empresas.filter((e) => !denied.has(Number(e.id)));
}

export async function userPuedeVerEmpresaOperativa(
  db: Db,
  user: VisibilidadUser,
  empresaOperativaId: number
): Promise<boolean> {
  if (shouldBypassStockEmpresaVisibilidad(user)) return true;
  const denied = await listDeniedEmpresaOperativaIds(db, user.id);
  return !denied.includes(empresaOperativaId);
}

export type EmpresaUsuarioVisibilidadItem = {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
  bypass: boolean;
  visible: boolean;
  /** true = acceso al módulo en esta empresa (default todo true). */
  modulos: Record<string, boolean>;
  avatar?: { tipo: "iniciales" | "foto"; url: string | null } | null;
};

/** Usuarios de la cuenta y si ven esta empresa operativa (opt-out). */
export async function listUsuariosVisibilidadForEmpresa(
  db: Db,
  empresaOperativaId: number,
  cuentaUsers: Array<{
    id: number;
    nombre: string;
    email: string;
    rol: string;
    activo?: boolean;
    es_super_admin?: boolean;
    es_admin_plataforma?: boolean;
    es_admin_cuenta?: boolean;
    avatar?: { tipo: "iniciales" | "foto"; url: string | null } | null;
  }>
): Promise<EmpresaUsuarioVisibilidadItem[]> {
  const deniedRows = (await db
    .prepare(
      `SELECT user_id AS id
       FROM USER_STOCK_EMPRESA_VISIBILIDAD
       WHERE empresa_operativa_id = ? AND visible = 0`
    )
    .all(empresaOperativaId)) as { id: number }[];
  const deniedUsers = new Set(
    deniedRows.map((r) => Number(r.id)).filter((id) => Number.isFinite(id))
  );

  const modDb = await import("./user-empresa-modulo-visibilidad-db.js");
  const deniedMods = await modDb.loadDeniedModulosByUsers(
    db,
    empresaOperativaId,
    cuentaUsers.map((u) => u.id)
  );

  return cuentaUsers.map((u) => {
    const bypass = shouldBypassStockEmpresaVisibilidad(u);
    const visible = bypass || !deniedUsers.has(u.id);
    const modulos = bypass
      ? modDb.emptyModulosMap(true)
      : modDb.modulosMapFromDenied(deniedMods.get(u.id) ?? []);
    return {
      id: u.id,
      nombre: u.nombre,
      email: u.email,
      rol: u.rol,
      activo: u.activo !== false,
      bypass,
      visible,
      modulos,
      avatar: u.avatar ?? { tipo: "iniciales", url: null },
    };
  });
}

/**
 * Define qué usuarios de la cuenta ven esta empresa.
 * Solo acepta user_ids de `cuentaUsers`; admins (bypass) siempre ven todo.
 * Valida que la empresa pertenezca a `cuentaId`.
 * `modulosPorUsuario`: userId → módulos DENEGADOS (opt-out). Solo aplica si el usuario queda visible.
 */
export async function setUsuariosVisiblesForEmpresa(
  db: Db,
  cuentaId: number,
  empresaOperativaId: number,
  visiblesUserIds: number[],
  cuentaUsers: VisibilidadUser[],
  modulosPorUsuario?: Record<string, string[]>
): Promise<void> {
  const emp = (await db
    .prepare(
      `SELECT id FROM EMPRESAS_OPERATIVAS
       WHERE id = ? AND cuenta_id = ?`
    )
    .get(empresaOperativaId, cuentaId)) as { id: number } | undefined;
  if (!emp) {
    throw new Error("La empresa no pertenece a esta cuenta");
  }

  const cuentaIds = new Set(cuentaUsers.map((u) => u.id));
  const visibles = new Set(
    visiblesUserIds
      .map((n) => Number(n))
      .filter((id) => Number.isFinite(id) && id > 0 && cuentaIds.has(id))
  );

  const modDb = await import("./user-empresa-modulo-visibilidad-db.js");

  for (const user of cuentaUsers) {
    if (shouldBypassStockEmpresaVisibilidad(user)) continue;
    const denied = await listDeniedEmpresaOperativaIds(db, user.id);
    const shouldSee = visibles.has(user.id);
    const isDenied = denied.includes(empresaOperativaId);
    if (shouldSee && isDenied) {
      await setDeniedEmpresaOperativaIds(
        db,
        user.id,
        cuentaId,
        denied.filter((id) => id !== empresaOperativaId)
      );
    } else if (!shouldSee && !isDenied) {
      await setDeniedEmpresaOperativaIds(db, user.id, cuentaId, [
        ...denied,
        empresaOperativaId,
      ]);
    }

    if (shouldSee) {
      const rawDenied = modulosPorUsuario?.[String(user.id)] ?? [];
      const denegados = modDb.normalizeEmpresaModuloKeys(rawDenied);
      await modDb.setDeniedModulosForUserEmpresa(
        db,
        user.id,
        empresaOperativaId,
        denegados
      );
    } else {
      // Sin acceso a la empresa: limpia denegaciones de módulo (empresa completa gana).
      await modDb.setDeniedModulosForUserEmpresa(
        db,
        user.id,
        empresaOperativaId,
        []
      );
    }
  }
}
