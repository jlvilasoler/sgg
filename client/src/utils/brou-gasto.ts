import type { BrouImporte, BrouTransferenciaParsed, PresupuestoForm } from "../types";
import { aplicarImporteMoneda } from "./importeMoneda";
import { aMayusculas } from "./formText";
import {
  BROU_MAPEO_DEFAULT,
  type ComisionDocumentoConfig,
  decodeProveedorComision,
  type GastoCampoId,
  type GastoDestinoId,
  type GastoMapeoCampos,
  normalizeComisionConfig,
} from "./gasto-campos";

type FormLike = {
  fecha: string;
  codigo_proveedor: string;
  razon_social_proveedor: string;
  concepto: string;
  observaciones: string;
  nro_factura: string;
  nro_operacion_origen: string;
  pesos: number;
  dolares_usd: number;
  reales: number;
  tc_usd: number;
  tc_reales: number;
  saldo_usd: number;
};

function importeToMoney(importe: BrouImporte): Pick<
  FormLike,
  "pesos" | "dolares_usd" | "reales" | "tc_usd" | "tc_reales" | "saldo_usd"
> {
  const base = { pesos: 0, dolares_usd: 0, reales: 0, tc_usd: 0, tc_reales: 0, saldo_usd: 0 };
  if (importe.moneda === "USD") return { ...base, dolares_usd: importe.valor, saldo_usd: importe.valor };
  return { ...base, pesos: importe.valor };
}

function parseImporteMapeo(raw: string): BrouImporte | null {
  const m = raw.match(/^(USD|UYU):([\d.]+)$/);
  if (!m) return null;
  const valor = Number(m[2]);
  if (!Number.isFinite(valor) || valor <= 0) return null;
  return { moneda: m[1] as "USD" | "UYU", valor };
}

/**
 * Completa el formulario usando los valores extraídos según las etiquetas del PDF
 * configuradas en el tipo de documento.
 */
export function applyBrouParsedToForm<T extends FormLike>(
  parsed: BrouTransferenciaParsed,
  form: T,
  _mapeo?: GastoMapeoCampos,
  valoresMapeo?: Partial<Record<GastoDestinoId, string>>
): T {
  const next: T = { ...form };
  const valores = valoresMapeo ?? {};

  if (valores.nro_operacion_origen?.trim()) {
    next.nro_operacion_origen = valores.nro_operacion_origen.trim();
  } else if (!Object.keys(valores).length && parsed.numero_operacion) {
    next.nro_operacion_origen = parsed.numero_operacion;
  }

  if (valores.fecha?.trim()) {
    next.fecha = valores.fecha.trim();
  } else if (!Object.keys(valores).length && parsed.fecha) {
    next.fecha = parsed.fecha;
  }

  if (valores.nro_factura?.trim()) {
    next.nro_factura = valores.nro_factura.trim();
  } else if (!Object.keys(valores).length && parsed.numero_transferencia) {
    next.nro_factura = parsed.numero_transferencia;
  }

  const proveedorNombre = valores.proveedor?.trim() || "";
  if (proveedorNombre) {
    if (parsed.proveedor_cod != null) {
      next.codigo_proveedor = String(parsed.proveedor_cod);
      next.razon_social_proveedor = aMayusculas(parsed.proveedor_razon || proveedorNombre);
    } else {
      next.razon_social_proveedor = aMayusculas(proveedorNombre);
    }
  } else if (!Object.keys(valores).length && parsed.beneficiario_nombre) {
    if (parsed.proveedor_cod != null) {
      next.codigo_proveedor = String(parsed.proveedor_cod);
      next.razon_social_proveedor = aMayusculas(parsed.proveedor_razon || parsed.beneficiario_nombre);
    } else {
      next.razon_social_proveedor = aMayusculas(parsed.beneficiario_nombre);
    }
  }

  if (valores.concepto?.trim()) {
    next.concepto = aMayusculas(valores.concepto.trim());
  } else if (!Object.keys(valores).length && parsed.concepto_brou) {
    next.concepto = aMayusculas(parsed.concepto_brou);
  } else if (!next.concepto.trim()) {
    next.concepto = "TRANSFERENCIA BROU";
  }

  if (valores.observaciones?.trim()) {
    next.observaciones = valores.observaciones.trim();
  } else if (!Object.keys(valores).length && parsed.beneficiario_observaciones) {
    next.observaciones = parsed.beneficiario_observaciones;
  }

  const impMapeo = valores.importes ? parseImporteMapeo(valores.importes) : null;
  if (impMapeo) {
    Object.assign(next, importeToMoney(impMapeo));
  } else if (!Object.keys(valores).length && parsed.importe_acreditar?.valor > 0) {
    Object.assign(next, importeToMoney(parsed.importe_acreditar));
  }

  return next;
}

/** Aplica conexiones por defecto (etiquetas BROU) cuando no hay tipo configurado. */
export function mapeoPorDefectoBrou(): GastoMapeoCampos {
  return { ...BROU_MAPEO_DEFAULT };
}

export function formatBrouImporte(moneda: "UYU" | "USD", valor: number): string {
  const sym = moneda === "USD" ? "U$S" : "$";
  return `${sym} ${valor.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const PREFIJO_SUB_RUBRO_COMISION = "Comisiones Bancarias";
const CONCEPTO_COMISION_BANCARIA = "COMISIONES BANCARIAS";

function subRubroComisionBancaria(subRubroPrincipal: string): string {
  const base = subRubroPrincipal.trim();
  if (!base) return PREFIJO_SUB_RUBRO_COMISION;
  if (base.toLowerCase().startsWith(PREFIJO_SUB_RUBRO_COMISION.toLowerCase())) return base;
  return `${PREFIJO_SUB_RUBRO_COMISION} - ${base}`;
}

function esSubRubroComisionBancaria(subRubro: string): boolean {
  return subRubro.trim().toLowerCase().startsWith(PREFIJO_SUB_RUBRO_COMISION.toLowerCase());
}

function aplicarHeredarCampo(
  out: PresupuestoForm,
  main: PresupuestoForm,
  campo: GastoCampoId
): void {
  switch (campo) {
    case "empresa":
      out.empresa = main.empresa;
      break;
    case "rubro":
      out.rubro = main.rubro;
      break;
    case "sub_rubro":
      out.sub_rubro = subRubroComisionBancaria(main.sub_rubro);
      break;
    case "responsable_gasto":
      out.responsable_gasto = main.responsable_gasto;
      out.funcionario_cedula = main.funcionario_cedula;
      break;
    case "proveedor":
      out.codigo_proveedor = main.codigo_proveedor;
      out.razon_social_proveedor = main.razon_social_proveedor;
      break;
    default:
      break;
  }
}

function aplicarDestinoComision(
  out: PresupuestoForm,
  destino: GastoDestinoId,
  valor: string,
  parsed: BrouTransferenciaParsed
): void {
  switch (destino) {
    case "nro_operacion_origen":
      out.nro_operacion_origen = valor.trim();
      break;
    case "fecha":
      out.fecha = valor.trim();
      break;
    case "nro_factura":
      out.nro_factura = valor.trim();
      break;
    case "concepto":
      out.concepto = aMayusculas(valor.trim());
      break;
    case "observaciones":
      out.observaciones = valor.trim();
      break;
    case "proveedor": {
      const app = decodeProveedorComision(valor);
      if (app) {
        out.codigo_proveedor = app.cod;
        out.razon_social_proveedor = aMayusculas(app.razon);
        break;
      }
      const nombre = valor.trim();
      if (!nombre) break;
      if (parsed.proveedor_cod != null) {
        out.codigo_proveedor = String(parsed.proveedor_cod);
        out.razon_social_proveedor = aMayusculas(parsed.proveedor_razon || nombre);
      } else {
        out.razon_social_proveedor = aMayusculas(nombre);
      }
      break;
    }
    case "importes": {
      const imp = parseImporteMapeo(valor) ?? parsed.comision;
      if (!imp || imp.valor <= 0) break;
      const moneda = imp.moneda === "USD" ? "USD" : "UYU";
      const money = aplicarImporteMoneda(
        moneda,
        imp.valor,
        moneda === "UYU" ? out.tc_usd || 0 : 0
      );
      Object.assign(out, money);
      break;
    }
    default:
      break;
  }
}

/**
 * Arma el payload del registro de comisión según la configuración del tipo de documento.
 */
export function buildComisionPayload(
  mainPayload: PresupuestoForm,
  configRaw: ComisionDocumentoConfig | undefined,
  valoresComision: Partial<Record<GastoDestinoId, string>> | undefined,
  parsed: BrouTransferenciaParsed
): PresupuestoForm {
  const config = normalizeComisionConfig(configRaw);
  const out: PresupuestoForm = {
    ...mainPayload,
    pesos: 0,
    dolares_usd: 0,
    reales: 0,
    saldo_usd: 0,
    nro_operacion_origen: "",
    fecha: "",
    codigo_proveedor: "",
    razon_social_proveedor: "",
    concepto: "",
    observaciones: "",
    nro_factura: "",
    rubro: "",
    sub_rubro: "",
    responsable_gasto: "",
    funcionario_cedula: "",
  };

  for (const campo of config.heredar) {
    aplicarHeredarCampo(out, mainPayload, campo);
  }

  for (const destino of config.campos_incluidos) {
    const fijo = config.valores_fijos[destino];
    if (fijo?.trim()) {
      aplicarDestinoComision(out, destino, fijo, parsed);
      continue;
    }
    const desdePdf = valoresComision?.[destino]?.trim();
    if (desdePdf) {
      aplicarDestinoComision(out, destino, desdePdf, parsed);
      continue;
    }
    if (destino === "importes" && parsed.comision && parsed.comision.valor > 0) {
      aplicarDestinoComision(out, destino, `${parsed.comision.moneda}:${parsed.comision.valor}`, parsed);
    }
  }

  if (
    config.campos_incluidos.includes("observaciones") &&
    !out.observaciones.trim() &&
    !config.valores_fijos.observaciones
  ) {
    out.observaciones = `Comisión BROU — transferencia ${parsed.numero_transferencia} (op. ${parsed.numero_operacion})`;
  }

  if (config.campos_incluidos.includes("nro_operacion_origen") && out.nro_operacion_origen.trim()) {
    const base = out.nro_operacion_origen.trim();
    if (!base.endsWith("-COM")) {
      out.nro_operacion_origen = `${base}-COM`;
    }
  }

  // La fecha es obligatoria en el servidor: si no se obtuvo del documento, heredá la del gasto.
  if (!out.fecha.trim()) out.fecha = mainPayload.fecha;
  if (!out.empresa) out.empresa = mainPayload.empresa;
  if (!out.rubro.trim()) out.rubro = mainPayload.rubro;
  out.sub_rubro = subRubroComisionBancaria(mainPayload.sub_rubro);
  if (esSubRubroComisionBancaria(out.sub_rubro)) {
    out.concepto = CONCEPTO_COMISION_BANCARIA;
  }

  return out;
}

export const EMPTY_BROU_PARSED: BrouTransferenciaParsed = {
  numero_operacion: "",
  numero_transferencia: "",
  fecha: "",
  importe_acreditar: { moneda: "UYU", valor: 0 },
  comision: null,
  beneficiario_nombre: "",
  beneficiario_direccion: "",
  beneficiario_observaciones: "",
  banco_destino: "",
  cuenta_destino: "",
  concepto_brou: "",
  cuenta_origen: "",
  proveedor_cod: null,
  proveedor_razon: "",
};

type MoneyFields = Pick<
  PresupuestoForm,
  "pesos" | "dolares_usd" | "reales" | "tc_usd" | "tc_reales" | "saldo_usd"
>;

export function tieneImporteComision(money: MoneyFields): boolean {
  return money.dolares_usd > 0 || money.pesos > 0 || money.reales > 0;
}

function moneyToImporteMapeo(money: MoneyFields): string | null {
  if (money.dolares_usd > 0) return `USD:${money.dolares_usd}`;
  if (money.pesos > 0) return `UYU:${money.pesos}`;
  if (money.reales > 0) return `BRL:${money.reales}`;
  return null;
}

function buildManualValoresComision(
  main: PresupuestoForm,
  money: MoneyFields,
  config: ComisionDocumentoConfig
): Partial<Record<GastoDestinoId, string>> {
  const valores: Partial<Record<GastoDestinoId, string>> = {};
  for (const destino of config.campos_incluidos) {
    switch (destino) {
      case "nro_operacion_origen":
        if (main.nro_operacion_origen.trim()) {
          valores.nro_operacion_origen = main.nro_operacion_origen.trim();
        }
        break;
      case "fecha":
        if (main.fecha.trim()) valores.fecha = main.fecha.trim();
        break;
      case "nro_factura":
        if (main.nro_factura.trim()) valores.nro_factura = main.nro_factura.trim();
        break;
      case "importes": {
        const imp = moneyToImporteMapeo(money);
        if (imp) valores.importes = imp;
        break;
      }
      default:
        break;
    }
  }
  return valores;
}

/** Arma el payload de comisión para vista previa o guardado (PDF o carga manual). */
export function buildComisionPayloadForGasto(
  mainPayload: PresupuestoForm,
  configRaw: ComisionDocumentoConfig | undefined,
  brouParsed: BrouTransferenciaParsed | null | undefined,
  manualMoney?: MoneyFields
): PresupuestoForm {
  const config = normalizeComisionConfig(configRaw);
  const parsed = brouParsed ?? EMPTY_BROU_PARSED;
  const desdePdf = Boolean(parsed.comision && parsed.comision.valor > 0);
  const valoresComision = desdePdf
    ? (parsed.valores_mapeo_comision as Partial<Record<GastoDestinoId, string>>)
    : buildManualValoresComision(mainPayload, manualMoney ?? mainPayload, config);

  const out = buildComisionPayload(mainPayload, config, valoresComision, parsed);

  if (!desdePdf && manualMoney && tieneImporteComision(manualMoney)) {
    Object.assign(out, manualMoney);
  }

  if (
    config.campos_incluidos.includes("observaciones") &&
    !out.observaciones.trim() &&
    !config.valores_fijos.observaciones &&
    !parsed.numero_operacion
  ) {
    const ref =
      mainPayload.nro_operacion_origen.trim() ||
      mainPayload.nro_factura.trim() ||
      mainPayload.concepto.trim();
    if (ref) out.observaciones = `Comisión bancaria — ref. ${ref}`;
  }

  return out;
}
