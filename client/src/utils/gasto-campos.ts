/** Campos configurables al vincular un tipo de documento digital con Ingresar gasto. */
export const GASTO_CAMPO_IDS = [
  "empresa",
  "fecha",
  "proveedor",
  "nro_factura",
  "rubro",
  "sub_rubro",
  "responsable_gasto",
  "concepto",
  "observaciones",
  "importes",
] as const;

export type GastoCampoId = (typeof GASTO_CAMPO_IDS)[number];

export const GASTO_CAMPO_LABELS: Record<GastoCampoId, string> = {
  empresa: "Empresa",
  fecha: "Fecha",
  proveedor: "Proveedor (código y razón social)",
  nro_factura: "Nro. factura",
  rubro: "Rubro",
  sub_rubro: "Sub-rubro",
  responsable_gasto: "Presupuesto asignado",
  concepto: "Concepto",
  observaciones: "Observaciones",
  importes: "Importe y moneda",
};

export const GASTO_CAMPO_GRUPOS: { titulo: string; campos: GastoCampoId[] }[] = [
  { titulo: "Datos generales", campos: ["empresa", "fecha"] },
  { titulo: "Proveedor y documento", campos: ["proveedor", "nro_factura"] },
  { titulo: "Clasificación", campos: ["rubro", "sub_rubro", "responsable_gasto"] },
  { titulo: "Detalle", campos: ["concepto", "observaciones"] },
  { titulo: "Montos", campos: ["importes"] },
];

export function isGastoCampoId(value: string): value is GastoCampoId {
  return (GASTO_CAMPO_IDS as readonly string[]).includes(value);
}

export function normalizeGastoCampoList(raw: unknown): GastoCampoId[] {
  if (!Array.isArray(raw)) return [];
  const out: GastoCampoId[] = [];
  for (const item of raw) {
    if (typeof item !== "string" || !isGastoCampoId(item)) continue;
    if (!out.includes(item)) out.push(item);
  }
  return out;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Conexiones documento → formulario de gasto
 * Mapean cada dato del comprobante (origen) a un campo del formulario (destino).
 * ──────────────────────────────────────────────────────────────────────── */

/** Campos del formulario de gasto que se pueden completar desde un documento. */
export const GASTO_DESTINO_IDS = [
  "nro_operacion_origen",
  "fecha",
  "proveedor",
  "nro_factura",
  "concepto",
  "observaciones",
  "importes",
] as const;

export type GastoDestinoId = (typeof GASTO_DESTINO_IDS)[number];

export const GASTO_DESTINO_LABELS: Record<GastoDestinoId, string> = {
  nro_operacion_origen: "N° de operación",
  fecha: "Fecha",
  proveedor: "Proveedor",
  nro_factura: "Nro. factura",
  concepto: "Concepto",
  observaciones: "Observaciones",
  importes: "Importe y moneda",
};

/** Datos que extrae el lector de comprobantes BROU (origen del dato). */
export const BROU_CAMPO_IDS = [
  "numero_operacion",
  "numero_transferencia",
  "fecha",
  "importe_acreditar",
  "comision",
  "beneficiario_nombre",
  "beneficiario_direccion",
  "beneficiario_observaciones",
  "banco_destino",
  "cuenta_destino",
  "cuenta_origen",
  "concepto_brou",
] as const;

export type BrouCampoId = (typeof BROU_CAMPO_IDS)[number];

export const BROU_CAMPO_LABELS: Record<BrouCampoId, string> = {
  numero_operacion: "Número de la operación",
  numero_transferencia: "Número de transferencia",
  fecha: "Fecha de realización",
  importe_acreditar: "Importe a acreditar",
  comision: "Comisiones y gastos",
  beneficiario_nombre: "Beneficiario — nombre completo",
  beneficiario_direccion: "Beneficiario — dirección",
  beneficiario_observaciones: "Beneficiario — observaciones",
  banco_destino: "Banco de destino",
  cuenta_destino: "Cuenta de destino",
  cuenta_origen: "Cuenta de origen",
  concepto_brou: "Concepto",
};

export type GastoMapeoCampos = Partial<Record<GastoDestinoId, string>>;

/** Conexiones por defecto: título del campo en el comprobante BROU. */
export const BROU_MAPEO_DEFAULT: GastoMapeoCampos = {
  nro_operacion_origen: "Número de la operación",
  fecha: "Fecha de realización",
  nro_factura: "Número de transferencia",
  proveedor: "Nombre Completo",
  concepto: "Concepto",
  observaciones: "Observaciones",
  importes: "Importe a acreditar",
};

/** Convierte un id de catálogo legacy a la etiqueta del PDF. */
export function mapeoValorAEtiqueta(valor: string): string {
  const t = valor.trim();
  if (!t) return "";
  if (isBrouCampoId(t)) return BROU_CAMPO_LABELS[t];
  return t;
}

export function isGastoDestinoId(value: string): value is GastoDestinoId {
  return (GASTO_DESTINO_IDS as readonly string[]).includes(value);
}

export function isBrouCampoId(value: string): value is BrouCampoId {
  return (BROU_CAMPO_IDS as readonly string[]).includes(value);
}

export function normalizeGastoMapeo(raw: unknown): GastoMapeoCampos {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: GastoMapeoCampos = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!isGastoDestinoId(k) || typeof v !== "string") continue;
    const etiqueta = mapeoValorAEtiqueta(v);
    if (etiqueta) out[k] = etiqueta;
  }
  return out;
}

/** Campos del formulario que pueden copiarse de la transferencia principal al registro de comisión. */
export const COMISION_HEREDAR_IDS = [
  "empresa",
  "rubro",
  "sub_rubro",
  "responsable_gasto",
] as const satisfies readonly GastoCampoId[];

export const COMISION_PROVEEDOR_APP_PREFIJO = "app:";
export const COMISION_PROVEEDOR_HEREDAR_VALOR = "heredar";

export function encodeProveedorComision(cod: number, razonSocial: string): string {
  return `${COMISION_PROVEEDOR_APP_PREFIJO}${cod}:${razonSocial}`;
}

export function decodeProveedorComision(
  raw: string
): { cod: string; razon: string } | null {
  const t = raw.trim();
  if (!t.startsWith(COMISION_PROVEEDOR_APP_PREFIJO)) return null;
  const rest = t.slice(COMISION_PROVEEDOR_APP_PREFIJO.length);
  const sep = rest.indexOf(":");
  if (sep < 0) return { cod: rest, razon: "" };
  return { cod: rest.slice(0, sep), razon: rest.slice(sep + 1) };
}

export function esProveedorComisionHeredar(raw: string | undefined): boolean {
  return raw?.trim() === COMISION_PROVEEDOR_HEREDAR_VALOR;
}

/** Importe fijo de comisión Santander (1001) cuando no se lee del PDF BROU. */
export const COMISION_IMPORTE_SANTANDER_LABEL = "1,60 usd";
export const COMISION_IMPORTE_SANTANDER_VALOR = "USD:1.6";

export function esProveedorComisionSantander(raw: string | undefined): boolean {
  const decoded = decodeProveedorComision(raw?.trim() ?? "");
  if (!decoded) return false;
  if (decoded.cod === "1001") return true;
  return decoded.razon.toUpperCase().includes("SANTANDER");
}

export function esImporteComisionSantander(
  mapeo: string | undefined,
  valorFijo: string | undefined
): boolean {
  return (
    mapeo?.trim() === COMISION_IMPORTE_SANTANDER_LABEL ||
    valorFijo?.trim() === COMISION_IMPORTE_SANTANDER_VALOR
  );
}

export interface ComisionDocumentoConfig {
  /** Registrar comisión como operación separada al guardar (por defecto). */
  activa: boolean;
  /** Campos copiados del gasto principal sin leer el PDF. */
  heredar: GastoCampoId[];
  /** Campos del registro de comisión completados desde el PDF o valores fijos. */
  campos_incluidos: GastoDestinoId[];
  mapeo_campos: GastoMapeoCampos;
  valores_fijos: Partial<Record<GastoDestinoId, string>>;
}

export const COMISION_MAPEO_DEFAULT: GastoMapeoCampos = {
  fecha: "Fecha de realización",
  importes: "Comisiones y gastos",
  nro_factura: "Número de transferencia",
  nro_operacion_origen: "Número de la operación",
};

export const COMISION_CONFIG_DEFAULT: ComisionDocumentoConfig = {
  activa: true,
  heredar: ["empresa", "rubro", "sub_rubro", "responsable_gasto"],
  campos_incluidos: [
    "nro_operacion_origen",
    "fecha",
    "concepto",
    "observaciones",
    "nro_factura",
    "importes",
  ],
  mapeo_campos: { ...COMISION_MAPEO_DEFAULT },
  valores_fijos: { concepto: "COMISIONES BANCARIAS" },
};

export function normalizeComisionConfig(raw: unknown): ComisionDocumentoConfig {
  const base = COMISION_CONFIG_DEFAULT;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      activa: base.activa,
      heredar: [...base.heredar],
      campos_incluidos: [...base.campos_incluidos],
      mapeo_campos: { ...base.mapeo_campos },
      valores_fijos: { ...base.valores_fijos },
    };
  }
  const o = raw as Record<string, unknown>;
  const heredar = normalizeGastoCampoList(o.heredar).filter((c) =>
    (COMISION_HEREDAR_IDS as readonly string[]).includes(c)
  );
  const campos_incluidos: GastoDestinoId[] = [];
  if (Array.isArray(o.campos_incluidos)) {
    for (const item of o.campos_incluidos) {
      if (typeof item === "string" && isGastoDestinoId(item) && !campos_incluidos.includes(item)) {
        campos_incluidos.push(item);
      }
    }
  }
  const valores_fijos: Partial<Record<GastoDestinoId, string>> = {};
  if (o.valores_fijos && typeof o.valores_fijos === "object" && !Array.isArray(o.valores_fijos)) {
    for (const [k, v] of Object.entries(o.valores_fijos as Record<string, unknown>)) {
      if (isGastoDestinoId(k) && typeof v === "string" && v.trim()) {
        valores_fijos[k] = v.trim();
      }
    }
  }
  return {
    activa: o.activa !== false && o.activa !== 0 && o.activa !== "0",
    heredar: heredar.length > 0 ? heredar : [...base.heredar],
    campos_incluidos: campos_incluidos.length > 0 ? campos_incluidos : [...base.campos_incluidos],
    mapeo_campos: normalizeGastoMapeo(o.mapeo_campos ?? base.mapeo_campos),
    valores_fijos: Object.keys(valores_fijos).length > 0 ? valores_fijos : { ...base.valores_fijos },
  };
}

export function esTipoDocumentoBrou(tipo: { origen?: string; nombre?: string }): boolean {
  const o = (tipo.origen ?? "").trim().toUpperCase();
  const n = (tipo.nombre ?? "").trim().toUpperCase();
  return o === "BROU" || n.includes("BROU");
}

export const GASTO_CAMPOS_DEFAULT_REQUERIDOS: GastoCampoId[] = [
  "empresa",
  "fecha",
  "rubro",
  "concepto",
];

export function campoGastoVisible(
  campo: GastoCampoId,
  habilitados: GastoCampoId[] | null | undefined
): boolean {
  if (!habilitados) return true;
  return habilitados.includes(campo);
}

export function campoGastoRequerido(
  campo: GastoCampoId,
  habilitados: GastoCampoId[] | null | undefined,
  requeridos: GastoCampoId[] | null | undefined
): boolean {
  if (!habilitados) {
    return GASTO_CAMPOS_DEFAULT_REQUERIDOS.includes(campo);
  }
  if (!habilitados.includes(campo)) return false;
  return requeridos?.includes(campo) ?? false;
}
