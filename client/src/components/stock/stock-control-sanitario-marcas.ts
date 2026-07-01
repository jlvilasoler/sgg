/** País de comercialización habitual del producto o laboratorio. */
export type MarcaRemedioPais = "UY" | "AR" | "BR";

export interface MarcaRemedioCatalogo {
  nombre: string;
  paises: readonly MarcaRemedioPais[];
}

export const PAIS_MARCA_LABEL: Record<MarcaRemedioPais, string> = {
  UY: "Uruguay",
  AR: "Argentina",
  BR: "Brasil",
};

/** Marcas comerciales y laboratorios frecuentes en ganadería (UY, AR, BR). */
export const MARCAS_REMEDIO_GANADO: readonly MarcaRemedioCatalogo[] = [
  { nombre: "Agrovet Market", paises: ["UY"] },
  { nombre: "Albex", paises: ["UY", "AR", "BR"] },
  { nombre: "Albenil", paises: ["UY", "AR", "BR"] },
  { nombre: "Aranda", paises: ["AR"] },
  { nombre: "Ausmectin", paises: ["UY", "AR", "BR"] },
  { nombre: "Bago", paises: ["AR", "UY"] },
  { nombre: "Banamine", paises: ["UY", "AR", "BR"] },
  { nombre: "Baycox", paises: ["UY", "AR", "BR"] },
  { nombre: "Baymec", paises: ["UY", "AR", "BR"] },
  { nombre: "Bectin", paises: ["UY", "AR", "BR"] },
  { nombre: "Biogenesis Bagó", paises: ["AR", "UY", "BR"] },
  { nombre: "Boehringer Ingelheim", paises: ["UY", "AR", "BR"] },
  { nombre: "Brouwer", paises: ["AR", "UY"] },
  { nombre: "Calier", paises: ["AR", "UY", "BR"] },
  { nombre: "Ceva Salud Animal", paises: ["UY", "AR", "BR"] },
  { nombre: "Cobalt", paises: ["UY", "AR", "BR"] },
  { nombre: "Cydectin", paises: ["UY", "AR", "BR"] },
  { nombre: "Dectomax", paises: ["UY", "AR", "BR"] },
  { nombre: "Doramec", paises: ["UY", "AR", "BR"] },
  { nombre: "Draxxin", paises: ["UY", "AR", "BR"] },
  { nombre: "Ectocide", paises: ["UY", "AR"] },
  { nombre: "Elanco", paises: ["UY", "AR", "BR"] },
  { nombre: "Engemycin", paises: ["UY", "AR", "BR"] },
  { nombre: "Eprinex", paises: ["UY", "AR", "BR"] },
  { nombre: "Excenel", paises: ["UY", "AR", "BR"] },
  { nombre: "Excede", paises: ["UY", "AR", "BR"] },
  { nombre: "Fasinex", paises: ["UY", "AR", "BR"] },
  { nombre: "Globion", paises: ["AR"] },
  { nombre: "Hipra", paises: ["UY", "AR", "BR"] },
  { nombre: "Hertape Calier", paises: ["BR", "AR"] },
  { nombre: "Ivomec", paises: ["UY", "AR", "BR"] },
  { nombre: "Ivomec Gold", paises: ["UY", "AR", "BR"] },
  { nombre: "Ivomec Pour-On", paises: ["UY", "AR", "BR"] },
  { nombre: "Ivosan", paises: ["UY", "AR", "BR"] },
  { nombre: "Ivercass", paises: ["UY", "AR", "BR"] },
  { nombre: "Ivermet", paises: ["UY", "AR", "BR"] },
  { nombre: "J.A. Baker", paises: ["UY", "AR", "BR"] },
  { nombre: "Konig", paises: ["AR"] },
  { nombre: "Labinco", paises: ["UY"] },
  { nombre: "Lafox", paises: ["UY", "AR", "BR"] },
  { nombre: "Longrange", paises: ["UY", "AR", "BR"] },
  { nombre: "Maximec", paises: ["UY", "AR", "BR"] },
  { nombre: "Merck Animal Health", paises: ["UY", "AR", "BR"] },
  { nombre: "Metacam", paises: ["UY", "AR", "BR"] },
  { nombre: "Micotil", paises: ["UY", "AR", "BR"] },
  { nombre: "Morvia", paises: ["UY"] },
  { nombre: "MSD Salud Animal", paises: ["UY", "AR", "BR"] },
  { nombre: "Naxcel", paises: ["UY", "AR", "BR"] },
  { nombre: "Ouro Fino Saúde Animal", paises: ["BR", "UY", "AR"] },
  { nombre: "Panacur", paises: ["UY", "AR", "BR"] },
  { nombre: "Panacur 25", paises: ["UY", "AR", "BR"] },
  { nombre: "Panzer", paises: ["UY", "AR", "BR"] },
  { nombre: "Provet", paises: ["UY"] },
  { nombre: "Richet", paises: ["AR"] },
  { nombre: "Rycoben", paises: ["UY", "AR", "BR"] },
  { nombre: "Supasin", paises: ["UY", "AR", "BR"] },
  { nombre: "Supracid", paises: ["UY", "AR", "BR"] },
  { nombre: "Tasignol", paises: ["UY", "AR", "BR"] },
  { nombre: "Taurador", paises: ["UY", "AR", "BR"] },
  { nombre: "Tecnopec", paises: ["AR", "UY"] },
  { nombre: "Terramicina LA", paises: ["UY", "AR", "BR"] },
  { nombre: "Tulamax", paises: ["UY", "AR", "BR"] },
  { nombre: "Valbazen", paises: ["UY", "AR", "BR"] },
  { nombre: "Vallée", paises: ["BR", "AR"] },
  { nombre: "Verben", paises: ["UY", "AR", "BR"] },
  { nombre: "Vermitan", paises: ["UY", "AR", "BR"] },
  { nombre: "Vetanco", paises: ["AR", "UY", "BR"] },
  { nombre: "Vetoquinol", paises: ["UY", "AR", "BR"] },
  { nombre: "Virbac", paises: ["UY", "AR", "BR"] },
  { nombre: "Virbamec", paises: ["UY", "AR", "BR"] },
  { nombre: "Zactran", paises: ["UY", "AR", "BR"] },
  { nombre: "Zoetis", paises: ["UY", "AR", "BR"] },
  { nombre: "Zuprevo", paises: ["UY", "AR", "BR"] },
];

export function formatMarcaPaises(paises: readonly MarcaRemedioPais[]): string {
  return paises.map((p) => PAIS_MARCA_LABEL[p]).join(" · ");
}

export function marcaCoincideBusqueda(
  marca: MarcaRemedioCatalogo,
  termino: string
): boolean {
  const t = termino.trim().toLowerCase();
  if (!t) return true;
  if (marca.nombre.toLowerCase().includes(t)) return true;
  for (const p of marca.paises) {
    if (p.toLowerCase().includes(t)) return true;
    if (PAIS_MARCA_LABEL[p].toLowerCase().includes(t)) return true;
  }
  return false;
}

export function buscarMarcaCatalogo(nombre: string): MarcaRemedioCatalogo | undefined {
  const key = nombre.trim().toLocaleLowerCase("es-UY");
  if (!key) return undefined;
  return MARCAS_REMEDIO_GANADO.find((m) => m.nombre.toLocaleLowerCase("es-UY") === key);
}
