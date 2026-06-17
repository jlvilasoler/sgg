/**
 * Completa migración async Postgres en *-db.ts, database.ts, index.ts, auth.ts
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, "..", "src");

function fixDbFiles() {
  const files = fs
    .readdirSync(srcDir)
    .filter((f) => f.endsWith("-db.ts") || f === "database.ts");

  for (const name of files) {
    let c = fs.readFileSync(path.join(srcDir, name), "utf8");
    const orig = c;

    // async function return types: ): Foo { -> ): Promise<Foo> {
    c = c.replace(
      /(export async function \w+\([^)]*\)):\s*([A-Za-z_][\w<>,\s|&]*?)\s*\{/g,
      (m, sig, ret) => {
        if (ret.startsWith("Promise<") || ret === "void") return m;
        return `${sig}: Promise<${ret}> {`;
      }
    );

    // await before db.prepare chains missing await
    c = c.replace(
      /(?<!await )(?<!\.)db\.prepare\(/g,
      "await db.prepare("
    );
    c = c.replace(/await await db\.prepare/g, "await db.prepare");

    // tx.prepare in async contexts
    c = c.replace(/(?<!await )tx\.prepare\(/g, "await tx.prepare(");
    c = c.replace(/await await tx\.prepare/g, "await tx.prepare");

    // Old sqlite transaction: const tx = db.transaction(() => { ... }); tx();
    c = c.replace(
      /const tx = db\.transaction\(\(\) => \{([\s\S]*?)\}\);\s*tx\(\);/g,
      "await db.transaction(async (tx) => {$1});"
    );
    c = c.replace(
      /const tx = db\.transaction\(\((\w+)\) => \{([\s\S]*?)\}\);\s*tx\(([^)]*)\);/g,
      "await db.transaction(async ($1) => {$2});"
    );

    // Helper calls that are now async - add await in async functions only if missing
    const asyncHelpers = [
      "clavesEidRepetidas(",
      "clavesRegistradasSet(",
      "assertDispositivoExiste(",
      "aplicarBajaDispositivo(",
      "registrarHistorialCambiosDispositivo(",
      "mapMetaDispositivos(",
      "enrichDispositivosWithMeta(",
      "purgeExpiredSessions(",
      "seedAdminIfEmpty(",
      "migrateLegacyAdmin(",
      "seedRolePermissionsIfEmpty(",
      "toUserPublic(",
      "roleCapabilities(",
    ];
    for (const h of asyncHelpers) {
      const esc = h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      c = c.replace(new RegExp(`(?<!await )(?<!= )${esc}`, "g"), `await ${h}`);
    }

    // Fix helpers that must stay sync
    c = c.replace(/await (formatNumeroOperacion|formatNumeroOperacionVenta|normalizeCedula|formatCedulaDisplay|esRubroRemuneracion|publicIconUrl|publicVentaIconUrl|nombreFuncionarioDisplay|calcularTotalUsdVenta|dispositivoClave|splitEidVid|normalizarClaveDispositivo|validarGrupo|grupoDesdeNacimiento|fechaIsoAMesAnio)\(/g, "$1(");

    if (c !== orig) {
      fs.writeFileSync(path.join(srcDir, name), c);
      console.log("db:", name);
    }
  }
}

function fixIndexTs() {
  const fp = path.join(srcDir, "index.ts");
  let c = fs.readFileSync(fp, "utf8");

  if (!c.includes("express-async-errors")) {
    c = c.replace(
      'import express, { type Request, type Response } from "express";',
      'import "express-async-errors";\nimport express, { type Request, type Response } from "express";'
    );
  }

  c = c.replace(
    "db.initDb();\n\nconst app = express();",
    `const dbReady = db.initDb().catch((err) => {
  console.error("[SCG] Error al inicializar base de datos:", err);
  process.exit(1);
});

const app = express();
app.use(async (_req, _res, next) => {
  await dbReady;
  next();
});`
  );

  const syncFns = new Set([
    "formatNumeroOperacion",
    "formatNumeroOperacionVenta",
    "esRubroRemuneracion",
    "paramString",
    "parseNum",
    "isoDateLocal",
    "normalizarTituloRubro",
  ]);

  const dbPrefixes = [
    "db.insertPresupuesto",
    "db.updatePresupuesto",
    "db.deletePresupuesto",
    "db.getPresupuesto",
    "db.listPresupuesto",
    "db.peekNextNroRegistro",
    "db.getCatalogos",
    "db.resumenPorEmpresa",
    "db.resumenPorRubro",
    "db.proveedores.",
    "db.rubros.",
    "db.subRubros.",
    "db.subRubroItems.",
    "db.responsables.",
    "db.funcionarios.",
    "db.divisas.",
    "db.grupoIconos.",
    "db.rubroVinculos.",
    "db.rrhhPagos.",
    "db.ingresosVentas.",
    "db.ventaSubRubros.",
    "db.ventaSubRubroItems.",
    "db.ventaGrupoIconos.",
    "db.stockGanadero.",
  ];

  for (const p of dbPrefixes) {
    const esc = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    c = c.replace(new RegExp(`(?<!await )${esc}`, "g"), `await ${p}`);
  }

  // validate payload function - make async
  c = c.replace(
    "function validarPayloadPresupuesto(",
    "async function validarPayloadPresupuesto("
  );
  c = c.replace(
    /validarPayloadPresupuesto\(/g,
    "await validarPayloadPresupuesto("
  );
  c = c.replace(/await await validarPayloadPresupuesto/g, "await validarPayloadPresupuesto");

  // Route handlers -> async (simple pattern for arrow callbacks)
  c = c.replace(
    /app\.(get|post|put|patch|delete)\(([^,]+),\s*\(req,\s*res\)\s*=>\s*\{/g,
    "app.$1($2, async (req, res) => {"
  );

  fs.writeFileSync(fp, c);
  console.log("fixed index.ts");
}

function fixAuthTs() {
  const fp = path.join(srcDir, "auth.ts");
  let c = fs.readFileSync(fp, "utf8");

  c = c.replace(
    "export function authMiddleware(",
    "export async function authMiddleware("
  );

  const authCalls = [
    "authDb.getUserBySessionToken(",
    "authDb.verifyLogin(",
    "authDb.createSession(",
    "authDb.deleteSession(",
    "authDb.changeOwnPassword(",
    "authDb.listUsers(",
    "authDb.insertUser(",
    "authDb.recordAuthEvent(",
    "authDb.getUserById(",
    "authDb.countActiveAdmins(",
    "authDb.updateUser(",
    "authDb.listRolePermissions(",
    "authDb.updateRolePermissions(",
  ];
  for (const call of authCalls) {
    const esc = call.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    c = c.replace(new RegExp(`(?<!await )${esc}`, "g"), `await ${call}`);
  }

  c = c.replace(
    /app\.(get|post|patch)\(([^,]+),\s*\(req,\s*res\)\s*=>\s*\{/g,
    "app.$1($2, async (req, res) => {"
  );
  c = c.replace(
    /app\.post\("\/api\/auth\/login", loginRateLimiter, \(req, res\) => \{\s*void \(async \(\) => \{[\s\S]*?\}\)\(\);\s*\}\);/,
    `app.post("/api/auth/login", loginRateLimiter, async (req, res) => {
    try {
      const email = String(req.body?.email ?? "").trim().slice(0, 254);
      const password = String(req.body?.password ?? "").slice(0, 128);

      if (!email || !password) {
        res.status(400).json({ ok: false, error: "Email y contraseña requeridos" });
        return;
      }
      if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
        res.status(400).json({ ok: false, error: "Email o contraseña incorrectos" });
        return;
      }

      const db = getDb();
      const ip = clientIp(req);
      const result = await authDb.verifyLogin(db, email, password, {
        ip,
        userAgent: req.headers["user-agent"],
      });

      if (!result.ok) {
        await artificialLoginDelay();
        const msg =
          result.reason === "locked"
            ? "Cuenta bloqueada temporalmente por intentos fallidos. Probá más tarde."
            : "Email o contraseña incorrectos";
        res.status(401).json({ ok: false, error: msg });
        return;
      }

      const token = await authDb.createSession(db, result.user.id, {
        ip,
        userAgent: req.headers["user-agent"],
      });

      res.cookie(SESSION_COOKIE, token, cookieOptions());
      res.json({ ok: true, data: result.user });
    } catch {
      res.status(500).json({
        ok: false,
        error: "Error al iniciar sesión",
      });
    }
  });`
  );

  fs.writeFileSync(fp, c);
  console.log("fixed auth.ts");
}

fixDbFiles();
fixIndexTs();
fixAuthTs();
