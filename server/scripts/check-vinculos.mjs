import * as db from "../dist/database.js";

db.initDb();
const d = db.getDb();
const count = (rubro) =>
  d
    .prepare(
      `SELECT COUNT(*) AS n FROM RUBRO_SUB_RUBROS rsr
       JOIN RUBROS r ON r.id = rsr.rubro_id
       WHERE r.nombre = ?`
    )
    .get(rubro).n;

console.log("Otros gastos:", count("Otros gastos de funcionamiento"));
console.log("Agricultura:", count("Agricultura"));
console.log("Construcción:", count("Construcción"));
console.log("Servicios operativos:", count("Servicios operativos"));
console.log("Alambrados:", count("Alambrados y cerramientos"));
