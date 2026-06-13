import * as db from "../dist/database.js";
import * as vinc from "../dist/rubro-sub-rubros-db.js";

db.initDb();
const d = db.getDb();

console.log("ALL RUBROS:");
for (const r of d.prepare("SELECT id, nombre, activo FROM RUBROS ORDER BY nombre").all()) {
  console.log(`  [${r.activo ? "A" : "x"}] ${r.nombre}`);
}

console.log("\nGRUPOS con subs:");
for (const g of d
  .prepare(
    "SELECT grupo, COUNT(*) c FROM SUB_RUBROS WHERE activo=1 GROUP BY grupo ORDER BY grupo"
  )
  .all()) {
  console.log(`  ${g.grupo} (${g.c})`);
}

const map = vinc.getMapSubRubrosPorRubro(d, true);
console.log("\nRubros activos SIN entrada en mapa (pero grupo con subs):");
for (const r of d.prepare("SELECT nombre FROM RUBROS WHERE activo=1").all()) {
  const inMap = map[r.nombre]?.length ?? 0;
  const byGrupo = d
    .prepare(
      "SELECT COUNT(*) n FROM SUB_RUBROS WHERE activo=1 AND grupo = ? COLLATE NOCASE"
    )
    .get(r.nombre).n;
  if (byGrupo > 0 && inMap === 0) {
    console.log(`  ${r.nombre}: ${byGrupo} subs por grupo, 0 en mapa`);
  }
  if (inMap === 0) {
    const subsAny = d
      .prepare(
        `SELECT COUNT(*) n FROM SUB_RUBROS s
         INNER JOIN RUBRO_SUB_RUBROS rsr ON rsr.sub_rubro_id = s.id
         INNER JOIN RUBROS r ON r.id = rsr.rubro_id AND r.nombre = ? COLLATE NOCASE
         WHERE s.activo=1`
      )
      .get(r.nombre).n;
    if (subsAny > 0 && inMap === 0) {
      console.log(`  ${r.nombre}: ${subsAny} vinculos DB pero mapa vacio`);
    }
  }
}

console.log("\nRubros activos con 0 sub-rubros en mapa:");
for (const r of d.prepare("SELECT nombre FROM RUBROS WHERE activo=1 ORDER BY nombre").all()) {
  const n = map[r.nombre]?.length ?? 0;
  if (n === 0) console.log(`  ${r.nombre}`);
}
console.log("\nEntradas en mapa:", Object.keys(map).length);
