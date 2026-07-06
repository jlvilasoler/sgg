import type { Db } from "./db/pg-client.js";

export const COLORES_CARAVANA = [
  { id: "amarillo", label: "Amarillo", hex: "#facc15" },
  { id: "rojo", label: "Rojo", hex: "#dc2626" },
  { id: "azul", label: "Azul", hex: "#2563eb" },
  { id: "verde", label: "Verde", hex: "#16a34a" },
  { id: "naranja", label: "Naranja", hex: "#ea580c" },
  { id: "blanco", label: "Blanco", hex: "#f8fafc" },
  { id: "negro", label: "Negro", hex: "#1e293b" },
  { id: "rosa", label: "Rosa", hex: "#ec4899" },
  { id: "violeta", label: "Violeta", hex: "#7c3aed" },
  { id: "celeste", label: "Celeste", hex: "#38bdf8" },
] as const;

export type ColorCaravanaId = (typeof COLORES_CARAVANA)[number]["id"];

const COLOR_IDS = new Set<string>(COLORES_CARAVANA.map((c) => c.id));

export function normalizarColorCaravana(val: string | undefined | null): string {
  const norm = String(val ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (!norm || !COLOR_IDS.has(norm)) return "";
  return norm;
}

export function etiquetaColorCaravana(val: string | undefined | null): string {
  const id = normalizarColorCaravana(val);
  if (!id) return "—";
  return COLORES_CARAVANA.find((c) => c.id === id)?.label ?? id;
}

export async function migrateGanaderoColorCaravanaColumn(db: Db): Promise<void> {
  const done = (await db
    .prepare(
      `SELECT 1 AS ok FROM STOCK_GANADERO_DISPOSITIVO_HISTORIAL
       WHERE clave = '__meta__' AND campo = 'color_caravana_col' LIMIT 1`
    )
    .get()) as { ok: number } | undefined;
  if (done) return;

  try {
    await db
      .prepare(
        `ALTER TABLE STOCK_GANADERO_DISPOSITIVO ADD COLUMN color_caravana TEXT NOT NULL DEFAULT ''`
      )
      .run();
  } catch {
    /* columna ya existe */
  }

  await db
    .prepare(
      `INSERT INTO STOCK_GANADERO_DISPOSITIVO_HISTORIAL
         (clave, campo, etiqueta, valor_anterior, valor_nuevo)
       VALUES ('__meta__', 'color_caravana_col', '', '', '')`
    )
    .run();
}

export async function migrateEquinoColorCaravanaColumn(db: Db): Promise<void> {
  const done = (await db
    .prepare(
      `SELECT 1 AS ok FROM STOCK_EQUINO_DISPOSITIVO_HISTORIAL
       WHERE clave = '__meta__' AND campo = 'color_caravana_col' LIMIT 1`
    )
    .get()) as { ok: number } | undefined;
  if (done) return;

  try {
    await db
      .prepare(
        `ALTER TABLE STOCK_EQUINO_DISPOSITIVO ADD COLUMN color_caravana TEXT NOT NULL DEFAULT ''`
      )
      .run();
  } catch {
    /* columna ya existe */
  }

  await db
    .prepare(
      `INSERT INTO STOCK_EQUINO_DISPOSITIVO_HISTORIAL
         (clave, campo, etiqueta, valor_anterior, valor_nuevo)
       VALUES ('__meta__', 'color_caravana_col', '', '', '')`
    )
    .run();
}
