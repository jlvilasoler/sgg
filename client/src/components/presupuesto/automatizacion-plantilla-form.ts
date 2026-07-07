import type { Empresa, GastoAutomatizacion, Presupuesto } from "../../types";
import { todayIso } from "../../utils";

export interface AutomatizacionPlantillaFormState {
  presupuesto_id: number;
  nombre: string;
  dia_mes: number;
  intervalo_meses: number;
  fecha_inicio: string;
  empresa: Empresa | "";
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
  activo: boolean;
}

export const INTERVALO_MESES_OPCIONES = [
  { value: 1, label: "Cada mes" },
  { value: 2, label: "Cada 2 meses" },
  { value: 3, label: "Cada 3 meses (trimestral)" },
  { value: 6, label: "Cada 6 meses (semestral)" },
  { value: 12, label: "Cada 12 meses (anual)" },
] as const;

function tituloDesdeGasto(row: Presupuesto): string {
  const proveedor = row.razon_social_proveedor?.trim();
  const concepto = row.concepto?.trim();
  if (proveedor && concepto) return `${proveedor} · ${concepto}`;
  return proveedor || concepto || `Operación #${row.nro_registro}`;
}

function diaDesdeFecha(iso: string): number {
  const d = Number(iso.slice(8, 10));
  return Number.isFinite(d) && d >= 1 && d <= 31 ? d : new Date().getDate();
}

/** Primer día del mes siguiente al gasto documentado (inicio por defecto de la regla). */
export function fechaInicioAutomatizacionDesdeGasto(fechaGasto: string): string {
  const [y, m] = fechaGasto.slice(0, 10).split("-").map(Number);
  if (!y || !m) return todayIso();
  let nm = m + 1;
  let ny = y;
  if (nm > 12) {
    nm = 1;
    ny += 1;
  }
  return `${ny}-${String(nm).padStart(2, "0")}-01`;
}

/** Fecha contable del pago en un período (AAAA-MM) según el día configurado. */
export function fechaProgramadaEnPeriodo(periodo: string, diaMes: number): string {
  const [yStr, mStr] = periodo.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!y || !m) return periodo;
  const ultimoDia = new Date(y, m, 0).getDate();
  const dia = Math.min(diaMes, ultimoDia);
  return `${yStr}-${mStr}-${String(dia).padStart(2, "0")}`;
}

/** Primera fecha en que se contabilizará un pago automático (desde + día). */
export function primeraFechaPagoProgramada(form: AutomatizacionPlantillaFormState): string {
  const inicio = form.fecha_inicio.slice(0, 10);
  const periodoInicio = inicio.slice(0, 7);
  let fecha = fechaProgramadaEnPeriodo(periodoInicio, form.dia_mes);
  if (fecha < inicio) {
    const siguienteMes = fechaInicioAutomatizacionDesdeGasto(inicio);
    fecha = fechaProgramadaEnPeriodo(siguienteMes.slice(0, 7), form.dia_mes);
  }
  return fecha;
}

export function plantillaFormVacia(): AutomatizacionPlantillaFormState {
  return {
    presupuesto_id: 0,
    nombre: "",
    dia_mes: new Date().getDate(),
    intervalo_meses: 1,
    fecha_inicio: todayIso(),
    empresa: "",
    codigo_proveedor: "",
    razon_social_proveedor: "",
    concepto: "",
    observaciones: "",
    rubro: "",
    sub_rubro: "",
    responsable_gasto: "",
    funcionario_cedula: "",
    nro_factura: "",
    nro_operacion_origen: "",
    pesos: 0,
    dolares_usd: 0,
    reales: 0,
    tc_usd: 0,
    tc_reales: 0,
    saldo_usd: 0,
    activo: true,
  };
}

export function plantillaFormDesdePresupuesto(p: Presupuesto): AutomatizacionPlantillaFormState {
  return {
    presupuesto_id: p.id,
    nombre: tituloDesdeGasto(p).slice(0, 80),
    dia_mes: diaDesdeFecha(p.fecha),
    intervalo_meses: 1,
    fecha_inicio: fechaInicioAutomatizacionDesdeGasto(p.fecha),
    empresa: p.empresa,
    codigo_proveedor: p.codigo_proveedor ?? "",
    razon_social_proveedor: p.razon_social_proveedor ?? "",
    concepto: p.concepto ?? "",
    observaciones: p.observaciones ?? "",
    rubro: p.rubro ?? "",
    sub_rubro: p.sub_rubro ?? "",
    responsable_gasto: p.responsable_gasto ?? "",
    funcionario_cedula: p.funcionario_cedula ?? "",
    nro_factura: p.nro_factura ?? "",
    nro_operacion_origen: p.nro_operacion_origen ?? "",
    pesos: p.pesos ?? 0,
    dolares_usd: p.dolares_usd ?? 0,
    reales: p.reales ?? 0,
    tc_usd: p.tc_usd ?? 0,
    tc_reales: p.tc_reales ?? 0,
    saldo_usd: p.saldo_usd ?? 0,
    activo: true,
  };
}

export function plantillaFormDesdeAutomatizacion(
  p: GastoAutomatizacion
): AutomatizacionPlantillaFormState {
  return {
    presupuesto_id: p.presupuesto_origen_id ?? 0,
    nombre: p.nombre,
    dia_mes: p.dia_mes,
    intervalo_meses: p.intervalo_meses || 1,
    fecha_inicio: p.fecha_inicio || todayIso(),
    empresa: p.empresa,
    codigo_proveedor: p.codigo_proveedor,
    razon_social_proveedor: p.razon_social_proveedor,
    concepto: p.concepto,
    observaciones: p.observaciones,
    rubro: p.rubro,
    sub_rubro: p.sub_rubro,
    responsable_gasto: p.responsable_gasto,
    funcionario_cedula: p.funcionario_cedula,
    nro_factura: p.nro_factura,
    nro_operacion_origen: p.nro_operacion_origen,
    pesos: p.pesos,
    dolares_usd: p.dolares_usd,
    reales: p.reales,
    tc_usd: p.tc_usd,
    tc_reales: p.tc_reales,
    saldo_usd: p.saldo_usd,
    activo: p.activo,
  };
}

export function programacionResumen(form: AutomatizacionPlantillaFormState): string {
  const intervalo =
    INTERVALO_MESES_OPCIONES.find((o) => o.value === form.intervalo_meses)?.label ??
    `Cada ${form.intervalo_meses} meses`;
  const primera = primeraFechaPagoProgramada(form);
  const [y, m, d] = primera.split("-");
  const primeraFmt = d && m && y ? `${d}/${m}/${y}` : primera;
  return `Primer pago: ${primeraFmt} · Día ${form.dia_mes} · ${intervalo}`;
}
