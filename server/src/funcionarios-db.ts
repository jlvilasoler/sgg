import type { Db } from "./db/pg-client.js";

export interface Funcionario {
  id: number;
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

export async function initFuncionariosTable(_db: Db): Promise<void> {}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function listFuncionarios(
  db: Db,
  opts?: { busqueda?: string; soloActivos?: boolean }
): Promise<Funcionario[]> {
  let query = "SELECT * FROM FUNCIONARIOS WHERE 1=1";
  const params: Record<string, string | number> = {};
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
  id: number
): Promise<Funcionario | undefined> {
  return (await db.prepare("SELECT * FROM FUNCIONARIOS WHERE id = ?").get(id)) as
    | Funcionario
    | undefined;
}

export async function getFuncionarioByCedula(
  db: Db,
  cedula: string
): Promise<Funcionario | undefined> {
  const n = normalizeCedula(cedula);
  if (!n) return undefined;
  return (await db
    .prepare(
      `SELECT * FROM FUNCIONARIOS
       WHERE replace(replace(replace(cedula, '.', ''), '-', ''), ' ', '') = ?`
    )
    .get(n)) as Funcionario | undefined;
}

export async function insertFuncionario(db: Db, data: FuncionarioInput): Promise<number> {
  const cedula = validateCedula(data.cedula);
  const nombre = data.nombre.trim();
  const apellido = data.apellido.trim();
  if (!nombre) throw new Error("El nombre es obligatorio.");
  if (!apellido) throw new Error("El apellido es obligatorio.");
  if (await getFuncionarioByCedula(db, cedula)) {
    throw new Error("Ya existe un funcionario con esa cédula.");
  }

  const result = await db
    .prepare(
      `INSERT INTO FUNCIONARIOS (
        cedula, nombre, apellido, domicilio, ciudad, departamento,
        banco, sucursal, cuenta, tipo_cuenta, titular_cuenta, celular, email, activo
      ) VALUES (
        @cedula, @nombre, @apellido, @domicilio, @ciudad, @departamento,
        @banco, @sucursal, @cuenta, @tipo_cuenta, @titular_cuenta, @celular, @email, @activo
      )`
    )
    .run({
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
      celular: (data.celular ?? "").trim(),
      email: normalizeEmail(data.email ?? ""),
      activo: data.activo === false ? 0 : 1,
    });
  return Number(result.lastInsertRowid);
}

export async function updateFuncionario(
  db: Db,
  id: number,
  data: FuncionarioInput
): Promise<boolean> {
  const existing = await getFuncionarioById(db, id);
  if (!existing) return false;

  const cedula = validateCedula(data.cedula);
  const nombre = data.nombre.trim();
  const apellido = data.apellido.trim();
  if (!nombre) throw new Error("El nombre es obligatorio.");
  if (!apellido) throw new Error("El apellido es obligatorio.");

  const otro = await getFuncionarioByCedula(db, cedula);
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
        celular: (data.celular ?? "").trim(),
        email: normalizeEmail(data.email ?? ""),
        activo: data.activo === false ? 0 : 1,
      })
  ).changes > 0;
}

export async function deleteFuncionario(db: Db, id: number): Promise<boolean> {
  const row = await getFuncionarioById(db, id);
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
  nombreDisplay: string
): Promise<Funcionario | undefined> {
  const v = nombreDisplay.trim();
  if (!v) return undefined;
  for (const f of await listFuncionarios(db, { soloActivos: true })) {
    if (
      nombreFuncionarioDisplay(f).localeCompare(v, "es", { sensitivity: "accent" }) === 0
    ) {
      return f;
    }
  }
  return undefined;
}

export async function listFuncionariosParaSelector(db: Db): Promise<
  Array<{
    cedula: string;
    label: string;
    nombre_display: string;
  }>
> {
  return (await listFuncionarios(db, { soloActivos: true })).map((f) => ({
    cedula: f.cedula,
    label: `${formatCedulaDisplay(f.cedula)} — ${nombreFuncionarioDisplay(f)}`,
    nombre_display: nombreFuncionarioDisplay(f),
  }));
}
