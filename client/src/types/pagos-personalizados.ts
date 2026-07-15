export const TIPOS_PRESTAMO_PAGO = [
  "PRESTAMO",
  "HIPOTECARIO",
  "PRENDARIO",
  "LEASING",
  "TARJETA",
  "OTRO",
] as const;

export type TipoPrestamoPago = (typeof TIPOS_PRESTAMO_PAGO)[number];

export const MONEDAS_PAGO_PERSONALIZADO = ["UYU", "USD"] as const;
export type MonedaPagoPersonalizado = (typeof MONEDAS_PAGO_PERSONALIZADO)[number];

export const TIPO_PRESTAMO_PAGO_LABEL: Record<TipoPrestamoPago, string> = {
  PRESTAMO: "Préstamo",
  HIPOTECARIO: "Hipotecario",
  PRENDARIO: "Prendario",
  LEASING: "Leasing",
  TARJETA: "Tarjeta / crédito",
  OTRO: "Otro",
};

export interface PagoPersonalizadoCuota {
  id: number;
  nro_cuota: number;
  fecha: string;
  monto: number | null;
  descripcion: string | null;
  pagado: boolean;
}

export interface PagoPersonalizadoRow {
  id: number;
  cuenta_id: number;
  entidad: string;
  tipo_prestamo: TipoPrestamoPago;
  tasa_interes: number | null;
  cantidad_cuotas: number;
  moneda: MonedaPagoPersonalizado;
  monto_cuota: number | null;
  notas: string | null;
  activo: boolean;
  cuotas: PagoPersonalizadoCuota[];
  creado_por_user_id: number | null;
  creado_en: string;
  actualizado_en: string;
}

export interface PagoPersonalizadoCuotaInput {
  nro_cuota: number;
  fecha: string;
  monto?: number | null;
  descripcion?: string | null;
  pagado?: boolean;
}

export interface PagoPersonalizadoInput {
  entidad: string;
  tipo_prestamo: TipoPrestamoPago;
  tasa_interes?: number | null;
  moneda?: MonedaPagoPersonalizado;
  monto_cuota?: number | null;
  notas?: string | null;
  activo?: boolean;
  cuotas: PagoPersonalizadoCuotaInput[];
}
