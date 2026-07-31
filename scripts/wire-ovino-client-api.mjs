import fs from "fs";

// --- types ---
{
  const p = "client/src/types.ts";
  let s = fs.readFileSync(p, "utf8");
  if (!s.includes("export type StockOvinoLote")) {
    s = s.replace(
      "export type StockEquinaDispositivoHistorial = StockGanaderaDispositivoHistorial;",
      `export type StockEquinaDispositivoHistorial = StockGanaderaDispositivoHistorial;

export type StockOvinoLote = StockGanaderoLote;
export interface StockOvinoRegistro extends StockGanaderoRegistro {
  clave?: string;
  sexo?: string;
  categoria?: string;
  castrado?: boolean | null;
  origen_alta?: string;
  rp?: string;
  nombre_animal?: string;
  registro?: string;
  premios?: string;
  empresa?: string;
  potrero?: string;
  grupo?: string;
  edad?: number | null;
  nacimiento_mes?: number | null;
  nacimiento_anio?: number | null;
  estado?: string;
}
export type StockOvinoEidRepetido = StockGanaderoEidRepetido;
export type StockOvinoEstadisticas = StockGanaderoEstadisticas;
export type StockOvinaDispositivo = StockGanaderaDispositivo;
export type StockOvinaLecturaDetalle = StockGanaderaLecturaDetalle;
export type StockOvinaDispositivoDetalle = StockGanaderaDispositivoDetalle;
export type StockOvinaDispositivoHistorial = StockGanaderaDispositivoHistorial;`
    );
    fs.writeFileSync(p, s);
    console.log("types OK");
  }
}

// --- api.ts ---
{
  const p = "client/src/api.ts";
  let s = fs.readFileSync(p, "utf8");
  s = s.replace(
    'export type StockDispositivoModulo = "ganadero" | "equino";',
    'export type StockDispositivoModulo = "ganadero" | "equino" | "ovino";'
  );

  if (!s.includes("fetchStockOvinoLotes")) {
    const start = s.indexOf("export async function fetchStockEquinoLotes");
    const end = s.indexOf("export async function deleteStockEquinoLote");
    if (start < 0 || end < 0) throw new Error("api equino block markers");
    // include deleteStockEquinoLote function
    let e2 = s.indexOf("\nexport async function", end + 10);
    if (e2 < 0) e2 = s.length;
    let block = s.slice(start, e2);
    // drop pelajes + aru
    const parts = block.split(/\n(?=export (?:async )?function |export type |export interface )/);
    block = parts
      .filter((chunk) => {
        if (/Pelaje|pelajes|Aru|aru\//.test(chunk) && /stock-equino/.test(chunk)) return false;
        if (/fetchAru|AruRaza|AruDetalle|AruArbol/.test(chunk)) return false;
        return true;
      })
      .join("\n");
    block = block
      .split("/stock-equino")
      .join("/stock-ovino")
      .split("StockEquino")
      .join("StockOvino")
      .split("StockEquina")
      .join("StockOvina")
      .split("stockEquino")
      .join("stockOvino")
      .split("stockEquina")
      .join("stockOvina")
      .split("Equino")
      .join("Ovino")
      .split("Equina")
      .join("Ovina");
    s = s.slice(0, e2) + "\n" + block + "\n" + s.slice(e2);
  }

  // Ensure type imports include ovino aliases if needed - api usually imports from types with *
  fs.writeFileSync(p, s);
  console.log("api OK");
}

console.log("done client api/types");
