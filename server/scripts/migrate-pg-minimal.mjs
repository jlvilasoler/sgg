/** Minimal safe transforms: import, Db type, SQL dialect only. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");

function fixSql(content) {
  return content.replace(/(`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g, (str) => {
    let s = str;
    s = s.replace(/(\b[a-zA-Z_][\w.]*)\s*=\s*\?\s*COLLATE\s+NOCASE/gi, "LOWER($1) = LOWER(?)");
    s = s.replace(/(\b[a-zA-Z_][\w.]*)\s*=\s*@(\w+)\s*COLLATE\s+NOCASE/gi, "LOWER($1) = LOWER(@$2)");
    s = s.replace(/(\b[a-zA-Z_][\w.]*)\s*=\s*'([^']*)'\s*COLLATE\s+NOCASE/gi, "LOWER($1) = LOWER('$2')");
    s = s.replace(/ORDER BY\s+([\w.]+)\s+COLLATE\s+NOCASE(\s+ASC|\s+DESC)?/gi, (_, c, d) => `ORDER BY LOWER(${c})${d ?? ""}`);
    s = s.replace(/,\s*([\w.]+)\s+COLLATE\s+NOCASE/gi, ", LOWER($1)");
    s = s.replace(/INSERT\s+OR\s+IGNORE\s+INTO\s+PROVEEDORES[^;]+/gi, (m) => m.replace(/INSERT\s+OR\s+IGNORE/i, "INSERT") + " ON CONFLICT (cod) DO NOTHING");
    s = s.replace(/INSERT\s+OR\s+IGNORE\s+INTO\s+RUBROS \(nombre, activo\) VALUES \(@nombre, 1\)/gi, "INSERT INTO RUBROS (nombre, activo) VALUES (@nombre, 1) ON CONFLICT DO NOTHING");
    s = s.replace(/INSERT\s+OR\s+IGNORE\s+INTO\s+RESPONSABLES \(nombre, activo\) VALUES \(@nombre, 1\)/gi, "INSERT INTO RESPONSABLES (nombre, activo) VALUES (@nombre, 1) ON CONFLICT DO NOTHING");
    s = s.replace(/INSERT\s+OR\s+IGNORE\s+INTO\s+SUB_RUBROS \(nombre, grupo, activo\) VALUES \(@nombre, @grupo, 1\)/gi, "INSERT INTO SUB_RUBROS (nombre, grupo, activo) VALUES (@nombre, @grupo, 1) ON CONFLICT DO NOTHING");
    s = s.replace(/INSERT\s+OR\s+IGNORE\s+INTO\s+RUBRO_SUB_RUBROS \(rubro_id, sub_rubro_id\) VALUES \(\?, \?\)/gi, "INSERT INTO RUBRO_SUB_RUBROS (rubro_id, sub_rubro_id) VALUES (?, ?) ON CONFLICT (rubro_id, sub_rubro_id) DO NOTHING");
    s = s.replace(/INSERT\s+OR\s+IGNORE\s+INTO\s+PRESUPUESTO_REGISTRO_SEQ \(id, ultimo\) VALUES \(1, 0\)/gi, "INSERT INTO PRESUPUESTO_REGISTRO_SEQ (id, ultimo) VALUES (1, 0) ON CONFLICT (id) DO NOTHING");
    s = s.replace(/INSERT\s+OR\s+IGNORE\s+INTO\s+INGRESOS_VENTAS_SEQ \(id, ultimo\) VALUES \(1, 0\)/gi, "INSERT INTO INGRESOS_VENTAS_SEQ (id, ultimo) VALUES (1, 0) ON CONFLICT (id) DO NOTHING");
    s = s.replace(/SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'GRUPO_ICONOS'/g, "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'grupo_iconos'");
    return s;
  });
}

for (const f of fs.readdirSync(srcDir).filter((x) => x.endsWith("-db.ts"))) {
  const fp = path.join(srcDir, f);
  let c = fs.readFileSync(fp, "utf8");
  c = c.replace(/import type Database from "better-sqlite3";\r?\n?/g, 'import type { Db } from "./db/pg-client.js";\n');
  c = c.replace(/Database\.Database/g, "Db");
  c = fixSql(c);
  fs.writeFileSync(fp, c);
  console.log("SQL+import:", f);
}
