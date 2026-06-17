import pg from "pg";

const { Pool } = pg;

type PgPool = pg.Pool;
type PgPoolClient = pg.PoolClient;

let pool: PgPool | null = null;

export function getPool(): PgPool {
  if (!pool) {
    const raw = process.env.DATABASE_URL?.trim();
    if (!raw) {
      throw new Error(
        "Falta DATABASE_URL (connection string de Supabase Postgres)."
      );
    }
    const connectionString = normalizeDatabaseUrl(raw);
    const useSsl = !connectionString.includes("localhost");
    pool = new Pool({
      connectionString,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
      max: process.env.VERCEL ? 1 : 10,
      idleTimeoutMillis: process.env.VERCEL ? 0 : 10_000,
      allowExitOnIdle: Boolean(process.env.VERCEL),
      connectionTimeoutMillis: process.env.VERCEL ? 60_000 : 15_000,
    });
  }
  return pool;
}

function normalizeDatabaseUrl(url: string): string {
  let u = url;

  const directSupabase = u.match(
    /^postgres(?:ql)?:\/\/postgres:([^@]+)@db\.([a-z0-9]+)\.supabase\.co:5432\/postgres/i
  );
  if (directSupabase && process.env.VERCEL) {
    throw new Error(
      "DATABASE_URL usa conexión directa (db.xxx.supabase.co:5432) que no funciona en Vercel. " +
        "En Supabase → Database → Connection string elegí Transaction pooler (puerto 6543) " +
        "y pegá esa URL en Vercel."
    );
  }

  // sslmode en la URL fuerza verificación de certificado y falla con Supabase pooler.
  u = u.replace(/([?&])sslmode=[^&]*/gi, "$1").replace(/\?&/, "?").replace(/[?&]$/, "");

  // Vercel: Session pooler (5432) — estable con transacciones e init largo. Transaction (6543) cuelga.
  if (process.env.VERCEL && /pooler\.supabase\.com:6543/i.test(u)) {
    u = u.replace(":6543", ":5432");
  }

  u = u.replace(/([?&])pgbouncer=[^&]*/gi, "$1").replace(/\?&/, "?").replace(/[?&]$/, "");

  if (/pooler\.supabase\.com/i.test(u) && /^postgres(?:ql)?:\/\/postgres:/i.test(u)) {
    throw new Error(
      "En Transaction pooler el usuario no es «postgres», es «postgres.TU_PROJECT_REF» " +
        "(ej. postgres.mxcrpumaadtixlmnlgmj). Copiá la URI desde Supabase sin cambiar el usuario."
    );
  }

  if (/pooler\.supabase\.com:6543/i.test(u) && !/pgbouncer=/i.test(u)) {
    u += u.includes("?") ? "&" : "?";
    u += "pgbouncer=true";
  }
  return u;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/** Convierte parámetros nombrados @foo a $1, $2… */
export function toPgParams(
  sql: string,
  params?: Record<string, unknown> | unknown[]
): { text: string; values: unknown[] } {
  if (!params) return { text: sql, values: [] };
  if (Array.isArray(params)) {
    let i = 0;
    const text = sql.replace(/\?/g, () => `$${++i}`);
    return { text, values: params };
  }
  const names: string[] = [];
  const text = sql.replace(/@([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, name: string) => {
    let idx = names.indexOf(name);
    if (idx === -1) {
      names.push(name);
      idx = names.length - 1;
    }
    return `$${idx + 1}`;
  });
  const values = names.map((n) => params[n]);
  return { text, values };
}

/** Adaptaciones SQLite → Postgres en consultas existentes. */
export function adaptSql(sql: string): string {
  return sql
    .replace(/datetime\(\s*'now'\s*,\s*'localtime'\s*\)/gi, "NOW()")
    .replace(/datetime\(\s*([a-zA-Z0-9_.]+)\s*\)/gi, "$1::timestamptz")
    .replace(/\bINSERT\s+OR\s+IGNORE\b/gi, "INSERT")
    .replace(/COLLATE\s+NOCASE/gi, "")
    .replace(/PRAGMA\s+table_info\([^)]+\)/gi, "SELECT 1 WHERE FALSE");
}

function normalizeParams(
  ...params: unknown[]
): Record<string, unknown> | unknown[] | undefined {
  if (params.length === 0) return undefined;
  if (
    params.length === 1 &&
    typeof params[0] === "object" &&
    params[0] !== null &&
    !Array.isArray(params[0])
  ) {
    return params[0] as Record<string, unknown>;
  }
  if (params.length === 1 && Array.isArray(params[0])) {
    return params[0];
  }
  return params;
}

export type RunResult = { changes: number; lastInsertRowid: number };

export class PgStatement {
  constructor(
    private readonly client: PgPool | PgPoolClient,
    private readonly sql: string
  ) {}

  async get<T = Record<string, unknown>>(
    ...params: unknown[]
  ): Promise<T | undefined> {
    const { text, values } = toPgParams(adaptSql(this.sql), normalizeParams(...params));
    const r = await this.client.query(text, values);
    return r.rows[0] as T | undefined;
  }

  async all<T = Record<string, unknown>>(...params: unknown[]): Promise<T[]> {
    const { text, values } = toPgParams(adaptSql(this.sql), normalizeParams(...params));
    const r = await this.client.query(text, values);
    return r.rows as T[];
  }

  async run(...params: unknown[]): Promise<RunResult> {
    let sql = adaptSql(this.sql);
    const isInsert = /^\s*INSERT\s+/i.test(sql) && !/\bRETURNING\b/i.test(sql);
    if (isInsert) {
      sql = sql.replace(/;\s*$/, "") + " RETURNING id";
    }
    const { text, values } = toPgParams(sql, normalizeParams(...params));
    const r = await this.client.query(text, values);
    const lastInsertRowid =
      isInsert && r.rows[0]?.id != null ? Number(r.rows[0].id) : 0;
    return { changes: r.rowCount ?? 0, lastInsertRowid };
  }
}

export class PgDb {
  constructor(private readonly client: PgPool | PgPoolClient = getPool()) {}

  prepare(sql: string): PgStatement {
    return new PgStatement(this.client, sql);
  }

  async exec(sql: string): Promise<void> {
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      if (/PRAGMA/i.test(stmt)) continue;
      await this.client.query(adaptSql(stmt));
    }
  }

  async transaction<T>(fn: (db: PgDb) => Promise<T>): Promise<T> {
    const pool = getPool();
    if (this.client !== pool) {
      return fn(this);
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(new PgDb(client));
      await client.query("COMMIT");
      return result;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
}

export type Db = PgDb;
