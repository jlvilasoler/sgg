import type { Db } from "./db/pg-client.js";

export const OPERATIVA_TAREA_ESTADOS = [
  "pendiente",
  "en_curso",
  "hecha",
  "cancelada",
] as const;

export type OperativaTareaEstado = (typeof OPERATIVA_TAREA_ESTADOS)[number];

export const OPERATIVA_TAREA_PRIORIDADES = ["baja", "normal", "alta"] as const;

export type OperativaTareaPrioridad = (typeof OPERATIVA_TAREA_PRIORIDADES)[number];

/** 0 = lunes … 6 = domingo (calendario es-UY). */
export type OperativaDiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface OperativaTareaAsignado {
  id: number;
  nombre: string;
}

export interface OperativaTareaRow {
  id: number;
  cuenta_id: number;
  titulo: string;
  descripcion: string;
  notas: string;
  fecha: string;
  fecha_hasta: string | null;
  dia_semana: OperativaDiaSemana | null;
  estado: OperativaTareaEstado;
  prioridad: OperativaTareaPrioridad;
  asignado_user_id: number | null;
  asignado_nombre: string | null;
  asignados: OperativaTareaAsignado[];
  creado_por_user_id: number | null;
  creado_por_nombre: string | null;
  potrero_id: number | null;
  potrero_nombre: string | null;
  ubicacion: string;
  ganado_cantidad: number | null;
  ganado_detalle: string;
  completado_en: string | null;
  creado_en: string;
  actualizado_en: string;
}

export interface OperativaTareaInput {
  titulo: string;
  descripcion?: string;
  notas?: string;
  fecha?: string;
  fecha_hasta?: string | null;
  dia_semana?: OperativaDiaSemana | null;
  estado?: OperativaTareaEstado;
  prioridad?: OperativaTareaPrioridad;
  asignado_user_id?: number | null;
  asignados_user_ids?: number[];
  potrero_id?: number | null;
  ubicacion?: string;
  ganado_cantidad?: number | null;
  ganado_detalle?: string;
}

export interface OperativaTareaRegistroRow {
  id: number;
  tarea_id: number;
  cuenta_id: number;
  user_id: number | null;
  user_nombre: string | null;
  texto: string;
  ganado_cantidad: number | null;
  ganado_detalle: string;
  fecha_ejecucion: string;
  creado_en: string;
}

export interface OperativaTareaRegistroInput {
  texto: string;
  ganado_cantidad?: number | null;
  ganado_detalle?: string;
  fecha_ejecucion: string;
}

export interface OperativaTareaListFilters {
  desde?: string;
  hasta?: string;
  asignado_user_id?: number;
  estado?: OperativaTareaEstado;
}

function isEstado(value: string): value is OperativaTareaEstado {
  return (OPERATIVA_TAREA_ESTADOS as readonly string[]).includes(value);
}

function isPrioridad(value: string): value is OperativaTareaPrioridad {
  return (OPERATIVA_TAREA_PRIORIDADES as readonly string[]).includes(value);
}

function normalizeFecha(value: string): string {
  const raw = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error("La fecha debe tener formato AAAA-MM-DD.");
  }
  return raw;
}

function isoWeekdayFromDate(iso: string): OperativaDiaSemana {
  const d = new Date(
    Number(iso.slice(0, 4)),
    Number(iso.slice(5, 7)) - 1,
    Number(iso.slice(8, 10)),
  );
  return ((d.getDay() + 6) % 7) as OperativaDiaSemana;
}

function normalizeDiaSemana(value: unknown): OperativaDiaSemana | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 6) {
    throw new Error("El día de la semana debe ser entre lunes (0) y domingo (6).");
  }
  return n as OperativaDiaSemana;
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function rowToTarea(row: Record<string, unknown>): OperativaTareaRow {
  const estadoRaw = String(row.estado ?? "pendiente");
  const prioridadRaw = String(row.prioridad ?? "normal");
  return {
    id: Number(row.id),
    cuenta_id: Number(row.cuenta_id),
    titulo: String(row.titulo ?? ""),
    descripcion: String(row.descripcion ?? ""),
    notas: String(row.notas ?? ""),
    fecha: String(row.fecha ?? "").slice(0, 10),
    fecha_hasta: row.fecha_hasta ? String(row.fecha_hasta).slice(0, 10) : null,
    dia_semana:
      row.dia_semana != null && Number.isInteger(Number(row.dia_semana))
        ? (Number(row.dia_semana) as OperativaDiaSemana)
        : row.fecha
          ? isoWeekdayFromDate(String(row.fecha).slice(0, 10))
          : null,
    estado: isEstado(estadoRaw) ? estadoRaw : "pendiente",
    prioridad: isPrioridad(prioridadRaw) ? prioridadRaw : "normal",
    asignado_user_id:
      row.asignado_user_id != null ? Number(row.asignado_user_id) : null,
    asignado_nombre: row.asignado_nombre ? String(row.asignado_nombre) : null,
    asignados: [],
    creado_por_user_id:
      row.creado_por_user_id != null ? Number(row.creado_por_user_id) : null,
    creado_por_nombre: row.creado_por_nombre ? String(row.creado_por_nombre) : null,
    potrero_id: row.potrero_id != null ? Number(row.potrero_id) : null,
    potrero_nombre: row.potrero_nombre ? String(row.potrero_nombre) : null,
    ubicacion: String(row.ubicacion ?? ""),
    ganado_cantidad:
      row.ganado_cantidad != null && Number.isFinite(Number(row.ganado_cantidad))
        ? Number(row.ganado_cantidad)
        : null,
    ganado_detalle: String(row.ganado_detalle ?? ""),
    completado_en: row.completado_en ? String(row.completado_en) : null,
    creado_en: String(row.creado_en ?? ""),
    actualizado_en: String(row.actualizado_en ?? ""),
  };
}

function rowToRegistro(row: Record<string, unknown>): OperativaTareaRegistroRow {
  return {
    id: Number(row.id),
    tarea_id: Number(row.tarea_id),
    cuenta_id: Number(row.cuenta_id),
    user_id: row.user_id != null ? Number(row.user_id) : null,
    user_nombre: row.user_nombre ? String(row.user_nombre) : null,
    texto: String(row.texto ?? ""),
    ganado_cantidad:
      row.ganado_cantidad != null && Number.isFinite(Number(row.ganado_cantidad))
        ? Number(row.ganado_cantidad)
        : null,
    ganado_detalle: String(row.ganado_detalle ?? ""),
    fecha_ejecucion: row.fecha_ejecucion
      ? String(row.fecha_ejecucion).slice(0, 10)
      : String(row.creado_en ?? "").slice(0, 10),
    creado_en: String(row.creado_en ?? ""),
  };
}

const TAREA_SELECT = `
  SELECT t.id, t.cuenta_id, t.titulo, t.descripcion, t.notas, t.fecha, t.fecha_hasta,
         t.dia_semana, t.estado, t.prioridad, t.asignado_user_id, ua.nombre AS asignado_nombre,
         t.creado_por_user_id, uc.nombre AS creado_por_nombre,
         t.potrero_id, p.nombre AS potrero_nombre, t.ubicacion,
         t.ganado_cantidad, t.ganado_detalle, t.completado_en,
         t.creado_en, t.actualizado_en
  FROM OPERATIVA_TAREA t
  LEFT JOIN USERS ua ON ua.id = t.asignado_user_id
  LEFT JOIN USERS uc ON uc.id = t.creado_por_user_id
  LEFT JOIN CAMPO_POTRERO_MAPA p ON p.id = t.potrero_id AND p.cuenta_id = t.cuenta_id
`;

async function listAsignadosByTareaIds(
  db: Db,
  tareaIds: number[],
): Promise<Map<number, OperativaTareaAsignado[]>> {
  const map = new Map<number, OperativaTareaAsignado[]>();
  if (!tareaIds.length) return map;

  const placeholders = tareaIds.map(() => "?").join(", ");
  const rows = (await db
    .prepare(
      `SELECT a.tarea_id, u.id, u.nombre
       FROM OPERATIVA_TAREA_ASIGNADO a
       JOIN USERS u ON u.id = a.user_id
       WHERE a.tarea_id IN (${placeholders})
       ORDER BY u.nombre COLLATE NOCASE ASC, u.id ASC`,
    )
    .all(...tareaIds)) as Record<string, unknown>[];

  for (const row of rows) {
    const tareaId = Number(row.tarea_id);
    const item: OperativaTareaAsignado = {
      id: Number(row.id),
      nombre: String(row.nombre ?? ""),
    };
    const list = map.get(tareaId) ?? [];
    list.push(item);
    map.set(tareaId, list);
  }
  return map;
}

function attachAsignadosToTareas(
  tareas: OperativaTareaRow[],
  asignadosMap: Map<number, OperativaTareaAsignado[]>,
): OperativaTareaRow[] {
  return tareas.map((t) => {
    const asignados = asignadosMap.get(t.id) ?? [];
    const asignadoNombre =
      asignados.length > 0 ? asignados.map((a) => a.nombre).join(", ") : t.asignado_nombre;
    return {
      ...t,
      asignados,
      asignado_nombre: asignadoNombre,
      asignado_user_id: asignados[0]?.id ?? t.asignado_user_id,
    };
  });
}

async function normalizeAsignadosIds(
  db: Db,
  cuentaId: number,
  ids: number[] | undefined,
  fallbackUserId?: number | null,
): Promise<number[]> {
  const raw =
    ids !== undefined
      ? ids
      : fallbackUserId != null
        ? [fallbackUserId]
        : [];
  const unique = [...new Set(raw.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))];
  const validated: number[] = [];
  for (const id of unique) {
    const userId = await validateAsignado(db, cuentaId, id);
    if (userId) validated.push(userId);
  }
  validated.sort((a, b) => a - b);
  return validated;
}

async function replaceTareaAsignados(
  db: Db,
  cuentaId: number,
  tareaId: number,
  userIds: number[],
): Promise<void> {
  await db.prepare(`DELETE FROM OPERATIVA_TAREA_ASIGNADO WHERE tarea_id = ?`).run(tareaId);
  for (const userId of userIds) {
    await db
      .prepare(
        `INSERT INTO OPERATIVA_TAREA_ASIGNADO (tarea_id, user_id, cuenta_id) VALUES (?, ?, ?)`,
      )
      .run(tareaId, userId, cuentaId);
  }
}

async function enrichTarea(db: Db, tarea: OperativaTareaRow): Promise<OperativaTareaRow> {
  const map = await listAsignadosByTareaIds(db, [tarea.id]);
  return attachAsignadosToTareas([tarea], map)[0] ?? tarea;
}

async function enrichTareas(db: Db, tareas: OperativaTareaRow[]): Promise<OperativaTareaRow[]> {
  if (!tareas.length) return tareas;
  const map = await listAsignadosByTareaIds(
    db,
    tareas.map((t) => t.id),
  );
  return attachAsignadosToTareas(tareas, map);
}

export async function initOperativaTareasTables(db: Db): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS OPERATIVA_TAREA (
         id SERIAL PRIMARY KEY,
         cuenta_id INTEGER NOT NULL REFERENCES EMPRESAS_CUENTA(id) ON DELETE CASCADE,
         titulo TEXT NOT NULL,
         descripcion TEXT NOT NULL DEFAULT '',
         notas TEXT NOT NULL DEFAULT '',
         fecha DATE NOT NULL,
         fecha_hasta DATE,
         estado TEXT NOT NULL DEFAULT 'pendiente',
         prioridad TEXT NOT NULL DEFAULT 'normal',
         asignado_user_id INTEGER REFERENCES USERS(id) ON DELETE SET NULL,
         creado_por_user_id INTEGER REFERENCES USERS(id) ON DELETE SET NULL,
         potrero_id INTEGER REFERENCES CAMPO_POTRERO_MAPA(id) ON DELETE SET NULL,
         ubicacion TEXT NOT NULL DEFAULT '',
         ganado_cantidad INTEGER,
         ganado_detalle TEXT NOT NULL DEFAULT '',
         completado_en TIMESTAMPTZ,
         creado_en TIMESTAMPTZ DEFAULT NOW(),
         actualizado_en TIMESTAMPTZ DEFAULT NOW()
       )`,
    )
    .run();

  await db
    .prepare(
      `CREATE INDEX IF NOT EXISTS idx_operativa_tarea_cuenta_fecha
       ON OPERATIVA_TAREA(cuenta_id, fecha)`,
    )
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS OPERATIVA_TAREA_REGISTRO (
         id SERIAL PRIMARY KEY,
         tarea_id INTEGER NOT NULL REFERENCES OPERATIVA_TAREA(id) ON DELETE CASCADE,
         cuenta_id INTEGER NOT NULL REFERENCES EMPRESAS_CUENTA(id) ON DELETE CASCADE,
         user_id INTEGER REFERENCES USERS(id) ON DELETE SET NULL,
         texto TEXT NOT NULL,
         ganado_cantidad INTEGER,
         ganado_detalle TEXT NOT NULL DEFAULT '',
         creado_en TIMESTAMPTZ DEFAULT NOW()
       )`,
    )
    .run();

  await db
    .prepare(
      `CREATE INDEX IF NOT EXISTS idx_operativa_tarea_registro_tarea
       ON OPERATIVA_TAREA_REGISTRO(tarea_id)`,
    )
    .run();

  await db
    .prepare(`ALTER TABLE OPERATIVA_TAREA ADD COLUMN IF NOT EXISTS dia_semana INTEGER`)
    .run();

  await db
    .prepare(
      `ALTER TABLE OPERATIVA_TAREA_REGISTRO ADD COLUMN IF NOT EXISTS fecha_ejecucion DATE`,
    )
    .run();

  await db
    .prepare(
      `UPDATE OPERATIVA_TAREA
       SET dia_semana = MOD(CAST(EXTRACT(DOW FROM fecha) AS INTEGER) + 6, 7)
       WHERE dia_semana IS NULL AND fecha IS NOT NULL`,
    )
    .run();

  await db
    .prepare(
      `UPDATE OPERATIVA_TAREA_REGISTRO
       SET fecha_ejecucion = CAST(creado_en AS DATE)
       WHERE fecha_ejecucion IS NULL`,
    )
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS OPERATIVA_TAREA_ASIGNADO (
         tarea_id INTEGER NOT NULL REFERENCES OPERATIVA_TAREA(id) ON DELETE CASCADE,
         user_id INTEGER NOT NULL REFERENCES USERS(id) ON DELETE CASCADE,
         cuenta_id INTEGER NOT NULL REFERENCES EMPRESAS_CUENTA(id) ON DELETE CASCADE,
         PRIMARY KEY (tarea_id, user_id)
       )`,
    )
    .run();

  await db
    .prepare(
      `CREATE INDEX IF NOT EXISTS idx_operativa_tarea_asignado_user
       ON OPERATIVA_TAREA_ASIGNADO(user_id)`,
    )
    .run();

  await db
    .prepare(
      `ALTER TABLE OPERATIVA_TAREA_ASIGNADO ADD COLUMN IF NOT EXISTS cuenta_id INTEGER REFERENCES EMPRESAS_CUENTA(id) ON DELETE CASCADE`,
    )
    .run();

  await db
    .prepare(
      `UPDATE OPERATIVA_TAREA_ASIGNADO a
       SET cuenta_id = t.cuenta_id
       FROM OPERATIVA_TAREA t
       WHERE a.tarea_id = t.id AND a.cuenta_id IS NULL`,
    )
    .run();

  await db
    .prepare(
      `INSERT INTO OPERATIVA_TAREA_ASIGNADO (tarea_id, user_id, cuenta_id)
       SELECT t.id, t.asignado_user_id, t.cuenta_id
       FROM OPERATIVA_TAREA t
       WHERE t.asignado_user_id IS NOT NULL
       ON CONFLICT (tarea_id, user_id) DO NOTHING`,
    )
    .run()
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/duplicate|unique|already exists/i.test(msg)) throw err;
    });
}

export async function listOperativaTareas(
  db: Db,
  cuentaId: number,
  filters: OperativaTareaListFilters = {},
): Promise<OperativaTareaRow[]> {
  let sql = `${TAREA_SELECT} WHERE t.cuenta_id = ?`;
  const params: unknown[] = [cuentaId];

  if (filters.desde) {
    sql += ` AND (t.dia_semana IS NOT NULL OR t.fecha >= ?)`;
    params.push(normalizeFecha(filters.desde));
  }
  if (filters.hasta) {
    sql += ` AND (t.dia_semana IS NOT NULL OR t.fecha <= ?)`;
    params.push(normalizeFecha(filters.hasta));
  }
  if (filters.asignado_user_id != null && Number.isFinite(filters.asignado_user_id)) {
    sql += ` AND EXISTS (
      SELECT 1 FROM OPERATIVA_TAREA_ASIGNADO a
      WHERE a.tarea_id = t.id AND a.user_id = ?
    )`;
    params.push(filters.asignado_user_id);
  }
  if (filters.estado && isEstado(filters.estado)) {
    sql += ` AND t.estado = ?`;
    params.push(filters.estado);
  }

  sql += ` ORDER BY COALESCE(t.dia_semana, 7) ASC, t.titulo ASC, t.id ASC`;

  const rows = (await db.prepare(sql).all(...params)) as Record<string, unknown>[];
  return enrichTareas(db, rows.map(rowToTarea));
}

export async function getOperativaTareaById(
  db: Db,
  cuentaId: number,
  id: number,
): Promise<OperativaTareaRow | null> {
  const row = (await db
    .prepare(`${TAREA_SELECT} WHERE t.cuenta_id = ? AND t.id = ? LIMIT 1`)
    .get(cuentaId, id)) as Record<string, unknown> | undefined;
  return row ? enrichTarea(db, rowToTarea(row)) : null;
}

async function validatePotrero(
  db: Db,
  cuentaId: number,
  potreroId: number | null | undefined,
): Promise<number | null> {
  if (potreroId == null) return null;
  const id = Number(potreroId);
  if (!Number.isFinite(id) || id <= 0) return null;
  const row = (await db
    .prepare(`SELECT id FROM CAMPO_POTRERO_MAPA WHERE cuenta_id = ? AND id = ? LIMIT 1`)
    .get(cuentaId, id)) as { id: number } | undefined;
  if (!row) throw new Error("El potrero seleccionado no existe en el mapa de la cuenta.");
  return id;
}

async function validateAsignado(
  db: Db,
  cuentaId: number,
  userId: number | null | undefined,
): Promise<number | null> {
  if (userId == null) return null;
  const id = Number(userId);
  if (!Number.isFinite(id) || id <= 0) return null;
  const row = (await db
    .prepare(`SELECT id FROM USERS WHERE id = ? AND empresa_id = ? AND activo = 1 LIMIT 1`)
    .get(id, cuentaId)) as { id: number } | undefined;
  if (!row) {
    const adminRow = (await db
      .prepare(
        `SELECT u.id FROM USERS u
         JOIN EMPRESAS_CUENTA c ON c.admin_user_id = u.id
         WHERE u.id = ? AND c.id = ? AND u.activo = 1 LIMIT 1`,
      )
      .get(id, cuentaId)) as { id: number } | undefined;
    if (!adminRow) throw new Error("El usuario asignado no pertenece a esta cuenta.");
  }
  return id;
}

export async function createOperativaTarea(
  db: Db,
  cuentaId: number,
  creadoPorUserId: number | null,
  input: OperativaTareaInput,
): Promise<OperativaTareaRow> {
  if (!Number.isFinite(cuentaId) || cuentaId <= 0) {
    throw new Error("Cuenta inválida para registrar la tarea.");
  }
  const titulo = String(input.titulo ?? "").trim().slice(0, 120);
  if (!titulo) throw new Error("Ingresá qué tarea se realiza.");
  const diaSemana = normalizeDiaSemana(input.dia_semana);
  if (diaSemana == null) {
    throw new Error("Seleccioná el día de la semana de la rutina.");
  }
  const fecha = input.fecha?.trim() ? normalizeFecha(input.fecha) : todayIso();
  const fechaHasta = null;
  const estado = "pendiente";
  const prioridad = "normal";
  const asignadosIds = await normalizeAsignadosIds(
    db,
    cuentaId,
    input.asignados_user_ids,
    input.asignado_user_id,
  );
  const asignadoUserId = asignadosIds[0] ?? null;
  const potreroId = await validatePotrero(db, cuentaId, input.potrero_id);
  const descripcion = String(input.descripcion ?? "").trim().slice(0, 2000);
  const notas = String(input.notas ?? "").trim().slice(0, 4000);
  const ubicacion = String(input.ubicacion ?? "").trim().slice(0, 120);
  const ganadoCantidad =
    input.ganado_cantidad != null && Number.isFinite(Number(input.ganado_cantidad))
      ? Math.max(0, Math.floor(Number(input.ganado_cantidad)))
      : null;
  const ganadoDetalle = String(input.ganado_detalle ?? "").trim().slice(0, 500);
  const completadoEn = null;

  const inserted = (await db
    .prepare(
      `INSERT INTO OPERATIVA_TAREA (
         cuenta_id, titulo, descripcion, notas, fecha, fecha_hasta, dia_semana, estado, prioridad,
         asignado_user_id, creado_por_user_id, potrero_id, ubicacion,
         ganado_cantidad, ganado_detalle, completado_en
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
    )
    .get(
      cuentaId,
      titulo,
      descripcion,
      notas,
      fecha,
      fechaHasta,
      diaSemana,
      estado,
      prioridad,
      asignadoUserId,
      creadoPorUserId,
      potreroId,
      ubicacion,
      ganadoCantidad,
      ganadoDetalle,
      completadoEn,
    )) as { id: number };

  await replaceTareaAsignados(db, cuentaId, Number(inserted.id), asignadosIds);

  const created = await getOperativaTareaById(db, cuentaId, Number(inserted.id));
  if (!created) throw new Error("No se pudo crear la tarea.");
  return created;
}

export async function updateOperativaTarea(
  db: Db,
  cuentaId: number,
  id: number,
  input: Partial<OperativaTareaInput>,
): Promise<OperativaTareaRow> {
  const existing = await getOperativaTareaById(db, cuentaId, id);
  if (!existing) throw new Error("Tarea no encontrada.");

  const titulo =
    input.titulo !== undefined ? String(input.titulo).trim().slice(0, 120) : existing.titulo;
  if (!titulo) throw new Error("Ingresá qué tarea se realiza.");
  const fecha = existing.fecha;
  const fechaHasta = null;
  const diaSemana =
    input.dia_semana !== undefined
      ? normalizeDiaSemana(input.dia_semana)
      : existing.dia_semana;
  if (diaSemana == null) {
    throw new Error("Seleccioná el día de la semana de la rutina.");
  }
  const estado = existing.estado;
  const prioridad = existing.prioridad;
  const shouldSyncAsignados =
    input.asignados_user_ids !== undefined || input.asignado_user_id !== undefined;
  let asignadoUserId = existing.asignado_user_id;
  let asignadosToSave: number[] | undefined;
  if (shouldSyncAsignados) {
    asignadosToSave = await normalizeAsignadosIds(
      db,
      cuentaId,
      input.asignados_user_ids,
      input.asignado_user_id ?? null,
    );
    asignadoUserId = asignadosToSave[0] ?? null;
  }
  const potreroId =
    input.potrero_id !== undefined
      ? await validatePotrero(db, cuentaId, input.potrero_id)
      : existing.potrero_id;
  const descripcion =
    input.descripcion !== undefined
      ? String(input.descripcion).trim().slice(0, 2000)
      : existing.descripcion;
  const notas =
    input.notas !== undefined ? String(input.notas).trim().slice(0, 4000) : existing.notas;
  const ubicacion =
    input.ubicacion !== undefined
      ? String(input.ubicacion).trim().slice(0, 120)
      : existing.ubicacion;
  const ganadoCantidad =
    input.ganado_cantidad !== undefined
      ? input.ganado_cantidad != null && Number.isFinite(Number(input.ganado_cantidad))
        ? Math.max(0, Math.floor(Number(input.ganado_cantidad)))
        : null
      : existing.ganado_cantidad;
  const ganadoDetalle =
    input.ganado_detalle !== undefined
      ? String(input.ganado_detalle).trim().slice(0, 500)
      : existing.ganado_detalle;

  let completadoEn = existing.completado_en;
  if (estado === "hecha" && existing.estado !== "hecha") {
    completadoEn = new Date().toISOString();
  } else if (estado !== "hecha") {
    completadoEn = null;
  }

  await db
    .prepare(
      `UPDATE OPERATIVA_TAREA
       SET titulo = ?, descripcion = ?, notas = ?, fecha = ?, fecha_hasta = ?,
           dia_semana = ?, estado = ?, prioridad = ?, asignado_user_id = ?, potrero_id = ?,
           ubicacion = ?, ganado_cantidad = ?, ganado_detalle = ?,
           completado_en = ?, actualizado_en = NOW()
       WHERE cuenta_id = ? AND id = ?`,
    )
    .run(
      titulo,
      descripcion,
      notas,
      fecha,
      fechaHasta,
      diaSemana,
      estado,
      prioridad,
      asignadoUserId,
      potreroId,
      ubicacion,
      ganadoCantidad,
      ganadoDetalle,
      completadoEn,
      cuentaId,
      id,
    );

  if (asignadosToSave !== undefined) {
    await replaceTareaAsignados(db, cuentaId, id, asignadosToSave);
  }

  const updated = await getOperativaTareaById(db, cuentaId, id);
  if (!updated) throw new Error("Tarea no encontrada.");
  return updated;
}

export async function deleteOperativaTarea(
  db: Db,
  cuentaId: number,
  id: number,
): Promise<void> {
  const result = await db
    .prepare(`DELETE FROM OPERATIVA_TAREA WHERE cuenta_id = ? AND id = ?`)
    .run(cuentaId, id);
  if (!result.changes) throw new Error("Tarea no encontrada.");
}

export async function listOperativaTareaRegistros(
  db: Db,
  cuentaId: number,
  tareaId: number,
  fechaEjecucion?: string,
): Promise<OperativaTareaRegistroRow[]> {
  const tarea = await getOperativaTareaById(db, cuentaId, tareaId);
  if (!tarea) throw new Error("Tarea no encontrada.");

  let sql = `
    SELECT r.id, r.tarea_id, r.cuenta_id, r.user_id, u.nombre AS user_nombre,
           r.texto, r.ganado_cantidad, r.ganado_detalle, r.fecha_ejecucion, r.creado_en
    FROM OPERATIVA_TAREA_REGISTRO r
    LEFT JOIN USERS u ON u.id = r.user_id
    WHERE r.cuenta_id = ? AND r.tarea_id = ?`;
  const params: unknown[] = [cuentaId, tareaId];
  if (fechaEjecucion?.trim()) {
    sql += ` AND r.fecha_ejecucion = ?`;
    params.push(normalizeFecha(fechaEjecucion));
  }
  sql += ` ORDER BY r.fecha_ejecucion DESC, r.creado_en DESC, r.id DESC`;

  const rows = (await db.prepare(sql).all(...params)) as Record<string, unknown>[];
  return rows.map(rowToRegistro);
}

export async function listOperativaRegistrosPorFecha(
  db: Db,
  cuentaId: number,
  fecha: string,
): Promise<OperativaTareaRegistroRow[]> {
  const fechaNorm = normalizeFecha(fecha);
  const rows = (await db
    .prepare(
      `SELECT r.id, r.tarea_id, r.cuenta_id, r.user_id, u.nombre AS user_nombre,
              r.texto, r.ganado_cantidad, r.ganado_detalle, r.fecha_ejecucion, r.creado_en
       FROM OPERATIVA_TAREA_REGISTRO r
       LEFT JOIN USERS u ON u.id = r.user_id
       WHERE r.cuenta_id = ? AND r.fecha_ejecucion = ?
       ORDER BY r.creado_en DESC, r.id DESC`,
    )
    .all(cuentaId, fechaNorm)) as Record<string, unknown>[];
  return rows.map(rowToRegistro);
}

export async function createOperativaTareaRegistro(
  db: Db,
  cuentaId: number,
  tareaId: number,
  userId: number | null,
  input: OperativaTareaRegistroInput,
): Promise<OperativaTareaRegistroRow> {
  const tarea = await getOperativaTareaById(db, cuentaId, tareaId);
  if (!tarea) throw new Error("Tarea no encontrada.");

  const texto = String(input.texto ?? "").trim().slice(0, 2000);
  if (!texto) throw new Error("Ingresá qué se hizo en el trabajo.");
  const fechaEjecucion = normalizeFecha(input.fecha_ejecucion);
  const ganadoCantidad = null;
  const ganadoDetalle = String(input.ganado_detalle ?? "").trim().slice(0, 2000);

  const inserted = (await db
    .prepare(
      `INSERT INTO OPERATIVA_TAREA_REGISTRO (
         tarea_id, cuenta_id, user_id, texto, ganado_cantidad, ganado_detalle, fecha_ejecucion
       ) VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
    )
    .get(
      tareaId,
      cuentaId,
      userId,
      texto,
      ganadoCantidad,
      ganadoDetalle,
      fechaEjecucion,
    )) as { id: number };

  const rows = await listOperativaTareaRegistros(db, cuentaId, tareaId);
  const created = rows.find((r) => r.id === Number(inserted.id));
  if (!created) throw new Error("No se pudo guardar el registro.");
  return created;
}
