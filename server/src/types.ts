export type Empresa = string;

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

export type TipoComprobantePresupuesto = "FACTURA" | "NOTA_CREDITO";

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
  /** FACTURA (default) o NOTA_CREDITO. */
  tipo_comprobante?: TipoComprobantePresupuesto;
  /** Gasto/factura que anula esta NC. */
  presupuesto_origen_id?: number | null;
  /** Número del documento de nota de crédito del proveedor. */
  nro_nota_credito?: string;
}

export interface Presupuesto extends PresupuestoInput {
  id: number;
  nro_registro: number;
  cuenta_id?: number | null;
  ingresado_por_email?: string;
  ingresado_por_nombre?: string;
  creado_en?: string;
  documento_adjunto?: PresupuestoDocumentoMeta | null;
  tipo_comprobante?: TipoComprobantePresupuesto;
  presupuesto_origen_id?: number | null;
  nro_nota_credito?: string;
}

/** Factura/gasto con saldo pendiente para aplicar una NC. */
export interface PresupuestoFacturaParaNc {
  id: number;
  nro_registro: number;
  empresa: Empresa;
  fecha: string;
  codigo_proveedor: string;
  razon_social_proveedor: string;
  nro_factura: string;
  concepto: string;
  rubro: string;
  sub_rubro: string;
  responsable_gasto: string;
  funcionario_cedula: string;
  pesos: number;
  dolares_usd: number;
  reales: number;
  tc_usd: number;
  tc_reales: number;
  saldo_usd: number;
  saldo_pendiente_usd: number;
  nc_aplicadas_usd: number;
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
  total_reales: number;
  total_saldo_usd: number;
}

export interface ResumenEmpresaRubro extends ResumenTotales {
  empresa: string;
  rubro: string;
}

export interface ResumenTotales {
  cantidad: number;
  total_pesos: number;
  total_usd: number;
  total_reales: number;
  total_saldo_usd: number;
}

/** Importes en USD por mes (clave YYYY-MM) para el estado financiero. */
export interface EstadoFinancieroUsd {
  total_saldo_usd: number;
  por_mes: Record<string, number>;
}

export interface EstadoFinancieroMes {
  clave: string;
  label: string;
}

export interface EstadoFinancieroLinea extends EstadoFinancieroUsd {
  sub_rubro: string;
}

export interface EstadoFinancieroRubro {
  rubro: string;
  sub_rubros: EstadoFinancieroLinea[];
  totales: EstadoFinancieroUsd;
}

export interface EstadoFinancieroPayload {
  meses: EstadoFinancieroMes[];
  rubros: EstadoFinancieroRubro[];
}

export interface GastosProveedorTotalesLinea extends ResumenTotales {
  codigo_proveedor: string;
  razon_social_proveedor: string;
}

export interface GastosProveedorDetalleLinea {
  id: number;
  codigo_proveedor: string;
  fecha: string;
  empresa: string;
  rubro: string;
  sub_rubro: string;
  concepto: string;
  nro_factura: string;
  pesos: number;
  dolares_usd: number;
  reales: number;
  saldo_usd: number;
}

export interface GastosProveedoresReportPayload {
  totales: GastosProveedorTotalesLinea[];
  detalle: GastosProveedorDetalleLinea[];
  consolidado: ResumenTotales;
}

export interface EstadoResultadosSubRubroLinea {
  sub_rubro: string;
  total: number;
}

export interface EstadoResultadosRubroLinea {
  rubro: string;
  total: number;
  sub_rubros: EstadoResultadosSubRubroLinea[];
}

export interface EstadoResultadosClasificacionDetalle {
  total: number;
  rubros: EstadoResultadosRubroLinea[];
}

export interface EstadoResultadosVentasDetalle {
  ganado: number;
  agricultura: number;
  arrendamientos: number;
}

export interface EstadoResultadosPayload {
  ventas: number;
  ventas_detalle: EstadoResultadosVentasDetalle;
  costos_produccion: number;
  gastos_administrativos: number;
  gastos_comerciales: number;
  utilidad: number;
  detalle: Record<
    "COSTOS_PRODUCCION" | "GASTOS_ADMINISTRATIVOS" | "GASTOS_COMERCIALES",
    EstadoResultadosClasificacionDetalle
  >;
}

export interface ResumenSubRubro extends ResumenTotales {
  rubro: string;
  sub_rubro: string;
}

export interface ResumenSubRubroMes {
  rubro: string;
  sub_rubro: string;
  mes: string;
  total_saldo_usd: number;
}
