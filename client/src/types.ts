export type Empresa = string;

export interface Presupuesto {
  id: number;
  nro_registro: number;
  empresa: Empresa;
  fecha: string;
  codigo_proveedor: string;
  razon_social_proveedor: string;
  concepto: string;
  observaciones: string;
  rubro: string;
  sub_rubro: string;
  responsable_gasto: string;
  funcionario_cedula: string;
  nro_factura: string;
  nro_operacion_origen: string;
  pesos: number;
  dolares_usd: number;
  reales: number;
  tc_usd: number;
  tc_reales: number;
  saldo_usd: number;
  creado_en?: string;
  ingresado_por_email?: string;
  ingresado_por_nombre?: string;
  documento_adjunto?: PresupuestoDocumentoAdjunto | null;
}

export interface PresupuestoDocumentoAdjunto {
  nombre: string;
  mime: string;
  tamano: number;
}

export type PresupuestoForm = Omit<Presupuesto, "id" | "nro_registro" | "creado_en">;

/** Configuración del registro de comisión bancaria separado (transferencias BROU). */
export interface ComisionDocumentoConfig {
  activa: boolean;
  heredar: string[];
  campos_incluidos: string[];
  mapeo_campos: Record<string, string>;
  valores_fijos: Record<string, string>;
}

export interface TipoDocumentoGasto {
  id: number;
  nombre: string;
  descripcion: string;
  origen: string;
  /** Banco/cuenta de destino del movimiento (ej. SANTANDER). */
  destino: string;
  activo: boolean;
  campos_habilitados: string[];
  campos_requeridos: string[];
  valores_defecto: Record<string, string>;
  /** Conexiones campo del documento → campo del formulario de gasto. */
  mapeo_campos: Record<string, string>;
  /** Configuración del registro de comisión bancaria (BROU). */
  comision_config: ComisionDocumentoConfig;
  creado_en?: string;
  actualizado_en?: string;
}

export type TipoDocumentoGastoForm = Omit<
  TipoDocumentoGasto,
  "id" | "creado_en" | "actualizado_en"
>;

export type BrouMoneda = "UYU" | "USD";

export interface BrouImporte {
  moneda: BrouMoneda;
  valor: number;
}

export interface BrouTransferenciaParsed {
  numero_operacion: string;
  numero_transferencia: string;
  fecha: string;
  importe_acreditar: BrouImporte;
  comision: BrouImporte | null;
  beneficiario_nombre: string;
  beneficiario_direccion: string;
  beneficiario_observaciones: string;
  banco_destino: string;
  cuenta_destino: string;
  concepto_brou: string;
  cuenta_origen: string;
  proveedor_cod: number | null;
  proveedor_razon: string;
  valores_mapeo?: Partial<Record<string, string>>;
  valores_mapeo_comision?: Partial<Record<string, string>>;
}

export interface TipoDocumentoDetectado {
  id: number;
  nombre: string;
  origen: string;
  destino: string;
  comision_activa: boolean;
}

export interface ComprobanteLeido extends BrouTransferenciaParsed {
  /** true si el comprobante es una transferencia BROU (parser específico aplicado). */
  es_brou?: boolean;
  /** true si es un comprobante Santander «Transferencias en el país». */
  es_santander_pais?: boolean;
  /** Tipo de documento configurado que coincidió con el texto (banco detectado). */
  tipo_detectado?: TipoDocumentoDetectado | null;
}

export interface CampoDocumentoDetectado {
  etiqueta: string;
  valor_muestra: string;
}

export interface DetectarCamposDocumentoResult {
  campos: CampoDocumentoDetectado[];
}

export interface IngresoVenta {
  id: number;
  nro_registro: number;
  fecha: string;
  codigo_proveedor: string;
  razon_social_proveedor: string;
  concepto: string;
  nro_factura: string;
  pesos: number;
  dolares_usd: number;
  tc_usd: number;
  total_usd: number;
  creado_en?: string;
}

export type IngresoVentaForm = Omit<IngresoVenta, "id" | "nro_registro" | "creado_en" | "total_usd">;

export type VentaAgriculturaCultivo = "TRIGO" | "SOJA" | "MAIZ" | "COLZA";

export interface VentaAgriculturaRow {
  id: number;
  empresa: Empresa;
  mes_inicio: number;
  mes_fin: number;
  anio_inicio: number;
  anio_fin: number;
  cultivo: VentaAgriculturaCultivo;
  hectareas: number;
  rendimiento_ton_ha: number;
  precio_usd_ton: number;
  total_ton: number;
  importe_usd: number;
  venta_realizada: boolean;
  venta_realizada_en: string | null;
  real_mes_inicio: number | null;
  real_mes_fin: number | null;
  real_anio_inicio: number | null;
  real_anio_fin: number | null;
  real_hectareas: number | null;
  real_rendimiento_ton_ha: number | null;
  real_precio_usd_ton: number | null;
  real_total_ton: number | null;
  real_importe_usd: number | null;
  real_notas: string | null;
  destacada: boolean;
  creado_en: string;
}

export interface VentaAgriculturaRealInput {
  mes_inicio: number;
  mes_fin: number;
  anio_inicio: number;
  anio_fin: number;
  hectareas: number;
  rendimiento_ton_ha: number;
  precio_usd_ton: number;
  total_ton: number;
  importe_usd: number;
  notas?: string | null;
}

export type VentaArrendamientoDepartamento = "RIVERA" | "RIO_NEGRO";

export interface VentaArrendamientoRow {
  id: number;
  empresa: Empresa;
  fecha_inicio: string;
  fecha_fin: string;
  departamento: VentaArrendamientoDepartamento;
  padron: string;
  hectareas: number;
  precio_usd_ha: number;
  total_usd: number;
  notas: string | null;
  pago_frecuencia: "MENSUAL" | "ANUAL";
  pago_inicio: string;
  pago_fin: string;
  pago_inicio_monto: number;
  pago_inicio_tipo: "VALOR" | "PORCENTAJE";
  pago_fin_monto: number;
  pago_fin_tipo: "VALOR" | "PORCENTAJE";
  venta_realizada: boolean;
  venta_realizada_en: string | null;
  real_fecha_inicio: string | null;
  real_fecha_fin: string | null;
  real_hectareas: number | null;
  real_precio_usd_ha: number | null;
  real_total_usd: number | null;
  real_notas: string | null;
  real_pago_frecuencia: "MENSUAL" | "ANUAL" | null;
  real_pago_inicio: string | null;
  real_pago_fin: string | null;
  real_pago_inicio_monto: number | null;
  real_pago_inicio_tipo: "VALOR" | "PORCENTAJE" | null;
  real_pago_fin_monto: number | null;
  real_pago_fin_tipo: "VALOR" | "PORCENTAJE" | null;
  destacada: boolean;
  creado_en: string;
}

export interface VentaArrendamientoRealInput {
  fecha_inicio: string;
  fecha_fin: string;
  hectareas: number;
  precio_usd_ha: number;
  total_usd: number;
  notas?: string | null;
  pago_frecuencia: "MENSUAL" | "ANUAL";
  pago_inicio: string;
  pago_fin: string;
  pago_inicio_monto: number;
  pago_inicio_tipo: "VALOR" | "PORCENTAJE";
  pago_fin_monto: number;
  pago_fin_tipo: "VALOR" | "PORCENTAJE";
}

export interface StockGanaderoLote {
  id: number;
  nombre_archivo: string;
  filas: number;
  importado_en: string;
}

export interface StockGanaderoRegistro {
  id: number;
  lote_id: number;
  eid: string;
  vid: string;
  fecha: string;
  hora: string;
  condicion: string;
  creado_en?: string;
}

export interface StockGanaderoEidRepetido {
  eid: string;
  vid: string;
  clave: string;
  cantidad: number;
}

export interface StockGanaderoEstadisticas {
  total_lecturas: number;
  eids_activos: number;
  eids_repetidos: number;
  lecturas_en_repetidos: number;
  detalle_repetidos: StockGanaderoEidRepetido[];
}

export type DispositivoSexo = "" | "MACHO" | "HEMBRA";
export type DispositivoEmpresa = "" | "GUAVIYU" | "CHIVILCOY";
export type DispositivoEstado = "VIVO" | "MUERTO" | "VENDIDO" | "FRIGORIFICO" | "PERDIDO";

export type TipoBaja =
  | "VENTA_FRIGORIFICO"
  | "FRIGORIFICO"
  | "VENTA_PRODUCTOR"
  | "MUERTE"
  | "PERDIDO";

export interface StockGanaderaDispositivo {
  clave: string;
  eid: string;
  vid: string;
  sexo: DispositivoSexo;
  empresa: DispositivoEmpresa;
  grupo: string;
  grupo_libre: string;
  edad: number | null;
  nacimiento_mes: number | null;
  nacimiento_anio: number | null;
  observaciones: string;
  estado: DispositivoEstado;
  tipo_baja: TipoBaja | "";
  numero_guia: string;
  baja_mes: number | null;
  baja_anio: number | null;
  primera_fecha: string;
  ultima_fecha: string;
  ultima_hora: string;
  ultima_condicion: string;
  total_lecturas: number;
  es_repetido: boolean;
}

export interface StockGanaderaLecturaDetalle extends StockGanaderoRegistro {
  nombre_archivo: string;
}

export interface StockGanaderaDispositivoDetalle extends StockGanaderaDispositivo {
  lecturas: StockGanaderaLecturaDetalle[];
  lotes_distintos: number;
}

export interface StockGanaderaDispositivoHistorial {
  id: number;
  clave: string;
  campo: string;
  etiqueta: string;
  valor_anterior: string;
  valor_nuevo: string;
  creado_en: string;
  user_id: number | null;
  user_email: string;
  user_nombre: string;
  origen: string;
}

export type StockMovimientoTipo = "ALTA" | "BAJA" | "MODIFICACION";

export interface StockMovimientoBajaDispositivo {
  clave: string;
  eid: string;
  vid: string;
  numero: string;
  primera_fecha: string;
  fecha_baja: string;
  dias_en_sistema: number | null;
  categoria: string;
  tipo_baja: string;
}

export interface StockMovimientoAuditoria {
  id: number;
  user_id: number | null;
  user_email: string;
  user_nombre: string;
  tipo: StockMovimientoTipo;
  clave: string;
  cantidad: number;
  resumen: string;
  detalle: string;
  ip: string;
  creado_en: string;
  baja_dispositivo?: StockMovimientoBajaDispositivo | null;
}

export interface AuthActividadLog {
  id: number;
  evento: string;
  email: string | null;
  user_nombre: string | null;
  ip: string | null;
  user_agent: string | null;
  detalle: string | null;
  creado_en: string;
}

export interface UsuarioOnline {
  id: number;
  email: string;
  nombre: string;
  rol: string;
  avatar: UserAvatar;
  ip: string | null;
  pantalla: string | null;
  ultimo_visto: string;
  hace_segundos: number;
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

export interface GastosProveedoresReport {
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

export interface EstadoResultados {
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

export interface Catalogos {
  empresas: Empresa[];
  rubros: string[];
  sub_rubros: string[];
  /** Sub-rubros válidos por nombre de rubro (solo rubros con vínculos configurados). */
  sub_rubros_por_rubro: Record<string, string[]>;
  responsables: string[];
  funcionarios: FuncionarioSelectorItem[];
}

export interface FuncionarioSelectorItem {
  cedula: string;
  label: string;
  /** Apellido, nombre — para Presupuesto asignado en rubros de sueldos. */
  nombre_display: string;
}

export interface Funcionario {
  id: number;
  cedula: string;
  nombre: string;
  apellido: string;
  domicilio: string;
  ciudad: string;
  departamento: string;
  banco: string;
  sucursal: string;
  cuenta: string;
  tipo_cuenta: string;
  titular_cuenta: string;
  cuenta_otros_bancos: string;
  moneda_otros_bancos: string;
  celular: string;
  email: string;
  activo: number;
  creado_en?: string;
  actualizado_en?: string;
}

export type FuncionarioForm = {
  cedula: string;
  nombre: string;
  apellido: string;
  domicilio: string;
  ciudad: string;
  departamento: string;
  celular: string;
  email: string;
  banco: string;
  sucursal: string;
  cuenta: string;
  tipo_cuenta: string;
  titular_cuenta: string;
  cuenta_otros_bancos: string;
  activo: boolean;
};

export type VinculoPago = "explicito" | "rubro" | "concepto";

export interface PagoFuncionario {
  id: number;
  nro_registro: number;
  fecha: string;
  empresa: string;
  codigo_proveedor: string;
  razon_social_proveedor: string;
  concepto: string;
  rubro: string;
  sub_rubro: string;
  nro_factura: string;
  pesos: number;
  dolares_usd: number;
  reales: number;
  tc_usd: number;
  tc_reales: number;
  saldo_usd: number;
  vinculo: VinculoPago;
}

export interface ResumenPagosFuncionario {
  cedula: string;
  cedula_display: string;
  funcionario: Funcionario | null;
  total_registros: number;
  total_pesos: number;
  total_usd: number;
  total_reales: number;
  total_saldo_usd: number;
  por_rubro: Array<{
    rubro: string;
    sub_rubro: string;
    cantidad: number;
    total_pesos: number;
    total_usd: number;
    total_reales: number;
    total_saldo_usd: number;
  }>;
  por_anio: Array<{
    anio: string;
    cantidad: number;
    total_pesos: number;
    total_usd: number;
    total_reales: number;
    total_saldo_usd: number;
  }>;
  pagos: PagoFuncionario[];
}

export interface Rubro {
  id: number;
  nombre: string;
  activo: number;
  creado_en?: string;
}

export type RubroForm = {
  nombre: string;
  activo: boolean;
};

export interface SubRubro {
  id: number;
  nombre: string;
  grupo: string;
  activo: number;
  creado_en?: string;
}

export type SubRubroForm = {
  nombre: string;
  grupo: string;
  activo: boolean;
};

export interface SubRubroItem {
  id: number;
  sub_rubro_id: number;
  nombre: string;
  activo: number;
  creado_en?: string;
}

export interface RubroVinculoMapaItem {
  rubro_id: number;
  rubro: string;
  rubro_activo: number;
  sub_rubros: Array<{ nombre: string; grupo: string; activo: number }>;
}

export interface Responsable {
  id: number;
  nombre: string;
  activo: number;
  creado_en?: string;
}

export type ResponsableForm = {
  nombre: string;
  activo: boolean;
};

export interface Proveedor {
  id: number;
  cod: number;
  razon_social: string;
  rut: string;
  direccion: string;
  ciudad: string;
  rubro: string;
  sub_rubro: string;
  clasificacion_resultado: ClasificacionResultado | null;
  creado_en?: string;
}

export type ProveedorRubroClasificacionInput = {
  rubro: string;
  sub_rubro: string;
};

export type ProveedorForm = Omit<
  Proveedor,
  "id" | "creado_en" | "clasificacion_resultado" | "rubro" | "sub_rubro"
>;

export type ClasificacionResultado =
  | "COSTOS_PRODUCCION"
  | "GASTOS_ADMINISTRATIVOS"
  | "GASTOS_COMERCIALES";

export type ParDivisa = "UYU_USD" | "BRL_USD";

export interface TipoCambio {
  id: number;
  fecha: string;
  par: ParDivisa;
  valor: number;
  creado_en?: string;
}

export type TipoCambioForm = Omit<TipoCambio, "id" | "creado_en">;

export interface DivisaIndicadores {
  ultimo: { fecha: string; valor: number } | null;
  promedio_mes: { mes: string; valor: number; dias: number } | null;
  cierre_mes_anterior: { mes: string; fecha: string; valor: number } | null;
}

/** Dirección del tipo de cambio: unidades de moneda destino por 1 USD. */
export const PAR_DIVISA_LABELS: Record<ParDivisa, string> = {
  UYU_USD: "Dólares estadounidenses → pesos uruguayos",
  BRL_USD: "Dólares estadounidenses → reales brasileños",
};

/** Etiqueta corta para columnas y campos de valor TC. */
export const PAR_DIVISA_TC_LABEL: Record<ParDivisa, string> = {
  UYU_USD: "",
  BRL_USD: "",
};

export type CategoriaGanadoGordo = "NOVILLO" | "VACA" | "VAQUILLONA";
export type CategoriaGanadoReposicion = "TERNERO" | "TERNERA" | "VACA_INVERNADA";
export type CategoriaPrecioGanado = CategoriaGanadoGordo | CategoriaGanadoReposicion;
export type SegmentoPreciosGanado = "GORDO" | "REPOSICION";

export interface PrecioGanado {
  id: number;
  anio: number;
  semana: number;
  fecha_desde: string;
  fecha_hasta: string;
  segmento: SegmentoPreciosGanado;
  categoria: CategoriaPrecioGanado;
  valor: number;
  unidad: string;
  fuente: string;
}

export interface SemanaPreciosGanado {
  anio: number;
  semana: number;
  fecha_desde: string;
  fecha_hasta: string;
  segmento: SegmentoPreciosGanado;
  fuente: string;
  precios: Partial<Record<CategoriaPrecioGanado, number>>;
}

export interface PrecioGanadoResumenLocal {
  total_semanas: number;
  total_registros: number;
  ultima_sincronizacion: string | null;
  ultima_semana_guardada: { anio: number; semana: number; fecha_hasta: string } | null;
}

export const CATEGORIA_GANADO_GORDO_LABELS: Record<CategoriaGanadoGordo, string> = {
  NOVILLO: "Novillo",
  VACA: "Vaca",
  VAQUILLONA: "Vaquillona",
};

export const CATEGORIA_GANADO_REPOSICION_LABELS: Record<
  CategoriaGanadoReposicion,
  string
> = {
  TERNERO: "Ternero",
  TERNERA: "Ternera",
  VACA_INVERNADA: "Vaca de invernada",
};

/** @deprecated usar CATEGORIA_GANADO_GORDO_LABELS */
export const CATEGORIA_GANADO_LABELS = CATEGORIA_GANADO_GORDO_LABELS;

export const PRECIO_GANADO_GORDO_UNIDAD_LABEL = "USD/kg en cuarta balanza";
export const PRECIO_GANADO_REPOSICION_UNIDAD_LABEL = "USD/kg en pie";

export type SimuladorVentaTipo = "EN_PIE" | "CUARTA_BALANZA";
export type SimuladorModoKg = "TOTAL" | "CABEZAS";

export interface SimuladorVentaRealInput {
  precio_usd_kg: number;
  cantidad_animales?: number | null;
  kg_promedio?: number | null;
  kg_total: number;
  total_usd: number;
  total_usd_por_cabeza?: number | null;
  notas?: string | null;
}

export interface SimuladorVentaGanadoRow {
  id: number;
  numero_operacion: string;
  tipo: SimuladorVentaTipo;
  segmento: SegmentoPreciosGanado;
  categoria: CategoriaPrecioGanado;
  modo_kg: SimuladorModoKg;
  precio_usd_kg: number;
  precio_ref_anio: number | null;
  precio_ref_semana: number | null;
  precio_ref_fecha_hasta: string | null;
  cantidad_animales: number | null;
  kg_promedio: number | null;
  kg_total: number;
  rendimiento: number | null;
  total_usd: number;
  total_usd_por_cabeza: number | null;
  notas: string | null;
  destacada: boolean;
  venta_realizada: boolean;
  venta_realizada_en: string | null;
  real_precio_usd_kg: number | null;
  real_cantidad_animales: number | null;
  real_kg_promedio: number | null;
  real_kg_total: number | null;
  real_total_usd: number | null;
  real_total_usd_por_cabeza: number | null;
  real_notas: string | null;
  destino: string | null;
  usuario_id: number | null;
  usuario_nombre: string | null;
  creado_en: string;
  dispositivos_count: number;
}

export interface SimuladorVentaDispositivoRow {
  id: number;
  simulacion_id: number;
  clave: string;
  eid: string;
  vid: string;
  creado_en: string;
}

export type SimuladorVentaAuditoriaTipo =
  | "CREAR"
  | "ACTUALIZAR"
  | "DESTACAR"
  | "QUITAR_DESTACADO"
  | "VENTA_REAL_REGISTRADA"
  | "VENTA_REAL_ACTUALIZADA"
  | "VENTA_REAL_ANULADA"
  | "ELIMINAR";

export interface SimuladorVentaOperacionSnapshot {
  id: number;
  numero_operacion: string;
  tipo: string;
  segmento: string;
  categoria: string;
  simulacion: {
    modo_kg: string;
    precio_usd_kg: number;
    precio_ref_anio: number | null;
    precio_ref_semana: number | null;
    precio_ref_fecha_hasta: string | null;
    cantidad_animales: number | null;
    kg_promedio: number | null;
    kg_total: number;
    rendimiento: number | null;
    total_usd: number;
    total_usd_por_cabeza: number | null;
    notas: string | null;
  };
  venta_real: {
    venta_realizada: boolean;
    venta_realizada_en: string | null;
    precio_usd_kg: number | null;
    cantidad_animales: number | null;
    kg_promedio: number | null;
    kg_total: number | null;
    total_usd: number | null;
    total_usd_por_cabeza: number | null;
    notas: string | null;
  } | null;
  destacada: boolean;
  usuario_id: number | null;
  usuario_nombre: string | null;
  creado_en: string;
}

export interface SimuladorVentaAuditoriaDetalle {
  antes?: SimuladorVentaOperacionSnapshot | null;
  despues?: SimuladorVentaOperacionSnapshot | null;
  cambios?: string[];
  historico?: boolean;
}

export interface SimuladorVentaAuditoriaRow {
  id: number;
  simulacion_id: number | null;
  numero_operacion: string;
  user_id: number | null;
  user_email: string;
  user_nombre: string;
  tipo: SimuladorVentaAuditoriaTipo;
  resumen: string;
  detalle: SimuladorVentaAuditoriaDetalle | null;
  ip: string;
  creado_en: string;
}

export interface SimuladorPreciosReferencia {
  tipo: SimuladorVentaTipo;
  segmento: SegmentoPreciosGanado;
  ultima: SemanaPreciosGanado | null;
  precios: Partial<Record<CategoriaPrecioGanado, number>>;
  labels: Record<string, string>;
  categorias: readonly string[];
  siguiente_numero_operacion: string;
}

/** @deprecated usar PRECIO_GANADO_GORDO_UNIDAD_LABEL */
export const PRECIO_GANADO_UNIDAD_LABEL = PRECIO_GANADO_GORDO_UNIDAD_LABEL;

export type Rol = "admin" | "editor" | "gestor_n2" | "consulta";

export const ALL_ROLES: Rol[] = ["admin", "editor", "gestor_n2", "consulta"];

export const ROL_LABELS: Record<Rol, string> = {
  admin: "Administrador",
  editor: "Gestor",
  gestor_n2: "Gestor",
  consulta: "Consulta",
};

/** Etiquetas con nivel (solo administración de usuarios y permisos). */
export const ROL_LABELS_DETALLE: Record<Rol, string> = {
  admin: "Administrador",
  editor: "Gestor N1",
  gestor_n2: "Gestor N2",
  consulta: "Consulta",
};

export const ROL_DESCRIPCION: Record<Rol, string> = {
  admin: "Acceso total al sistema (no editable)",
  editor: "Gestión operativa según sectores habilitados (sin usuarios ni ventas)",
  gestor_n2:
    "Gastos, configuración, stock, RRHH y resumen. Divisas solo lectura. Sin ventas ni usuarios.",
  consulta: "Solo lectura en los sectores habilitados",
};

export type Modulo =
  | "presupuesto"
  | "configuracion"
  | "divisas"
  | "precios_ganado"
  | "simulador_venta_ganado"
  | "chat"
  | "rrhh"
  | "ventas"
  | "stock"
  | "usuarios"
  | "documentos_digitales";

export type AvatarTipo = "iniciales" | "foto";

export interface UserAvatar {
  tipo: AvatarTipo;
  url: string | null;
}

export interface AuthUser {
  id: number;
  usuario_numero: string;
  email: string;
  nombre: string;
  rol: Rol;
  rol_label: string;
  activo: boolean;
  empresa_id: number | null;
  empresa_nombre: string | null;
  empresa_codigo: string | null;
  empresa_cuenta_numero: string | null;
  es_super_admin: boolean;
  permisos: Modulo[];
  puede_escribir: boolean;
  modulos_solo_lectura: Modulo[];
  creado_en: string;
  ultimo_acceso: string | null;
  avatar: UserAvatar;
}

export interface EmpresaCuentaAdmin {
  id: number;
  email: string;
  nombre: string;
  es_super_admin: boolean;
}

export interface EmpresaCuenta {
  id: number;
  cuenta_numero: string;
  nombre: string;
  codigo: string;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
  usuarios_count: number;
  empresas_count: number;
  empresas: EmpresaOperativa[];
  admin_user_id: number | null;
  admin: EmpresaCuentaAdmin | null;
}

export interface EmpresaOperativa {
  id: number;
  cuenta_id: number;
  nombre: string;
  codigo: string;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
}

export interface EmpresaCuentaForm {
  nombre: string;
  codigo: string;
  activo?: boolean;
}

export interface EmpresaOperativaForm {
  nombre: string;
  codigo: string;
  activo?: boolean;
}

export interface UserForm {
  email: string;
  nombre: string;
  rol: Rol;
  password?: string;
  activo?: boolean;
  empresa_id?: number | null;
}

export interface ModuloAccesoConfig {
  modulo: Modulo;
  label: string;
  acceso: boolean;
  solo_lectura: boolean;
}

export interface RolPermisosConfig {
  rol: Rol;
  rol_label: string;
  descripcion: string;
  puede_escribir: boolean;
  modulos: ModuloAccesoConfig[];
  editable: boolean;
}

export interface RolPermisosInput {
  puede_escribir: boolean;
  modulos: Partial<Record<Modulo, boolean>>;
  modulos_solo_lectura?: Partial<Record<Modulo, boolean>>;
}

export interface ChatChannel {
  id: number;
  peer_id: number;
  nombre: string;
  es_sistema: boolean;
  unread_count: number;
  last_message: string | null;
  last_message_at: string | null;
}

export interface ChatMessageAttachment {
  tipo: "imagen" | "archivo";
  nombre: string;
  mime: string;
  tamano: number;
  url: string;
}

export interface ChatMessage {
  id: number;
  sender_id: number;
  sender_nombre: string;
  sender_avatar: UserAvatar;
  recipient_id: number;
  body: string;
  creado_en: string;
  es_propio: boolean;
  attachment: ChatMessageAttachment | null;
}

export interface ChatSearchHit extends ChatMessage {
  peer_id: number;
  peer_label: string;
}

export interface ChatUserPresence {
  id: number;
  online: boolean;
  ultimo_visto: string | null;
  hace_segundos: number | null;
  online_desde_segundos: number | null;
}

export interface ChatContact {
  id: number;
  nombre: string;
  rol_label: string;
  avatar: UserAvatar;
  presencia: ChatUserPresence;
  unread_count: number;
  last_message: string | null;
  last_message_at: string | null;
}

export interface ChatUnreadSummary {
  total: number;
  general: number;
}
