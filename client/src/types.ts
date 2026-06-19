export type Empresa = "GANADERA GUAVIYU" | "GANADERA CHIVILCOY";

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
  pesos: number;
  dolares_usd: number;
  reales: number;
  tc_usd: number;
  tc_reales: number;
  saldo_usd: number;
  creado_en?: string;
  ingresado_por_email?: string;
  ingresado_por_nombre?: string;
}

export type PresupuestoForm = Omit<Presupuesto, "id" | "nro_registro" | "creado_en">;

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
  email: string;
  nombre: string;
  rol: string;
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
  creado_en?: string;
}

export type ProveedorForm = Omit<Proveedor, "id" | "creado_en">;

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
  UYU_USD: "Pesos uruguayos por 1 USD",
  BRL_USD: "Reales brasileños por 1 USD",
};

export type Rol = "admin" | "editor" | "gestor_n2" | "consulta";

export const ALL_ROLES: Rol[] = ["admin", "editor", "gestor_n2", "consulta"];

export const ROL_LABELS: Record<Rol, string> = {
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
  | "rrhh"
  | "ventas"
  | "stock"
  | "usuarios";

export interface AuthUser {
  id: number;
  email: string;
  nombre: string;
  rol: Rol;
  rol_label: string;
  activo: boolean;
  permisos: Modulo[];
  puede_escribir: boolean;
  creado_en: string;
  ultimo_acceso: string | null;
}

export interface UserForm {
  email: string;
  nombre: string;
  rol: Rol;
  password?: string;
  activo?: boolean;
}

export interface ModuloAccesoConfig {
  modulo: Modulo;
  label: string;
  acceso: boolean;
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
}
