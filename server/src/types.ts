export const EMPRESAS = [
  "GANADERA GUAVIYU",
  "GANADERA CHIVILCOY",
] as const;

export type Empresa = (typeof EMPRESAS)[number];

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
] as const;

export const RESPONSABLES_DEFAULT = ["Elida Diaz Saravia"] as const;

export interface PresupuestoInput {
  empresa: Empresa;
  fecha: string;
  codigo_proveedor: string;
  razon_social_proveedor: string;
  concepto: string;
  /** Detalle opcional adicional de la operación. */
  observaciones: string;
  rubro: string;
  sub_rubro: string;
  responsable_gasto: string;
  /** Cédula del funcionario (RRHH), para vincular con Sueldos y Jornales. */
  funcionario_cedula: string;
  nro_factura: string;
  /** Número de operación del documento origen (ej. comprobante BROU). */
  nro_operacion_origen: string;
  pesos: number;
  dolares_usd: number;
  reales: number;
  tc_usd: number;
  tc_reales: number;
  saldo_usd: number;
}

export interface Presupuesto extends PresupuestoInput {
  id: number;
  nro_registro: number;
  ingresado_por_email?: string;
  ingresado_por_nombre?: string;
  creado_en?: string;
  documento_adjunto?: PresupuestoDocumentoMeta | null;
}

export interface PresupuestoDocumentoMeta {
  nombre: string;
  mime: string;
  tamano: number;
}

export interface ResumenEmpresa {
  empresa: string;
  cantidad: number;
  total_pesos: number;
  total_usd: number;
  total_reales: number;
  total_saldo_usd: number;
}

export interface ResumenRubro {
  rubro: string;
  cantidad: number;
  total_pesos: number;
  total_usd: number;
}
