import type { Db } from "./db/pg-client.js";
import * as authDb from "./auth-db.js";
import * as empresasCuenta from "./empresas-cuenta-db.js";

export const NOTA_COLORES = ["default", "yellow", "green", "blue", "pink", "purple"] as const;
export type NotaColor = (typeof NOTA_COLORES)[number];

export interface NotaCompartido {
  id: number;
  nombre: string;
}

export interface NotaRow {
  id: number;
  usuario_id: number;
  cuenta_id: number | null;
  titulo: string;
  contenido: string;
  fijada: boolean;
  compartida: boolean;
  color: NotaColor;
  autor_nombre: string;
  compartidos_con: NotaCompartido[];
  creado_en: string;
  actualizado_en: string;
}

export interface NotaInput {
  titulo?: string;
  contenido?: string;
  fijada?: boolean;
  compartida?: boolean;
  compartidos_con?: number[];
  color?: string;
}

const NOTA_SELECT = `SELECT n.id, n.usuario_id, n.cuenta_id, n.titulo, n.contenido, n.fijada,
  n.compartida, n.color, n.creado_en, n.actualizado_en, u.nombre AS autor_nombre`;

const NOTA_FROM = `FROM NOTAS n JOIN USERS u ON u.id = n.usuario_id`;

const NOTA_VISIBLE_WHERE = `(
  n.usuario_id = ?
  OR EXISTS (
    SELECT 1 FROM NOTAS_COMPARTIDAS nc
    WHERE nc.nota_id = n.id AND nc.usuario_id = ?
  )
)`;

function isValidColor(value: string): value is NotaColor {
  return (NOTA_COLORES as readonly string[]).includes(value);
}

function rowToNotaBase(row: Record<string, unknown>): Omit<NotaRow, "compartidos_con"> {
  const colorRaw = String(row.color ?? "default");
  return {
    id: Number(row.id),
    usuario_id: Number(row.usuario_id),
    cuenta_id: row.cuenta_id != null ? Number(row.cuenta_id) : null,
    titulo: String(row.titulo ?? ""),
    contenido: String(row.contenido ?? ""),
    fijada: Number(row.fijada ?? 0) === 1,
    compartida: Number(row.compartida ?? 0) === 1,
    color: isValidColor(colorRaw) ? colorRaw : "default",
    autor_nombre: String(row.autor_nombre ?? "").trim(),
    creado_en: String(row.creado_en ?? ""),
    actualizado_en: String(row.actualizado_en ?? ""),
  };
}

export function tituloDesdeContenido(titulo: string, contenido: string): string {
  const t = titulo.trim();
  if (t) return t.slice(0, 200);
  const first = contenido
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find(Boolean);
  return (first ?? "").slice(0, 200);
}

async function notasColumnExists(db: Db, column: string): Promise<boolean> {
  const row = (await db
    .prepare(
      `SELECT 1 AS ok FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'notas' AND column_name = @col
       LIMIT 1`
    )
    .get({ col: column.toLowerCase() })) as { ok: number } | undefined;
  return row != null;
}

async function notasCompartidasTableExists(db: Db): Promise<boolean> {
  const row = (await db
    .prepare(
      `SELECT 1 AS ok FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'notas_compartidas'
       LIMIT 1`
    )
    .get()) as { ok: number } | undefined;
  return row != null;
}

async function listUsuarioIdsCuenta(db: Db, cuentaId: number): Promise<number[]> {
  const cuenta = await empresasCuenta.getEmpresaCuentaById(db, cuentaId);
  const users = await authDb.listUsers(db, {
    empresa_id: cuentaId,
    incluir_admin_id: cuenta?.admin_user_id ?? null,
  });
  return users.map((u) => u.id);
}

async function normalizeCompartidosIds(
  db: Db,
  ownerId: number,
  cuentaId: number | null,
  raw: number[] | undefined,
  compartidaFlag: boolean
): Promise<number[]> {
  if (!raw?.length) {
    if (compartidaFlag) {
      throw new Error("Seleccioná al menos un usuario del equipo para compartir la nota.");
    }
    return [];
  }
  if (cuentaId == null) {
    throw new Error("No se pudo compartir la nota: tu usuario no está asociado a una cuenta.");
  }
  const allowed = new Set(await listUsuarioIdsCuenta(db, cuentaId));
  allowed.delete(ownerId);
  const unique: number[] = [];
  const seen = new Set<number>();
  for (const id of raw) {
    const uid = Number(id);
    if (!Number.isFinite(uid) || uid === ownerId || !allowed.has(uid) || seen.has(uid)) continue;
    seen.add(uid);
    unique.push(uid);
  }
  if (!unique.length) {
    throw new Error("Seleccioná usuarios válidos de tu equipo para compartir la nota.");
  }
  return unique;
}

async function loadCompartidosMap(
  db: Db,
  notaIds: number[]
): Promise<Map<number, NotaCompartido[]>> {
  const map = new Map<number, NotaCompartido[]>();
  if (!notaIds.length) return map;
  const placeholders = notaIds.map(() => "?").join(", ");
  const rows = (await db
    .prepare(
      `SELECT nc.nota_id, u.id AS usuario_id, u.nombre
       FROM NOTAS_COMPARTIDAS nc
       JOIN USERS u ON u.id = nc.usuario_id
       WHERE nc.nota_id IN (${placeholders})
       ORDER BY LOWER(u.nombre) ASC`
    )
    .all(...notaIds)) as Array<Record<string, unknown>>;
  for (const row of rows) {
    const notaId = Number(row.nota_id);
    const item: NotaCompartido = {
      id: Number(row.usuario_id),
      nombre: String(row.nombre ?? "").trim() || "Usuario",
    };
    const list = map.get(notaId) ?? [];
    list.push(item);
    map.set(notaId, list);
  }
  return map;
}

async function attachCompartidos(db: Db, rows: Record<string, unknown>[]): Promise<NotaRow[]> {
  const bases = rows.map(rowToNotaBase);
  const map = await loadCompartidosMap(
    db,
    bases.map((n) => n.id)
  );
  return bases.map((base) => ({
    ...base,
    compartidos_con: map.get(base.id) ?? [],
  }));
}

async function syncNotaCompartidos(
  db: Db,
  notaId: number,
  usuarioIds: number[]
): Promise<void> {
  await db.prepare("DELETE FROM NOTAS_COMPARTIDAS WHERE nota_id = ?").run(notaId);
  if (!usuarioIds.length) return;
  const ins = db.prepare(
    `INSERT INTO NOTAS_COMPARTIDAS (nota_id, usuario_id) VALUES (?, ?)`
  );
  for (const uid of usuarioIds) {
    await ins.run(notaId, uid);
  }
}

async function migrateLegacyCompartidasCuenta(db: Db): Promise<void> {
  const legacy = (await db
    .prepare(
      `SELECT n.id, n.usuario_id, n.cuenta_id
       FROM NOTAS n
       WHERE n.compartida = 1
         AND n.cuenta_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM NOTAS_COMPARTIDAS nc WHERE nc.nota_id = n.id)`
    )
    .all()) as Array<{ id: number; usuario_id: number; cuenta_id: number }>;

  for (const row of legacy) {
    const teamIds = (await listUsuarioIdsCuenta(db, row.cuenta_id)).filter(
      (id) => id !== row.usuario_id
    );
    await syncNotaCompartidos(db, row.id, teamIds);
  }
  if (legacy.length) {
    console.info(
      `[SGG] Migración: ${legacy.length} nota(s) compartida(s) migradas a destinatarios por cuenta`
    );
  }
}

export async function initNotasTable(db: Db): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS NOTAS (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES USERS(id) ON DELETE CASCADE,
      cuenta_id INTEGER REFERENCES EMPRESAS_CUENTA(id) ON DELETE SET NULL,
      titulo TEXT NOT NULL DEFAULT '',
      contenido TEXT NOT NULL DEFAULT '',
      fijada INTEGER NOT NULL DEFAULT 0,
      compartida INTEGER NOT NULL DEFAULT 0,
      color TEXT NOT NULL DEFAULT 'default'
        CHECK (color IN ('default', 'yellow', 'green', 'blue', 'pink', 'purple')),
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  if (!(await notasColumnExists(db, "compartida"))) {
    await db.prepare("ALTER TABLE NOTAS ADD COLUMN compartida INTEGER NOT NULL DEFAULT 0").run();
    console.info("[SGG] Migración: columna compartida agregada a NOTAS");
  }

  await db.exec(`
    CREATE TABLE IF NOT EXISTS NOTAS_COMPARTIDAS (
      nota_id INTEGER NOT NULL REFERENCES NOTAS(id) ON DELETE CASCADE,
      usuario_id INTEGER NOT NULL REFERENCES USERS(id) ON DELETE CASCADE,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (nota_id, usuario_id)
    )
  `);
  await db.exec(
    `CREATE INDEX IF NOT EXISTS idx_notas_compartidas_usuario
     ON NOTAS_COMPARTIDAS(usuario_id, nota_id)`
  );

  await db.exec(
    `CREATE INDEX IF NOT EXISTS idx_notas_usuario_actualizado
     ON NOTAS(usuario_id, fijada DESC, actualizado_en DESC)`
  );

  if (await notasCompartidasTableExists(db)) {
    await migrateLegacyCompartidasCuenta(db);
  }
}

export async function listNotasVisibles(
  db: Db,
  usuarioId: number,
  _cuentaId: number | null,
  limit?: number
): Promise<NotaRow[]> {
  const capped =
    limit != null && Number.isFinite(limit) && limit > 0
      ? Math.min(Math.floor(limit), 50)
      : null;
  const rows = (await db
    .prepare(
      `${NOTA_SELECT}
       ${NOTA_FROM}
       WHERE ${NOTA_VISIBLE_WHERE}
       ORDER BY n.fijada DESC, n.actualizado_en DESC, n.id DESC${
         capped != null ? ` LIMIT ${capped}` : ""
       }`
    )
    .all(usuarioId, usuarioId)) as Record<string, unknown>[];
  return await attachCompartidos(db, rows);
}

export async function getNotaVisible(
  db: Db,
  id: number,
  usuarioId: number,
  _cuentaId: number | null
): Promise<NotaRow | null> {
  const row = (await db
    .prepare(
      `${NOTA_SELECT}
       ${NOTA_FROM}
       WHERE n.id = ? AND ${NOTA_VISIBLE_WHERE}`
    )
    .get(id, usuarioId, usuarioId)) as Record<string, unknown> | undefined;
  if (!row) return null;
  const [nota] = await attachCompartidos(db, [row]);
  return nota ?? null;
}

export async function getNotaPropia(db: Db, id: number, usuarioId: number): Promise<NotaRow | null> {
  const row = (await db
    .prepare(
      `${NOTA_SELECT}
       ${NOTA_FROM}
       WHERE n.id = ? AND n.usuario_id = ?`
    )
    .get(id, usuarioId)) as Record<string, unknown> | undefined;
  if (!row) return null;
  const [nota] = await attachCompartidos(db, [row]);
  return nota ?? null;
}

export async function createNota(
  db: Db,
  usuarioId: number,
  cuentaId: number | null,
  input: NotaInput
): Promise<NotaRow> {
  const contenido = String(input.contenido ?? "");
  const titulo = tituloDesdeContenido(String(input.titulo ?? ""), contenido);
  const fijada = input.fijada ? 1 : 0;
  const colorRaw = String(input.color ?? "default");
  const color = isValidColor(colorRaw) ? colorRaw : "default";

  const wantsShare =
    input.compartidos_con !== undefined
      ? (input.compartidos_con?.length ?? 0) > 0
      : Boolean(input.compartida);
  const compartidos = await normalizeCompartidosIds(
    db,
    usuarioId,
    cuentaId,
    input.compartidos_con,
    wantsShare && input.compartidos_con === undefined
  );
  const compartida = compartidos.length > 0 ? 1 : 0;

  const ins = await db
    .prepare(
      `INSERT INTO NOTAS (usuario_id, cuenta_id, titulo, contenido, fijada, compartida, color)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(usuarioId, cuentaId, titulo, contenido, fijada, compartida, color);

  const notaId = Number(ins.lastInsertRowid);
  await syncNotaCompartidos(db, notaId, compartidos);

  const created = await getNotaPropia(db, notaId, usuarioId);
  if (!created) throw new Error("No se pudo crear la nota.");
  return created;
}

export async function updateNota(
  db: Db,
  id: number,
  usuarioId: number,
  cuentaId: number | null,
  input: NotaInput
): Promise<NotaRow> {
  const prev = await getNotaPropia(db, id, usuarioId);
  if (!prev) throw new Error("Solo podés editar tus propias notas.");

  const contenido = input.contenido !== undefined ? String(input.contenido) : prev.contenido;
  const titulo =
    input.titulo !== undefined
      ? tituloDesdeContenido(String(input.titulo), contenido)
      : tituloDesdeContenido(prev.titulo, contenido);
  const fijada = input.fijada !== undefined ? (input.fijada ? 1 : 0) : prev.fijada ? 1 : 0;
  const colorRaw = input.color !== undefined ? String(input.color) : prev.color;
  const color = isValidColor(colorRaw) ? colorRaw : prev.color;

  let compartidos = prev.compartidos_con.map((u) => u.id);
  if (input.compartidos_con !== undefined) {
    compartidos = await normalizeCompartidosIds(db, usuarioId, cuentaId, input.compartidos_con, false);
  } else if (input.compartida === false) {
    compartidos = [];
  } else if (input.compartida === true && !compartidos.length) {
    throw new Error("Seleccioná al menos un usuario del equipo para compartir la nota.");
  }

  const compartida = compartidos.length > 0 ? 1 : 0;

  await db
    .prepare(
      `UPDATE NOTAS SET
         titulo = ?,
         contenido = ?,
         fijada = ?,
         compartida = ?,
         color = ?,
         cuenta_id = COALESCE(cuenta_id, ?),
         actualizado_en = NOW()
       WHERE id = ? AND usuario_id = ?`
    )
    .run(titulo, contenido, fijada, compartida, color, cuentaId, id, usuarioId);

  await syncNotaCompartidos(db, id, compartidos);

  const updated = await getNotaPropia(db, id, usuarioId);
  if (!updated) throw new Error("No se pudo actualizar la nota.");
  return updated;
}

export async function deleteNota(db: Db, id: number, usuarioId: number): Promise<void> {
  const r = await db.prepare("DELETE FROM NOTAS WHERE id = ? AND usuario_id = ?").run(id, usuarioId);
  if (!r.changes) throw new Error("Solo podés eliminar tus propias notas.");
}
