import type { Db } from "./db/pg-client.js";
import { migrateAddCuentaIdColumn } from "./empresas-cuenta-db.js";

export interface Funcionario {
  id: number;
  cuenta_id?: number | null;
  cedula: string;
  nombre: string;
  apellido: string;
  domicilio: string;
  ciudad: string;
  departamento: string;
  banco: string;
  sucursal: string;
  cuenta: string;
  tipo_cuenta: string;
  titular_cuenta: string;
  cuenta_otros_bancos: string;
  moneda_otros_bancos: string;
  celular: string;
  email: string;
  activo: number;
  creado_en?: string;
  actualizado_en?: string;
}

export interface FuncionarioInput {
  cedula: string;
  nombre: string;
  apellido: string;
  domicilio?: string;
  ciudad?: string;
  departamento?: string;
  banco?: string;
  sucursal?: string;
  cuenta?: string;
  tipo_cuenta?: string;
  titular_cuenta?: string;
  cuenta_otros_bancos?: string;
  moneda_otros_bancos?: string;
  celular?: string;
  email?: string;
  activo?: boolean;
}

export function normalizeCedula(cedula: string): string {
  return cedula.replace(/\D/g, "").trim();
}

export function formatCedulaDisplay(cedula: string): string {
  const n = normalizeCedula(cedula);
  if (n.length <= 1) return n;
  if (n.length <= 7) return `${n.slice(0, -1)}-${n.slice(-1)}`;
  return `${n.slice(0, -1)}-${n.slice(-1)}`;
}

function validateCedula(cedula: string): string {
  const n = normalizeCedula(cedula);
  if (n.length < 6 || n.length > 8) {
    throw new Error("La cédula debe tener entre 6 y 8 dígitos (sin puntos).");
  }
  return n;
}

export async function initFuncionariosTable(db: Db): Promise<void> {
  for (const col of [
    "cuenta_otros_bancos TEXT NOT NULL DEFAULT ''",
    "moneda_otros_bancos TEXT NOT NULL DEFAULT ''",
  ]) {
    try {
      await db.prepare(`ALTER TABLE FUNCIONARIOS ADD COLUMN ${col}`).run();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/already exists|duplicate column/i.test(msg)) throw err;
    }
  }
  await migrateAddCuentaIdColumn(db, "FUNCIONARIOS");
  await migrateFuncionarioCedulaUniquePorCuenta(db);
}

/**
 * La cédula deja de ser única globalmente para ser única por cuenta: dos cuentas
 * distintas pueden tener un funcionario con la misma cédula.
 */
async function migrateFuncionarioCedulaUniquePorCuenta(db: Db): Promise<void> {
  for (const stmt of [
    "ALTER TABLE FUNCIONARIOS DROP CONSTRAINT IF EXISTS funcionarios_cedula_key",
    "DROP INDEX IF EXISTS idx_funcionarios_cedula",
  ]) {
    try {
      await db.prepare(stmt).run();
    } catch {
      /* ignore */
    }
  }
  try {
    await db
      .prepare(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_funcionarios_cuenta_cedula ON FUNCIONARIOS(cuenta_id, cedula)"
      )
      .run();
  } catch {
    /* ignore */
  }
}

function scopeCuenta(
  query: string,
  params: Record<string, string | number>,
  cuentaId?: number | null
): string {
  if (cuentaId != null) {
    query += " AND cuenta_id = @cuentaId";
    params.cuentaId = cuentaId;
  }
  return query;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function listFuncionarios(
  db: Db,
  opts?: { busqueda?: string; soloActivos?: boolean },
  cuentaId?: number | null
): Promise<Funcionario[]> {
  let query = "SELECT * FROM FUNCIONARIOS WHERE 1=1";
  const params: Record<string, string | number> = {};
  query = scopeCuenta(query, params, cuentaId);
  if (opts?.soloActivos) query += " AND activo = 1";
  if (opts?.busqueda?.trim()) {
    query += ` AND (
      cedula LIKE @term OR nombre LIKE @term OR apellido LIKE @term
      OR ciudad LIKE @term OR departamento LIKE @term OR banco LIKE @term
      OR cuenta LIKE @term OR celular LIKE @term OR email LIKE @term
    )`;
    params.term = `%${opts.busqueda.trim()}%`;
  }
  query += " ORDER BY LOWER(apellido), LOWER(nombre)";
  return (await db.prepare(query).all(params)) as Funcionario[];
}

export async function getFuncionarioById(
  db: Db,
  id: number,
  cuentaId?: number | null
): Promise<Funcionario | undefined> {
  let query = "SELECT * FROM FUNCIONARIOS WHERE id = @id";
  const params: Record<string, string | number> = { id };
  query = scopeCuenta(query, params, cuentaId);
  return (await db.prepare(query).get(params)) as Funcionario | undefined;
}

export async function getFuncionarioByCedula(
  db: Db,
  cedula: string,
  cuentaId?: number | null
): Promise<Funcionario | undefined> {
  const n = normalizeCedula(cedula);
  if (!n) return undefined;
  let query = `SELECT * FROM FUNCIONARIOS
       WHERE replace(replace(replace(cedula, '.', ''), '-', ''), ' ', '') = @ced`;
  const params: Record<string, string | number> = { ced: n };
  query = scopeCuenta(query, params, cuentaId);
  return (await db.prepare(query).get(params)) as Funcionario | undefined;
}

export async function insertFuncionario(
  db: Db,
  data: FuncionarioInput,
  cuentaId?: number | null
): Promise<number> {
  const cedula = validateCedula(data.cedula);
  const nombre = data.nombre.trim();
  const apellido = data.apellido.trim();
  if (!nombre) throw new Error("El nombre es obligatorio.");
  if (!apellido) throw new Error("El apellido es obligatorio.");
  if (await getFuncionarioByCedula(db, cedula, cuentaId)) {
    throw new Error("Ya existe un funcionario con esa cédula.");
  }

  const result = await db
    .prepare(
      `INSERT INTO FUNCIONARIOS (
        cuenta_id, cedula, nombre, apellido, domicilio, ciudad, departamento,
        banco, sucursal, cuenta, tipo_cuenta, titular_cuenta,
        cuenta_otros_bancos, moneda_otros_bancos, celular, email, activo
      ) VALUES (
        @cuenta_id, @cedula, @nombre, @apellido, @domicilio, @ciudad, @departamento,
        @banco, @sucursal, @cuenta, @tipo_cuenta, @titular_cuenta,
        @cuenta_otros_bancos, @moneda_otros_bancos, @celular, @email, @activo
      )`
    )
    .run({
      cuenta_id: cuentaId ?? null,
      cedula,
      nombre,
      apellido,
      domicilio: (data.domicilio ?? "").trim(),
      ciudad: (data.ciudad ?? "").trim(),
      departamento: (data.departamento ?? "").trim(),
      banco: (data.banco ?? "").trim(),
      sucursal: (data.sucursal ?? "").trim(),
      cuenta: (data.cuenta ?? "").trim(),
      tipo_cuenta: (data.tipo_cuenta ?? "").trim(),
      titular_cuenta: (data.titular_cuenta ?? "").trim() || `${nombre} ${apellido}`,
      cuenta_otros_bancos: (data.cuenta_otros_bancos ?? "").trim(),
      moneda_otros_bancos: (data.moneda_otros_bancos ?? "").trim(),
      celular: (data.celular ?? "").trim(),
      email: normalizeEmail(data.email ?? ""),
      activo: data.activo === false ? 0 : 1,
    });
  return Number(result.lastInsertRowid);
}

export async function updateFuncionario(
  db: Db,
  id: number,
  data: FuncionarioInput,
  cuentaId?: number | null
): Promise<boolean> {
  const existing = await getFuncionarioById(db, id, cuentaId);
  if (!existing) return false;

  const cedula = validateCedula(data.cedula);
  const nombre = data.nombre.trim();
  const apellido = data.apellido.trim();
  if (!nombre) throw new Error("El nombre es obligatorio.");
  if (!apellido) throw new Error("El apellido es obligatorio.");

  const otro = await getFuncionarioByCedula(db, cedula, cuentaId);
  if (otro && otro.id !== id) {
    throw new Error("Ya existe otro funcionario con esa cédula.");
  }

  return (
    await db
      .prepare(
        `UPDATE FUNCIONARIOS SET
          cedula = @cedula, nombre = @nombre, apellido = @apellido,
          domicilio = @domicilio, ciudad = @ciudad, departamento = @departamento,
          banco = @banco, sucursal = @sucursal, cuenta = @cuenta,
          tipo_cuenta = @tipo_cuenta, titular_cuenta = @titular_cuenta,
          cuenta_otros_bancos = @cuenta_otros_bancos, moneda_otros_bancos = @moneda_otros_bancos,
          celular = @celular, email = @email,
          activo = @activo,
          actualizado_en = NOW()
        WHERE id = @id`
      )
      .run({
        id,
        cedula,
        nombre,
        apellido,
        domicilio: (data.domicilio ?? "").trim(),
        ciudad: (data.ciudad ?? "").trim(),
        departamento: (data.departamento ?? "").trim(),
        banco: (data.banco ?? "").trim(),
        sucursal: (data.sucursal ?? "").trim(),
        cuenta: (data.cuenta ?? "").trim(),
        tipo_cuenta: (data.tipo_cuenta ?? "").trim(),
        titular_cuenta: (data.titular_cuenta ?? "").trim() || `${nombre} ${apellido}`,
        cuenta_otros_bancos: (data.cuenta_otros_bancos ?? "").trim(),
        moneda_otros_bancos: (data.moneda_otros_bancos ?? "").trim(),
        celular: (data.celular ?? "").trim(),
        email: normalizeEmail(data.email ?? ""),
        activo: data.activo === false ? 0 : 1,
      })
  ).changes > 0;
}

export async function deleteFuncionario(
  db: Db,
  id: number,
  cuentaId?: number | null
): Promise<boolean> {
  const row = await getFuncionarioById(db, id, cuentaId);
  if (!row) return false;
  const { n } = (await db
    .prepare(
      `SELECT COUNT(*) AS n FROM PRESUPUESTO
       WHERE replace(replace(replace(funcionario_cedula, '.', ''), '-', ''), ' ', '') = ?`
    )
    .get(normalizeCedula(row.cedula))) as { n: number };
  if (n > 0) {
    throw new Error(
      "No se puede eliminar: hay gastos vinculados a esta cédula. Desactivá el funcionario."
    );
  }
  return (await db.prepare("DELETE FROM FUNCIONARIOS WHERE id = ?").run(id)).changes > 0;
}

export function nombreFuncionarioDisplay(f: {
  apellido: string;
  nombre: string;
}): string {
  return `${f.apellido}, ${f.nombre}`.trim();
}

export function esRubroRemuneracion(rubro: string, subRubro = ""): boolean {
  const t = `${rubro} ${subRubro}`.toLowerCase();
  return /sueldo|jornal|aguinald|remunerac|carga|social|personal|salario|bonific|vacacional/.test(
    t
  );
}

export async function getFuncionarioByNombreDisplay(
  db: Db,
  nombreDisplay: string,
  cuentaId?: number | null
): Promise<Funcionario | undefined> {
  const v = nombreDisplay.trim();
  if (!v) return undefined;
  for (const f of await listFuncionarios(db, { soloActivos: true }, cuentaId)) {
    if (
      nombreFuncionarioDisplay(f).localeCompare(v, "es", { sensitivity: "accent" }) === 0
    ) {
      return f;
    }
  }
  return undefined;
}

export async function listFuncionariosParaSelector(
  db: Db,
  cuentaId?: number | null
): Promise<
  Array<{
    cedula: string;
    label: string;
    nombre_display: string;
  }>
> {
  return (await listFuncionarios(db, { soloActivos: true }, cuentaId)).map((f) => ({
    cedula: f.cedula,
    label: `${formatCedulaDisplay(f.cedula)} — ${nombreFuncionarioDisplay(f)}`,
    nombre_display: nombreFuncionarioDisplay(f),
  }));
}
