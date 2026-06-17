import fs from "fs";
import path from "path";

const destDir = path.join("dist", "supabase");
fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(
  path.join("supabase", "schema.sql"),
  path.join(destDir, "schema.sql")
);
console.info("[SCG] schema.sql copiado a dist/supabase/");
