import type { Db } from "./db/pg-client.js";
import { isPrimaryPlatformAdmin } from "./empresas-cuenta-db.js";

export interface PlatformNotificationRow {
  id: number;
  titulo: string;
  mensaje: string;
  fecha_inicio: string;
  fecha_fin: string;
  activo: number;
  creado_por: number | null;
  creado_en: string;
  actualizado_en: string;
}

export interface PlatformNotificationAdmin extends PlatformNotificationRow {
  activo: number;
  lecturas: number;
  usuarios_elegibles: number;
}

export interface PlatformNotificationInput {
  titulo: string;
  mensaje: string;
  fecha_inicio: string;
  fecha_fin: string;
  activo: boolean;
}

export interface PlatformNotificationPending {
  id: number;
  titulo: string;
  mensaje: string;
  fecha_inicio: string;
  fecha_fin: string;
}

export interface PlatformNotificationRecipient {
  user_id: number;
  nombre: string;
  email: string;
  rol: string;
  cuenta_nombre: string | null;
  leido_en: string;
}

function pgNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") return Number(v);
  return 0;
}

function rowToNotification(row: Record<string, unknown>): PlatformNotificationRow {
  return {
    id: pgNum(row.id),
    titulo: String(row.titulo ?? "").trim(),
    mensaje: String(row.mensaje ?? "").trim(),
    fecha_inicio: String(row.fecha_inicio ?? "").slice(0, 10),
    fecha_fin: String(row.fecha_fin ?? "").slice(0, 10),
    activo: pgNum(row.activo),
    creado_por: row.creado_por == null ? null : pgNum(row.creado_por),
    creado_en: String(row.creado_en ?? ""),
    actualizado_en: String(row.actualizado_en ?? ""),
  };
}

function normalizeIsoDate(value: string, field: string): string {
  const head = String(value ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(head)) {
    throw new Error(`${field} inválida (use AAAA-MM-DD)`);
  }
  return head;
}

function validateInput(input: PlatformNotificationInput): PlatformNotificationInput {
  const titulo = String(input.titulo ?? "").trim() || "Aviso de SAG";
  const mensaje = String(input.mensaje ?? "").trim();
  if (!mensaje) throw new Error("El mensaje es obligatorio");
  if (mensaje.length > 8000) throw new Error("El mensaje es demasiado largo (máx. 8000 caracteres)");
  const fecha_inicio = normalizeIsoDate(input.fecha_inicio, "Fecha de inicio");
  const fecha_fin = normalizeIsoDate(input.fecha_fin, "Fecha de fin");
  if (fecha_fin < fecha_inicio) {
    throw new Error("La fecha de fin no puede ser anterior a la de inicio");
  }
  return {
    titulo: titulo.slice(0, 200),
    mensaje,
    fecha_inicio,
    fecha_fin,
    activo: Boolean(input.activo),
  };
}

export async function initPlatformNotificationsTables(db: Db): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS PLATFORM_NOTIFICATIONS (
        id SERIAL PRIMARY KEY,
        titulo TEXT NOT NULL DEFAULT 'Aviso de SAG',
        mensaje TEXT NOT NULL,
        fecha_inicio DATE NOT NULL,
        fecha_fin DATE NOT NULL,
        activo INTEGER NOT NULL DEFAULT 0,
        creado_por INTEGER REFERENCES USERS(id) ON DELETE SET NULL,
        creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
    )
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS USER_PLATFORM_NOTIFICATION_READ (
        user_id INTEGER NOT NULL REFERENCES USERS(id) ON DELETE CASCADE,
        notification_id INTEGER NOT NULL REFERENCES PLATFORM_NOTIFICATIONS(id) ON DELETE CASCADE,
        leido_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, notification_id)
      )`,
    )
    .run();

  await db
    .prepare(
      `CREATE INDEX IF NOT EXISTS idx_platform_notifications_vigencia
       ON PLATFORM_NOTIFICATIONS (activo, fecha_inicio, fecha_fin)`,
    )
    .run();
}

async function countEligibleRecipients(db: Db): Promise<number> {
  const rows = (await db
    .prepare(
      `SELECT id, email, rol, empresa_id
       FROM USERS
       WHERE activo = 1`,
    )
    .all()) as { id: number; email: string; rol: string; empresa_id: number | null }[];

  return rows.filter((u) => !isPrimaryPlatformAdmin({ email: u.email })).length;
}

async function countReads(db: Db, notificationId: number): Promise<number> {
  const row = (await db
    .prepare(
      `SELECT COUNT(*) AS n
       FROM USER_PLATFORM_NOTIFICATION_READ
       WHERE notification_id = ?`,
    )
    .get(notificationId)) as { n: number | string };
  return pgNum(row?.n);
}

export async function listPlatformNotificationsAdmin(db: Db): Promise<PlatformNotificationAdmin[]> {
  const elegibles = await countEligibleRecipients(db);
  const rows = (await db
    .prepare(
      `SELECT *
       FROM PLATFORM_NOTIFICATIONS
       ORDER BY creado_en DESC, id DESC`,
    )
    .all()) as Record<string, unknown>[];

  const out: PlatformNotificationAdmin[] = [];
  for (const row of rows) {
    const base = rowToNotification(row);
    out.push({
      ...base,
      lecturas: await countReads(db, base.id),
      usuarios_elegibles: elegibles,
    });
  }
  return out;
}

export async function getPlatformNotificationById(
  db: Db,
  id: number,
): Promise<PlatformNotificationRow | null> {
  const row = (await db
    .prepare(`SELECT * FROM PLATFORM_NOTIFICATIONS WHERE id = ?`)
    .get(id)) as Record<string, unknown> | undefined;
  return row ? rowToNotification(row) : null;
}

export async function createPlatformNotification(
  db: Db,
  input: PlatformNotificationInput,
  creadoPor: number,
): Promise<PlatformNotificationAdmin> {
  const data = validateInput(input);
  const result = (await db
    .prepare(
      `INSERT INTO PLATFORM_NOTIFICATIONS
        (titulo, mensaje, fecha_inicio, fecha_fin, activo, creado_por, creado_en, actualizado_en)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
       RETURNING id`,
    )
    .get(
      data.titulo,
      data.mensaje,
      data.fecha_inicio,
      data.fecha_fin,
      data.activo ? 1 : 0,
      creadoPor,
    )) as { id: number };

  const created = await getPlatformNotificationById(db, pgNum(result.id));
  if (!created) throw new Error("No se pudo crear la notificación");
  return {
    ...created,
    lecturas: 0,
    usuarios_elegibles: await countEligibleRecipients(db),
  };
}

export async function updatePlatformNotification(
  db: Db,
  id: number,
  input: PlatformNotificationInput,
): Promise<PlatformNotificationAdmin> {
  const existing = await getPlatformNotificationById(db, id);
  if (!existing) throw new Error("Notificación no encontrada");
  const data = validateInput(input);

  await db
    .prepare(
      `UPDATE PLATFORM_NOTIFICATIONS
       SET titulo = ?, mensaje = ?, fecha_inicio = ?, fecha_fin = ?, activo = ?, actualizado_en = NOW()
       WHERE id = ?`,
    )
    .run(
      data.titulo,
      data.mensaje,
      data.fecha_inicio,
      data.fecha_fin,
      data.activo ? 1 : 0,
      id,
    );

  const updated = await getPlatformNotificationById(db, id);
  if (!updated) throw new Error("Notificación no encontrada");
  return {
    ...updated,
    lecturas: await countReads(db, id),
    usuarios_elegibles: await countEligibleRecipients(db),
  };
}

export async function deletePlatformNotification(db: Db, id: number): Promise<void> {
  const existing = await getPlatformNotificationById(db, id);
  if (!existing) throw new Error("Notificación no encontrada");
  await db.prepare(`DELETE FROM PLATFORM_NOTIFICATIONS WHERE id = ?`).run(id);
}

function userReceivesPlatformNotifications(email: string): boolean {
  return !isPrimaryPlatformAdmin({ email });
}

/** Avisos pendientes: activos, en vigencia y sin lectura previa del usuario (1× por persona). */
export async function listPendingPlatformNotificationsForUser(
  db: Db,
  userId: number,
  email: string,
): Promise<PlatformNotificationPending[]> {
  if (!userReceivesPlatformNotifications(email)) return [];

  const rows = (await db
    .prepare(
      `SELECT n.id, n.titulo, n.mensaje, n.fecha_inicio, n.fecha_fin
       FROM PLATFORM_NOTIFICATIONS n
       WHERE n.activo = 1
         AND n.fecha_inicio <= CURRENT_DATE
         AND n.fecha_fin >= CURRENT_DATE
         AND NOT EXISTS (
           SELECT 1 FROM USER_PLATFORM_NOTIFICATION_READ r
           WHERE r.user_id = ? AND r.notification_id = n.id
         )
       ORDER BY n.creado_en ASC, n.id ASC`,
    )
    .all(userId)) as Record<string, unknown>[];

  return rows.map((row) => ({
    id: pgNum(row.id),
    titulo: String(row.titulo ?? "").trim() || "Aviso de SAG",
    mensaje: String(row.mensaje ?? "").trim(),
    fecha_inicio: String(row.fecha_inicio ?? "").slice(0, 10),
    fecha_fin: String(row.fecha_fin ?? "").slice(0, 10),
  }));
}

export async function dismissPlatformNotificationForUser(
  db: Db,
  userId: number,
  notificationId: number,
): Promise<void> {
  const notif = await getPlatformNotificationById(db, notificationId);
  if (!notif) throw new Error("Notificación no encontrada");
  if (notif.activo !== 1) throw new Error("La notificación no está activa");
  const today = new Date().toISOString().slice(0, 10);
  if (notif.fecha_inicio > today || notif.fecha_fin < today) {
    throw new Error("La notificación no está vigente");
  }

  await db
    .prepare(
      `INSERT INTO USER_PLATFORM_NOTIFICATION_READ (user_id, notification_id, leido_en)
       VALUES (?, ?, NOW())
       ON CONFLICT (user_id, notification_id) DO UPDATE SET leido_en = NOW()`,
    )
    .run(userId, notificationId);
}

export async function listPlatformNotificationRecipients(
  db: Db,
  notificationId: number,
): Promise<PlatformNotificationRecipient[]> {
  const notif = await getPlatformNotificationById(db, notificationId);
  if (!notif) throw new Error("Notificación no encontrada");

  const rows = (await db
    .prepare(
      `SELECT u.id AS user_id, u.nombre, u.email, u.rol, r.leido_en, ec.nombre AS cuenta_nombre
       FROM USER_PLATFORM_NOTIFICATION_READ r
       INNER JOIN USERS u ON u.id = r.user_id
       LEFT JOIN EMPRESAS_CUENTA ec ON ec.id = u.empresa_id
       WHERE r.notification_id = ?
       ORDER BY r.leido_en DESC, u.nombre ASC`,
    )
    .all(notificationId)) as Record<string, unknown>[];

  return rows
    .filter((row) => !isPrimaryPlatformAdmin({ email: String(row.email ?? "") }))
    .map((row) => ({
      user_id: pgNum(row.user_id),
      nombre: String(row.nombre ?? "").trim(),
      email: String(row.email ?? "").trim(),
      rol: String(row.rol ?? "").trim(),
      cuenta_nombre: row.cuenta_nombre == null ? null : String(row.cuenta_nombre).trim(),
      leido_en: String(row.leido_en ?? ""),
    }));
}
