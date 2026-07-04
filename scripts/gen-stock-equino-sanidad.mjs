import fs from "fs";

const src = fs.readFileSync("client/src/components/stock/StockGanaderoSanidad.tsx", "utf8");
let out = src
  .replaceAll("StockGanaderoSanidad", "StockEquinoSanidad")
  .replaceAll("StockGanaderaDispositivo", "StockEquinaDispositivo")
  .replaceAll("StockGanaderaEdadMiniTimeline", "StockEquinaEdadMiniTimeline")
  .replaceAll("fetchStockGanaderaDispositivos", "fetchStockEquinaDispositivos")
  .replaceAll("fetchStockGanaderaVentasDispositivos", "fetchStockEquinaVentasDispositivos")
  .replaceAll("stock-ganadera-utils", "stock-equina-utils")
  .replaceAll("stock-sanidad-dispositivo-utils", "stock-equino-sanidad-dispositivo-utils")
  .replaceAll("animalIdFromDispositivo", "animalIdFromDispositivoEquino")
  .replaceAll("animalCategoriaLoteFromDispositivo", "animalCategoriaLoteFromDispositivoEquino")
  .replaceAll('"ganadero"', '"equino"')
  .replaceAll("Stock Ganadero", "Stock Equino")
  .replaceAll("stock-ganadera", "stock-equina");

fs.writeFileSync("client/src/components/stock-equino/StockEquinoSanidad.tsx", out);
console.log("OK", out.split("\n").length, "lines");
