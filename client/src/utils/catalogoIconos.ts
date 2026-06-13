/** Iconos (emoji) según nombre de rubro, sub-rubro o grupo. */

type Regla = [RegExp, string];

const RUBRO_ICON: Record<string, string> = {
  "Sueldos y cargas sociales": "👥",
  "Impuestos y tasas": "🧾",
  "Insumos veterinarios": "💉",
  "Alimentación animal": "🐄",
  "Combustibles y lubricantes": "⛽",
  "Transportes y Fletes": "🚛",
  "Repuestos y maquinaria": "🔧",
  "Servicios profesionales": "📋",
  "Alquileres y arrendamientos": "🏠",
  Seguros: "🛡️",
  "Otros gastos de funcionamiento": "📦",
  Agricultura: "🌾",
  Alambrados: "🚧",
  "Construcciones y Reformas": "🏗️",
  "Servicios operativos": "📡",
};

const GRUPO_ICON: Record<string, string> = {
  "Personal y remuneraciones": "👥",
  Veterinaria: "🩺",
  Agricultura: "🌾",
  Mecánica: "🔧",
  Alambrados: "🚧",
  Fletes: "🚛",
  "Tropas y domas": "🐴",
  Construcción: "🏗️",
  "Impuestos rurales": "📜",
  "Primaria rural y padrones": "🗺️",
  "Honorarios profesionales": "⚖️",
  "Servicios operativos": "📡",
  Importado: "📌",
  Divide: "➗",
  "Sueldos y cargas sociales": "👥",
  "Impuestos y tasas": "🧾",
  "Insumos veterinarios": "💉",
  "Alimentación animal": "🐄",
  "Combustibles y lubricantes": "⛽",
  "Transportes y Fletes": "🚛",
  "Repuestos y maquinaria": "🔧",
  "Servicios profesionales": "📋",
  "Alquileres y arrendamientos": "🏠",
  Seguros: "🛡️",
  "Otros gastos de funcionamiento": "📦",
};

const GRUPO_REGLAS: Regla[] = [
  [/personal|remunerac|sueldo|jornal|aguinald/i, "👥"],
  [/veterin|sanidad|medicament|racion|garrapata/i, "🩺"],
  [/agric|semilla|fertiliz|insectic|fungic|cosecha|agr[oó]nom/i, "🌾"],
  [/mec[aá]nic|repuesto|maquin/i, "🔧"],
  [/alamb|cerramiento|poste|portera|pique/i, "🚧"],
  [/flete|transporte|mudanza/i, "🚛"],
  [/tropa|doma|caballo/i, "🐴"],
  [/construc|albañil|albanil|obra/i, "🏗️"],
  [/impuesto|tasa|contribuc|irae|imeba|bps/i, "📜"],
  [/padron|primaria|municipal|rural/i, "🗺️"],
  [/honorario|escriban|abogad|contador|agrimens|profesional/i, "⚖️"],
  [/ute|antel|starlink|operativ|servicio/i, "📡"],
  [/seguro/i, "🛡️"],
  [/alquiler|arrend/i, "🏠"],
  [/combust|lubric|nafta|gasoil/i, "⛽"],
  [/aliment|ganado|feedlot/i, "🐄"],
  [/divide|reparto|prorrate/i, "➗"],
  [/import/i, "📌"],
];

const SUB_ICON: Record<string, string> = {
  Sueldos: "💵",
  Aguinaldos: "🎁",
  "Salario Vacacional": "🏖️",
  Jornales: "👷",
  Bonificaciones: "⭐",
  "Honorarios Veterinarios": "🩺",
  "Medicamentos Veterinarios": "💊",
  Raciones: "🌾",
  "Remedios de Baños Garrapata": "🛁",
  "Análisis Laboratorio": "🔬",
  "Caravanas Trazabilidad": "📍",
  Semillas: "🌱",
  Fertilizantes: "🧪",
  "Fertilizantes Foliados": "🍃",
  Insecticidas: "🐛",
  Fungicidas: "🍄",
  "Honorarios Asesoramiento Agrónomo": "👨‍🌾",
  "Análisis Laboratorio Cultivos": "🧫",
  Mecánico: "🔩",
  Repuestos: "⚙️",
  Alambre: "🔗",
  Postes: "🪵",
  Piques: "📍",
  Alambrados: "🚧",
  Porteras: "🚪",
  "Fletes Ganado": "🐂",
  "Fletes Agricultura (cosechas)": "🌽",
  "Fletes mudanza": "📦",
  "Fletes materiales": "🧱",
  "Tropas Ganado": "🐎",
  "Domas caballos": "🏇",
  "Fletes insumos": "📦",
  "Construcciones (Materiales)": "🧱",
  Albañiles: "👷‍♂️",
  BPS: "🏛️",
  "Jornales Albañiles": "🔨",
  "Contribución Rural / Padrón": "📜",
  "Primaria Rural / Padrón: 12822 (41,590 HAS)": "🗺️",
  "Padrón: 12821 (1226,2560 HAS)": "🗺️",
  "12819 - Padrón: 256,4951 / Firma: Ganadera Guaviyú o Ganadera Chivilcoy": "📋",
  "1% Municipal": "🏛️",
  IMEBA: "📊",
  IRAE: "💰",
  "Honorarios Escribano": "📜",
  "Honorarios Abogados": "⚖️",
  "Honorarios Contadores": "🧮",
  "Honorarios Agrimensor": "📐",
  "Honorarios Varios": "📎",
  "Gastos Operativos Starlink": "🛰️",
  UTE: "💡",
  ANTEL: "📶",
};

const RUBRO_REGLAS: Regla[] = [
  [/sueldo|jornal|aguinald|salario|bonific/i, "👥"],
  [/impuesto|tasa|padron|primaria|imeba|irae|municipal|contribuc/i, "🧾"],
  [/veterin|sanidad|medicament|racion/i, "🩺"],
  [/aliment|ganado|tropa|doma/i, "🐄"],
  [/combust|lubric|flete/i, "⛽"],
  [/repuesto|mecan|maquin/i, "🔧"],
  [/honorario|servicio profes|escriban|abogad|contador|agrimens/i, "📋"],
  [/alquiler|arrend/i, "🏠"],
  [/seguro/i, "🛡️"],
  [/construc|albañil|albanil/i, "🏗️"],
  [/alamb|poste|portera|pique/i, "🚧"],
  [/agric|semilla|fertiliz|insectic|fungic/i, "🌾"],
  [/ute|antel|starlink|operativ/i, "📡"],
];

const SUB_REGLAS: Regla[] = [
  [/sueldo/i, "💵"],
  [/aguinald/i, "🎁"],
  [/vacacional/i, "🏖️"],
  [/jornal/i, "👷"],
  [/bonific/i, "⭐"],
  [/veterin|garrapata|caravana|trazabil/i, "🩺"],
  [/medicament|racion/i, "💊"],
  [/laboratorio/i, "🔬"],
  [/semilla/i, "🌱"],
  [/fertiliz|foliado/i, "🧪"],
  [/insectic/i, "🐛"],
  [/fungicid/i, "🍄"],
  [/agronom/i, "👨‍🌾"],
  [/mecan/i, "🔩"],
  [/repuesto/i, "⚙️"],
  [/alamb|alambr/i, "🔗"],
  [/poste/i, "🪵"],
  [/pique/i, "📍"],
  [/portera/i, "🚪"],
  [/flete.*ganado|ganado.*flete/i, "🐂"],
  [/flete.*agric|cosecha/i, "🌽"],
  [/mudanza/i, "📦"],
  [/flete/i, "🚛"],
  [/tropa/i, "🐎"],
  [/doma|caballo/i, "🏇"],
  [/construc|materiale/i, "🧱"],
  [/albañil|albanil/i, "👷‍♂️"],
  [/bps/i, "🏛️"],
  [/padron|primaria|12819|12821|12822/i, "🗺️"],
  [/municipal/i, "🏛️"],
  [/imeba/i, "📊"],
  [/irae/i, "💰"],
  [/escriban/i, "📜"],
  [/abogad/i, "⚖️"],
  [/contador/i, "🧮"],
  [/agrimens/i, "📐"],
  [/honorario/i, "📎"],
  [/starlink/i, "🛰️"],
  [/ute/i, "💡"],
  [/antel/i, "📶"],
];

function porReglas(texto: string, reglas: Regla[], fallback: string): string {
  for (const [re, icon] of reglas) {
    if (re.test(texto)) return icon;
  }
  return fallback;
}

export function iconoRubro(nombre: string): string {
  if (RUBRO_ICON[nombre]) return RUBRO_ICON[nombre];
  return porReglas(nombre, RUBRO_REGLAS, "📁");
}

export function iconoGrupo(grupo: string): string {
  const t = grupo.trim();
  if (!t) return "📁";
  if (GRUPO_ICON[t]) return GRUPO_ICON[t];
  if (RUBRO_ICON[t]) return RUBRO_ICON[t];
  return porReglas(t, GRUPO_REGLAS, porReglas(t, RUBRO_REGLAS, "📁"));
}

export function iconoSubRubro(nombre: string, grupo?: string): string {
  if (SUB_ICON[nombre]) return SUB_ICON[nombre];
  const porNombre = porReglas(nombre, SUB_REGLAS, "");
  if (porNombre) return porNombre;
  if (grupo) return iconoGrupo(grupo);
  return "•";
}

const ORDEN_GRUPOS = [
  "Personal y remuneraciones",
  "Veterinaria",
  "Agricultura",
  "Mecánica",
  "Alambrados",
  "Fletes",
  "Tropas y domas",
  "Construcción",
  "Impuestos rurales",
  "Primaria rural y padrones",
  "Honorarios profesionales",
  "Servicios operativos",
  "Importado",
];

export function compararGrupos(a: string, b: string): number {
  const ia = ORDEN_GRUPOS.indexOf(a);
  const ib = ORDEN_GRUPOS.indexOf(b);
  if (ia >= 0 && ib >= 0) return ia - ib;
  if (ia >= 0) return -1;
  if (ib >= 0) return 1;
  return a.localeCompare(b, "es");
}

/** Agrupa sub-rubros por grupo y ordena jerárquicamente. */
export function agruparSubRubrosPorGrupo<
  T extends { grupo: string; nombre: string },
>(items: T[]): Array<{ grupo: string; items: T[] }> {
  const map = new Map<string, T[]>();
  for (const s of items) {
    const list = map.get(s.grupo) ?? [];
    list.push(s);
    map.set(s.grupo, list);
  }
  return [...map.entries()]
    .sort(([ga], [gb]) => compararGrupos(ga, gb))
    .map(([grupo, list]) => ({
      grupo,
      items: [...list].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    }));
}
