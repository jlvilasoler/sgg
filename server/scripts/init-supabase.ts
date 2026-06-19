import "../src/load-env.js";
import { initDb } from "../src/database.js";

await initDb();
console.log("[SAG] Supabase: schema y módulos aplicados.");
