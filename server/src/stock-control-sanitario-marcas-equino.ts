import type { StockDispositivoModulo } from "./stock-control-sanitario-db.js";

/** Nombres del catálogo equino (sincronizado con client MARCAS_REMEDIO_EQUINO). */
export const NOMBRES_CATALOGO_EQUINO: readonly string[] = [
  "Acepran",
  "Adequan",
  "Banamine",
  "Bio-Bute",
  "Bute",
  "Calier",
  "Dormosedan",
  "Engemycin",
  "Eqvalan",
  "Equilis",
  "Equimax",
  "Equimec",
  "Equioxx",
  "Equipalazone",
  "Equipaste",
  "Equistrong",
  "Equest",
  "Excenel",
  "Gastrogard",
  "Hipra",
  "Hylartil",
  "Ketofen",
  "Legend",
  "Metacam",
  "MSD Salud Animal",
  "Naxcel",
  "Panacur",
  "Pneumequine",
  "Prodigy",
  "Regu-Mate",
  "Rotecno",
  "Strongid P",
  "Ulcergard",
  "Vetoquinol",
  "Virbac",
  "West Nile Innovator",
  "Zoetis",
];

/** Nombres del catálogo ovino (sincronizado con client MARCAS_REMEDIO_OVINO). */
export const NOMBRES_CATALOGO_OVINO: readonly string[] = [
  "Agrovet Market",
  "Albex",
  "Albenil",
  "Bago",
  "Bectin",
  "Biogenesis Bagó",
  "Boehringer Ingelheim",
  "Calier",
  "Ceva Salud Animal",
  "Cobalt",
  "Cydectin",
  "Dectomax",
  "Ectocide",
  "Elanco",
  "Engemycin",
  "Fasinex",
  "Hertape Calier",
  "Ivomec",
  "Ivosan",
  "Ivermet",
  "Konig",
  "Lafox",
  "Maximec",
  "Merck Animal Health",
  "MSD Salud Animal",
  "Ouro Fino Saúde Animal",
  "Panacur",
  "Panacur 25",
  "Rycoben",
  "Supracid",
  "Tasignol",
  "Terramicina LA",
  "VAC-SULES",
  "Valbazen",
  "Verben",
  "Vermitan",
  "Vetanco",
  "Virbac",
  "Virbamec",
  "Zoetis",
];

const CATALOGO_EQUINO_KEYS = new Set(
  NOMBRES_CATALOGO_EQUINO.map((n) => n.trim().toLocaleLowerCase("es-UY")),
);

const CATALOGO_OVINO_KEYS = new Set(
  NOMBRES_CATALOGO_OVINO.map((n) => n.trim().toLocaleLowerCase("es-UY")),
);

export function nombreEnCatalogoEquino(nombre: string): boolean {
  return CATALOGO_EQUINO_KEYS.has(nombre.trim().toLocaleLowerCase("es-UY"));
}

export function nombreEnCatalogoOvino(nombre: string): boolean {
  return CATALOGO_OVINO_KEYS.has(nombre.trim().toLocaleLowerCase("es-UY"));
}

export function especieIndicaEquinos(especie: string): boolean {
  return /equino/i.test(String(especie ?? "").trim());
}

export function especieIndicaOvinos(especie: string): boolean {
  return /ovino/i.test(String(especie ?? "").trim());
}

/** Especie de ficha solo bovina (sin ovino ni equino). */
export function especieIndicaSoloBovinosPuros(especie: string): boolean {
  const e = String(especie ?? "").trim();
  if (!e) return false;
  if (especieIndicaOvinos(e) || especieIndicaEquinos(e)) return false;
  return /bovino|vacuno/i.test(e);
}

/**
 * Para filtrar equino: cualquier especie de ganado no-equino
 * (incluye "Bovinos y Ovinos").
 */
export function especieIndicaSoloBovinos(especie: string): boolean {
  const e = String(especie ?? "").trim();
  if (!e) return false;
  if (especieIndicaEquinos(e)) return false;
  return /bovino|vacuno|ovino|caprino|porcino/i.test(e);
}

export function productoVisibleEnModuloSanitario(
  modulo: StockDispositivoModulo | undefined,
  opts: { nombre: string; especie: string; en_ficha: boolean },
): boolean {
  if (!modulo) return true;
  const especie = String(opts.especie ?? "").trim();
  const enCatalogoEquino = nombreEnCatalogoEquino(opts.nombre);
  const enCatalogoOvino = nombreEnCatalogoOvino(opts.nombre);

  if (modulo === "equino") {
    if (especieIndicaSoloBovinos(especie)) return false;
    if (especieIndicaEquinos(especie)) return true;
    if (enCatalogoEquino) return true;
    if (!opts.en_ficha) return true;
    return false;
  }

  if (modulo === "ovino") {
    if (especieIndicaSoloBovinosPuros(especie)) return false;
    if (
      especieIndicaEquinos(especie) &&
      !especieIndicaOvinos(especie) &&
      !/bovino|vacuno|caprino|porcino/i.test(especie)
    ) {
      return false;
    }
    if (especieIndicaOvinos(especie)) return true;
    if (enCatalogoOvino) return true;
    if (!opts.en_ficha) return true;
    return false;
  }

  if (especieIndicaEquinos(especie)) {
    const esp = especie.toLocaleLowerCase("es");
    if (/equino/.test(esp) && !/bovino|vacuno|ovino|caprino|porcino/.test(esp)) {
      return false;
    }
  }
  return true;
}
