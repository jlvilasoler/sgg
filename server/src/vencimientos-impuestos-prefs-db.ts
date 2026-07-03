import type { Db } from "./db/pg-client.js";
import {
  CONTRIBUCION_RURAL_JURISDICCION_IDS,
  type ContribucionRuralJurisdiccionId,
} from "./contribucion-rural-calendarios-db.js";

export type ModalidadPagoVencImp = "contado" | "cuotas";

export type PlanCuotasJurisdiccionKey = "4" | "6" | "12";

export type RegimenPrimariaRural = "con_explotacion" | "sin_explotacion";

const VALID_PLAN_CUOTAS = new Set<string>(["4", "6", "12"]);

export interface CuentaVencimientosImpuestosPrefs {
  cuenta_id: number;
  jurisdiccion_ids: ContribucionRuralJurisdiccionId[];
  modalidad_pago: ModalidadPagoVencImp;
  modalidad_pago_patente: ModalidadPagoVencImp;
  planes_cuotas_por_jurisdiccion: Partial<Record<ContribucionRuralJurisdiccionId, PlanCuotasJurisdiccionKey>>;
  seguir_patente_sucive: boolean;
  seguir_bps_caja_rural: boolean;
  seguir_primaria_rural: boolean;
  regimen_primaria_rural: RegimenPrimariaRural;
  onboarding_completado: boolean;
  actualizado_por_user_id: number | null;
  actualizado_en: string;
}

/** @deprecated Alias de compatibilidad en API */
export type UserVencimientosImpuestosPrefs = CuentaVencimientosImpuestosPrefs;

export interface CuentaVencimientosImpuestosPrefsInput {
  jurisdiccion_ids: ContribucionRuralJurisdiccionId[];
  modalidad_pago: ModalidadPagoVencImp;
  modalidad_pago_patente?: ModalidadPagoVencImp;
  planes_cuotas_por_jurisdiccion?: Partial<Record<ContribucionRuralJurisdiccionId, PlanCuotasJurisdiccionKey>>;
  seguir_patente_sucive?: boolean;
  seguir_bps_caja_rural?: boolean;
  seguir_primaria_rural?: boolean;
  regimen_primaria_rural?: RegimenPrimariaRural;
  onboarding_completado?: boolean;
}

/** @deprecated Alias de compatibilidad en API */
export type UserVencimientosImpuestosPrefsInput = CuentaVencimientosImpuestosPrefsInput;

const VALID_IDS = new Set<string>(CONTRIBUCION_RURAL_JURISDICCION_IDS);
const LEGACY_PLACEHOLDER_DEPT: ContribucionRuralJurisdiccionId = "montevideo";

export function isValidJurisdiccionId(value: string): value is ContribucionRuralJurisdiccionId {
  return VALID_IDS.has(value);
}

export function isValidModalidadPago(value: string): value is ModalidadPagoVencImp {
  return value === "contado" || value === "cuotas";
}

export function isValidRegimenPrimariaRural(value: string): value is RegimenPrimariaRural {
  return value === "con_explotacion" || value === "sin_explotacion";
}

function parsePlanesCuotasFromRow(
  row: Record<string, unknown>,
): Partial<Record<ContribucionRuralJurisdiccionId, PlanCuotasJurisdiccionKey>> {
  const raw = row.planes_cuotas_por_jurisdiccion;
  if (typeof raw !== "string" || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Partial<Record<ContribucionRuralJurisdiccionId, PlanCuotasJurisdiccionKey>> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!isValidJurisdiccionId(key)) continue;
      const plan = String(value);
      if (!VALID_PLAN_CUOTAS.has(plan)) continue;
      out[key] = plan as PlanCuotasJurisdiccionKey;
    }
    return out;
  } catch {
    return {};
  }
}

function normalizePlanesCuotasInput(
  ids: ContribucionRuralJurisdiccionId[],
  input?: Partial<Record<ContribucionRuralJurisdiccionId, PlanCuotasJurisdiccionKey>>,
): Partial<Record<ContribucionRuralJurisdiccionId, PlanCuotasJurisdiccionKey>> {
  if (!input) return {};
  const idSet = new Set(ids);
  const out: Partial<Record<ContribucionRuralJurisdiccionId, PlanCuotasJurisdiccionKey>> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!isValidJurisdiccionId(key) || !idSet.has(key)) continue;
    const plan = String(value);
    if (!VALID_PLAN_CUOTAS.has(plan)) continue;
    out[key] = plan as PlanCuotasJurisdiccionKey;
  }
  return out;
}

function normalizeJurisdiccionIds(
  ids: ContribucionRuralJurisdiccionId[],
): ContribucionRuralJurisdiccionId[] {
  const seen = new Set<ContribucionRuralJurisdiccionId>();
  const out: ContribucionRuralJurisdiccionId[] = [];
  for (const id of ids) {
    if (!isValidJurisdiccionId(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function parseJurisdiccionIdsFromRow(row: Record<string, unknown>): ContribucionRuralJurisdiccionId[] {
  const rawIds = row.jurisdiccion_ids;
  if (typeof rawIds === "string" && rawIds.trim()) {
    try {
      const parsed = JSON.parse(rawIds) as unknown;
      if (Array.isArray(parsed)) {
        return normalizeJurisdiccionIds(
          parsed.filter((x): x is ContribucionRuralJurisdiccionId => typeof x === "string"),
        );
      }
    } catch {
      /* fallback abajo */
    }
  }
  const legacy = String(row.jurisdiccion_id ?? "");
  if (isValidJurisdiccionId(legacy)) return [legacy];
  return [];
}

async function prefsColumnExists(db: Db, column: string): Promise<boolean> {
  const row = (await db
    .prepare(
      `SELECT 1 AS ok FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'user_vencimientos_prefs' AND column_name = @col
       LIMIT 1`,
    )
    .get({ col: column.toLowerCase() })) as { ok: number } | undefined;
  return row != null;
}

async function prefsPrimaryKeyColumn(db: Db): Promise<string | null> {
  const row = (await db
    .prepare(
      `SELECT kcu.column_name AS col
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
       WHERE tc.table_schema = 'public'
         AND tc.table_name = 'user_vencimientos_prefs'
         AND tc.constraint_type = 'PRIMARY KEY'
       LIMIT 1`,
    )
    .get()) as { col: string } | undefined;
  return row?.col ?? null;
}

async function migratePrefsToCuentaScope(db: Db): Promise<void> {
  if (!(await prefsColumnExists(db, "actualizado_por_user_id"))) {
    await db
      .prepare(
        "ALTER TABLE USER_VENCIMIENTOS_PREFS ADD COLUMN actualizado_por_user_id INTEGER REFERENCES USERS(id) ON DELETE SET NULL",
      )
      .run();
    console.info(
      "[SGG] Migración: columna actualizado_por_user_id agregada a USER_VENCIMIENTOS_PREFS",
    );
  }

  if (!(await prefsColumnExists(db, "cuenta_id"))) {
    await db
      .prepare(
        "ALTER TABLE USER_VENCIMIENTOS_PREFS ADD COLUMN cuenta_id INTEGER REFERENCES EMPRESAS_CUENTA(id) ON DELETE CASCADE",
      )
      .run();
    console.info("[SGG] Migración: columna cuenta_id agregada a USER_VENCIMIENTOS_PREFS");
  }

  if (await prefsColumnExists(db, "user_id")) {
    await db
      .prepare(
        `UPDATE USER_VENCIMIENTOS_PREFS p
         SET cuenta_id = u.empresa_id,
             actualizado_por_user_id = COALESCE(p.actualizado_por_user_id, p.user_id)
         FROM USERS u
         WHERE p.user_id = u.id
           AND u.empresa_id IS NOT NULL
           AND p.cuenta_id IS NULL`,
      )
      .run();

    await db
      .prepare(
        `UPDATE USER_VENCIMIENTOS_PREFS p
         SET cuenta_id = ec.id,
             actualizado_por_user_id = COALESCE(p.actualizado_por_user_id, p.user_id)
         FROM EMPRESAS_CUENTA ec
         WHERE p.cuenta_id IS NULL
           AND ec.admin_user_id = p.user_id`,
      )
      .run();

    await db.prepare("DELETE FROM USER_VENCIMIENTOS_PREFS WHERE cuenta_id IS NULL").run();

    await db
      .prepare(
        `DELETE FROM USER_VENCIMIENTOS_PREFS a
         USING USER_VENCIMIENTOS_PREFS b
         WHERE a.cuenta_id = b.cuenta_id
           AND a.user_id < b.user_id`,
      )
      .run();

    const pkCol = await prefsPrimaryKeyColumn(db);
    if (pkCol === "user_id") {
      const pk = (await db
        .prepare(
          `SELECT c.conname AS name
           FROM pg_constraint c
           JOIN pg_class t ON c.conrelid = t.oid
           WHERE t.relname = 'user_vencimientos_prefs' AND c.contype = 'p'
           LIMIT 1`,
        )
        .get()) as { name: string } | undefined;
      if (pk?.name) {
        await db.prepare(`ALTER TABLE USER_VENCIMIENTOS_PREFS DROP CONSTRAINT "${pk.name}"`).run();
      }
      await db.prepare("ALTER TABLE USER_VENCIMIENTOS_PREFS DROP COLUMN user_id").run();
      await db.prepare("ALTER TABLE USER_VENCIMIENTOS_PREFS ADD PRIMARY KEY (cuenta_id)").run();
      console.info("[SGG] Migración: USER_VENCIMIENTOS_PREFS ahora usa cuenta_id como clave primaria");
    }
  }
}

export async function initVencimientosImpuestosPrefsTable(db: Db): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS USER_VENCIMIENTOS_PREFS (
      cuenta_id INTEGER PRIMARY KEY REFERENCES EMPRESAS_CUENTA(id) ON DELETE CASCADE,
      jurisdiccion_id TEXT NOT NULL,
      modalidad_pago TEXT NOT NULL CHECK (modalidad_pago IN ('contado', 'cuotas')),
      onboarding_completado INTEGER NOT NULL DEFAULT 0,
      actualizado_por_user_id INTEGER REFERENCES USERS(id) ON DELETE SET NULL,
      actualizado_en TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  if (!(await prefsColumnExists(db, "jurisdiccion_ids"))) {
    await db.prepare("ALTER TABLE USER_VENCIMIENTOS_PREFS ADD COLUMN jurisdiccion_ids TEXT").run();
    console.info("[SGG] Migración: columna jurisdiccion_ids agregada a USER_VENCIMIENTOS_PREFS");
  }

  if (!(await prefsColumnExists(db, "modalidad_pago_patente"))) {
    await db
      .prepare(
        "ALTER TABLE USER_VENCIMIENTOS_PREFS ADD COLUMN modalidad_pago_patente TEXT CHECK (modalidad_pago_patente IN ('contado', 'cuotas'))",
      )
      .run();
    console.info("[SGG] Migración: columna modalidad_pago_patente agregada a USER_VENCIMIENTOS_PREFS");
  }

  if (!(await prefsColumnExists(db, "seguir_patente_sucive"))) {
    await db
      .prepare(
        "ALTER TABLE USER_VENCIMIENTOS_PREFS ADD COLUMN seguir_patente_sucive INTEGER NOT NULL DEFAULT 1",
      )
      .run();
    console.info("[SGG] Migración: columna seguir_patente_sucive agregada a USER_VENCIMIENTOS_PREFS");
  }

  if (!(await prefsColumnExists(db, "planes_cuotas_por_jurisdiccion"))) {
    await db.prepare("ALTER TABLE USER_VENCIMIENTOS_PREFS ADD COLUMN planes_cuotas_por_jurisdiccion TEXT").run();
    console.info(
      "[SGG] Migración: columna planes_cuotas_por_jurisdiccion agregada a USER_VENCIMIENTOS_PREFS",
    );
  }

  if (!(await prefsColumnExists(db, "seguir_bps_caja_rural"))) {
    await db
      .prepare(
        "ALTER TABLE USER_VENCIMIENTOS_PREFS ADD COLUMN seguir_bps_caja_rural INTEGER NOT NULL DEFAULT 1",
      )
      .run();
    console.info("[SGG] Migración: columna seguir_bps_caja_rural agregada a USER_VENCIMIENTOS_PREFS");
  }

  if (!(await prefsColumnExists(db, "seguir_primaria_rural"))) {
    await db
      .prepare(
        "ALTER TABLE USER_VENCIMIENTOS_PREFS ADD COLUMN seguir_primaria_rural INTEGER NOT NULL DEFAULT 1",
      )
      .run();
    console.info("[SGG] Migración: columna seguir_primaria_rural agregada a USER_VENCIMIENTOS_PREFS");
  }

  if (!(await prefsColumnExists(db, "regimen_primaria_rural"))) {
    await db
      .prepare(
        "ALTER TABLE USER_VENCIMIENTOS_PREFS ADD COLUMN regimen_primaria_rural TEXT NOT NULL DEFAULT 'con_explotacion' CHECK (regimen_primaria_rural IN ('con_explotacion', 'sin_explotacion'))",
      )
      .run();
    console.info("[SGG] Migración: columna regimen_primaria_rural agregada a USER_VENCIMIENTOS_PREFS");
  }

  await migratePrefsToCuentaScope(db);

  await db
    .prepare(
      `UPDATE USER_VENCIMIENTOS_PREFS
       SET jurisdiccion_ids = json_build_array(jurisdiccion_id)::text
       WHERE (jurisdiccion_ids IS NULL OR TRIM(jurisdiccion_ids) = '')
         AND jurisdiccion_id IS NOT NULL
         AND TRIM(jurisdiccion_id) <> ''`,
    )
    .run();

  await db
    .prepare(
      `UPDATE USER_VENCIMIENTOS_PREFS
       SET modalidad_pago_patente = modalidad_pago
       WHERE modalidad_pago_patente IS NULL`,
    )
    .run();
}

function rowToPrefs(row: Record<string, unknown>): CuentaVencimientosImpuestosPrefs {
  const jurisdiccion_ids = parseJurisdiccionIdsFromRow(row);
  const seguir_patente_sucive = Number(row.seguir_patente_sucive ?? 1) === 1;
  const seguir_bps_caja_rural = Number(row.seguir_bps_caja_rural ?? 1) === 1;
  const seguir_primaria_rural = Number(row.seguir_primaria_rural ?? 1) === 1;
  if (
    jurisdiccion_ids.length === 0 &&
    !seguir_patente_sucive &&
    !seguir_bps_caja_rural &&
    !seguir_primaria_rural
  ) {
    throw new Error(
      "Preferencia guardada sin departamentos, patente SUCIVE, BPS Caja rural ni Primaria rural.",
    );
  }
  const modalidad = String(row.modalidad_pago ?? "");
  if (!isValidModalidadPago(modalidad)) {
    throw new Error("Preferencia guardada con modalidad inválida.");
  }
  const modalidadPatenteRaw = String(row.modalidad_pago_patente ?? modalidad);
  const modalidad_pago_patente = isValidModalidadPago(modalidadPatenteRaw)
    ? modalidadPatenteRaw
    : modalidad;
  return {
    cuenta_id: Number(row.cuenta_id),
    jurisdiccion_ids,
    modalidad_pago: modalidad,
    modalidad_pago_patente,
    planes_cuotas_por_jurisdiccion: parsePlanesCuotasFromRow(row),
    seguir_patente_sucive,
    seguir_bps_caja_rural,
    seguir_primaria_rural,
    regimen_primaria_rural: isValidRegimenPrimariaRural(String(row.regimen_primaria_rural ?? ""))
      ? (String(row.regimen_primaria_rural) as RegimenPrimariaRural)
      : "con_explotacion",
    onboarding_completado: Number(row.onboarding_completado) === 1,
    actualizado_por_user_id:
      row.actualizado_por_user_id != null ? Number(row.actualizado_por_user_id) : null,
    actualizado_en: String(row.actualizado_en ?? ""),
  };
}

export async function getCuentaVencimientosPrefs(
  db: Db,
  cuentaId: number,
): Promise<CuentaVencimientosImpuestosPrefs | null> {
  const row = (await db
    .prepare(
      `SELECT cuenta_id, jurisdiccion_id, jurisdiccion_ids, modalidad_pago, modalidad_pago_patente,
              planes_cuotas_por_jurisdiccion, seguir_patente_sucive, seguir_bps_caja_rural,
              seguir_primaria_rural, regimen_primaria_rural,
              onboarding_completado, actualizado_por_user_id, actualizado_en
       FROM USER_VENCIMIENTOS_PREFS WHERE cuenta_id = ?`,
    )
    .get(cuentaId)) as Record<string, unknown> | undefined;
  if (!row) return null;
  return rowToPrefs(row);
}

/** @deprecated Usar getCuentaVencimientosPrefs */
export async function getUserVencimientosPrefs(
  db: Db,
  cuentaId: number,
): Promise<CuentaVencimientosImpuestosPrefs | null> {
  return getCuentaVencimientosPrefs(db, cuentaId);
}

export async function saveCuentaVencimientosPrefs(
  db: Db,
  cuentaId: number,
  userId: number,
  input: CuentaVencimientosImpuestosPrefsInput,
): Promise<CuentaVencimientosImpuestosPrefs> {
  const jurisdiccion_ids = normalizeJurisdiccionIds(input.jurisdiccion_ids);
  const seguir_patente_sucive = input.seguir_patente_sucive !== false;
  const seguir_bps_caja_rural = input.seguir_bps_caja_rural !== false;
  const seguir_primaria_rural = input.seguir_primaria_rural !== false;
  const regimen_primaria_rural: RegimenPrimariaRural =
    input.regimen_primaria_rural && isValidRegimenPrimariaRural(input.regimen_primaria_rural)
      ? input.regimen_primaria_rural
      : "con_explotacion";
  if (
    jurisdiccion_ids.length === 0 &&
    !seguir_patente_sucive &&
    !seguir_bps_caja_rural &&
    !seguir_primaria_rural
  ) {
    throw new Error(
      "Seleccioná al menos un departamento, patente SUCIVE, BPS Caja rural o Primaria rural.",
    );
  }
  if (jurisdiccion_ids.length === 0 && !isValidModalidadPago(input.modalidad_pago)) {
    /* solo patente: modalidad rural puede ser cuotas por defecto */
  } else if (jurisdiccion_ids.length > 0 && !isValidModalidadPago(input.modalidad_pago)) {
    throw new Error("Modalidad de pago rural no válida.");
  }
  const modalidad_pago: ModalidadPagoVencImp = isValidModalidadPago(input.modalidad_pago)
    ? input.modalidad_pago
    : "cuotas";
  const modalidad_pago_patente: ModalidadPagoVencImp =
    input.modalidad_pago_patente && isValidModalidadPago(input.modalidad_pago_patente)
      ? input.modalidad_pago_patente
      : modalidad_pago;
  if (seguir_patente_sucive && !isValidModalidadPago(modalidad_pago_patente)) {
    throw new Error("Modalidad de patente no válida.");
  }
  const completado = input.onboarding_completado !== false ? 1 : 0;
  const idsJson = JSON.stringify(jurisdiccion_ids);
  const planesCuotas = normalizePlanesCuotasInput(jurisdiccion_ids, input.planes_cuotas_por_jurisdiccion);
  const planesJson = JSON.stringify(planesCuotas);
  const legacyPrimary = jurisdiccion_ids[0] ?? LEGACY_PLACEHOLDER_DEPT;
  const seguirPatenteInt = seguir_patente_sucive ? 1 : 0;
  const seguirBpsInt = seguir_bps_caja_rural ? 1 : 0;
  const seguirPrimariaInt = seguir_primaria_rural ? 1 : 0;

  await db
    .prepare(
      `INSERT INTO USER_VENCIMIENTOS_PREFS (
         cuenta_id, jurisdiccion_id, jurisdiccion_ids, modalidad_pago, modalidad_pago_patente,
         planes_cuotas_por_jurisdiccion, seguir_patente_sucive, seguir_bps_caja_rural,
         seguir_primaria_rural, regimen_primaria_rural,
         onboarding_completado, actualizado_por_user_id, actualizado_en
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
       ON CONFLICT (cuenta_id) DO UPDATE SET
         jurisdiccion_id = excluded.jurisdiccion_id,
         jurisdiccion_ids = excluded.jurisdiccion_ids,
         modalidad_pago = excluded.modalidad_pago,
         modalidad_pago_patente = excluded.modalidad_pago_patente,
         planes_cuotas_por_jurisdiccion = excluded.planes_cuotas_por_jurisdiccion,
         seguir_patente_sucive = excluded.seguir_patente_sucive,
         seguir_bps_caja_rural = excluded.seguir_bps_caja_rural,
         seguir_primaria_rural = excluded.seguir_primaria_rural,
         regimen_primaria_rural = excluded.regimen_primaria_rural,
         onboarding_completado = excluded.onboarding_completado,
         actualizado_por_user_id = excluded.actualizado_por_user_id,
         actualizado_en = NOW()`,
    )
    .run(
      cuentaId,
      legacyPrimary,
      idsJson,
      modalidad_pago,
      modalidad_pago_patente,
      planesJson,
      seguirPatenteInt,
      seguirBpsInt,
      seguirPrimariaInt,
      regimen_primaria_rural,
      completado,
      userId,
    );

  const saved = await getCuentaVencimientosPrefs(db, cuentaId);
  if (!saved) throw new Error("No se pudieron guardar las preferencias.");
  return saved;
}

/** @deprecated Usar saveCuentaVencimientosPrefs */
export async function saveUserVencimientosPrefs(
  db: Db,
  cuentaId: number,
  userId: number,
  input: CuentaVencimientosImpuestosPrefsInput,
): Promise<CuentaVencimientosImpuestosPrefs> {
  return saveCuentaVencimientosPrefs(db, cuentaId, userId, input);
}
