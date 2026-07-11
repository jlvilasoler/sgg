import pg from "pg";

const { Pool } = pg;

type PgPool = pg.Pool;
type PgPoolClient = pg.PoolClient;

let pool: PgPool | null = null;

export function isDbCapacityError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /EMAXCONN|max clients reached|too many clients|Connection terminated unexpectedly/i.test(
    msg
  );
}

export function dbCapacityHint(): string {
  return (
    "Supabase limitó las conexiones simultáneas. Detené todas las instancias de npm run dev " +
    "(Administrador de tareas → procesos node) y volvé a iniciar una sola."
  );
}

function poolMaxSize(connectionString: string): number {
  const fromEnv = Number(process.env.SCG_DB_POOL_MAX);
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return Math.min(20, Math.floor(fromEnv));
  }
  if (process.env.VERCEL === "1") return 1;
  // Transaction pooler (6543) multiplexa: soporta muchas conexiones cliente.
  // El dashboard dispara ~10 requests a la vez (x2 con React StrictMode en dev);
  // con pool chico se saturaba y paneles livianos (pizarrón) expiraban por
  // inanición. 15 da holgura sin acercarse al límite del pooler.
  if (/pooler\.supabase\.com:6543/i.test(connectionString)) return 15;
  // Session pooler (5432) tiene límite bajo en Supabase: conservador.
  if (/pooler\.supabase\.com/i.test(connectionString)) return 3;
  return 10;
}

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
    const max = poolMaxSize(connectionString);
    pool = new Pool({
      connectionString,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
      max,
      // En dev mantenemos conexiones calientes más tiempo: reabrir contra el
      // pooler de Supabase cuesta varios segundos (SSL + auth) y la ráfaga del
      // dashboard pagaba ese costo en simultáneo, expirando los paneles.
      idleTimeoutMillis: process.env.VERCEL === "1" ? 0 : 60_000,
      allowExitOnIdle: process.env.VERCEL === "1",
      connectionTimeoutMillis: process.env.VERCEL === "1" ? 60_000 : 15_000,
    });
    pool.on("error", (err) => {
      console.error("[SGG DB] Error en pool Postgres:", err.message);
    });
    if (!process.env.VERCEL) {
      console.info(`[SGG DB] Pool Postgres max=${max}`);
    }
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

  // Transaction pooler (6543): multiplexa conexiones — recomendado por Supabase.
  // Session pooler (5432 en pooler): límite ~15 conexiones; solo con SCG_DB_SESSION=1.
  if (/pooler\.supabase\.com:6543/i.test(u) && process.env.SCG_DB_SESSION === "1") {
    u = u.replace(":6543", ":5432");
  }

  u = u.replace(/([?&])pgbouncer=[^&]*/gi, "$1").replace(/\?&/, "?").replace(/[?&]$/, "");

  if (/pooler\.supabase\.com:6543/i.test(u) && !/[?&]pgbouncer=/i.test(u)) {
    u += `${u.includes("?") ? "&" : "?"}pgbouncer=true`;
  }

  if (/pooler\.supabase\.com/i.test(u) && /^postgres(?:ql)?:\/\/postgres:/i.test(u)) {
    throw new Error(
      "En Transaction pooler el usuario no es «postgres», es «postgres.TU_PROJECT_REF» " +
        "(ej. postgres.mxcrpumaadtixlmnlgmj). Copiá la URI desde Supabase sin cambiar el usuario."
    );
  }

  return u;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Pre-establece conexiones al arrancar para que la primera ráfaga (el dashboard
 * dispara ~15 requests a la vez) no pague el costo de crear todas las conexiones
 * SSL al pooler de Supabase en simultáneo. Best-effort: si falla no rompe el boot.
 */
export async function warmupPool(target?: number): Promise<void> {
  if (process.env.VERCEL === "1") return;
  const p = getPool();
  const n = Math.max(1, Math.min(target ?? p.options.max ?? 5, p.options.max ?? 5));
  const clients: PgPoolClient[] = [];
  try {
    // connect() en paralelo fuerza a crear N conexiones físicas.
    await Promise.all(
      Array.from({ length: n }, async () => {
        const c = await p.connect();
        clients.push(c);
        await c.query("SELECT 1");
      }),
    );
    console.info(`[SGG DB] Pool pre-calentado: ${clients.length} conexión(es)`);
  } catch (err) {
    console.warn(
      "[SGG DB] Pre-calentamiento del pool falló (se crearán bajo demanda):",
      err instanceof Error ? err.message : err,
    );
  } finally {
    for (const c of clients) c.release();
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
    const isInsert = /^\s*INSERT\s+/i.test(sql);
    const hasReturning = /\bRETURNING\b/i.test(sql);
    const skipReturningId =
      isInsert &&
      !hasReturning &&
      /INSERT\s+INTO\s+("?ROLE_ESCRITURA"?|"?ROLE_PERMISOS"?|"?ROLE_HOME_LAYOUT"?|"?USER_HOME_LAYOUT"?|"?RUBRO_SUB_RUBROS"?|"?USER_SESSIONS"?|"?STOCK_GANADERO_DISPOSITIVO"?|"?STOCK_GANADERO_RAZA"?|"?STOCK_GANADERO_POTRERO"?|"?STOCK_GANADERO_GRUPO"?|"?STOCK_EQUINO_DISPOSITIVO"?|"?CHAT_CHANNEL_MEMBERS"?|"?CHAT_READ_STATE"?|"?CHAT_WALLPAPER"?|"?USER_PLATFORM_NOTIFICATION_READ"?|"?SIMULADOR_VENTA_GANADO_OP_SEQ"?|"?PRESUPUESTO_DOCUMENTOS"?|"?USER_VENCIMIENTOS_PREFS"?|"?NOTAS_COMPARTIDAS"?|"?OPERATIVA_TAREA_ASIGNADO"?)\b/i.test(
        sql
      );
    if (isInsert && !hasReturning && !skipReturningId) {
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
