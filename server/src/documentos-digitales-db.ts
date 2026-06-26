import type { Db } from "./db/pg-client.js";
import {
  BROU_MAPEO_DEFAULT,
  COMISION_CONFIG_DEFAULT,
  GASTO_CAMPO_IDS,
  type ComisionDocumentoConfig,
  type GastoCampoId,
  type GastoMapeoCampos,
  normalizeComisionConfig,
  normalizeGastoCampoList,
  normalizeGastoMapeo,
} from "./gasto-campos.js";

export interface TipoDocumentoGastoRow {
  id: number;
  nombre: string;
  descripcion: string;
  origen: string;
  destino: string;
  activo: number;
  campos_habilitados: string;
  campos_requeridos: string;
  valores_defecto: string;
  mapeo_campos: string;
  comision_config: string;
  creado_en?: string;
  actualizado_en?: string;
}

export interface TipoDocumentoGasto {
  id: number;
  nombre: string;
  descripcion: string;
  origen: string;
  destino: string;
  activo: boolean;
  campos_habilitados: GastoCampoId[];
  campos_requeridos: GastoCampoId[];
  valores_defecto: Partial<Record<GastoCampoId, string>>;
  mapeo_campos: GastoMapeoCampos;
  comision_config: ComisionDocumentoConfig;
  creado_en?: string;
  actualizado_en?: string;
}

export interface TipoDocumentoGastoInput {
  nombre: string;
  descripcion?: string;
  origen?: string;
  destino?: string;
  activo?: boolean;
  campos_habilitados: GastoCampoId[];
  campos_requeridos?: GastoCampoId[];
  valores_defecto?: Partial<Record<GastoCampoId, string>>;
  mapeo_campos?: GastoMapeoCampos;
  comision_config?: ComisionDocumentoConfig;
}

function parseJsonObject(raw: string): Record<string, string> {
  try {
    const v = JSON.parse(raw || "{}");
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const out: Record<string, string> = {};
    for (const [k, val] of Object.entries(v)) {
      if (typeof val === "string") out[k] = val;
    }
    return out;
  } catch {
    return {};
  }
}

function rowToDto(row: TipoDocumentoGastoRow): TipoDocumentoGasto {
  const habilitados = normalizeGastoCampoList(JSON.parse(row.campos_habilitados || "[]"));
  const requeridos = normalizeGastoCampoList(JSON.parse(row.campos_requeridos || "[]")).filter(
    (c) => habilitados.includes(c)
  );
  const defectoRaw = parseJsonObject(row.valores_defecto);
  const valores_defecto: Partial<Record<GastoCampoId, string>> = {};
  for (const campo of GASTO_CAMPO_IDS) {
    if (defectoRaw[campo]) valores_defecto[campo] = defectoRaw[campo];
  }
  let mapeo_campos: GastoMapeoCampos = {};
  try {
    mapeo_campos = normalizeGastoMapeo(JSON.parse(row.mapeo_campos || "{}"));
  } catch {
    mapeo_campos = {};
  }
  let comision_config = COMISION_CONFIG_DEFAULT;
  try {
    comision_config = normalizeComisionConfig(JSON.parse(row.comision_config || "{}"));
  } catch {
    comision_config = COMISION_CONFIG_DEFAULT;
  }
  return {
    id: row.id,
    nombre: row.nombre,
    descripcion: row.descripcion ?? "",
    origen: row.origen ?? "",
    destino: row.destino ?? "",
    activo: row.activo === 1,
    campos_habilitados: habilitados,
    campos_requeridos: requeridos,
    valores_defecto,
    mapeo_campos,
    comision_config,
    creado_en: row.creado_en,
    actualizado_en: row.actualizado_en,
  };
}

function assertTipoInput(input: TipoDocumentoGastoInput): void {
  const nombre = input.nombre?.trim();
  if (!nombre) throw new Error("El nombre del tipo de documento es obligatorio");
  const habilitados = normalizeGastoCampoList(input.campos_habilitados);
  if (habilitados.length === 0) {
    throw new Error("Seleccioná al menos un campo para este tipo de documento");
  }
  const requeridos = normalizeGastoCampoList(input.campos_requeridos ?? []).filter((c) =>
    habilitados.includes(c)
  );
  if (requeridos.length === 0) {
    throw new Error("Marcá al menos un campo como obligatorio");
  }
}

export async function initDocumentosDigitalesTables(db: Db): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS DOC_DIGITAL_TIPOS_GASTO (
        id SERIAL PRIMARY KEY,
        nombre TEXT NOT NULL,
        descripcion TEXT NOT NULL DEFAULT '',
        origen TEXT NOT NULL DEFAULT '',
        destino TEXT NOT NULL DEFAULT '',
        activo INTEGER NOT NULL DEFAULT 1,
        campos_habilitados TEXT NOT NULL DEFAULT '[]',
        campos_requeridos TEXT NOT NULL DEFAULT '[]',
        valores_defecto TEXT NOT NULL DEFAULT '{}',
        mapeo_campos TEXT NOT NULL DEFAULT '{}',
        comision_config TEXT NOT NULL DEFAULT '{}',
        creado_en TIMESTAMPTZ DEFAULT NOW(),
        actualizado_en TIMESTAMPTZ DEFAULT NOW()
      )`
    )
    .run();

  await db
    .prepare(
      `ALTER TABLE DOC_DIGITAL_TIPOS_GASTO
       ADD COLUMN IF NOT EXISTS mapeo_campos TEXT NOT NULL DEFAULT '{}'`
    )
    .run();

  await db
    .prepare(
      `ALTER TABLE DOC_DIGITAL_TIPOS_GASTO
       ADD COLUMN IF NOT EXISTS comision_config TEXT NOT NULL DEFAULT '{}'`
    )
    .run();

  await db
    .prepare(
      `ALTER TABLE DOC_DIGITAL_TIPOS_GASTO
       ADD COLUMN IF NOT EXISTS destino TEXT NOT NULL DEFAULT ''`
    )
    .run();

  await seedTipoDocumentoGastoBrouIfEmpty(db);
  await seedTipoDocumentoGastoSantanderIfMissing(db);
}

async function seedTipoDocumentoGastoBrouIfEmpty(db: Db): Promise<void> {
  const row = (await db
    .prepare("SELECT COUNT(*) AS n FROM DOC_DIGITAL_TIPOS_GASTO")
    .get()) as { n: number };
  if (Number(row.n) > 0) return;

  const habilitados: GastoCampoId[] = [
    "empresa",
    "fecha",
    "proveedor",
    "concepto",
    "importes",
    "observaciones",
    "rubro",
    "sub_rubro",
  ];
  const requeridos: GastoCampoId[] = [
    "empresa",
    "fecha",
    "proveedor",
    "concepto",
    "importes",
    "rubro",
  ];

  await db
    .prepare(
      `INSERT INTO DOC_DIGITAL_TIPOS_GASTO
       (nombre, descripcion, origen, activo, campos_habilitados, campos_requeridos, valores_defecto, mapeo_campos, comision_config)
       VALUES (?, ?, ?, 1, ?, ?, '{}', ?, ?)`
    )
    .run(
      "BROU — Transferencias",
      "Extracto de transferencias del Banco República (BROU) a proveedores",
      "BROU",
      JSON.stringify(habilitados),
      JSON.stringify(requeridos),
      JSON.stringify(BROU_MAPEO_DEFAULT),
      JSON.stringify(COMISION_CONFIG_DEFAULT)
    );
  console.info("[SGG] Tipo de documento BROU — Transferencias creado por defecto");
}

async function seedTipoDocumentoGastoSantanderIfMissing(db: Db): Promise<void> {
  const habilitados: GastoCampoId[] = [
    "empresa",
    "fecha",
    "proveedor",
    "concepto",
    "importes",
    "observaciones",
    "rubro",
    "sub_rubro",
  ];
  const requeridos: GastoCampoId[] = [
    "empresa",
    "fecha",
    "proveedor",
    "concepto",
    "importes",
    "rubro",
  ];
  const mapeo: GastoMapeoCampos = {
    nro_operacion_origen: "Nro. de Referencia",
    fecha: "Fecha de finalización",
    proveedor: "Cuenta Destino",
    concepto: "Tipo de operación",
    observaciones: "Usuario Originador",
    importes: "Monto acreditado",
  };
  const comisionMapeo: GastoMapeoCampos = {
    nro_operacion_origen: "Nro. de Referencia",
    fecha: "Fecha de finalización",
    observaciones: "Usuario Originador",
  };
  const comision: ComisionDocumentoConfig = normalizeComisionConfig({
    activa: true,
    heredar: ["empresa", "rubro", "sub_rubro", "responsable_gasto"],
    campos_incluidos: [
      "nro_operacion_origen",
      "fecha",
      "concepto",
      "observaciones",
      "nro_factura",
      "importes",
      "proveedor",
    ],
    mapeo_campos: comisionMapeo,
    valores_fijos: {
      concepto: "COMISIONES BANCARIAS",
      proveedor: "app:1001:SANTANDER",
      importes: "USD:1.6",
    },
  });

  const existing = (await db
    .prepare(
      `SELECT *
       FROM DOC_DIGITAL_TIPOS_GASTO
       WHERE UPPER(origen) = 'SANTANDER'
          OR UPPER(nombre) LIKE '%SANTANDER%'
       ORDER BY id ASC
       LIMIT 1`
    )
    .get()) as TipoDocumentoGastoRow | undefined;

  if (existing) {
    const current = rowToDto(existing);
    const currentComision = normalizeComisionConfig(current.comision_config);
    const camposIncluidos = Array.from(
      new Set([...currentComision.campos_incluidos, ...comision.campos_incluidos])
    );
    const mergedComision: ComisionDocumentoConfig = normalizeComisionConfig({
      ...currentComision,
      activa: true,
      campos_incluidos: camposIncluidos,
      mapeo_campos: {
        ...comisionMapeo,
        ...currentComision.mapeo_campos,
      },
      valores_fijos: {
        ...currentComision.valores_fijos,
        concepto: "COMISIONES BANCARIAS",
        proveedor: "app:1001:SANTANDER",
        importes: "USD:1.6",
      },
    });
    const mergedMapeo = normalizeGastoMapeo({
      ...mapeo,
      ...current.mapeo_campos,
    });

    await db
      .prepare(
        `UPDATE DOC_DIGITAL_TIPOS_GASTO SET
          activo = 1,
          mapeo_campos = ?,
          comision_config = ?,
          actualizado_en = NOW()
         WHERE id = ?`
      )
      .run(JSON.stringify(mergedMapeo), JSON.stringify(mergedComision), existing.id);
    console.info("[SGG] Tipo de documento SANTANDER — Transferencias actualizado por defecto");
    return;
  }

  await db
    .prepare(
      `INSERT INTO DOC_DIGITAL_TIPOS_GASTO
       (nombre, descripcion, origen, destino, activo, campos_habilitados, campos_requeridos, valores_defecto, mapeo_campos, comision_config)
       VALUES (?, ?, ?, ?, 1, ?, ?, '{}', ?, ?)`
    )
    .run(
      "SANTANDER — Transferencias",
      "Comprobante Santander de transferencia a terceros en el banco",
      "SANTANDER",
      "SANTANDER",
      JSON.stringify(habilitados),
      JSON.stringify(requeridos),
      JSON.stringify(mapeo),
      JSON.stringify(comision)
    );
  console.info("[SGG] Tipo de documento SANTANDER — Transferencias creado por defecto");
}

export async function listTiposDocumentoGasto(
  db: Db,
  opts?: { soloActivos?: boolean }
): Promise<TipoDocumentoGasto[]> {
  const soloActivos = opts?.soloActivos ?? false;
  const rows = (await db
    .prepare(
      `SELECT * FROM DOC_DIGITAL_TIPOS_GASTO
       ${soloActivos ? "WHERE activo = 1" : ""}
       ORDER BY nombre ASC`
    )
    .all()) as TipoDocumentoGastoRow[];
  return rows.map(rowToDto);
}

export async function getTipoDocumentoGastoById(
  db: Db,
  id: number
): Promise<TipoDocumentoGasto | undefined> {
  const row = (await db
    .prepare("SELECT * FROM DOC_DIGITAL_TIPOS_GASTO WHERE id = ?")
    .get(id)) as TipoDocumentoGastoRow | undefined;
  return row ? rowToDto(row) : undefined;
}

export async function insertTipoDocumentoGasto(
  db: Db,
  input: TipoDocumentoGastoInput
): Promise<number> {
  assertTipoInput(input);
  const habilitados = normalizeGastoCampoList(input.campos_habilitados);
  const requeridos = normalizeGastoCampoList(input.campos_requeridos ?? []).filter((c) =>
    habilitados.includes(c)
  );
  const defecto = input.valores_defecto ?? {};
  const mapeo = normalizeGastoMapeo(input.mapeo_campos ?? {});
  const comision = normalizeComisionConfig(input.comision_config ?? COMISION_CONFIG_DEFAULT);

  const result = await db
    .prepare(
      `INSERT INTO DOC_DIGITAL_TIPOS_GASTO
       (nombre, descripcion, origen, destino, activo, campos_habilitados, campos_requeridos, valores_defecto, mapeo_campos, comision_config)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.nombre.trim(),
      (input.descripcion ?? "").trim(),
      (input.origen ?? "").trim().toUpperCase(),
      (input.destino ?? "").trim().toUpperCase(),
      input.activo === false ? 0 : 1,
      JSON.stringify(habilitados),
      JSON.stringify(requeridos),
      JSON.stringify(defecto),
      JSON.stringify(mapeo),
      JSON.stringify(comision)
    );
  return result.lastInsertRowid;
}

export async function updateTipoDocumentoGasto(
  db: Db,
  id: number,
  input: TipoDocumentoGastoInput
): Promise<boolean> {
  assertTipoInput(input);
  const habilitados = normalizeGastoCampoList(input.campos_habilitados);
  const requeridos = normalizeGastoCampoList(input.campos_requeridos ?? []).filter((c) =>
    habilitados.includes(c)
  );
  const defecto = input.valores_defecto ?? {};
  const mapeo = normalizeGastoMapeo(input.mapeo_campos ?? {});
  const comision = normalizeComisionConfig(input.comision_config ?? COMISION_CONFIG_DEFAULT);

  const result = await db
    .prepare(
      `UPDATE DOC_DIGITAL_TIPOS_GASTO SET
        nombre = ?,
        descripcion = ?,
        origen = ?,
        destino = ?,
        activo = ?,
        campos_habilitados = ?,
        campos_requeridos = ?,
        valores_defecto = ?,
        mapeo_campos = ?,
        comision_config = ?,
        actualizado_en = NOW()
       WHERE id = ?`
    )
    .run(
      input.nombre.trim(),
      (input.descripcion ?? "").trim(),
      (input.origen ?? "").trim().toUpperCase(),
      (input.destino ?? "").trim().toUpperCase(),
      input.activo === false ? 0 : 1,
      JSON.stringify(habilitados),
      JSON.stringify(requeridos),
      JSON.stringify(defecto),
      JSON.stringify(mapeo),
      JSON.stringify(comision),
      id
    );
  return Number(result.changes) > 0;
}

export async function deleteTipoDocumentoGasto(db: Db, id: number): Promise<boolean> {
  const result = await db.prepare("DELETE FROM DOC_DIGITAL_TIPOS_GASTO WHERE id = ?").run(id);
  return Number(result.changes) > 0;
}
