import {
  GASTO_DESTINO_IDS,
  type GastoDestinoId,
  type GastoMapeoCampos,
} from "./gasto-campos.js";
import {
  valorImportePorEtiqueta,
  valorPorEtiqueta,
} from "./parse-brou-transferencia.js";

function fechaUyToIso(fecha: string): string {
  const m = fecha.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Extrae valores del texto del documento según las etiquetas configuradas. */
export function extractValoresPorMapeo(
  text: string,
  mapeo: GastoMapeoCampos
): Partial<Record<GastoDestinoId, string>> {
  const out: Partial<Record<GastoDestinoId, string>> = {};

  for (const destino of GASTO_DESTINO_IDS) {
    const etiqueta = mapeo[destino];
    if (!etiqueta?.trim()) continue;

    if (destino === "importes") {
      const imp = valorImportePorEtiqueta(text, etiqueta);
      if (imp) out.importes = `${imp.moneda}:${imp.valor}`;
      continue;
    }

    if (destino === "fecha") {
      const raw = valorPorEtiqueta(text, etiqueta);
      const m = raw.match(/(\d{2}\/\d{2}\/\d{4})/);
      if (m) out.fecha = fechaUyToIso(m[1]);
      continue;
    }

    const v = valorPorEtiqueta(text, etiqueta);
    if (v) out[destino] = v;
  }

  return out;
}
