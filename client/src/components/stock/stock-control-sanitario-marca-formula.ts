import type { StockDispositivoModulo } from "../../api";
import { fetchStockControlSanitarioProductoFicha } from "../../api";
import type { StockControlSanitarioProductoFicha } from "../../types";
import {
  catalogoFormulasPorModulo,
  type FormulaRemedioModulo,
} from "./stock-control-sanitario-formulas";

function normKey(text: string): string {
  return text
    .trim()
    .toLocaleLowerCase("es-UY")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Marcas ganaderas con fórmula representativa única. */
const FORMULA_POR_MARCA_GANADO: Readonly<Record<string, string>> = {
  Albex: "Albendazol 10%",
  Albenil: "Albendazol 10%",
  Ausmectin: "Ivermectina 1%",
  Banamine: "Flunixin meglumine 2,5%",
  Baycox: "Toltrazuril 2,5%",
  Baymec: "Ivermectina 1%",
  Bectin: "Ivermectina 1%",
  Cydectin: "Moxidectina 1%",
  Dectomax: "Doramectina 1%",
  Doramec: "Doramectina 1%",
  Draxxin: "Tulatromicina 2,5%",
  Engemycin: "Oxitetraciclina 10% L.A.",
  Eprinex: "Eprinomectina 1%",
  Excenel: "Ceftiofur sódico 2,2%",
  Excede: "Ceftiofur cristalino 6%",
  Fasinex: "Triclabendazol 10%",
  "Ivomec Gold": "Ivermectina 1% + Clorsulon 10%",
  "Ivomec Pour-On": "Ivermectina 0,5% pour-on",
  Ivomec: "Ivermectina 1%",
  Ivosan: "Ivermectina 1%",
  Ivercass: "Ivermectina 1%",
  Ivermet: "Ivermectina 1%",
  Lafox: "Rafoxanida 7,5%",
  Longrange: "Eprinomectina 1%",
  Maximec: "Ivermectina 1%",
  Metacam: "Meloxicam 2%",
  Micotil: "Tilmicosina 30%",
  Naxcel: "Ceftiofur sódico 2,2%",
  Panacur: "Fenbendazol 10%",
  "Panacur 25": "Fenbendazol 10%",
  Panzer: "Ivermectina 1%",
  Rycoben: "Albendazol 10%",
  "Terramicina LA": "Oxitetraciclina 10% L.A.",
  Tulamax: "Tulatromicina 2,5%",
  Valbazen: "Albendazol 10%",
  Verben: "Ivermectina 1%",
  Vermitan: "Levamisol 10%",
  Virbamec: "Ivermectina 1%",
};

/** Marcas equinas con fórmula representativa única. */
const FORMULA_POR_MARCA_EQUINO: Readonly<Record<string, string>> = {
  Acepran: "Acepromazina 1%",
  Adequan: "Polisulfato de glicosaminoglicano 50 mg/ml",
  Banamine: "Flunixin meglumine 2,5%",
  "Bio-Bute": "Fenilbutazona 20%",
  Bute: "Fenilbutazona 20%",
  Dormosedan: "Detomidina 1 mg/ml",
  Engemycin: "Oxitetraciclina 10% L.A.",
  Eqvalan: "Ivermectina 1,87% pasta oral",
  Equilis: "Influenza equina — vacuna inactivada",
  Equimax: "Praziquantel 14,02% + Ivermectina 1,87%",
  Equimec: "Ivermectina 1,87% pasta oral",
  Equioxx: "Firocoxib 57 mg",
  Equipalazone: "Fenilbutazona 20%",
  Equipaste: "Ivermectina 1,87% pasta oral",
  Equistrong: "Fenbendazol 10% pasta oral",
  Equest: "Moxidectina 2% gel oral",
  Excenel: "Ceftiofur sódico 2,2%",
  Gastrogard: "Omeprazol pasta oral",
  Hylartil: "Hialuronato sódico 10 mg/ml",
  Ketofen: "Ketoprofeno 1%",
  Legend: "Hialuronato sódico 10 mg/ml",
  Metacam: "Meloxicam 2%",
  Naxcel: "Ceftiofur sódico 2,2%",
  Panacur: "Fenbendazol 10% pasta oral",
  Pneumequine: "Rinoneumonitis equina — vacuna",
  "Regu-Mate": "Altrenogest 0,044%",
  "Strongid P": "Pamoato de pirantel 11,4% pasta oral",
  Ulcergard: "Omeprazol pasta oral",
  "West Nile Innovator": "West Nile — vacuna inactivada",
};

function formulaPorMarcaMap(modulo: FormulaRemedioModulo): Map<string, string> {
  const source = modulo === "equino" ? FORMULA_POR_MARCA_EQUINO : FORMULA_POR_MARCA_GANADO;
  return new Map(Object.entries(source).map(([marca, formula]) => [normKey(marca), formula] as const));
}

const PRINCIPIO_AMBIGUO =
  /linea|multicomponente|combinacion|combinaciones|segun|vacuna|biologico|portafolio|variedad/i;

const MOLECULA_DEFAULT_GANADO: Readonly<Record<string, string>> = {
  albendazol: "Albendazol 10%",
  doramectina: "Doramectina 1%",
  eprinomectina: "Eprinomectina 1%",
  fenbendazol: "Fenbendazol 10%",
  flunixin: "Flunixin meglumine 2,5%",
  ivermectina: "Ivermectina 1%",
  levamisol: "Levamisol 10%",
  meloxicam: "Meloxicam 2%",
  moxidectina: "Moxidectina 1%",
  oxitetraciclina: "Oxitetraciclina 10% L.A.",
  rafoxanida: "Rafoxanida 7,5%",
  tilmicosina: "Tilmicosina 30%",
  toltrazuril: "Toltrazuril 2,5%",
  triclabendazol: "Triclabendazol 10%",
  tulatromicina: "Tulatromicina 2,5%",
  ceftiofur: "Ceftiofur sódico 2,2%",
};

const MOLECULA_DEFAULT_EQUINO: Readonly<Record<string, string>> = {
  acepromazina: "Acepromazina 1%",
  altrenogest: "Altrenogest 0,044%",
  ceftiofur: "Ceftiofur sódico 2,2%",
  detomidina: "Detomidina 1 mg/ml",
  fenbendazol: "Fenbendazol 10% pasta oral",
  fenilbutazona: "Fenilbutazona 20%",
  firocoxib: "Firocoxib 57 mg",
  flunixin: "Flunixin meglumine 2,5%",
  hialuronato: "Hialuronato sódico 10 mg/ml",
  ivermectina: "Ivermectina 1,87% pasta oral",
  ketoprofeno: "Ketoprofeno 1%",
  meloxicam: "Meloxicam 2%",
  moxidectina: "Moxidectina 2% gel oral",
  omeprazol: "Omeprazol pasta oral",
  oxitetraciclina: "Oxitetraciclina 10% L.A.",
  pirantel: "Pamoato de pirantel 11,4% pasta oral",
  praziquantel: "Praziquantel 14,02% + Ivermectina 1,87%",
  romifidina: "Romifidina 10 mg/ml",
  xilazina: "Xilazina 2%",
};

function moleculaDefault(modulo: FormulaRemedioModulo): Readonly<Record<string, string>> {
  return modulo === "equino" ? MOLECULA_DEFAULT_EQUINO : MOLECULA_DEFAULT_GANADO;
}

export interface ProductoSugeridoPatch {
  producto_nombre: string;
  producto_formula?: string;
  producto_forma?: string;
}

export interface ProductoSugeridoFlags {
  formula: boolean;
  forma: boolean;
}

function pctToken(raw: string): string | undefined {
  const m = raw.match(/(\d+[,.]?\d*)\s*%/);
  if (!m) return undefined;
  return m[1].replace(".", ",");
}

function matchFormulaInCatalog(
  text: string,
  catalogo: readonly string[]
): string | undefined {
  const key = normKey(text);
  const exact = catalogo.find((f) => normKey(f) === key);
  if (exact) return exact;

  const pct = pctToken(text);
  const candidates = catalogo.filter((f) => {
    const fn = normKey(f);
    const base = fn.split(/\d/)[0]?.trim() ?? fn;
    return key.includes(base) || fn.includes(key);
  });

  if (candidates.length === 0) return undefined;
  if (candidates.length === 1) return candidates[0];

  if (pct) {
    const withPct = candidates.filter(
      (f) => f.includes(`${pct}%`) || f.includes(`${pct.replace(",", ".")}%`)
    );
    if (withPct.length >= 1) return withPct[0];
  }

  return candidates[0];
}

export function resolverFormulaDesdePrincipio(
  principio: string,
  modulo: FormulaRemedioModulo = "ganadero"
): string | undefined {
  const raw = principio.trim();
  if (!raw || PRINCIPIO_AMBIGUO.test(raw)) return undefined;

  const catalogo = catalogoFormulasPorModulo(modulo);
  const defaults = moleculaDefault(modulo);

  if (raw.includes("+")) {
    const combo = raw
      .split("+")
      .map((part) => matchFormulaInCatalog(part.replace(/\./g, " ").trim(), catalogo))
      .filter(Boolean) as string[];
    if (combo.length >= 2) {
      const joined = combo.join(" + ");
      return matchFormulaInCatalog(joined, catalogo) ?? joined;
    }
  }

  const direct = matchFormulaInCatalog(raw.replace(/\./g, " "), catalogo);
  if (direct) return direct;

  const key = normKey(raw);
  for (const [mol, formula] of Object.entries(defaults)) {
    if (key.includes(mol)) return formula;
  }

  return undefined;
}

export function resolverFormaDesdeFicha(
  ficha: Pick<StockControlSanitarioProductoFicha, "via_administracion" | "presentacion">
): string | undefined {
  const presentacion = normKey(ficha.presentacion ?? "");
  const via = normKey(ficha.via_administracion ?? "");
  const blob = `${presentacion} ${via}`;

  if (/pour/.test(blob)) return "Pour-on";
  if (/pasta|gel oral/.test(blob)) return "Oral";
  if (/oral|suspension|bolo|premix|comprimido|tableta/.test(blob)) return "Oral";
  if (/intraven|(^|\s)iv(\s|$)|iv lenta/.test(blob)) return "Intravenosa";
  if (/intramus|im prof|(^|\s)im(\s|$)/.test(blob)) return "Intramuscular";
  if (/subcut|(^|\s)sc(\s|$)/.test(blob)) return "Subcutánea";
  if (/topica|topic/.test(blob)) return "Tópica";
  if (/inyect|solucion inyect|inyectable/.test(blob)) return "Inyectable";

  return undefined;
}

function formaSugeridaPorNombreMarca(nombre: string): string | undefined {
  const key = normKey(nombre);
  if (!key) return undefined;
  if (key.includes("pour-on") || key.includes("pour on")) return "Pour-on";
  return undefined;
}

export function sugerenciasDesdeFicha(
  ficha: StockControlSanitarioProductoFicha,
  modulo: FormulaRemedioModulo = "ganadero"
): Omit<ProductoSugeridoPatch, "producto_nombre"> {
  const producto_formula = resolverFormulaDesdePrincipio(ficha.principio_activo ?? "", modulo);
  const producto_forma = resolverFormaDesdeFicha(ficha);

  return {
    ...(producto_formula ? { producto_formula } : {}),
    ...(producto_forma ? { producto_forma } : {}),
  };
}

export function formulaSugeridaPorMarca(
  nombre: string,
  modulo: FormulaRemedioModulo = "ganadero"
): string | undefined {
  const key = normKey(nombre);
  if (!key) return undefined;
  return formulaPorMarcaMap(modulo).get(key);
}

export function patchProductoDesdeMarca(
  nombre: string,
  modulo: FormulaRemedioModulo = "ganadero"
): ProductoSugeridoPatch {
  const producto_nombre = nombre.trim();
  const producto_formula = formulaSugeridaPorMarca(producto_nombre, modulo);
  const producto_forma = formaSugeridaPorNombreMarca(producto_nombre);

  return {
    producto_nombre,
    ...(producto_formula ? { producto_formula } : {}),
    ...(producto_forma ? { producto_forma } : {}),
  };
}

export async function patchProductoDesdeMarcaAsync(
  nombre: string,
  modulo: StockDispositivoModulo,
  apiOnline: boolean
): Promise<ProductoSugeridoPatch> {
  const producto_nombre = nombre.trim();
  const base = patchProductoDesdeMarca(producto_nombre, modulo);

  if (!apiOnline || !producto_nombre) return base;

  try {
    const ficha = await fetchStockControlSanitarioProductoFicha(modulo, producto_nombre);
    if (!ficha) return base;

    const fromFicha = sugerenciasDesdeFicha(ficha, modulo);
    const producto_formula = fromFicha.producto_formula ?? base.producto_formula;
    const producto_forma = fromFicha.producto_forma ?? base.producto_forma;
    return {
      producto_nombre,
      ...(producto_formula ? { producto_formula } : {}),
      ...(producto_forma ? { producto_forma } : {}),
    };
  } catch {
    return base;
  }
}

export function flagsDesdePatch(patch: ProductoSugeridoPatch): ProductoSugeridoFlags {
  return {
    formula: Boolean(patch.producto_formula),
    forma: Boolean(patch.producto_forma),
  };
}

/** @deprecated usar patchProductoDesdeMarcaAsync */
export async function formulaSugeridaPorMarcaAsync(
  nombre: string,
  modulo: StockDispositivoModulo,
  apiOnline: boolean
): Promise<string | undefined> {
  const patch = await patchProductoDesdeMarcaAsync(nombre, modulo, apiOnline);
  return patch.producto_formula;
}
