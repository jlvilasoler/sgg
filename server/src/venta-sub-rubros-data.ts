/** Catálogo inicial de rubros y sub-rubros para ingresos por ventas. */
export const VENTA_SUB_RUBROS_SEED: ReadonlyArray<{ grupo: string; nombre: string }> = [
  { grupo: "Venta ganado", nombre: "Novillos" },
  { grupo: "Venta ganado", nombre: "Vaquillonas" },
  { grupo: "Venta ganado", nombre: "Terneros" },
  { grupo: "Venta ganado", nombre: "Vacas" },
  { grupo: "Venta ganado", nombre: "Toros" },
  { grupo: "Venta ganado", nombre: "Descarte" },

  { grupo: "Venta agricultura", nombre: "Soja" },
  { grupo: "Venta agricultura", nombre: "Trigo" },
  { grupo: "Venta agricultura", nombre: "Pasturas" },
  { grupo: "Venta agricultura", nombre: "Maíz" },
  { grupo: "Venta agricultura", nombre: "Sorgo" },

  { grupo: "Servicios y otros", nombre: "Arrendamientos" },
  { grupo: "Servicios y otros", nombre: "Faena / terceros" },
  { grupo: "Servicios y otros", nombre: "Subsidios" },
  { grupo: "Servicios y otros", nombre: "Otros ingresos" },
];

export const VENTA_GRUPOS_SUB_RUBRO = [
  ...new Set(VENTA_SUB_RUBROS_SEED.map((s) => s.grupo)),
] as string[];
