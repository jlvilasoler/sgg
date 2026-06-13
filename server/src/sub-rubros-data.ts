/** Catálogo inicial de sub-rubros (grupo + nombre). */
export const SUB_RUBROS_SEED: ReadonlyArray<{ grupo: string; nombre: string }> = [
  { grupo: "Personal y remuneraciones", nombre: "Sueldos" },
  { grupo: "Personal y remuneraciones", nombre: "Aguinaldos" },
  { grupo: "Personal y remuneraciones", nombre: "Salario Vacacional" },
  { grupo: "Personal y remuneraciones", nombre: "Jornales" },
  { grupo: "Personal y remuneraciones", nombre: "Bonificaciones" },

  { grupo: "Veterinaria", nombre: "Honorarios Veterinarios" },
  { grupo: "Veterinaria", nombre: "Medicamentos Veterinarios" },
  { grupo: "Veterinaria", nombre: "Raciones" },
  { grupo: "Veterinaria", nombre: "Remedios de Baños Garrapata" },
  { grupo: "Veterinaria", nombre: "Análisis Laboratorio" },
  { grupo: "Veterinaria", nombre: "Caravanas Trazabilidad" },

  { grupo: "Agricultura", nombre: "Semillas" },
  { grupo: "Agricultura", nombre: "Fertilizantes" },
  { grupo: "Agricultura", nombre: "Fertilizantes Foliados" },
  { grupo: "Agricultura", nombre: "Insecticidas" },
  { grupo: "Agricultura", nombre: "Fungicidas" },
  { grupo: "Agricultura", nombre: "Honorarios Asesoramiento Agrónomo" },
  { grupo: "Agricultura", nombre: "Análisis Laboratorio Cultivos" },

  { grupo: "Mecánica", nombre: "Mecánico" },
  { grupo: "Mecánica", nombre: "Repuestos" },

  { grupo: "Alambrados", nombre: "Alambre" },
  { grupo: "Alambrados", nombre: "Postes" },
  { grupo: "Alambrados", nombre: "Piques" },
  { grupo: "Alambrados", nombre: "Porteras" },

  { grupo: "Fletes", nombre: "Fletes Ganado" },
  { grupo: "Fletes", nombre: "Fletes Agricultura (cosechas)" },
  { grupo: "Fletes", nombre: "Fletes mudanza" },
  { grupo: "Fletes", nombre: "Fletes materiales" },

  { grupo: "Tropas y domas", nombre: "Tropas Ganado" },
  { grupo: "Tropas y domas", nombre: "Domas caballos" },
  { grupo: "Tropas y domas", nombre: "Fletes insumos" },

  { grupo: "Construcción", nombre: "Construcciones (Materiales)" },
  { grupo: "Construcción", nombre: "Albañiles" },
  { grupo: "Construcción", nombre: "BPS" },
  { grupo: "Construcción", nombre: "Jornales Albañiles" },

  { grupo: "Impuestos rurales", nombre: "Contribución Rural / Padrón" },

  {
    grupo: "Primaria rural y padrones",
    nombre: "Primaria Rural / Padrón: 12822 (41,590 HAS)",
  },
  {
    grupo: "Primaria rural y padrones",
    nombre: "Padrón: 12821 (1226,2560 HAS)",
  },
  {
    grupo: "Primaria rural y padrones",
    nombre: "12819 - Padrón: 256,4951 / Firma: Ganadera Guaviyú o Ganadera Chivilcoy",
  },
  { grupo: "Primaria rural y padrones", nombre: "1% Municipal" },
  { grupo: "Primaria rural y padrones", nombre: "IMEBA" },
  { grupo: "Primaria rural y padrones", nombre: "IRAE" },

  { grupo: "Honorarios profesionales", nombre: "Honorarios Escribano" },
  { grupo: "Honorarios profesionales", nombre: "Honorarios Abogados" },
  { grupo: "Honorarios profesionales", nombre: "Honorarios Contadores" },
  { grupo: "Honorarios profesionales", nombre: "Honorarios Agrimensor" },
  { grupo: "Honorarios profesionales", nombre: "Honorarios Varios" },

  { grupo: "Servicios operativos", nombre: "Gastos Operativos Starlink" },
  { grupo: "Servicios operativos", nombre: "UTE" },
  { grupo: "Servicios operativos", nombre: "ANTEL" },
];

export const GRUPOS_SUB_RUBRO = [
  ...new Set(SUB_RUBROS_SEED.map((s) => s.grupo)),
] as string[];

export const GRUPO_ALAMBRADOS = "Alambrados";

/** Grupo antiguo en BD o catálogo que debe unificarse a «Alambrados». */
export function esGrupoAlambradosLegacy(grupo: string): boolean {
  const n = grupo
    .trim()
    .toLocaleLowerCase("es-UY")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  return (
    n === "alambrados y cerramientos" ||
    n === "alambrados y cerramiento" ||
    n.startsWith("alambrados y cerr")
  );
}

/**
 * Rubros contables propios (cada categoría va a su rubro, no dentro de «Otros gastos»).
 */
export const RUBROS_POR_GRUPO = [
  "Agricultura",
  "Alambrados",
  "Construcciones y Reformas",
  "Servicios operativos",
] as const;

/** Vínculo grupo de sub-rubro → rubro contable (nombre en RUBROS). */
export const GRUPO_A_RUBRO_DEFAULT: Record<string, string> = {
  "Personal y remuneraciones": "Sueldos y cargas sociales",
  Veterinaria: "Insumos veterinarios",
  Agricultura: "Agricultura",
  Mecánica: "Repuestos y maquinaria",
  Alambrados: "Alambrados",
  Fletes: "Transportes y Fletes",
  "Tropas y domas": "Alimentación animal",
  Construcción: "Construcciones y Reformas",
  "Impuestos rurales": "Impuestos y tasas",
  "Primaria rural y padrones": "Impuestos y tasas",
  "Honorarios profesionales": "Servicios profesionales",
  "Servicios operativos": "Servicios operativos",
  Dividendos: "Dividendos",
};

/**
 * Rubros contables creados con otro nombre que el grupo de sub-rubros en catálogo.
 * Clave = nombre en RUBROS; valor = grupo(s) en SUB_RUBROS.
 */
export const RUBRO_GRUPOS_ADICIONALES: Readonly<Record<string, readonly string[]>> = {
  "Construcciones y Reformas": ["Construcción"],
  "Transportes y Fletes": ["Fletes"],
  "Combustibles y lubricantes": ["Combustibles y lubricantes"],
  "Gastos Operativos": ["Servicios operativos"],
  Maquinarias: ["Mecánica"],
  Cultivos: ["Agricultura"],
  "Honorarios Profesionales": ["Honorarios profesionales"],
  "Servicios Profesionales": ["Honorarios profesionales"],
  "Sueldos y Cargas Sociales": ["Personal y remuneraciones"],
  Veterinaria: ["Veterinaria"],
};

/** Busca el rubro contable por defecto de un grupo (sin distinguir mayúsculas/acentos). */
export function lookupGrupoARubroDefault(grupo: string): string | undefined {
  const g = grupo.trim();
  if (!g) return undefined;
  for (const [key, val] of Object.entries(GRUPO_A_RUBRO_DEFAULT)) {
    if (key.localeCompare(g, "es", { sensitivity: "accent" }) === 0) return val;
  }
  return undefined;
}
