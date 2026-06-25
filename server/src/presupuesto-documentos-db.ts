import fs from "fs";
import path from "path";
import type { Db } from "./db/pg-client.js";
import { scgDataPath } from "./data-dir.js";

export const PRESUPUESTO_DOCS_DIR = scgDataPath("presupuesto-documentos");

export const PRESUPUESTO_DOC_MAX_BYTES = 15 * 1024 * 1024;

const ALLOWED_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MIME_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export interface PresupuestoDocumentoMeta {
  nombre: string;
  mime: string;
  tamano: number;
}

export interface PresupuestoDocumentoRow extends PresupuestoDocumentoMeta {
  presupuesto_id: number;
  archivo: string;
}

export function publicPresupuestoDocumentoUrl(presupuestoId: number): string {
  return `/api/presupuesto/${presupuestoId}/documento`;
}

function extFromMime(mime: string, originalName: string): string {
  const lower = mime.toLowerCase();
  const fromMime = MIME_EXT[lower];
  if (fromMime) return fromMime;
  const fromName = path.extname(originalName).replace(/^\./, "").toLowerCase();
  if (fromName && /^[a-z0-9]{1,8}$/.test(fromName)) return fromName;
  return "bin";
}

function bufferFromDbValue(value: unknown): Buffer | null {
  if (!value) return null;
  if (Buffer.isBuffer(value)) return value.length > 0 ? value : null;
  if (value instanceof Uint8Array) {
    const buf = Buffer.from(value);
    return buf.length > 0 ? buf : null;
  }
  return null;
}

export function validatePresupuestoDocumentoFile(
  mime: string,
  size: number,
  originalName: string
): { nombre: string } {
  const nombre = path.basename(String(originalName || "documento").trim()) || "documento";
  if (nombre.length > 220) throw new Error("El nombre del archivo es demasiado largo");
  if (size <= 0) throw new Error("El archivo está vacío");
  if (size > PRESUPUESTO_DOC_MAX_BYTES) {
    throw new Error("El documento supera el máximo de 15 MB");
  }
  if (!ALLOWED_MIMES.has(mime.toLowerCase())) {
    throw new Error("Formato no permitido. Usá PDF o imagen (JPG, PNG, WebP).");
  }
  return { nombre };
}

export async function initPresupuestoDocumentosTable(db: Db): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS PRESUPUESTO_DOCUMENTOS (
        presupuesto_id INTEGER PRIMARY KEY,
        nombre TEXT NOT NULL,
        mime TEXT NOT NULL,
        tamano INTEGER NOT NULL DEFAULT 0,
        archivo TEXT NOT NULL DEFAULT '',
        datos BYTEA,
        creado_en TIMESTAMPTZ DEFAULT NOW()
      )`
    )
    .run();

  await db
    .prepare(
      `ALTER TABLE PRESUPUESTO_DOCUMENTOS
       ADD COLUMN IF NOT EXISTS datos BYTEA`
    )
    .run();

  await db
    .prepare(
      `ALTER TABLE PRESUPUESTO_DOCUMENTOS
       ALTER COLUMN archivo SET DEFAULT ''`
    )
    .run();
}

export async function getPresupuestoDocumentoRow(
  db: Db,
  presupuestoId: number
): Promise<PresupuestoDocumentoRow | null> {
  const row = (await db
    .prepare(
      `SELECT presupuesto_id, nombre, mime, tamano, archivo
       FROM PRESUPUESTO_DOCUMENTOS WHERE presupuesto_id = ?`
    )
    .get(presupuestoId)) as PresupuestoDocumentoRow | undefined;
  return row ?? null;
}

export function documentoMetaFromJoin(row: {
  doc_nombre?: string | null;
  doc_mime?: string | null;
  doc_tamano?: number | null;
}): PresupuestoDocumentoMeta | null {
  const nombre = String(row.doc_nombre ?? "").trim();
  if (!nombre) return null;
  return {
    nombre,
    mime: String(row.doc_mime ?? "application/octet-stream"),
    tamano: Number(row.doc_tamano ?? 0),
  };
}

function deleteDocumentoFile(archivo: string): void {
  const safe = path.basename(String(archivo ?? ""));
  if (!safe) return;
  const full = path.join(PRESUPUESTO_DOCS_DIR, safe);
  try {
    if (fs.existsSync(full)) fs.unlinkSync(full);
  } catch {
    /* ignorar errores de borrado en disco */
  }
}

export async function deletePresupuestoDocumento(db: Db, presupuestoId: number): Promise<void> {
  const row = await getPresupuestoDocumentoRow(db, presupuestoId);
  if (!row) return;
  if (row.archivo) deleteDocumentoFile(row.archivo);
  await db
    .prepare("DELETE FROM PRESUPUESTO_DOCUMENTOS WHERE presupuesto_id = ?")
    .run(presupuestoId);
}

export async function savePresupuestoDocumento(
  db: Db,
  presupuestoId: number,
  buffer: Buffer,
  mime: string,
  originalName: string
): Promise<PresupuestoDocumentoMeta> {
  const { nombre } = validatePresupuestoDocumentoFile(mime, buffer.length, originalName);
  await deletePresupuestoDocumento(db, presupuestoId);

  // Intentar también guardar copia en disco (best-effort; puede no persistir en serverless).
  const ext = extFromMime(mime, nombre);
  const archivo = `${presupuestoId}.${ext}`;
  try {
    fs.writeFileSync(path.join(PRESUPUESTO_DOCS_DIR, archivo), buffer);
  } catch {
    /* en entornos sin disco persistente se ignora */
  }

  await db
    .prepare(
      `INSERT INTO PRESUPUESTO_DOCUMENTOS (presupuesto_id, nombre, mime, tamano, archivo, datos)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(presupuestoId, nombre, mime, buffer.length, archivo, buffer);

  return { nombre, mime, tamano: buffer.length };
}

/** Devuelve el contenido binario del documento desde la base o, si no, desde disco. */
export async function readPresupuestoDocumento(
  db: Db,
  presupuestoId: number
): Promise<{ buffer: Buffer; mime: string; nombre: string } | null> {
  const row = (await db
    .prepare(
      `SELECT nombre, mime, archivo, datos
       FROM PRESUPUESTO_DOCUMENTOS WHERE presupuesto_id = ?`
    )
    .get(presupuestoId)) as
    | { nombre: string; mime: string; archivo: string; datos: unknown }
    | undefined;
  if (!row) return null;

  const mime = String(row.mime ?? "application/octet-stream");
  const nombre = String(row.nombre ?? "documento");

  const dbBuffer = bufferFromDbValue(row.datos);
  if (dbBuffer) return { buffer: dbBuffer, mime, nombre };

  const safe = path.basename(String(row.archivo ?? ""));
  if (safe) {
    const full = path.join(PRESUPUESTO_DOCS_DIR, safe);
    if (fs.existsSync(full)) {
      return { buffer: fs.readFileSync(full), mime, nombre };
    }
  }
  return null;
}
