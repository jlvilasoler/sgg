export type Empresa = string;

export type TipoComprobantePresupuesto = "FACTURA" | "NOTA_CREDITO";

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
  tipo_comprobante?: TipoComprobantePresupuesto;
  presupuesto_origen_id?: number | null;
  nro_nota_credito?: string;
  creado_en?: string;
  ingresado_por_email?: string;
  ingresado_por_nombre?: string;
  documento_adjunto?: PresupuestoDocumentoAdjunto | null;
}

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

export interface PresupuestoDocumentoAdjunto {
  nombre: string;
  mime: string;
  tamano: number;
}

export type PresupuestoForm = Omit<Presupuesto, "id" | "nro_registro" | "creado_en">;

export type GastoAutoPendienteEstado =
  | "pendiente_aprobacion"
  | "aprobado"
  | "rechazado"
  | "omitido";

export interface GastoAutomatizacion {
  id: number;
  cuenta_id: number;
  nombre: string;
  presupuesto_origen_id: number | null;
  empresa: Empresa;
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
  dia_mes: number;
  intervalo_meses: number;
  fecha_inicio: string;
  activo: boolean;
  responsable_user_id: number | null;
  responsable_email: string;
  responsable_nombre: string;
  creado_por_user_id: number | null;
  creado_por_email: string;
  creado_por_nombre: string;
  creado_en: string;
  actualizado_en: string;
}

export interface GastoAutoPendiente {
  id: number;
  automatizacion_id: number;
  cuenta_id: number;
  periodo: string;
  fecha_programada: string;
  estado: GastoAutoPendienteEstado;
  presupuesto_id: number | null;
  gestionado_por_email: string;
  gestionado_por_nombre: string;
  gestionado_en: string | null;
  nota_gestion: string;
  creado_en: string;
  plantilla: GastoAutomatizacion;
}

export type GastoAutomatizacionInput = Partial<
  Pick<
    GastoAutomatizacion,
    | "nombre"
    | "dia_mes"
    | "empresa"
    | "codigo_proveedor"
    | "razon_social_proveedor"
    | "concepto"
    | "observaciones"
    | "rubro"
    | "sub_rubro"
    | "responsable_gasto"
    | "funcionario_cedula"
    | "nro_factura"
    | "nro_operacion_origen"
    | "pesos"
    | "dolares_usd"
    | "reales"
    | "tc_usd"
    | "tc_reales"
    | "saldo_usd"
    | "activo"
    | "intervalo_meses"
    | "fecha_inicio"
  >
>;

export type CreateGastoAutomatizacionInput = {
  presupuesto_id: number;
  nombre: string;
  dia_mes: number;
  intervalo_meses?: number;
  fecha_inicio?: string;
} & Partial<
  Omit<
    GastoAutomatizacion,
    | "id"
    | "cuenta_id"
    | "presupuesto_origen_id"
    | "activo"
    | "responsable_user_id"
    | "responsable_email"
    | "responsable_nombre"
    | "creado_por_user_id"
    | "creado_por_email"
    | "creado_por_nombre"
    | "creado_en"
    | "actualizado_en"
  >
>;

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

export type VentaAgriculturaCultivo = string;

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
  precio_ingreso_usd_ton: number;
  forma_pago_agricultura: "FRACCIONADO" | "AL_FINAL";
  total_ton: number;
  importe_usd: number;
  costo_impuestos_usd: number;
  costo_flete_usd: number;
  /** Pago 1 (40% al ingresar) ya cobrado — solo forma FRACCIONADO. */
  pago_ingreso_cobrado: boolean;
  pago_ingreso_cobrado_en: string | null;
  /** Pago 2 (60% al finalizar) ya cobrado — solo forma FRACCIONADO. */
  pago_saldo_cobrado: boolean;
  pago_saldo_cobrado_en: string | null;
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
  pago_inicio_cobrado: boolean;
  pago_inicio_cobrado_en: string | null;
  pago_fin_cobrado: boolean;
  pago_fin_cobrado_en: string | null;
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
export type DispositivoEmpresa = string;
export type DispositivoEstado = "VIVO" | "MUERTO" | "VENDIDO" | "FRIGORIFICO" | "PERDIDO";

export type TipoBaja =
  | "VENTA_FRIGORIFICO"
  | "FRIGORIFICO"
  | "VENTA_PRODUCTOR"
  | "MUERTE"
  | "PERDIDO";

export interface CampoPotreroMapa {
  id: number;
  cuenta_id: number;
  nombre: string;
  geojson: string;
  color: string;
  hectareas: number | null;
  notas: string;
  metadata: string;
  creado_en: string;
  actualizado_en: string;
}

export type CampoMapaElementoTipo =
  | "marcador"
  | "nota"
  | "linea"
  | "area"
  | "clip"
  | "medicion_distancia"
  | "medicion_area";

export interface CampoMapaElemento {
  id: number;
  cuenta_id: number;
  tipo: CampoMapaElementoTipo;
  nombre: string;
  notas: string;
  geojson: string;
  color: string;
  metadata: string;
  creado_en: string;
  actualizado_en: string;
}

export type OperativaTareaEstado = "pendiente" | "en_curso" | "hecha" | "cancelada";

export type OperativaTareaPrioridad = "baja" | "normal" | "alta";

export type OperativaDiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface OperativaTareaAsignado {
  id: number;
  nombre: string;
}

export interface OperativaTarea {
  id: number;
  cuenta_id: number;
  titulo: string;
  descripcion: string;
  notas: string;
  fecha: string;
  fecha_hasta: string | null;
  dia_semana: OperativaDiaSemana | null;
  estado: OperativaTareaEstado;
  prioridad: OperativaTareaPrioridad;
  asignado_user_id: number | null;
  asignado_nombre: string | null;
  asignados: OperativaTareaAsignado[];
  creado_por_user_id: number | null;
  creado_por_nombre: string | null;
  potrero_id: number | null;
  potrero_nombre: string | null;
  ubicacion: string;
  ganado_cantidad: number | null;
  ganado_detalle: string;
  completado_en: string | null;
  creado_en: string;
  actualizado_en: string;
}

export interface OperativaTareaRegistro {
  id: number;
  tarea_id: number;
  cuenta_id: number;
  user_id: number | null;
  user_nombre: string | null;
  texto: string;
  ganado_cantidad: number | null;
  ganado_detalle: string;
  fecha_ejecucion: string;
  creado_en: string;
}

export interface OperativaTareaInput {
  titulo: string;
  descripcion?: string;
  notas?: string;
  fecha?: string;
  fecha_hasta?: string | null;
  dia_semana?: OperativaDiaSemana | null;
  estado?: OperativaTareaEstado;
  prioridad?: OperativaTareaPrioridad;
  asignado_user_id?: number | null;
  asignados_user_ids?: number[];
  potrero_id?: number | null;
  ubicacion?: string;
  ganado_cantidad?: number | null;
  ganado_detalle?: string;
}

export const OPERATIVA_DIA_SEMANA_LABELS: Record<OperativaDiaSemana, string> = {
  0: "Lunes",
  1: "Martes",
  2: "Miércoles",
  3: "Jueves",
  4: "Viernes",
  5: "Sábado",
  6: "Domingo",
};

export const OPERATIVA_TAREA_ESTADO_LABELS: Record<OperativaTareaEstado, string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  hecha: "Hecha",
  cancelada: "Cancelada",
};

export const OPERATIVA_TAREA_PRIORIDAD_LABELS: Record<OperativaTareaPrioridad, string> = {
  baja: "Baja",
  normal: "Normal",
  alta: "Alta",
};

export interface StockGanaderaDispositivo {
  clave: string;
  eid: string;
  vid: string;
  sexo: DispositivoSexo;
  empresa: DispositivoEmpresa;
  grupo: string;
  grupo_libre: string;
  potrero: string;
  raza: string;
  color_caravana: string;
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
  cabana_premium: boolean;
  nombre_cabana: string;
  tiene_foto: boolean;
  foto_url: string | null;
  foto_actualizado_en?: string;
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

/** Registro de medicación / control sanitario por dispositivo (ganadero o equino). */
export interface StockControlSanitarioRecord {
  id: number;
  clave: string;
  admin_fecha_inicio: string;
  admin_fecha_fin: string;
  admin_periodo_nota: string;
  admin_observaciones: string;
  producto_nombre: string;
  producto_formula: string;
  producto_cantidad: string;
  producto_forma: string;
  producto_espera: string;
  animal_categoria_lote: string;
  animal_id: string;
  control_motivo: string;
  control_funcionario: string;
  creado_en: string;
  creado_por: string;
}

export interface StockControlSanitarioInput {
  admin_fecha_inicio?: string;
  admin_fecha_fin?: string;
  admin_periodo_nota?: string;
  admin_observaciones?: string;
  producto_nombre?: string;
  producto_formula?: string;
  producto_cantidad?: string;
  producto_forma?: string;
  producto_espera?: string;
  animal_categoria_lote?: string;
  animal_id?: string;
  control_motivo?: string;
  control_funcionario?: string;
}

export interface StockControlSanitarioCantidadOpcion {
  id: number;
  valor: string;
  creado_en: string;
  creado_por: string;
}

export interface StockControlSanitarioEsperaOpcion {
  id: number;
  valor: string;
  creado_en: string;
  creado_por: string;
}

export interface StockControlSanitarioProductoFicha {
  id: number;
  nombre: string;
  laboratorio: string;
  principio_activo: string;
  presentacion: string;
  via_administracion: string;
  especie: string;
  tiempo_espera_carne: string;
  tiempo_espera_leche: string;
  detalles_tecnicos: string;
  caracteristicas: string;
  foto_data: string;
  creado_en: string;
  actualizado_en: string;
  actualizado_por: string;
  creado_por: string;
}

export interface StockControlSanitarioProductoFichaInput {
  nombre: string;
  laboratorio?: string;
  principio_activo?: string;
  presentacion?: string;
  via_administracion?: string;
  especie?: string;
  tiempo_espera_carne?: string;
  tiempo_espera_leche?: string;
  detalles_tecnicos?: string;
  caracteristicas?: string;
  foto_data?: string;
}

export interface StockControlSanitarioProductoFichaResumen {
  id: number;
  nombre: string;
  laboratorio: string;
  principio_activo: string;
  via_administracion: string;
  especie: string;
  creado_en: string;
  creado_por: string;
  actualizado_en: string;
  actualizado_por: string;
  tiene_foto: boolean;
}

/** Nombre comercial visible para todas las cuentas (catálogo + usos en registros). */
export interface StockControlSanitarioProductoNombreGlobal {
  nombre: string;
  creado_en: string;
  creado_por: string;
  en_ficha: boolean;
  laboratorio: string;
  principio_activo: string;
  tiene_foto: boolean;
  usos: number;
  usos_cuenta: number;
  especie: string;
}

export interface StockControlSanitarioResumenItem {
  id: number;
  clave: string;
  animal_id: string;
  producto_nombre: string;
  producto_formula: string;
  control_motivo: string;
  admin_fecha_inicio: string;
  admin_fecha_fin: string;
  admin_periodo_nota: string;
  creado_en: string;
  creado_por: string;
}

export interface StockControlSanitarioResumenFrecuencia {
  etiqueta: string;
  cantidad: number;
}

export interface StockControlSanitarioResumen {
  total_registros: number;
  dispositivos_consultados: number;
  dispositivos_con_historial: number;
  dispositivos_sin_historial: number;
  productos_frecuentes: StockControlSanitarioResumenFrecuencia[];
  motivos_frecuentes: StockControlSanitarioResumenFrecuencia[];
  ultimos_registros: StockControlSanitarioResumenItem[];
}

export type StockEquinoLote = StockGanaderoLote;
export type StockEquinoRegistro = StockGanaderoRegistro;
export type StockEquinoEidRepetido = StockGanaderoEidRepetido;
export type StockEquinoEstadisticas = StockGanaderoEstadisticas;
export type StockEquinaDispositivo = StockGanaderaDispositivo;
export type StockEquinaLecturaDetalle = StockGanaderaLecturaDetalle;
export type StockEquinaDispositivoDetalle = StockGanaderaDispositivoDetalle;
export type StockEquinaDispositivoHistorial = StockGanaderaDispositivoHistorial;

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
  conectado_segundos: number;
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

export interface UltimoPagoRRHH {
  id: number;
  fecha: string;
  empresa: string;
  concepto: string;
  rubro: string;
  saldo_usd: number;
  pesos: number;
  funcionario_nombre: string | null;
  cedula: string | null;
  cedula_display: string | null;
}

export interface RrhhDashboardData {
  funcionarios_total: number;
  funcionarios_activos: number;
  funcionarios_inactivos: number;
  funcionarios_sin_banco: number;
  pagos_periodo: {
    total_registros: number;
    total_pesos: number;
    total_saldo_usd: number;
    funcionarios_con_pagos: number;
  };
  ultimos_pagos: UltimoPagoRRHH[];
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
  cuenta_id?: number | null;
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
  observaciones?: string;
  activo: number;
  creado_en?: string;
}

export type ResponsableForm = {
  nombre: string;
  observaciones?: string;
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
  admin: "Responsable de la cuenta. Acceso total y único perfil que administra usuarios.",
  editor:
    "Operación completa en sectores habilitados (incluye ventas). Sin administración de usuarios.",
  gestor_n2:
    "Operación sin ventas. Divisas solo lectura. Sin administración de usuarios.",
  consulta: "Solo lectura en los sectores habilitados por el administrador.",
};

export type RolInfoSeccion = {
  etiqueta: string;
  items: string[];
};

/** Texto extendido para el panel informativo de cada rol. */
export const ROL_INFO_DETALLE: Record<
  Rol,
  { titulo: string; resumen: string; secciones: RolInfoSeccion[]; nota?: string }
> = {
  admin: {
    titulo: "Administrador",
    resumen:
      "Responsable máximo de la cuenta: define el equipo, los accesos y la configuración general.",
    secciones: [
      {
        etiqueta: "Puede",
        items: [
          "Crear, editar y desactivar usuarios del equipo.",
          "Acceder a todos los módulos operativos: gastos, stock, RRHH, ventas, divisas y más.",
          "Configurar catálogos, proveedores, permisos por tipo de usuario y sectores.",
        ],
      },
      {
        etiqueta: "Exclusivo de este rol",
        items: [
          "Administración de usuarios y documentos digitales de la cuenta.",
        ],
      },
    ],
  },
  editor: {
    titulo: "Gestor N1",
    resumen:
      "Perfil operativo principal para el trabajo diario en campo y oficina.",
    secciones: [
      {
        etiqueta: "Puede",
        items: [
          "Registrar y consultar gastos, stock ganadero, RRHH y paneles de inicio.",
          "Gestionar ingresos por ventas, divisas, precios de ganado y simulador.",
          "Usar configuración operativa: proveedores, rubros y catálogos.",
          "Participar en el chat interno del equipo.",
        ],
      },
      {
        etiqueta: "No puede",
        items: [
          "Administrar usuarios ni documentos digitales de la cuenta.",
        ],
      },
    ],
    nota: "El alcance final depende de los sectores habilitados por el administrador.",
  },
  gestor_n2: {
    titulo: "Gestor N2",
    resumen:
      "Operación con alcance reducido; pensado para tareas de campo sin registrar ventas.",
    secciones: [
      {
        etiqueta: "Puede",
        items: [
          "Gastos, configuración operativa, stock ganadero y RRHH.",
          "Consultar divisas y precios de ganado (divisas en solo lectura).",
          "Usar simulador de venta ganado y chat interno.",
        ],
      },
      {
        etiqueta: "No puede",
        items: [
          "Registrar ingresos por ventas.",
          "Administrar usuarios ni documentos digitales.",
        ],
      },
    ],
    nota: "El administrador puede ampliar o restringir módulos en «Permisos por tipo de usuario».",
  },
  consulta: {
    titulo: "Consulta",
    resumen: "Supervisión y auditoría sin modificar datos operativos.",
    secciones: [
      {
        etiqueta: "Puede",
        items: [
          "Ver listados, reportes y resúmenes de los sectores habilitados.",
          "Acceder al chat interno para comunicación con el equipo.",
        ],
      },
      {
        etiqueta: "No puede",
        items: [
          "Crear, editar ni eliminar registros.",
          "Cambiar configuración ni gestionar usuarios.",
        ],
      },
    ],
    nota: "Ideal para supervisores, auditores o colaboradores que solo necesitan consultar.",
  },
};

export type Modulo =
  | "presupuesto"
  | "configuracion"
  | "divisas"
  | "precios_ganado"
  | "simulador_venta_ganado"
  | "chat"
  | "asistente"
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
  /** Cuenta madre para actividad (p. ej. VILA DIAZ para super-admin principal). */
  cuenta_actividad_id: number | null;
  cuenta_actividad_nombre: string | null;
  es_super_admin: boolean;
  /** Superadministrador de plataforma (SCG_ADMIN_EMAIL). */
  es_admin_plataforma: boolean;
  /** Usuario designado como administrador de su cuenta. */
  es_admin_cuenta: boolean;
  permisos: Modulo[];
  puede_escribir: boolean;
  modulos_solo_lectura: Modulo[];
  /** Visibilidad de bloques del inicio según rol (Configuración SAG). */
  home_paneles?: Partial<Record<string, boolean>>;
  /** Orden de bloques del inicio (KPIs, columna principal, lateral). */
  home_panel_orden?: string[];
  /** Ejercicio fiscal contable EFECTIVO: mes/día de inicio (default 1/7). */
  ejercicio_inicio_mes?: number;
  ejercicio_inicio_dia?: number;
  /** Modo de inicio de sesión de la cuenta. */
  login_mode?: LoginMode;
  /** El admin debe elegir el modo de inicio (2+ empresas y aún no elegido). */
  debe_elegir_modo_inicio?: boolean;
  /** Empresa operativa activa (modo individual). null = consolidado / sin elegir. */
  empresa_operativa_activa_id?: number | null;
  empresa_activa_nombre?: string | null;
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

export type LoginMode = "consolidado" | "individual";

export interface EmpresaCuenta {
  id: number;
  cuenta_numero: string;
  nombre: string;
  codigo: string;
  activo: boolean;
  login_mode: LoginMode;
  ejercicio_empresa_id: number | null;
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
  color: string;
  activo: boolean;
  rut: string;
  ejercicio_inicio_mes: number;
  ejercicio_inicio_dia: number;
  creado_en: string;
  actualizado_en: string;
}

export interface EmpresaCuentaForm {
  nombre: string;
  codigo?: string;
  activo?: boolean;
  admin_email?: string;
  empresa_operativa?: Pick<EmpresaOperativaForm, "nombre" | "color">;
}

export interface EmpresaCuentaCreateResult {
  cuenta: EmpresaCuenta;
  admin_password_temporal?: string;
}

export interface CuentaControlResumen {
  cuenta_id: number;
  cuenta_numero: string;
  nombre: string;
  codigo: string;
  activo: boolean;
  animales_ganadero: number;
  animales_equino: number;
  animales_total: number;
  gastos_registros: number;
  gastos_pesos: number;
}

export interface CuentasControlPlataformaResumen {
  cuentas: CuentaControlResumen[];
  totales: {
    animales_ganadero: number;
    animales_equino: number;
    animales_total: number;
    gastos_registros: number;
    gastos_pesos: number;
  };
}

export type CategoriaStockMonitorKey =
  | "TERNERA"
  | "VAQUILLONA_1_2"
  | "VAQUILLONA_MAS_2"
  | "VACA"
  | "TERNERO"
  | "MACHO_1_2"
  | "MACHO_MAS_2"
  | "SIN_SEXO"
  | "SIN_EDAD";

export interface CategoriaStockMonitorFila {
  key: CategoriaStockMonitorKey;
  label: string;
  grupo: "hembra" | "macho" | "otro";
  machos: number;
  hembras: number;
  sin_definir: number;
  total: number;
}

export interface StockEspecieMonitorResumen {
  total: number;
  machos: number;
  hembras: number;
  sin_definir: number;
  categorias: CategoriaStockMonitorFila[];
}

export interface CuentaStockGanaderoMonitorResumen {
  cuenta_id: number;
  cuenta_numero: string;
  nombre: string;
  codigo: string;
  activo: boolean;
  total: number;
  machos: number;
  hembras: number;
  sin_definir: number;
  categorias: CategoriaStockMonitorFila[];
  equino: StockEspecieMonitorResumen;
  total_animales: number;
}

export interface HomeLayoutMonitorStockGanaderoSnapshot {
  generado_en: string;
  totales: {
    total: number;
    machos: number;
    hembras: number;
    sin_definir: number;
    cuentas_con_stock: number;
    categorias: CategoriaStockMonitorFila[];
    equino: StockEspecieMonitorResumen & { cuentas_con_stock: number };
    total_animales: number;
  };
  cuentas: CuentaStockGanaderoMonitorResumen[];
}

export interface HomeLayoutMonitorStockCuentaDetalle {
  generado_en: string;
  cuenta_id: number;
  cuenta_numero: string;
  nombre: string;
  codigo: string;
  activo: boolean;
  ganadero: StockEspecieMonitorResumen;
  equino: StockEspecieMonitorResumen;
  total_animales: number;
}

export type AsistenteIntentId =
  | "ayuda"
  | "stock_activo"
  | "stock_sexo"
  | "gastos_mes"
  | "gastos_ejercicio"
  | "precios_ganado"
  | "divisas"
  | "desconocido";

export interface AsistenteConsultaResult {
  intent: AsistenteIntentId;
  respuesta: string;
  sugerencias: string[];
}

export interface RubrosMonitorPermisos {
  ver_en_gastos: boolean;
  editar_catalogo: boolean;
  crear_desde_gasto: boolean;
  eliminar_catalogo: boolean;
  eliminar_items: boolean;
}

export interface RubrosMonitorUsuario {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  rol_label: string;
  activo: boolean;
  es_admin_cuenta: boolean;
  permisos: RubrosMonitorPermisos;
}

export interface RubrosMonitorSubRubro {
  id: number;
  nombre: string;
  origen: "sag" | "cuenta";
  activo: boolean;
}

export interface RubrosMonitorGrupo {
  nombre: string;
  sub_rubros: RubrosMonitorSubRubro[];
  sub_sag: number;
  sub_cuenta: number;
}

export interface RubrosMonitorCuentaResumen {
  id: number;
  nombre: string;
  codigo: string;
  cuenta_numero: string;
  activo: boolean;
  grupos: number;
  sub_rubros: number;
  sub_propios: number;
  rubros_contables: number;
  usuarios_count: number;
}

export interface RubrosMonitorCuentaDetalle extends RubrosMonitorCuentaResumen {
  grupos_catalogo: RubrosMonitorGrupo[];
  usuarios: RubrosMonitorUsuario[];
}

export interface RubrosMonitorSnapshot {
  generado_en: string;
  cuentas: RubrosMonitorCuentaResumen[];
  totales: {
    cuentas: number;
    cuentas_activas: number;
    sub_rubros_sag: number;
    sub_rubros_propios: number;
  };
}

export interface HomeLayoutMonitorUsuarioResumen {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  rol_label: string;
  activo: boolean;
  es_admin_cuenta: boolean;
  es_super_admin: boolean;
  cuenta_id: number | null;
  cuenta_nombre: string | null;
  cuenta_codigo: string | null;
  paneles_visibles: number;
  paneles_total: number;
  tiene_personalizacion: boolean;
  ultimo_acceso: string | null;
}

export interface HomeLayoutMonitorPanelDetalle {
  id: string;
  label: string;
  zone: "top" | "main" | "side";
  visible_efectivo: boolean;
  visible_rol: boolean;
  visible_usuario: boolean | null;
  personalizado: boolean;
  fuente: "rol" | "usuario" | "bloqueado_rol";
}

export interface HomeLayoutMonitorUsuarioDetalle extends HomeLayoutMonitorUsuarioResumen {
  ceiling: Record<string, boolean>;
  overrides: Record<string, boolean>;
  efectivo: Record<string, boolean>;
  orden: string[];
  orden_rol: string[];
  orden_personalizado: boolean;
  paneles: HomeLayoutMonitorPanelDetalle[];
}

export interface HomeLayoutMonitorSnapshot {
  generado_en: string;
  usuarios: HomeLayoutMonitorUsuarioResumen[];
  totales: {
    usuarios: number;
    usuarios_activos: number;
    con_personalizacion: number;
  };
}

export interface HomeLayoutMonitorCampoMapaData {
  cuenta_id: number | null;
  cuenta_nombre: string | null;
  potreros: CampoPotreroMapa[];
  elementos: CampoMapaElemento[];
}

export interface PlatformNotificationAdmin {
  id: number;
  titulo: string;
  mensaje: string;
  fecha_inicio: string;
  fecha_fin: string;
  activo: number;
  creado_por: number | null;
  creado_en: string;
  actualizado_en: string;
  lecturas: number;
  usuarios_elegibles: number;
}

export interface PlatformNotificationInput {
  titulo: string;
  mensaje: string;
  fecha_inicio: string;
  fecha_fin: string;
  activo: boolean;
}

export interface PlatformNotificationPending {
  id: number;
  titulo: string;
  mensaje: string;
  fecha_inicio: string;
  fecha_fin: string;
}

export interface PlatformNotificationRecipient {
  user_id: number;
  nombre: string;
  email: string;
  rol: string;
  cuenta_nombre: string | null;
  leido_en: string;
}

export interface EmpresaOperativaForm {
  nombre: string;
  codigo?: string;
  color?: string;
  activo?: boolean;
  rut?: string | null;
  ejercicio_inicio_mes?: number | null;
  ejercicio_inicio_dia?: number | null;
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

export interface ChatMessageReplyPreview {
  id: number;
  sender_nombre: string;
  body: string;
}

export interface ChatMessageReactions {
  like_count: number;
  heart_count: number;
  mi_reaccion: "like" | "heart" | null;
}

export interface ChatMessage {
  id: number;
  sender_id: number;
  sender_nombre: string;
  sender_avatar: UserAvatar;
  recipient_id: number;
  body: string;
  creado_en: string;
  editado_en: string | null;
  es_propio: boolean;
  attachment: ChatMessageAttachment | null;
  reply_to: ChatMessageReplyPreview | null;
  reacciones: ChatMessageReactions;
  puede_editar: boolean;
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
  external_estado?: "aceptada" | "pendiente_enviada" | null;
}

export interface ChatExternalRequest {
  id: number;
  requester_id: number;
  requester_nombre: string;
  requester_cuenta: string;
  requester_avatar: UserAvatar;
  creado_en: string;
}

export interface ChatUnreadSummary {
  total: number;
  general: number;
}

export const NOTA_COLORES = ["default", "yellow", "green", "blue", "pink", "purple"] as const;
export type NotaColor = (typeof NOTA_COLORES)[number];

export interface NotaCompartido {
  id: number;
  nombre: string;
}

export interface Nota {
  id: number;
  usuario_id: number;
  cuenta_id: number | null;
  titulo: string;
  contenido: string;
  fijada: boolean;
  compartida: boolean;
  color: NotaColor;
  autor_nombre: string;
  compartidos_con: NotaCompartido[];
  creado_en: string;
  actualizado_en: string;
}

export interface NotaInput {
  titulo?: string;
  contenido?: string;
  fijada?: boolean;
  compartida?: boolean;
  compartidos_con?: number[];
  color?: NotaColor;
}
