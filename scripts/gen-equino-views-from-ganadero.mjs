import fs from "fs";

function adapt(content, map) {
  let out = content;
  for (const [from, to] of map) {
    out = out.split(from).join(to);
  }
  return out;
}

const common = [
  ["StockGanadera", "StockEquina"],
  ["StockGanadero", "StockEquino"],
  ["stock-ganadera", "stock-equina"],
  ["stock-ganadero", "stock-equino"],
  ["fetchStockGanadera", "fetchStockEquina"],
  ["fetchStockGanadero", "fetchStockEquino"],
  ["importStockGanadero", "importStockEquino"],
  ["deleteStockGanadera", "deleteStockEquina"],
  ["deleteStockGanadero", "deleteStockEquino"],
  ["StockGanaderoLote", "StockEquinoLote"],
  ["StockGanaderaDispositivo", "StockEquinaDispositivo"],
  ["Volver a Stock Ganadero", "Volver a Stock Equino"],
];

// Listado
{
  const src = fs.readFileSync("client/src/components/stock/StockGanaderoListado.tsx", "utf8");
  fs.writeFileSync(
    "client/src/components/stock-equino/StockEquinoListado.tsx",
    adapt(src, common),
  );
  console.log("StockEquinoListado.tsx");
}

// Salidas
{
  const src = fs.readFileSync("client/src/components/stock/StockGanaderaSalidas.tsx", "utf8");
  let out = adapt(src, common);
  // equino has cabana read-only - ganadero may differ; keep as-is from ganadero salidas
  fs.writeFileSync("client/src/components/stock-equino/StockEquinaSalidas.tsx", out);
  console.log("StockEquinaSalidas.tsx");
}

// Import baja
{
  const src = fs.readFileSync("client/src/components/stock/StockGanaderoImportarBaja.tsx", "utf8");
  fs.writeFileSync(
    "client/src/components/stock-equino/StockEquinoImportarBaja.tsx",
    adapt(src, common),
  );
  console.log("StockEquinoImportarBaja.tsx");
}
