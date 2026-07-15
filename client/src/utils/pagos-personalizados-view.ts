import type { PagoPersonalizadoRow } from "../types/pagos-personalizados";
import { TIPO_PRESTAMO_PAGO_LABEL } from "../types/pagos-personalizados";
import {
  diasHastaVencimientoCuota,
  formatearFechaContribucionRural,
  parseFechaLocal,
} from "./contribucion-rural-common";

export interface CuotaPersonalizadaItem {
  pagoId: number;
  entidad: string;
  tipoLabel: string;
  cuota: number;
  totalCuotas: number;
  fecha: string;
  fechaLabel: string;
  diasRestantes: number;
  montoLabel: string | null;
  tasaLabel: string | null;
  descripcion: string | null;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Normaliza cualquier valor de fecha a YYYY-MM-DD o null. */
export function normalizeFechaPagoIso(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(value).trim();
  const matched = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  if (matched && ISO_DATE_RE.test(matched[1]!)) return matched[1]!;
  return null;
}

function formatMonto(
  monto: number | null | undefined,
  moneda: string,
): string | null {
  if (motivoNull(monto)) return null;
  const n = Number(monto);
  const formatted = new Intl.NumberFormat("es-UY", {
    maximumFractionDigits: 2,
  }).format(n);
  return `${moneda} ${formatted}`;
}

function motivoNull(value: number | null | undefined): value is null | undefined {
  return value == null || !Number.isFinite(Number(value));
}

/** Cuotas futuras no marcadas como pagadas. */
export function cuotasFuturasPagosPersonalizados(
  pagos: PagoPersonalizadoRow[],
): CuotaPersonalizadaItem[] {
  const out: CuotaPersonalizadaItem[] = [];
  for (const pago of pagos) {
    if (!pago.activo) continue;
    const tipoLabel = TIPO_PRESTAMO_PAGO_LABEL[pago.tipo_prestamo] ?? pago.tipo_prestamo;
    const tasaLabel =
      pago.tasa_interes != null && Number.isFinite(pago.tasa_interes)
        ? `${pago.tasa_interes} %`
        : null;
    const total = pago.cuotas.length || pago.cantidad_cuotas;
    for (const cuota of pago.cuotas) {
      if (cuota.pagado) continue;
      const fecha = normalizeFechaPagoIso(cuota.fecha);
      if (!fecha) continue;
      const dias = diasHastaVencimientoCuota(fecha);
      if (!Number.isFinite(dias) || dias < 0) continue;
      const monto =
        formatMonto(cuota.monto, pago.moneda) ??
        formatMonto(pago.monto_cuota, pago.moneda);
      out.push({
        pagoId: pago.id,
        entidad: pago.entidad,
        tipoLabel,
        cuota: cuota.nro_cuota,
        totalCuotas: total,
        fecha,
        fechaLabel: formatearFechaContribucionRural(fecha),
        diasRestantes: dias,
        montoLabel: monto,
        tasaLabel,
        descripcion: cuota.descripcion?.trim() || null,
      });
    }
  }
  return out.sort(
    (a, b) => parseFechaLocal(a.fecha).getTime() - parseFechaLocal(b.fecha).getTime(),
  );
}

/** Genera N cuotas mensuales a partir de una fecha inicial (día coincidente o último del mes). */
export function generarCuotasMensuales(
  fechaInicio: string,
  cantidad: number,
  montoPorCuota: number | null = null,
): Array<{
  nro_cuota: number;
  fecha: string;
  monto: number | null;
  descripcion: string | null;
  pagado: boolean;
}> {
  const raw = normalizeFechaPagoIso(fechaInicio);
  if (!raw) return [];
  const n = Math.floor(Number(cantidad));
  if (!Number.isFinite(n) || n < 1 || n > 360) return [];
  const [y0, m0, d0] = raw.split("-").map(Number);
  const out: Array<{
    nro_cuota: number;
    fecha: string;
    monto: number | null;
    descripcion: string | null;
    pagado: boolean;
  }> = [];
  for (let i = 0; i < n; i += 1) {
    const date = new Date(y0, m0 - 1 + i, 1);
    const y = date.getFullYear();
    const m = date.getMonth();
    const lastDay = new Date(y, m + 1, 0).getDate();
    const day = Math.min(d0, lastDay);
    const fecha = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    out.push({
      nro_cuota: i + 1,
      fecha,
      monto: montoPorCuota,
      descripcion: null,
      pagado: false,
    });
  }
  return out;
}
