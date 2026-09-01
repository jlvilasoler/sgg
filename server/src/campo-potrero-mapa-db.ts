import type { Db } from "./db/pg-client.js";
import { ensurePotreroEnCatalogo, normalizarPotrero } from "./stock-ganadero-potrero-db.js";

export interface CampoPotreroMapaRow {
  id: number;
  cuenta_id: number;
  empresa_operativa_id: number | null;
  nombre: string;
  geojson: string;
  color: string;
  hectareas: number | null;
  notas: string;
  metadata: string;
  creado_en: string;
  actualizado_en: string;
}

export interface CampoPotreroMapaInput {
  nombre: string;
  geojson: unknown;
  color?: string;
  hectareas?: number | null;
  notas?: string;
  metadata?: Record<string, unknown>;
  empresa_operativa_id?: number | null;
}

/** Scope por empresa activa (modo individual). */
export interface CampoMapaEmpresaScope {
  /** null = toda la cuenta; -1 = vacío; >0 = esa empresa (+ legacy sin asignar) */
  filterEmpresaOperativaId?: number | null;
  /** Se graba en altas / claim de legacy */
  stampEmpresaOperativaId?: number | null;
}

const POTRERO_COLORS = [
  "#2d5a3d",
  "#2563eb",
  "#b45309",
  "#7c3aed",
  "#be123c",
  "#0d9488",
  "#ca8a04",
  "#4338ca",
] as const;

function rowToCampoPotrero(row: Record<string, unknown>): CampoPotreroMapaRow {
  return {
    id: Number(row.id),
    cuenta_id: Number(row.cuenta_id),
    empresa_operativa_id:
      row.empresa_operativa_id != null && Number.isFinite(Number(row.empresa_operativa_id))
        ? Number(row.empresa_operativa_id)
        : null,
    nombre: String(row.nombre ?? ""),
    geojson: String(row.geojson ?? ""),
    color: String(row.color ?? POTRERO_COLORS[0]),
    hectareas: row.hectareas != null ? Number(row.hectareas) : null,
    notas: String(row.notas ?? ""),
    metadata: String(row.metadata ?? "{}"),
    creado_en: String(row.creado_en ?? ""),
    actualizado_en: String(row.actualizado_en ?? ""),
  };
}

function normalizeGeoJson(raw: unknown): string {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("El polígono del potrero no es un GeoJSON válido.");
    }
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("El polígono del potrero no es un GeoJSON válido.");
  }
  const obj = parsed as { type?: string; coordinates?: unknown };
  if (obj.type !== "Polygon" || !Array.isArray(obj.coordinates)) {
    throw new Error("El potrero debe guardarse como un polígono (GeoJSON Polygon).");
  }
  const ring = obj.coordinates[0];
  if (!Array.isArray(ring) || ring.length < 4) {
    throw new Error("El polígono debe tener al menos tres vértices.");
  }
  return JSON.stringify({ type: "Polygon", coordinates: obj.coordinates });
}

function normalizeColor(value: string | undefined, fallbackIndex = 0): string {
  const raw = String(value ?? "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw;
  return POTRERO_COLORS[fallbackIndex % POTRERO_COLORS.length];
}

function normalizeMetadata(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "{}";
  try {
    return JSON.stringify(raw);
  } catch {
    return "{}";
  }
}

export async function initCampoPotreroMapaTable(db: Db): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS CAMPO_POTRERO_MAPA (
         id SERIAL PRIMARY KEY,
         cuenta_id INTEGER NOT NULL REFERENCES EMPRESAS_CUENTA(id) ON DELETE CASCADE,
         nombre TEXT NOT NULL,
         geojson TEXT NOT NULL,
         color TEXT NOT NULL DEFAULT '#2d5a3d',
         hectareas REAL,
         notas TEXT NOT NULL DEFAULT '',
         creado_en TIMESTAMPTZ DEFAULT NOW(),
         actualizado_en TIMESTAMPTZ DEFAULT NOW()
       )`,
    )
    .run();

  await db
    .prepare(
      `CREATE INDEX IF NOT EXISTS idx_campo_potrero_mapa_cuenta
       ON CAMPO_POTRERO_MAPA(cuenta_id)`,
    )
    .run();

  await db
    .prepare(`ALTER TABLE CAMPO_POTRERO_MAPA ADD COLUMN IF NOT EXISTS metadata TEXT NOT NULL DEFAULT '{}'`)
    .run();

  await db
    .prepare(
      `ALTER TABLE CAMPO_POTRERO_MAPA ADD COLUMN IF NOT EXISTS empresa_operativa_id INTEGER REFERENCES EMPRESAS_OPERATIVAS(id) ON DELETE SET NULL`,
    )
    .run();

  await db
    .prepare(
      `CREATE INDEX IF NOT EXISTS idx_campo_potrero_mapa_empresa
       ON CAMPO_POTRERO_MAPA(cuenta_id, empresa_operativa_id)`,
    )
    .run();
}

function sqlVisibleEmpresaScope(filterId: number | null | undefined): {
  clause: string;
  params: number[];
} {
  if (filterId == null) return { clause: "", params: [] };
  if (filterId < 0) return { clause: " AND 1=0", params: [] };
  // Modo individual: solo la empresa de la sesión (sin mezclar legacy compartido).
  return {
    clause: " AND empresa_operativa_id = ?",
    params: [filterId],
  };
}

/**
 * Si la cuenta pasa a modo individual con potreros/elementos sin empresa,
 * duplica cada ítem huérfano para cada empresa activa (el original queda en la 1ª).
 * Idempotente: solo actúa sobre filas con empresa_operativa_id IS NULL.
 */
export async function partitionOrphanCampoPotrerosToEmpresas(
  db: Db,
  cuentaId: number,
  empresaIds: number[],
): Promise<void> {
  const ids = empresaIds.filter((id) => Number.isFinite(id) && id > 0);
  if (!ids.length) return;

  const orphans = (await db
    .prepare(
      `SELECT ${POTRERO_SELECT}
       FROM CAMPO_POTRERO_MAPA
       WHERE cuenta_id = ? AND empresa_operativa_id IS NULL
       ORDER BY id ASC`,
    )
    .all(cuentaId)) as Record<string, unknown>[];
  if (!orphans.length) return;

  for (const raw of orphans) {
    const orphan = rowToCampoPotrero(raw);
    await db
      .prepare(
        `UPDATE CAMPO_POTRERO_MAPA
         SET empresa_operativa_id = ?, actualizado_en = NOW()
         WHERE id = ? AND cuenta_id = ? AND empresa_operativa_id IS NULL`,
      )
      .run(ids[0], orphan.id, cuentaId);

    for (const empresaId of ids.slice(1)) {
      await db
        .prepare(
          `INSERT INTO CAMPO_POTRERO_MAPA
             (cuenta_id, empresa_operativa_id, nombre, geojson, color, hectareas, notas, metadata)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          cuentaId,
          empresaId,
          orphan.nombre,
          orphan.geojson,
          orphan.color,
          orphan.hectareas,
          orphan.notas,
          orphan.metadata,
        );
    }
  }
}

const POTRERO_SELECT =
  `id, cuenta_id, empresa_operativa_id, nombre, geojson, color, hectareas, notas, metadata, creado_en, actualizado_en`;

export async function listCampoPotrerosMapa(
  db: Db,
  cuentaId: number,
  scope?: CampoMapaEmpresaScope,
): Promise<CampoPotreroMapaRow[]> {
  const vis = sqlVisibleEmpresaScope(scope?.filterEmpresaOperativaId);
  const rows = (await db
    .prepare(
      `SELECT ${POTRERO_SELECT}
       FROM CAMPO_POTRERO_MAPA
       WHERE cuenta_id = ?${vis.clause}
       ORDER BY LOWER(nombre) ASC, id ASC`,
    )
    .all(cuentaId, ...vis.params)) as Record<string, unknown>[];
  return rows.map(rowToCampoPotrero);
}

export async function getCampoPotreroMapaById(
  db: Db,
  cuentaId: number,
  id: number,
  scope?: CampoMapaEmpresaScope,
): Promise<CampoPotreroMapaRow | null> {
  const vis = sqlVisibleEmpresaScope(scope?.filterEmpresaOperativaId);
  const row = (await db
    .prepare(
      `SELECT ${POTRERO_SELECT}
       FROM CAMPO_POTRERO_MAPA
       WHERE cuenta_id = ? AND id = ?${vis.clause}
       LIMIT 1`,
    )
    .get(cuentaId, id, ...vis.params)) as Record<string, unknown> | undefined;
  return row ? rowToCampoPotrero(row) : null;
}

export async function createCampoPotreroMapa(
  db: Db,
  cuentaId: number,
  input: CampoPotreroMapaInput,
  scope?: CampoMapaEmpresaScope,
): Promise<CampoPotreroMapaRow> {
  if (!Number.isFinite(cuentaId) || cuentaId <= 0) {
    throw new Error("Cuenta inválida para registrar el potrero.");
  }
  const nombre = normalizarPotrero(input.nombre);
  if (!nombre) throw new Error("Ingresá un nombre de potrero válido.");
  const geojson = normalizeGeoJson(input.geojson);
  const countRow = (await db
    .prepare(`SELECT COUNT(*)::int AS total FROM CAMPO_POTRERO_MAPA WHERE cuenta_id = ?`)
    .get(cuentaId)) as { total: number };
  const color = normalizeColor(input.color, Number(countRow?.total ?? 0));
  const hectareas =
    input.hectareas != null && Number.isFinite(Number(input.hectareas))
      ? Number(input.hectareas)
      : null;
  const notas = String(input.notas ?? "").trim().slice(0, 500);
  const metadata = normalizeMetadata(input.metadata);
  const empresaOperativaId =
    input.empresa_operativa_id !== undefined
      ? input.empresa_operativa_id
      : scope?.stampEmpresaOperativaId ?? null;

  const inserted = (await db
    .prepare(
      `INSERT INTO CAMPO_POTRERO_MAPA (cuenta_id, empresa_operativa_id, nombre, geojson, color, hectareas, notas, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING ${POTRERO_SELECT}`,
    )
    .get(
      cuentaId,
      empresaOperativaId,
      nombre,
      geojson,
      color,
      hectareas,
      notas,
      metadata,
    )) as Record<string, unknown>;

  await ensurePotreroEnCatalogo(db, cuentaId, nombre);
  return rowToCampoPotrero(inserted);
}

export async function updateCampoPotreroMapa(
  db: Db,
  cuentaId: number,
  id: number,
  input: Partial<CampoPotreroMapaInput>,
  scope?: CampoMapaEmpresaScope,
): Promise<CampoPotreroMapaRow> {
  const existing = await getCampoPotreroMapaById(db, cuentaId, id, scope);
  if (!existing) throw new Error("Potrero no encontrado.");

  const nombre =
    input.nombre !== undefined ? normalizarPotrero(input.nombre) : existing.nombre;
  if (!nombre) throw new Error("Ingresá un nombre de potrero válido.");
  const geojson =
    input.geojson !== undefined ? normalizeGeoJson(input.geojson) : existing.geojson;
  const color =
    input.color !== undefined ? normalizeColor(input.color) : existing.color;
  const hectareas =
    input.hectareas !== undefined
      ? input.hectareas != null && Number.isFinite(Number(input.hectareas))
        ? Number(input.hectareas)
        : null
      : existing.hectareas;
  const notas =
    input.notas !== undefined ? String(input.notas ?? "").trim().slice(0, 500) : existing.notas;
  const metadata =
    input.metadata !== undefined ? normalizeMetadata(input.metadata) : existing.metadata;
  // En modo individual, al editar un potrero legacy (sin empresa) lo asignamos a la activa.
  const empresaOperativaId =
    input.empresa_operativa_id !== undefined
      ? input.empresa_operativa_id
      : existing.empresa_operativa_id == null && scope?.stampEmpresaOperativaId != null
        ? scope.stampEmpresaOperativaId
        : existing.empresa_operativa_id;

  const updated = (await db
    .prepare(
      `UPDATE CAMPO_POTRERO_MAPA
       SET nombre = ?, geojson = ?, color = ?, hectareas = ?, notas = ?, metadata = ?,
           empresa_operativa_id = ?, actualizado_en = NOW()
       WHERE cuenta_id = ? AND id = ?
       RETURNING ${POTRERO_SELECT}`,
    )
    .get(
      nombre,
      geojson,
      color,
      hectareas,
      notas,
      metadata,
      empresaOperativaId,
      cuentaId,
      id,
    )) as Record<string, unknown>;

  await ensurePotreroEnCatalogo(db, cuentaId, nombre);
  return rowToCampoPotrero(updated);
}

export async function deleteCampoPotreroMapa(
  db: Db,
  cuentaId: number,
  id: number,
  scope?: CampoMapaEmpresaScope,
): Promise<void> {
  const existing = await getCampoPotreroMapaById(db, cuentaId, id, scope);
  if (!existing) throw new Error("Potrero no encontrado.");
  const result = await db
    .prepare(`DELETE FROM CAMPO_POTRERO_MAPA WHERE cuenta_id = ? AND id = ?`)
    .run(cuentaId, id);
  if (!result.changes) throw new Error("Potrero no encontrado.");
}
