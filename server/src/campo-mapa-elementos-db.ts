import type { Db } from "./db/pg-client.js";

export const CAMPO_MAPA_ELEMENTO_TIPOS = [
  "marcador",
  "nota",
  "linea",
  "area",
  "clip",
  "medicion_distancia",
  "medicion_area",
] as const;

export type CampoMapaElementoTipo = (typeof CAMPO_MAPA_ELEMENTO_TIPOS)[number];

export interface CampoMapaElementoRow {
  id: number;
  cuenta_id: number;
  tipo: CampoMapaElementoTipo;
  nombre: string;
  notas: string;
  geojson: string;
  color: string;
  metadata: string;
  creado_en: string;
  actualizado_en: string;
}

export interface CampoMapaElementoInput {
  tipo: CampoMapaElementoTipo;
  nombre: string;
  geojson: unknown;
  notas?: string;
  color?: string;
  metadata?: Record<string, unknown>;
}

const COLORS: Record<CampoMapaElementoTipo, string> = {
  marcador: "#2563eb",
  nota: "#ca8a04",
  linea: "#7c3aed",
  area: "#0d9488",
  clip: "#475569",
  medicion_distancia: "#ea580c",
  medicion_area: "#ea580c",
};

function isTipo(value: string): value is CampoMapaElementoTipo {
  return (CAMPO_MAPA_ELEMENTO_TIPOS as readonly string[]).includes(value);
}

function rowToElemento(row: Record<string, unknown>): CampoMapaElementoRow {
  const tipoRaw = String(row.tipo ?? "marcador");
  return {
    id: Number(row.id),
    cuenta_id: Number(row.cuenta_id),
    tipo: isTipo(tipoRaw) ? tipoRaw : "marcador",
    nombre: String(row.nombre ?? ""),
    notas: String(row.notas ?? ""),
    geojson: String(row.geojson ?? ""),
    color: String(row.color ?? COLORS.marcador),
    metadata: String(row.metadata ?? "{}"),
    creado_en: String(row.creado_en ?? ""),
    actualizado_en: String(row.actualizado_en ?? ""),
  };
}

function normalizeGeoJson(raw: unknown, allowed: ("Point" | "LineString" | "Polygon")[]): string {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("La geometría no es un GeoJSON válido.");
    }
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("La geometría no es un GeoJSON válido.");
  }
  const obj = parsed as { type?: string; coordinates?: unknown };
  if (!obj.type || !allowed.includes(obj.type as "Point" | "LineString" | "Polygon")) {
    throw new Error("Tipo de geometría no válido para este elemento.");
  }
  return JSON.stringify({ type: obj.type, coordinates: obj.coordinates });
}

function geoAllowedForTipo(tipo: CampoMapaElementoTipo): ("Point" | "LineString" | "Polygon")[] {
  switch (tipo) {
    case "marcador":
    case "nota":
    case "clip":
      return ["Point"];
    case "linea":
    case "medicion_distancia":
      return ["LineString"];
    case "area":
    case "medicion_area":
      return ["Polygon"];
  }
}

function normalizeColor(tipo: CampoMapaElementoTipo, value?: string): string {
  const raw = String(value ?? "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw;
  return COLORS[tipo];
}

function normalizeMetadata(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "{}";
  try {
    return JSON.stringify(raw);
  } catch {
    return "{}";
  }
}

export async function initCampoMapaElementosTable(db: Db): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS CAMPO_MAPA_ELEMENTO (
         id SERIAL PRIMARY KEY,
         cuenta_id INTEGER NOT NULL REFERENCES EMPRESAS_CUENTA(id) ON DELETE CASCADE,
         tipo TEXT NOT NULL,
         nombre TEXT NOT NULL,
         notas TEXT NOT NULL DEFAULT '',
         geojson TEXT NOT NULL,
         color TEXT NOT NULL DEFAULT '#2563eb',
         metadata TEXT NOT NULL DEFAULT '{}',
         creado_en TIMESTAMPTZ DEFAULT NOW(),
         actualizado_en TIMESTAMPTZ DEFAULT NOW()
       )`,
    )
    .run();

  await db
    .prepare(
      `CREATE INDEX IF NOT EXISTS idx_campo_mapa_elemento_cuenta
       ON CAMPO_MAPA_ELEMENTO(cuenta_id)`,
    )
    .run();
}

export async function listCampoMapaElementos(
  db: Db,
  cuentaId: number,
): Promise<CampoMapaElementoRow[]> {
  const rows = (await db
    .prepare(
      `SELECT id, cuenta_id, tipo, nombre, notas, geojson, color, metadata, creado_en, actualizado_en
       FROM CAMPO_MAPA_ELEMENTO
       WHERE cuenta_id = ?
       ORDER BY creado_en DESC, id DESC`,
    )
    .all(cuentaId)) as Record<string, unknown>[];
  return rows.map(rowToElemento);
}

export async function getCampoMapaElementoById(
  db: Db,
  cuentaId: number,
  id: number,
): Promise<CampoMapaElementoRow | null> {
  const row = (await db
    .prepare(
      `SELECT id, cuenta_id, tipo, nombre, notas, geojson, color, metadata, creado_en, actualizado_en
       FROM CAMPO_MAPA_ELEMENTO WHERE cuenta_id = ? AND id = ? LIMIT 1`,
    )
    .get(cuentaId, id)) as Record<string, unknown> | undefined;
  return row ? rowToElemento(row) : null;
}

export async function createCampoMapaElemento(
  db: Db,
  cuentaId: number,
  input: CampoMapaElementoInput,
): Promise<CampoMapaElementoRow> {
  if (!Number.isFinite(cuentaId) || cuentaId <= 0) {
    throw new Error("Cuenta inválida para guardar el elemento del mapa.");
  }
  if (!isTipo(input.tipo)) throw new Error("Tipo de elemento inválido.");
  const nombre = String(input.nombre ?? "").trim().slice(0, 80);
  if (!nombre) throw new Error("Ingresá un nombre para el elemento.");
  const geojson = normalizeGeoJson(input.geojson, geoAllowedForTipo(input.tipo));
  const notas = String(input.notas ?? "").trim().slice(0, 2000);
  const color = normalizeColor(input.tipo, input.color);
  const metadata = normalizeMetadata(input.metadata);

  const inserted = (await db
    .prepare(
      `INSERT INTO CAMPO_MAPA_ELEMENTO (cuenta_id, tipo, nombre, notas, geojson, color, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING id, cuenta_id, tipo, nombre, notas, geojson, color, metadata, creado_en, actualizado_en`,
    )
    .get(cuentaId, input.tipo, nombre, notas, geojson, color, metadata)) as Record<string, unknown>;

  return rowToElemento(inserted);
}

export async function updateCampoMapaElemento(
  db: Db,
  cuentaId: number,
  id: number,
  input: Partial<CampoMapaElementoInput>,
): Promise<CampoMapaElementoRow> {
  const existing = await getCampoMapaElementoById(db, cuentaId, id);
  if (!existing) throw new Error("Elemento no encontrado.");

  const tipo = input.tipo && isTipo(input.tipo) ? input.tipo : existing.tipo;
  const nombre =
    input.nombre !== undefined ? String(input.nombre).trim().slice(0, 80) : existing.nombre;
  if (!nombre) throw new Error("Ingresá un nombre para el elemento.");
  const geojson =
    input.geojson !== undefined
      ? normalizeGeoJson(input.geojson, geoAllowedForTipo(tipo))
      : existing.geojson;
  const notas =
    input.notas !== undefined ? String(input.notas).trim().slice(0, 2000) : existing.notas;
  const color =
    input.color !== undefined ? normalizeColor(tipo, input.color) : existing.color;
  const metadata =
    input.metadata !== undefined ? normalizeMetadata(input.metadata) : existing.metadata;

  const updated = (await db
    .prepare(
      `UPDATE CAMPO_MAPA_ELEMENTO
       SET tipo = ?, nombre = ?, notas = ?, geojson = ?, color = ?, metadata = ?, actualizado_en = NOW()
       WHERE cuenta_id = ? AND id = ?
       RETURNING id, cuenta_id, tipo, nombre, notas, geojson, color, metadata, creado_en, actualizado_en`,
    )
    .get(tipo, nombre, notas, geojson, color, metadata, cuentaId, id)) as Record<string, unknown>;

  return rowToElemento(updated);
}

export async function deleteCampoMapaElemento(
  db: Db,
  cuentaId: number,
  id: number,
): Promise<void> {
  const result = await db
    .prepare(`DELETE FROM CAMPO_MAPA_ELEMENTO WHERE cuenta_id = ? AND id = ?`)
    .run(cuentaId, id);
  if (!result.changes) throw new Error("Elemento no encontrado.");
}
