import type { Catalogos } from "./types";

export const RUBROS_DEFAULT = [
  "Sueldos y cargas sociales",
  "Impuestos y tasas",
  "Insumos veterinarios",
  "Alimentación animal",
  "Combustibles y lubricantes",
  "Transportes y Fletes",
  "Repuestos y maquinaria",
  "Servicios profesionales",
  "Alquileres y arrendamientos",
  "Seguros",
  "Agricultura",
  "Alambrados",
  "Construcciones y Reformas",
  "Servicios operativos",
  "Otros gastos de funcionamiento",
];

export const RESPONSABLES_DEFAULT = ["Elida Diaz Saravia"];

/** Valor del filtro en listado para gastos sin responsable asignado. */
export const FILTRO_SIN_RESPONSABLE = "__none__";

export const DEFAULT_CATALOGOS: Catalogos = {
  empresas: [],
  rubros: [],
  sub_rubros: [],
  sub_rubros_por_rubro: {},
  responsables: [],
  funcionarios: [],
};
