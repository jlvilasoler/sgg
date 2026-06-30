import type { Db } from "./db/pg-client.js";
import fs from "fs";
import path from "path";
import { scgDataPath } from "./data-dir.js";

export type StockDispositivoModulo = "ganadero" | "equino";

export const STOCK_DISPOSITIVO_FOTOS_DIR = scgDataPath("stock-dispositivo-fotos");
export const STOCK_DISPOSITIVO_FOTO_MAX_BYTES = 4 * 1024 * 1024;
export const STOCK_DISPOSITIVO_FOTOS_MAX = 20;
const FOTO_THUMB_MAX_PX = 192;

const TABLE: Record<StockDispositivoModulo, string> = {
  ganadero: "STOCK_GANADERO_DISPOSITIVO",
  equino: "STOCK_EQUINO_DISPOSITIVO",
};

const FOTOS_TABLE: Record<StockDispositivoModulo, string> = {
  ganadero: "STOCK_GANADERO_DISPOSITIVO_FOTOS",
  equino: "STOCK_EQUINO_DISPOSITIVO_FOTOS",
};

const HIST_TABLE: Record<StockDispositivoModulo, string> = {
  ganadero: "STOCK_GANADERO_DISPOSITIVO_HISTORIAL",
  equino: "STOCK_EQUINO_DISPOSITIVO_HISTORIAL",
};

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export interface StockDispositivoFotoItemDto {
  id: number;
  url: string;
  thumb_url: string;
  es_principal: boolean;
  creado_en: string;
}

export interface StockDispositivoFotoDto {
  tiene_foto: boolean;
  foto_url: string | null;
  foto_actualizado_en: string;
  foto_principal_id: number | null;
  fotos: StockDispositivoFotoItemDto[];
}

interface FotoGalleryRow {
  id: number;
  clave: string;
  archivo: string;
  mime: string;
  es_principal: number;
  creado_en: string;
}

interface LegacyFotoRow {
  clave: string;
  foto_archivo: string;
  foto_mime: string;
  foto_actualizado_en: string;
}

function normalizeClave(clave: string): string {
  const norm = clave.replace(/\D/g, "");
  if (!norm) throw new Error("Clave de dispositivo inválida");
  return norm;
}

function extFromMime(mime: string): string {
  const ext = MIME_EXT[mime.toLowerCase()];
  if (!ext) throw new Error("Formato no permitido. Usá JPG, PNG, WebP o GIF.");
  return ext;
}

function moduloDir(modulo: StockDispositivoModulo): string {
  const dir = path.join(STOCK_DISPOSITIVO_FOTOS_DIR, modulo);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function deleteFotoFile(modulo: StockDispositivoModulo, archivo: string): void {
  if (!archivo) return;
  const full = path.join(moduloDir(modulo), archivo);
  if (fs.existsSync(full)) fs.unlinkSync(full);
  const thumb = thumbFilePath(modulo, archivo);
  if (fs.existsSync(thumb)) fs.unlinkSync(thumb);
}

function thumbFilePath(modulo: StockDispositivoModulo, archivo: string): string {
  const ext = path.extname(archivo);
  const base = archivo.slice(0, -ext.length);
  return path.join(moduloDir(modulo), `${base}_thumb.webp`);
}

async function writeThumbFile(
  modulo: StockDispositivoModulo,
  archivo: string
): Promise<boolean> {
  const full = path.join(moduloDir(modulo), archivo);
  if (!fs.existsSync(full)) return false;
  const thumbPath = thumbFilePath(modulo, archivo);
  if (fs.existsSync(thumbPath)) return true;
  try {
    const sharp = (await import("sharp")).default;
    await sharp(full)
      .rotate()
      .resize(FOTO_THUMB_MAX_PX, FOTO_THUMB_MAX_PX, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toFile(thumbPath);
    return fs.existsSync(thumbPath);
  } catch {
    return false;
  }
}

export function publicStockDispositivoFotoUrl(
  modulo: StockDispositivoModulo,
  clave: string,
  fotoId?: number,
  version?: string
): string {
  const claveNorm = normalizeClave(clave);
  const base = fotoId
    ? `/api/stock-${modulo}/dispositivos/${encodeURIComponent(claveNorm)}/foto/${fotoId}`
    : `/api/stock-${modulo}/dispositivos/${encodeURIComponent(claveNorm)}/foto`;
  return version ? `${base}?v=${encodeURIComponent(version)}` : base;
}

export function publicStockDispositivoFotoThumbUrl(
  modulo: StockDispositivoModulo,
  clave: string,
  fotoId: number,
  version?: string
): string {
  const base = publicStockDispositivoFotoUrl(modulo, clave, fotoId, version);
  return base.includes("?") ? `${base}&thumb=1` : `${base}?thumb=1`;
}

function rowToItem(
  modulo: StockDispositivoModulo,
  row: FotoGalleryRow
): StockDispositivoFotoItemDto | null {
  if (!row.archivo?.trim()) return null;
  const full = path.join(moduloDir(modulo), row.archivo);
  if (!fs.existsSync(full)) {
    console.warn(
      `[stock-foto] Archivo ausente en disco: ${full} (clave ${row.clave}, id ${row.id})`
    );
    return null;
  }
  const version = row.creado_en || undefined;
  return {
    id: row.id,
    url: publicStockDispositivoFotoUrl(
      modulo,
      row.clave,
      row.id,
      version
    ),
    thumb_url: publicStockDispositivoFotoThumbUrl(
      modulo,
      row.clave,
      row.id,
      version
    ),
    es_principal: Boolean(row.es_principal),
    creado_en: row.creado_en || "",
  };
}

function galleryToDto(
  modulo: StockDispositivoModulo,
  clave: string,
  rows: FotoGalleryRow[]
): StockDispositivoFotoDto {
  const fotos = rows
    .map((r) => rowToItem(modulo, r))
    .filter((f): f is StockDispositivoFotoItemDto => f !== null);
  const principal =
    fotos.find((f) => f.es_principal) ?? (fotos.length ? fotos[0] : null);
  if (!fotos.length) {
    return {
      tiene_foto: false,
      foto_url: null,
      foto_actualizado_en: "",
      foto_principal_id: null,
      fotos: [],
    };
  }
  return {
    tiene_foto: true,
    foto_url: principal?.url ?? null,
    foto_actualizado_en: principal?.creado_en ?? "",
    foto_principal_id: principal?.id ?? null,
    fotos,
  };
}

async function syncLegacyPrincipalColumns(
  db: Db,
  modulo: StockDispositivoModulo,
  claveNorm: string,
  principal: FotoGalleryRow | undefined
): Promise<void> {
  const table = TABLE[modulo];
  if (!principal?.archivo) {
    await db
      .prepare(
        `UPDATE ${table}
         SET foto_archivo = '', foto_mime = '', foto_actualizado_en = '', actualizado_en = NOW()
         WHERE clave = ?`
      )
      .run(claveNorm);
    return;
  }
  await db
    .prepare(
      `UPDATE ${table}
       SET foto_archivo = ?, foto_mime = ?, foto_actualizado_en = ?, actualizado_en = NOW()
       WHERE clave = ?`
    )
    .run(
      principal.archivo,
      principal.mime || "image/jpeg",
      principal.creado_en || "",
      claveNorm
    );
}

export async function migrateStockDispositivoFotoColumns(
  db: Db,
  modulo: StockDispositivoModulo
): Promise<void> {
  moduloDir(modulo);
  const hist = HIST_TABLE[modulo];
  const done = (await db
    .prepare(
      `SELECT 1 AS ok FROM ${hist}
       WHERE clave = '__meta__' AND campo = 'foto_cols' LIMIT 1`
    )
    .get()) as { ok: number } | undefined;
  if (done) return;

  const table = TABLE[modulo];
  for (const col of [
    `ALTER TABLE ${table} ADD COLUMN foto_archivo TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE ${table} ADD COLUMN foto_mime TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE ${table} ADD COLUMN foto_actualizado_en TEXT NOT NULL DEFAULT ''`,
  ]) {
    try {
      await db.prepare(col).run();
    } catch {
      /* columna ya existe */
    }
  }

  await db
    .prepare(
      `INSERT INTO ${hist} (clave, campo, etiqueta, valor_anterior, valor_nuevo)
       VALUES ('__meta__', 'foto_cols', '', '', '')`
    )
    .run();
}

export async function migrateStockDispositivoFotosGallery(
  db: Db,
  modulo: StockDispositivoModulo
): Promise<void> {
  const hist = HIST_TABLE[modulo];
  const fotosTable = FOTOS_TABLE[modulo];
  const deviceTable = TABLE[modulo];

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS ${fotosTable} (
         id SERIAL PRIMARY KEY,
         clave TEXT NOT NULL,
         archivo TEXT NOT NULL,
         mime TEXT NOT NULL,
         es_principal INTEGER NOT NULL DEFAULT 0,
         creado_en TEXT NOT NULL
       )`
    )
    .run();

  try {
    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_${fotosTable.toLowerCase()}_clave
         ON ${fotosTable} (clave)`
      )
      .run();
  } catch {
    /* índice ya existe */
  }

  const done = (await db
    .prepare(
      `SELECT 1 AS ok FROM ${hist}
       WHERE clave = '__meta__' AND campo = 'foto_gallery_v1' LIMIT 1`
    )
    .get()) as { ok: number } | undefined;
  if (done) return;

  const legacyRows = (await db
    .prepare(
      `SELECT clave, foto_archivo, foto_mime, foto_actualizado_en
       FROM ${deviceTable}
       WHERE TRIM(foto_archivo) <> ''`
    )
    .all()) as LegacyFotoRow[];

  for (const row of legacyRows) {
    const claveNorm = row.clave.replace(/\D/g, "");
    if (!claveNorm || !row.foto_archivo?.trim()) continue;
    const full = path.join(moduloDir(modulo), row.foto_archivo);
    if (!fs.existsSync(full)) continue;

    const exists = (await db
      .prepare(`SELECT 1 AS ok FROM ${fotosTable} WHERE clave = ? LIMIT 1`)
      .get(claveNorm)) as { ok: number } | undefined;
    if (exists) continue;

    const creado = row.foto_actualizado_en?.trim() || new Date().toISOString();
    await db
      .prepare(
        `INSERT INTO ${fotosTable} (clave, archivo, mime, es_principal, creado_en)
         VALUES (?, ?, ?, 1, ?)`
      )
      .run(
        claveNorm,
        row.foto_archivo,
        row.foto_mime?.trim() || "image/jpeg",
        creado
      );
  }

  await db
    .prepare(
      `INSERT INTO ${hist} (clave, campo, etiqueta, valor_anterior, valor_nuevo)
       VALUES ('__meta__', 'foto_gallery_v1', '', '', '')`
    )
    .run();
}

async function listGalleryRows(
  db: Db,
  modulo: StockDispositivoModulo,
  claveNorm: string
): Promise<FotoGalleryRow[]> {
  const fotosTable = FOTOS_TABLE[modulo];
  return (await db
    .prepare(
      `SELECT id, clave, archivo, mime, es_principal, creado_en
       FROM ${fotosTable}
       WHERE clave = ?
       ORDER BY es_principal DESC, id ASC`
    )
    .all(claveNorm)) as FotoGalleryRow[];
}

async function getGalleryRow(
  db: Db,
  modulo: StockDispositivoModulo,
  claveNorm: string,
  fotoId: number
): Promise<FotoGalleryRow | undefined> {
  const fotosTable = FOTOS_TABLE[modulo];
  return (await db
    .prepare(
      `SELECT id, clave, archivo, mime, es_principal, creado_en
       FROM ${fotosTable}
       WHERE clave = ? AND id = ?`
    )
    .get(claveNorm, fotoId)) as FotoGalleryRow | undefined;
}

async function countGalleryRows(
  db: Db,
  modulo: StockDispositivoModulo,
  claveNorm: string
): Promise<number> {
  const fotosTable = FOTOS_TABLE[modulo];
  const row = (await db
    .prepare(`SELECT COUNT(*) AS n FROM ${fotosTable} WHERE clave = ?`)
    .get(claveNorm)) as { n: number };
  return Number(row?.n ?? 0);
}

export async function mapStockDispositivoFotos(
  db: Db,
  modulo: StockDispositivoModulo
): Promise<Map<string, StockDispositivoFotoDto>> {
  const fotosTable = FOTOS_TABLE[modulo];
  const rows = (await db
    .prepare(
      `SELECT id, clave, archivo, mime, es_principal, creado_en
       FROM ${fotosTable}
       ORDER BY clave ASC, es_principal DESC, id ASC`
    )
    .all()) as FotoGalleryRow[];

  const byClave = new Map<string, FotoGalleryRow[]>();
  for (const row of rows) {
    const list = byClave.get(row.clave) ?? [];
    list.push(row);
    byClave.set(row.clave, list);
  }

  const map = new Map<string, StockDispositivoFotoDto>();
  for (const [clave, list] of byClave) {
    map.set(clave, galleryToDto(modulo, clave, list));
  }
  return map;
}

export async function getStockDispositivoFotoDto(
  db: Db,
  modulo: StockDispositivoModulo,
  clave: string
): Promise<StockDispositivoFotoDto> {
  const claveNorm = normalizeClave(clave);
  const rows = await listGalleryRows(db, modulo, claveNorm);
  return galleryToDto(modulo, claveNorm, rows);
}

export async function loadStockDispositivoFoto(
  db: Db,
  modulo: StockDispositivoModulo,
  clave: string
): Promise<{ buffer: Buffer; mime: string } | null> {
  const claveNorm = normalizeClave(clave);
  const rows = await listGalleryRows(db, modulo, claveNorm);
  const principal = rows.find((r) => r.es_principal) ?? rows[0];
  if (!principal) {
    return readLegacyDeviceFotoBuffer(db, modulo, claveNorm);
  }
  return loadStockDispositivoFotoById(db, modulo, clave, principal.id);
}

async function readLegacyDeviceFotoBuffer(
  db: Db,
  modulo: StockDispositivoModulo,
  claveNorm: string
): Promise<{ buffer: Buffer; mime: string } | null> {
  const table = TABLE[modulo];
  const row = (await db
    .prepare(
      `SELECT foto_archivo, foto_mime FROM ${table}
       WHERE clave = ? AND TRIM(foto_archivo) <> ''`
    )
    .get(claveNorm)) as { foto_archivo: string; foto_mime: string } | undefined;
  if (!row?.foto_archivo?.trim()) return null;
  const full = path.join(moduloDir(modulo), row.foto_archivo);
  if (!fs.existsSync(full)) return null;
  return {
    buffer: fs.readFileSync(full),
    mime: row.foto_mime?.trim() || "image/jpeg",
  };
}

export async function loadStockDispositivoFotoById(
  db: Db,
  modulo: StockDispositivoModulo,
  clave: string,
  fotoId: number,
  opts?: { thumb?: boolean }
): Promise<{ buffer: Buffer; mime: string } | null> {
  const claveNorm = normalizeClave(clave);
  const row = await getGalleryRow(db, modulo, claveNorm, fotoId);
  if (!row?.archivo) {
    return readLegacyDeviceFotoBuffer(db, modulo, claveNorm);
  }
  const full = path.join(moduloDir(modulo), row.archivo);
  if (!fs.existsSync(full)) {
    console.warn(
      `[stock-foto] Galería sin archivo en disco: ${full} (id ${fotoId})`
    );
    return readLegacyDeviceFotoBuffer(db, modulo, claveNorm);
  }

  if (opts?.thumb) {
    await writeThumbFile(modulo, row.archivo);
    const thumbPath = thumbFilePath(modulo, row.archivo);
    if (fs.existsSync(thumbPath)) {
      return { buffer: fs.readFileSync(thumbPath), mime: "image/webp" };
    }
  }

  const mime = row.mime?.trim() || "image/jpeg";
  return { buffer: fs.readFileSync(full), mime };
}

export async function saveStockDispositivoFoto(
  db: Db,
  modulo: StockDispositivoModulo,
  clave: string,
  buffer: Buffer,
  mime: string
): Promise<StockDispositivoFotoDto> {
  if (!buffer.length) throw new Error("Seleccioná una imagen");
  if (buffer.length > STOCK_DISPOSITIVO_FOTO_MAX_BYTES) {
    throw new Error("La imagen no puede superar 4 MB");
  }

  const claveNorm = normalizeClave(clave);
  const count = await countGalleryRows(db, modulo, claveNorm);
  if (count >= STOCK_DISPOSITIVO_FOTOS_MAX) {
    throw new Error(`Máximo ${STOCK_DISPOSITIVO_FOTOS_MAX} fotos por animal`);
  }

  const ext = extFromMime(mime);
  const creado = new Date().toISOString();
  const fotosTable = FOTOS_TABLE[modulo];
  const esPrincipal = count === 0 ? 1 : 0;

  const ins = await db
    .prepare(
      `INSERT INTO ${fotosTable} (clave, archivo, mime, es_principal, creado_en)
       VALUES (?, '', ?, ?, ?)`
    )
    .run(claveNorm, mime, esPrincipal, creado);

  const fotoId = Number(ins.lastInsertRowid);
  const archivo = `${claveNorm}_${fotoId}.${ext}`;
  fs.writeFileSync(path.join(moduloDir(modulo), archivo), buffer);
  void writeThumbFile(modulo, archivo);

  await db
    .prepare(`UPDATE ${fotosTable} SET archivo = ? WHERE id = ?`)
    .run(archivo, fotoId);

  const rows = await listGalleryRows(db, modulo, claveNorm);
  const principal = rows.find((r) => r.es_principal) ?? rows[0];
  await syncLegacyPrincipalColumns(db, modulo, claveNorm, principal);

  return galleryToDto(modulo, claveNorm, rows);
}

export async function setStockDispositivoFotoPrincipal(
  db: Db,
  modulo: StockDispositivoModulo,
  clave: string,
  fotoId: number
): Promise<StockDispositivoFotoDto> {
  const claveNorm = normalizeClave(clave);
  const row = await getGalleryRow(db, modulo, claveNorm, fotoId);
  if (!row) throw new Error("Foto no encontrada");

  const fotosTable = FOTOS_TABLE[modulo];
  await db
    .prepare(`UPDATE ${fotosTable} SET es_principal = 0 WHERE clave = ?`)
    .run(claveNorm);
  await db
    .prepare(`UPDATE ${fotosTable} SET es_principal = 1 WHERE id = ?`)
    .run(fotoId);

  const rows = await listGalleryRows(db, modulo, claveNorm);
  const principal = rows.find((r) => r.id === fotoId);
  await syncLegacyPrincipalColumns(db, modulo, claveNorm, principal);

  return galleryToDto(modulo, claveNorm, rows);
}

export async function deleteStockDispositivoFotoById(
  db: Db,
  modulo: StockDispositivoModulo,
  clave: string,
  fotoId: number
): Promise<StockDispositivoFotoDto> {
  const claveNorm = normalizeClave(clave);
  const row = await getGalleryRow(db, modulo, claveNorm, fotoId);
  if (!row) throw new Error("Foto no encontrada");

  deleteFotoFile(modulo, row.archivo);
  const fotosTable = FOTOS_TABLE[modulo];
  await db.prepare(`DELETE FROM ${fotosTable} WHERE id = ?`).run(fotoId);

  let rows = await listGalleryRows(db, modulo, claveNorm);
  if (rows.length && !rows.some((r) => r.es_principal)) {
    await db
      .prepare(`UPDATE ${fotosTable} SET es_principal = 1 WHERE id = ?`)
      .run(rows[0].id);
    rows = await listGalleryRows(db, modulo, claveNorm);
  }

  const principal = rows.find((r) => r.es_principal) ?? rows[0];
  await syncLegacyPrincipalColumns(db, modulo, claveNorm, principal);

  return galleryToDto(modulo, claveNorm, rows);
}

export async function clearStockDispositivoFoto(
  db: Db,
  modulo: StockDispositivoModulo,
  clave: string
): Promise<StockDispositivoFotoDto> {
  const claveNorm = normalizeClave(clave);
  const rows = await listGalleryRows(db, modulo, claveNorm);
  for (const row of rows) {
    deleteFotoFile(modulo, row.archivo);
  }

  const fotosTable = FOTOS_TABLE[modulo];
  await db.prepare(`DELETE FROM ${fotosTable} WHERE clave = ?`).run(claveNorm);
  await syncLegacyPrincipalColumns(db, modulo, claveNorm, undefined);

  return galleryToDto(modulo, claveNorm, []);
}
