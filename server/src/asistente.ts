import type { Db } from "./db/pg-client.js";
import type { Modulo, UserPublic } from "./auth-db.js";
import * as stockGanadero from "./stock-ganadero-db.js";
import type { StockGanaderoFilters, StockGanaderaDispositivo } from "./stock-ganadero-db.js";
import { listClavesDispositivosEnVentasCerradas } from "./simulador-venta-dispositivos-db.js";
import * as database from "./database.js";
import type { ResumenEmpresaScope } from "./empresa-scope.js";
import * as divisasDb from "./divisas-db.js";
import * as preciosGanado from "./precios-ganado-db.js";
import * as campoPotreros from "./campo-potrero-mapa-db.js";
import * as campoElementos from "./campo-mapa-elementos-db.js";
import * as empresasCuenta from "./empresas-cuenta-db.js";
import * as funcionariosDb from "./funcionarios-db.js";
import type { Funcionario } from "./funcionarios-db.js";
import * as rrhhPagos from "./rrhh-pagos-db.js";
import * as gastosAuto from "./gastos-automatizacion-db.js";
import * as ventasAgricultura from "./ventas-agricultura-db.js";

export type AsistenteIntentId =
  | "ayuda"
  | "stock_activo"
  | "stock_sexo"
  | "gastos_mes"
  | "gastos_ejercicio"
  | "gastos_anio_vs_anterior"
  | "precios_ganado"
  | "divisas"
  | "mapa_resumen"
  | "mapa_objetos"
  | "estancias"
  | "rrhh_empleados"
  | "rrhh_salarios"
  | "rrhh_sueldo_empleado"
  | "rrhh_banco_empleado"
  | "rrhh_sueldos_pendientes"
  | "rrhh_aguinaldos"
  | "rrhh_licencias"
  | "pasturas_uy"
  | "indicadores_financieros"
  | "indicadores_ganaderos"
  | "indicadores_agricolas"
  | "indicadores_lecheria"
  | "desconocido";

export interface AsistenteConsultaResult {
  intent: AsistenteIntentId;
  respuesta: string;
  sugerencias: string[];
}

export const ASISTENTE_SUGERENCIAS = [
  "¿Cómo están los indicadores financieros?",
  "¿Cómo están los indicadores ganaderos?",
  "¿Cómo va la agricultura?",
  "¿Qué indicadores de lechería se usan?",
  "¿Cuánto ganado activo tengo?",
  "¿Gastos de este año vs el año pasado?",
  "¿Cuántos potreros hay en el mapa?",
  "¿Cómo está el dólar?",
] as const;

const OBJETO_MAPA_LABELS: Record<string, string> = {
  molino_agua: "molinos de agua",
  bomba_agua: "bombas de agua",
  bebedero: "bebederos",
  tanque_australiano: "tanques australianos",
  camino: "caminos",
  portera: "porteras",
  puente: "puentes",
};

function normalizeText(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(text: string, words: string[]): boolean {
  return words.some((w) => text.includes(w));
}

function hasWord(text: string, word: string): boolean {
  return new RegExp(`(?:^|\\s)${word}(?:$|\\s)`, "i").test(` ${text} `);
}

function hasAnyWord(text: string, words: string[]): boolean {
  return words.some((w) => hasWord(text, w));
}

/** Preguntas de cantidad / existencia → stock, no precios. */
function esPreguntaCantidad(text: string): boolean {
  return hasAny(text, [
    "cuantas",
    "cuantos",
    "cuanta",
    "cuanto",
    "cantidad",
    "tengo",
    "hay",
    "existen",
    "activos",
    "activo",
    "en stock",
    "cabezas",
  ]);
}

const CATEGORIAS_GANADO = [
  "vaca",
  "vacas",
  "novillo",
  "novillos",
  "vaquillona",
  "vaquillonas",
  "ternero",
  "terneros",
  "ternera",
  "terneras",
  "toro",
  "toros",
  "vacuno",
  "vacunos",
];

/** Misma lógica de edad/sexo que el monitor de stock en Home. */
type CategoriaStockKey =
  | "TERNERA"
  | "VAQUILLONA_1_2"
  | "VAQUILLONA_MAS_2"
  | "VACA"
  | "TERNERO"
  | "MACHO_1_2"
  | "MACHO_MAS_2"
  | "SIN_SEXO"
  | "SIN_EDAD";

const MACHO_FRONTERA_TERNERO = 12;
const MACHO_FRONTERA_NOVILLO = 24;
const HEMBRA_FRONTERA_TERNERA = 12;
const HEMBRA_FRONTERA_VAQUILLONA = 24;
const HEMBRA_FRONTERA_VAQUILLONA_MAS_2 = 36;

function categoriaStockKey(d: StockGanaderaDispositivo): CategoriaStockKey {
  if (!d.sexo) return "SIN_SEXO";
  if (!d.nacimiento_mes || !d.nacimiento_anio) return "SIN_EDAD";
  if (d.edad === null || d.edad === undefined) return "SIN_EDAD";
  const meses = d.edad;
  if (d.sexo === "HEMBRA") {
    if (meses < HEMBRA_FRONTERA_TERNERA) return "TERNERA";
    if (meses < HEMBRA_FRONTERA_VAQUILLONA) return "VAQUILLONA_1_2";
    if (meses < HEMBRA_FRONTERA_VAQUILLONA_MAS_2) return "VAQUILLONA_MAS_2";
    return "VACA";
  }
  if (d.sexo === "MACHO") {
    if (meses < MACHO_FRONTERA_TERNERO) return "TERNERO";
    if (meses < MACHO_FRONTERA_NOVILLO) return "MACHO_1_2";
    return "MACHO_MAS_2";
  }
  return "SIN_SEXO";
}

type CategoriaConsulta = {
  label: string;
  labelPlural: string;
  keys: CategoriaStockKey[];
};

/** Detecta si la pregunta apunta a una categoría concreta (vacas, novillos, …). */
export function detectCategoriaStockConsulta(pregunta: string): CategoriaConsulta | null {
  const t = normalizeText(pregunta);
  if (hasAnyWord(t, ["vaca", "vacas"])) {
    return { label: "vaca", labelPlural: "vacas", keys: ["VACA"] };
  }
  if (hasAnyWord(t, ["vaquillona", "vaquillonas"])) {
    return {
      label: "vaquillona",
      labelPlural: "vaquillonas",
      keys: ["VAQUILLONA_1_2", "VAQUILLONA_MAS_2"],
    };
  }
  if (hasAnyWord(t, ["ternera", "terneras"])) {
    return { label: "ternera", labelPlural: "terneras", keys: ["TERNERA"] };
  }
  if (hasAnyWord(t, ["ternero", "terneros"])) {
    return { label: "ternero", labelPlural: "terneros", keys: ["TERNERO"] };
  }
  if (hasAnyWord(t, ["novillo", "novillos", "toro", "toros"])) {
    const esToro = hasAnyWord(t, ["toro", "toros"]) && !hasAnyWord(t, ["novillo", "novillos"]);
    return {
      label: esToro ? "toro / novillo" : "novillo / toro",
      labelPlural: esToro ? "toros / novillos" : "novillos / toros",
      keys: ["MACHO_1_2", "MACHO_MAS_2"],
    };
  }
  return null;
}

export function detectAsistenteIntent(pregunta: string): AsistenteIntentId {
  const t = normalizeText(pregunta);
  if (!t) return "ayuda";

  if (hasAny(t, ["ayuda", "que puedo", "opciones", "ejemplos", "como funciona"])) {
    return "ayuda";
  }

  if (hasAny(t, ["pastura", "pasturas", "pradera", "forraje", "campo natural"])) {
    return "pasturas_uy";
  }

  if (
    hasAny(t, [
      "lecheria",
      "lechera",
      "lechero",
      "tambo",
      "tambos",
      "leche",
      "ordeñe",
      "ordene",
      "litros de leche",
    ])
  ) {
    return "indicadores_lecheria";
  }

  if (
    hasAny(t, [
      "agricola",
      "agricolas",
      "agricultura",
      "cultivo",
      "cultivos",
      "zafra",
      "rendimiento",
      "toneladas",
      "kg/ha",
      "kg ha",
      "soja",
      "trigo",
      "maiz",
      "cebada",
      "colza",
      "girasol",
    ])
  ) {
    return "indicadores_agricolas";
  }

  if (
    hasAny(t, [
      "indicador financiero",
      "indicadores financieros",
      "estado de resultados",
      "estado resultados",
      "utilidad",
      "rentabilidad",
      "margen",
      "margenes",
      "resultado economico",
      "resultado financiero",
      "ganancia",
      "perdida",
      "roi",
      "ebitda",
    ]) ||
    (hasAny(t, ["indicador", "indicadores"]) &&
      hasAny(t, ["financiero", "financieros", "economico", "economicos"]))
  ) {
    return "indicadores_financieros";
  }

  if (
    hasAny(t, [
      "indicador ganadero",
      "indicadores ganaderos",
      "dotacion ganadera",
      "carga animal",
      "ug/ha",
      "ug ha",
      "unidad ganadera",
      "destete",
      "porcentaje de destete",
      "kg carne",
      "productividad ganadera",
    ]) ||
    (hasAny(t, ["indicador", "indicadores", "dotacion", "carga"]) &&
      hasAny(t, ["ganadero", "ganaderos", "ganaderia", "hacienda", "vacuno"]))
  ) {
    return "indicadores_ganaderos";
  }

  if (
    hasAny(t, ["licencia", "licencias", "vacaciones", "dias libres", "ausencia", "ausencias"])
  ) {
    return "rrhh_licencias";
  }

  // Comparación de gastos entre años (antes que gastos genéricos).
  if (
    hasAny(t, ["gasto", "gastos", "gaste", "presupuesto"]) &&
    hasAny(t, ["vs", "versus", "contra", "compar", "diferencia", "respecto"]) &&
    hasAny(t, ["anio", "ano", "anual", "pasado", "anterior"])
  ) {
    return "gastos_anio_vs_anterior";
  }
  if (
    hasAny(t, ["gasto", "gastos", "gaste"]) &&
    hasAny(t, ["este anio", "este ano", "anio actual", "ano actual"]) &&
    hasAny(t, ["anio pasado", "ano pasado", "anio anterior", "ano anterior"])
  ) {
    return "gastos_anio_vs_anterior";
  }

  if (
    hasAny(t, ["falta pagar", "faltan pagar", "sueldos pendientes", "sueldo pendiente", "pendiente de pago", "pendientes de pago", "sin pagar"]) &&
    hasAny(t, ["sueldo", "sueldos", "salario", "salarios", "jornal", "jornales", "empleado", "empleados", "funcionario", "mes"])
  ) {
    return "rrhh_sueldos_pendientes";
  }
  if (
    hasAny(t, ["falta", "faltan", "pendiente", "pendientes"]) &&
    hasAny(t, ["sueldo", "sueldos", "salario", "salarios", "jornal", "jornales"])
  ) {
    return "rrhh_sueldos_pendientes";
  }

  if (
    hasAny(t, ["banco", "bancos", "cuenta bancaria", "sucursal"]) &&
    hasAny(t, [
      "empleado",
      "empleados",
      "funcionario",
      "funcionarios",
      "usa",
      "tiene",
      "de",
    ])
  ) {
    return "rrhh_banco_empleado";
  }

  if (hasAny(t, ["aguinaldo", "aguinaldos"])) {
    return "rrhh_aguinaldos";
  }

  // Sueldo de un empleado concreto: "cuánto gana X", "sueldo de X".
  if (
    hasAny(t, ["cuanto gana", "cuanto cobra", "cuanto percibe", "sueldo de", "salario de", "jornal de"]) ||
    (hasAny(t, ["gana", "cobra", "percibe"]) &&
      hasAny(t, ["empleado", "funcionario", "cuanto"]))
  ) {
    return "rrhh_sueldo_empleado";
  }

  if (
    hasAny(t, ["salario", "salarios", "sueldo", "sueldos", "jornal", "jornales", "remuneracion"])
  ) {
    return "rrhh_salarios";
  }

  if (
    hasAny(t, [
      "empleado",
      "empleados",
      "funcionario",
      "funcionarios",
      "personal",
      "rrhh",
      "recursos humanos",
      "dotacion",
    ])
  ) {
    return "rrhh_empleados";
  }

  if (
    hasAny(t, ["dolar", "divisa", "tipo de cambio", "uyu"]) ||
    (hasWord(t, "cambio") && !hasAny(t, ["gasto", "gastos", "presupuesto"]))
  ) {
    if (!hasAny(t, ["gasto", "gastos", "presupuesto"])) return "divisas";
  }

  if (hasAny(t, ["macho", "machos", "hembra", "hembras", "sexo"])) {
    return "stock_sexo";
  }

  // Cantidad de animales / categorías → stock (antes que precios: "cuántas vacas" no es ACG).
  if (
    esPreguntaCantidad(t) &&
    (hasAny(t, ["ganado", "stock", "animales", "cabezas", "dispositivos", "hacienda"]) ||
      hasAnyWord(t, CATEGORIAS_GANADO))
  ) {
    return "stock_activo";
  }

  if (
    hasAny(t, ["gasto", "gastos", "presupuesto", "gaste"]) &&
    hasAny(t, ["ejercicio", "anio", "anual", "fiscal"])
  ) {
    return "gastos_ejercicio";
  }

  if (hasAny(t, ["gasto", "gastos", "presupuesto", "gaste"]) && hasAny(t, ["mes", "mensual"])) {
    return "gastos_mes";
  }

  if (hasAny(t, ["gasto", "gastos", "presupuesto", "gaste"])) {
    return "gastos_mes";
  }

  // Precios solo con señal clara de cotización / mercado.
  const pidePrecio = hasAny(t, [
    "precio",
    "precios",
    "cotizacion",
    "cotizaciones",
    "acg",
    "mercado",
    "gordo",
    "reposicion",
    "usd/kg",
    "por kg",
    "kilo",
  ]);
  if (
    pidePrecio ||
    (hasAnyWord(t, CATEGORIAS_GANADO) &&
      hasAny(t, ["vale", "cuesta", "cotiza", "como esta", "como andan"]))
  ) {
    return "precios_ganado";
  }

  if (
    hasAny(t, [
      "bebedero",
      "bebederos",
      "portera",
      "porteras",
      "molino",
      "molinos",
      "tanque australiano",
      "tanques australianos",
      "bomba de agua",
      "bombas de agua",
      "puente",
      "puentes",
    ])
  ) {
    return "mapa_objetos";
  }

  if (hasAny(t, ["estancia", "estancias", "empresa operativa", "empresas operativas"])) {
    return "estancias";
  }

  if (
    hasAny(t, [
      "mapa",
      "potrero",
      "potreros",
      "predio",
      "predios",
      "campo mapa",
      "hectarea",
      "hectareas",
    ])
  ) {
    return "mapa_resumen";
  }

  if (hasAny(t, ["ganado", "stock", "animales", "cabezas", "dispositivos", "vacunos", "hacienda"])) {
    return "stock_activo";
  }

  if (hasAnyWord(t, CATEGORIAS_GANADO)) {
    return "stock_activo";
  }

  return "desconocido";
}

function canAccess(user: UserPublic, modulo: Modulo): boolean {
  if (user.es_super_admin || user.rol === "admin") return true;
  return user.permisos.includes(modulo);
}

function fmtEntero(n: number): string {
  return n.toLocaleString("es-UY");
}

function fmtUsd(n: number): string {
  return n.toLocaleString("es-UY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function mesActualRango(): { desde: string; hasta: string; label: string } {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const desde = `${y}-${pad2(m)}-01`;
  const hasta = todayIso();
  const label = d.toLocaleDateString("es-UY", { month: "long", year: "numeric" });
  return { desde, hasta, label };
}

function normalizeEjercicio(user: UserPublic): { inicioMes: number; inicioDia: number } {
  let mes = Number(user.ejercicio_inicio_mes);
  if (!Number.isFinite(mes) || mes < 1 || mes > 12) mes = 7;
  let dia = Number(user.ejercicio_inicio_dia);
  if (!Number.isFinite(dia) || dia < 1) dia = 1;
  return { inicioMes: Math.floor(mes), inicioDia: Math.floor(dia) };
}

function ejercicioVigenteRango(user: UserPublic): {
  desde: string;
  hasta: string;
  label: string;
} {
  const { inicioMes, inicioDia } = normalizeEjercicio(user);
  const ref = new Date();
  const inicioEsteAnio = new Date(ref.getFullYear(), inicioMes - 1, inicioDia);
  const anioInicio = ref < inicioEsteAnio ? ref.getFullYear() - 1 : ref.getFullYear();
  const desde = `${anioInicio}-${pad2(inicioMes)}-${pad2(inicioDia)}`;
  const fin = new Date(anioInicio + 1, inicioMes - 1, inicioDia);
  fin.setDate(fin.getDate() - 1);
  const hastaFin = `${fin.getFullYear()}-${pad2(fin.getMonth() + 1)}-${pad2(fin.getDate())}`;
  const hasta = hastaFin < todayIso() ? hastaFin : todayIso();
  return {
    desde,
    hasta,
    label: `${anioInicio}/${anioInicio + 1}`,
  };
}

function totalGastosUsd(
  porEmpresa: { total_saldo_usd: number }[],
  porRubro: { total_saldo_usd: number }[],
): number {
  const rows = porEmpresa.length ? porEmpresa : porRubro;
  return rows.reduce((s, r) => s + Number(r.total_saldo_usd || 0), 0);
}

function contarSexo(dispositivos: StockGanaderaDispositivo[]): {
  machos: number;
  hembras: number;
  sinDefinir: number;
} {
  let machos = 0;
  let hembras = 0;
  let sinDefinir = 0;
  for (const d of dispositivos) {
    if (d.sexo === "MACHO") machos += 1;
    else if (d.sexo === "HEMBRA") hembras += 1;
    else sinDefinir += 1;
  }
  return { machos, hembras, sinDefinir };
}

function respuestaAyuda(): string {
  return [
    "Soy el asistente interno de SAG (sin costos de AI externa).",
    "Puedo responder con datos reales de tu cuenta y del mercado. Probá por ejemplo:",
    ...ASISTENTE_SUGERENCIAS.map((s) => `• ${s}`),
  ].join("\n");
}

function respuestaDesconocida(): string {
  return [
    "No entendí esa consulta.",
    "Puedo hablar de indicadores financieros, ganaderos, agrícolas y lechería; stock; mapa; RRHH; pasturas; gastos; precios y dólar.",
    "Ejemplos:",
    ...ASISTENTE_SUGERENCIAS.slice(0, 6).map((s) => `• ${s}`),
  ].join("\n");
}

function sinPermiso(moduloLabel: string): string {
  return `No tenés permiso para consultar ${moduloLabel} en esta cuenta. Pedile al administrador que habilite el módulo.`;
}

function parseMetadata(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw || "{}") as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* ignore */
  }
  return {};
}

function objetoTipoDeElemento(el: campoElementos.CampoMapaElementoRow): string | null {
  const meta = parseMetadata(el.metadata);
  const tipo = meta.objeto_tipo;
  return typeof tipo === "string" && tipo.trim() ? tipo.trim() : null;
}

function esMarcadorEstancia(el: campoElementos.CampoMapaElementoRow): boolean {
  return el.tipo === "marcador" && !objetoTipoDeElemento(el);
}

function detectObjetoMapaConsulta(pregunta: string): string | null {
  const t = normalizeText(pregunta);
  if (hasAny(t, ["bebedero", "bebederos"])) return "bebedero";
  if (hasAny(t, ["portera", "porteras"])) return "portera";
  if (hasAny(t, ["molino", "molinos"])) return "molino_agua";
  if (hasAny(t, ["tanque australiano", "tanques australianos", "tanque", "tanques"])) {
    return "tanque_australiano";
  }
  if (hasAny(t, ["bomba de agua", "bombas de agua", "bomba", "bombas"])) return "bomba_agua";
  if (hasAny(t, ["camino", "caminos"])) return "camino";
  if (hasAny(t, ["puente", "puentes"])) return "puente";
  return null;
}

function respuestaPasturasUy(): string {
  return [
    "En Uruguay, las pasturas más usadas en ganadería son:",
    "",
    "**Campo natural**",
    "• Base del sistema pastoril uruguayo; mezcla de gramíneas y leguminosas nativas.",
    "• Buena persistencia y bajo costo; la productividad depende del manejo y la carga.",
    "",
    "**Praderas cultivadas / mejoradas**",
    "• Mezclas de gramíneas y leguminosas sembradas para más forraje y calidad.",
    "• Comunes: festuca, dactylis (pasto ovillo), raigrás anual/perenne, festulolium.",
    "• Leguminosas: lotus corniculatus, trébol blanco, trébol rojo, alfalfa (en suelos aptos).",
    "",
    "**Verdeos / cultivos forrajeros**",
    "• Avena, raigrás anual, moha, sorgo forrajero, maíz para silo.",
    "• Cubren huecos de invierno o verano según la zona.",
    "",
    "**Campo natural mejorado**",
    "• Campo natural con fertilización, siembra en cobertura o control de malezas.",
    "",
    "Tip: en el mapa del predio podés anotar en cada potrero qué pastura tiene (en notas del potrero).",
  ].join("\n");
}

function respuestaLicencias(): string {
  return [
    "Todavía no hay un módulo de **licencias / vacaciones / ausencias** en SAG.",
    "Lo que sí podés consultar en RRHH es:",
    "• Empleados (funcionarios activos)",
    "• Sueldos / jornales cargados en presupuesto",
    "• Aguinaldos y salario vacacional (como gastos de remuneración)",
    "Si querés, preguntame por empleados, sueldos o aguinaldos.",
  ].join("\n");
}

function respuestaLecheria(): string {
  return [
    "En SAG **todavía no hay un módulo de lechería** (litros, sólidos, tambo).",
    "Igual, estos son los indicadores típicos de un tambo en Uruguay:",
    "",
    "**Producción**",
    "• Litros / vaca en ordeñe / día",
    "• Litros / ha / año",
    "• % de vacas en ordeñe sobre el rodeo lechero",
    "",
    "**Calidad**",
    "• % grasa y % proteína",
    "• UFC (unidades formadoras de colonias) y células somáticas",
    "",
    "**Reproducción y salud**",
    "• Intervalo parto–concepción",
    "• % preñez / % rechazo",
    "• Mastitis clínica y descarte",
    "",
    "**Económicos**",
    "• Precio por litro / por sólido",
    "• Costo de alimentación por litro",
    "• Margen sobre alimentación",
    "",
    "Tip: mientras tanto podés seguir stock, precios de ganado, agricultura y el estado de resultados en SAG.",
  ].join("\n");
}

function respuestaIndicadoresGanaderosGuia(extraLive?: string): string {
  const base = [
    "Indicadores ganaderos clave (Uruguay / cría–recria–invernada):",
    "",
    "**Estructura y carga**",
    "• Cabezas activas y desglose por sexo / categoría (terneros, vaquillonas, vacas, novillos)",
    "• Dotación: UG/ha (unidad ganadera por hectárea) y ocupación del potrero",
    "• Referencia orientativa: ~1 UG/ha ≈ carga media de cría; más alto en recría/invernada intensiva",
    "",
    "**Productividad**",
    "• % destete (terneros destetados / vacas entoradas)",
    "• Peso al destete y kg destetados / ha",
    "• Ganancia diaria (ADG) en recría e invernada",
    "",
    "**Sanidad y salidas**",
    "• Mortandad %, ventas, frigorífico, perdidos",
    "",
    "**Mercado**",
    "• Precio ACG gordo / reposición (USD/kg)",
  ];
  if (extraLive) {
    base.push("", "Datos de tu cuenta ahora:", extraLive);
  } else {
    base.push(
      "",
      "En SAG ya podés consultar stock activo, sexo, precios ACG y mapa/potreros. La dotación UG/ha se ve en el panel de stock por potrero del Inicio.",
    );
  }
  return base.join("\n");
}

function fmtPct(n: number): string {
  return n.toLocaleString("es-UY", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function fmtHa(n: number): string {
  return n.toLocaleString("es-UY", { maximumFractionDigits: 1 });
}

function fmtUyu(n: number): string {
  return n.toLocaleString("es-UY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function listarNombres(nombres: string[], max = 8): string {
  const limpios = nombres.map((n) => n.trim()).filter(Boolean);
  if (!limpios.length) return "";
  const head = limpios.slice(0, max);
  const extra = limpios.length - head.length;
  return head.map((n) => `• ${n}`).join("\n") + (extra > 0 ? `\n• …y ${extra} más` : "");
}

const STOP_WORDS_NOMBRE = new Set([
  "cuanto",
  "cuantos",
  "cuanta",
  "cuantas",
  "gana",
  "cobra",
  "percibe",
  "sueldo",
  "sueldos",
  "salario",
  "salarios",
  "jornal",
  "jornales",
  "banco",
  "bancos",
  "usa",
  "tiene",
  "del",
  "de",
  "la",
  "el",
  "los",
  "las",
  "un",
  "una",
  "empleado",
  "empleados",
  "funcionario",
  "funcionarios",
  "personal",
  "que",
  "cual",
  "cuales",
  "me",
  "decime",
  "dime",
  "mostrar",
  "mostrame",
  "es",
  "esta",
  "este",
  "hay",
  "para",
  "por",
  "con",
  "sin",
  "sobre",
  "en",
  "al",
  "a",
  "y",
  "o",
  "su",
  "sus",
  "mi",
  "cuenta",
  "bancaria",
  "sucursal",
  "numero",
  "nro",
]);

function extractNombreEmpleadoConsulta(pregunta: string): string {
  let t = normalizeText(pregunta);
  t = t
    .replace(/\b(cuanto gana|cuanto cobra|cuanto percibe|sueldo de|salario de|jornal de|banco de|banco usa|que banco|cual banco)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = t.split(" ").filter((w) => w && !STOP_WORDS_NOMBRE.has(w));
  return tokens.join(" ").trim();
}

function scoreNombreFuncionario(f: Funcionario, query: string): number {
  const q = normalizeText(query);
  if (!q) return 0;
  const nombre = normalizeText(f.nombre);
  const apellido = normalizeText(f.apellido);
  const full = `${nombre} ${apellido}`.trim();
  const fullRev = `${apellido} ${nombre}`.trim();
  const display = normalizeText(funcionariosDb.nombreFuncionarioDisplay(f));
  if (q === full || q === fullRev || q === display || q === apellido || q === nombre) return 100;
  if (full.includes(q) || fullRev.includes(q) || display.includes(q)) return 80;
  const qTokens = q.split(" ").filter(Boolean);
  if (!qTokens.length) return 0;
  let hits = 0;
  for (const tok of qTokens) {
    if (nombre.includes(tok) || apellido.includes(tok)) hits += 1;
  }
  if (hits === qTokens.length) return 70;
  if (hits > 0) return 40 + hits * 10;
  return 0;
}

async function findFuncionariosPorConsulta(
  db: Db,
  pregunta: string,
  cuentaId: number | null,
): Promise<{ matches: Funcionario[]; query: string }> {
  const query = extractNombreEmpleadoConsulta(pregunta);
  const cedula = funcionariosDb.normalizeCedula(pregunta);
  if (cedula.length >= 6 && cedula.length <= 8) {
    const byCi = await funcionariosDb.getFuncionarioByCedula(db, cedula, cuentaId);
    if (byCi) return { matches: [byCi], query: cedula };
  }
  if (!query) return { matches: [], query: "" };
  const todos = await funcionariosDb.listFuncionarios(db, { soloActivos: true }, cuentaId);
  const scored = todos
    .map((f) => ({ f, score: scoreNombreFuncionario(f, query) }))
    .filter((x) => x.score >= 40)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return { matches: [], query };
  const top = scored[0].score;
  const matches = scored.filter((x) => x.score >= top - 15).map((x) => x.f);
  return { matches, query };
}

function anioCalendarioRango(anio: number): { desde: string; hasta: string } {
  const hoy = todayIso();
  const desde = `${anio}-01-01`;
  const hastaFin = `${anio}-12-31`;
  return { desde, hasta: hastaFin < hoy ? hastaFin : hoy };
}

function esPlantillaRemuneracion(p: { rubro?: string; sub_rubro?: string; concepto?: string; funcionario_cedula?: string }): boolean {
  if (p.funcionario_cedula?.trim()) return true;
  return funcionariosDb.esRubroRemuneracion(p.rubro ?? "", p.sub_rubro ?? "") ||
    /sueldo|jornal|salario|aguinald|remunerac/i.test(p.concepto ?? "");
}

export interface AsistenteConsultaDeps {
  stockFilters: StockGanaderoFilters;
  resumenScope: ResumenEmpresaScope;
}

export async function consultarAsistente(
  db: Db,
  user: UserPublic,
  pregunta: string,
  deps: AsistenteConsultaDeps,
): Promise<AsistenteConsultaResult> {
  const intent = detectAsistenteIntent(pregunta);
  const sugerencias: string[] = [];

  if (intent === "ayuda") {
    return { intent, respuesta: respuestaAyuda(), sugerencias };
  }
  if (intent === "desconocido") {
    return { intent, respuesta: respuestaDesconocida(), sugerencias };
  }
  if (intent === "pasturas_uy") {
    return { intent, respuesta: respuestaPasturasUy(), sugerencias };
  }
  if (intent === "rrhh_licencias") {
    return { intent, respuesta: respuestaLicencias(), sugerencias };
  }
  if (intent === "indicadores_lecheria") {
    return { intent, respuesta: respuestaLecheria(), sugerencias };
  }

  if ((intent === "stock_activo" || intent === "stock_sexo" || intent === "indicadores_ganaderos") && !canAccess(user, "stock")) {
    return { intent, respuesta: sinPermiso("stock ganadero"), sugerencias };
  }
  if (
    (intent === "mapa_resumen" || intent === "mapa_objetos" || intent === "estancias") &&
    !canAccess(user, "stock")
  ) {
    return { intent, respuesta: sinPermiso("mapa de campo / stock"), sugerencias };
  }
  if (intent === "indicadores_agricolas" && !canAccess(user, "ventas")) {
    return { intent, respuesta: sinPermiso("ventas / agricultura"), sugerencias };
  }
  if (
    intent === "indicadores_financieros" &&
    !canAccess(user, "presupuesto")
  ) {
    return { intent, respuesta: sinPermiso("presupuesto / estado de resultados"), sugerencias };
  }
  if (
    (intent === "rrhh_empleados" ||
      intent === "rrhh_salarios" ||
      intent === "rrhh_sueldo_empleado" ||
      intent === "rrhh_banco_empleado" ||
      intent === "rrhh_aguinaldos") &&
    !canAccess(user, "rrhh")
  ) {
    return { intent, respuesta: sinPermiso("recursos humanos"), sugerencias };
  }
  if (
    intent === "rrhh_sueldos_pendientes" &&
    !canAccess(user, "rrhh") &&
    !canAccess(user, "presupuesto")
  ) {
    return { intent, respuesta: sinPermiso("recursos humanos o presupuesto"), sugerencias };
  }
  if (
    (intent === "gastos_mes" ||
      intent === "gastos_ejercicio" ||
      intent === "gastos_anio_vs_anterior") &&
    !canAccess(user, "presupuesto")
  ) {
    return { intent, respuesta: sinPermiso("presupuesto y gastos"), sugerencias };
  }
  if (intent === "precios_ganado" && !canAccess(user, "precios_ganado")) {
    return { intent, respuesta: sinPermiso("precios de ganado"), sugerencias };
  }
  if (intent === "divisas" && !canAccess(user, "divisas")) {
    return { intent, respuesta: sinPermiso("divisas"), sugerencias };
  }

  try {
    if (intent === "indicadores_financieros") {
      const { desde, hasta, label } = ejercicioVigenteRango(user);
      const er = await database.buildEstadoResultados({
        fecha_desde: desde,
        fecha_hasta: hasta,
        empresa: deps.resumenScope.empresa,
        empresas: deps.resumenScope.empresas,
        cuentaId: deps.resumenScope.cuenta_id ?? null,
      });
      const ventas = Number(er.ventas) || 0;
      const costos = Number(er.costos_produccion) || 0;
      const admin = Number(er.gastos_administrativos) || 0;
      const comercial = Number(er.gastos_comerciales) || 0;
      const utilidad = Number(er.utilidad) || 0;
      const gastosTot = costos + admin + comercial;
      const margen = ventas > 0 ? (utilidad / ventas) * 100 : null;
      const vd = er.ventas_detalle;
      return {
        intent,
        respuesta: [
          `Indicadores financieros · ejercicio **${label}** (${desde} → ${hasta}):`,
          "",
          `• Ventas totales: **USD ${fmtUsd(ventas)}**`,
          `  – Ganado: USD ${fmtUsd(Number(vd.ganado) || 0)}`,
          `  – Agricultura: USD ${fmtUsd(Number(vd.agricultura) || 0)}`,
          `  – Arrendamientos: USD ${fmtUsd(Number(vd.arrendamientos) || 0)}`,
          `• Costos de producción: **USD ${fmtUsd(costos)}**`,
          `• Gastos administrativos: **USD ${fmtUsd(admin)}**`,
          `• Gastos comerciales: **USD ${fmtUsd(comercial)}**`,
          `• Gastos totales: **USD ${fmtUsd(gastosTot)}**`,
          `• Utilidad: **USD ${fmtUsd(utilidad)}**${
            margen != null ? ` (margen ${margen >= 0 ? "+" : ""}${fmtPct(margen)}% sobre ventas)` : ""
          }`,
          "",
          "Fuente: Estado de resultados de SAG (ventas realizadas − gastos clasificados).",
        ].join("\n"),
        sugerencias,
      };
    }

    if (intent === "indicadores_ganaderos") {
      const [activos, dispositivos, ventasClaves] = await Promise.all([
        stockGanadero.countStockGanaderaDispositivosActivos(db, deps.stockFilters),
        stockGanadero.listStockGanaderaDispositivos(db, deps.stockFilters),
        listClavesDispositivosEnVentasCerradas(db),
      ]);
      const ventas = new Set(ventasClaves);
      const vivos = dispositivos.filter((d) => d.estado === "VIVO" && !ventas.has(d.clave));
      const sexo = contarSexo(vivos);
      const porCat = new Map<string, number>();
      for (const d of vivos) {
        const key = categoriaStockKey(d);
        const label =
          key === "VACA"
            ? "Vacas"
            : key === "TERNERA"
              ? "Terneras"
              : key === "TERNERO"
                ? "Terneros"
                : key === "VAQUILLONA_1_2" || key === "VAQUILLONA_MAS_2"
                  ? "Vaquillonas"
                  : key === "MACHO_1_2" || key === "MACHO_MAS_2"
                    ? "Novillos / toros"
                    : key === "SIN_SEXO"
                      ? "Sin sexo"
                      : "Sin edad";
        porCat.set(label, (porCat.get(label) ?? 0) + 1);
      }
      const catLines = [...porCat.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([lab, n]) => `  – ${lab}: ${fmtEntero(n)}`);
      const live = [
        `• Stock activo: **${fmtEntero(activos)}**`,
        `• Machos: **${fmtEntero(sexo.machos)}** · Hembras: **${fmtEntero(sexo.hembras)}**`,
        catLines.length ? `• Por categoría:\n${catLines.join("\n")}` : null,
        "• Dotación UG/ha: mirá el panel Stock por potrero en Inicio (se calcula con hectáreas del mapa).",
        "• Precios: preguntame «precio del novillo» o «precios ACG».",
      ]
        .filter(Boolean)
        .join("\n");
      return {
        intent,
        respuesta: respuestaIndicadoresGanaderosGuia(live),
        sugerencias,
      };
    }

    if (intent === "indicadores_agricolas") {
      const cuentaId = await empresasCuenta.resolveCuentaMadreIdForUser(db, user);
      const anio = new Date().getFullYear();
      const rows = await ventasAgricultura.listVentasAgricultura(db, {
        cuenta_id: cuentaId ?? undefined,
        empresas: deps.resumenScope.empresas,
        empresa: deps.resumenScope.empresa,
        anio,
      });
      if (!rows.length) {
        return {
          intent,
          respuesta: [
            `No hay ventas de agricultura cargadas para **${anio}**.`,
            "",
            "Indicadores agrícolas típicos que SAG puede mostrar cuando cargues zafra:",
            "• Hectáreas y cultivo (soja, trigo, maíz, etc.)",
            "• Rendimiento (ton/ha o kg/ha)",
            "• Precio USD/ton e importe",
            "• Pendiente de cobro vs venta realizada",
            "• Aporte de agricultura al estado de resultados",
          ].join("\n"),
          sugerencias,
        };
      }
      let ha = 0;
      let ton = 0;
      let usd = 0;
      let realizadas = 0;
      let pendientes = 0;
      const porCultivo = new Map<string, { ha: number; ton: number; usd: number; n: number }>();
      for (const r of rows) {
        const h = Number(r.real_hectareas ?? r.hectareas) || 0;
        const t = Number(r.real_total_ton ?? r.total_ton) || 0;
        const u = Number(r.real_importe_usd ?? r.importe_usd) || 0;
        ha += h;
        ton += t;
        usd += u;
        if (r.venta_realizada) realizadas += 1;
        else pendientes += 1;
        const c = String(r.cultivo || "Sin cultivo");
        const bucket = porCultivo.get(c) ?? { ha: 0, ton: 0, usd: 0, n: 0 };
        bucket.ha += h;
        bucket.ton += t;
        bucket.usd += u;
        bucket.n += 1;
        porCultivo.set(c, bucket);
      }
      const rend = ha > 0 ? ton / ha : 0;
      const usdHa = ha > 0 ? usd / ha : 0;
      const lines = [
        `Indicadores agrícolas · zafra / registros **${anio}**:`,
        `• Lotes: **${fmtEntero(rows.length)}** (${fmtEntero(realizadas)} realizados · ${fmtEntero(pendientes)} pendientes)`,
        `• Hectáreas: **${fmtHa(ha)} ha**`,
        `• Producción: **${fmtHa(ton)} ton**`,
        `• Rendimiento medio: **${fmtHa(rend)} ton/ha**`,
        `• Importe: **USD ${fmtUsd(usd)}** (${fmtUsd(usdHa)} USD/ha)`,
        "",
        "Por cultivo:",
      ];
      for (const [cultivo, b] of [...porCultivo.entries()].sort((a, b) => b[1].usd - a[1].usd)) {
        lines.push(
          `• **${cultivo}**: ${fmtHa(b.ha)} ha · ${fmtHa(b.ton)} ton · USD ${fmtUsd(b.usd)}`,
        );
      }
      return { intent, respuesta: lines.join("\n"), sugerencias };
    }

    if (intent === "mapa_resumen" || intent === "mapa_objetos" || intent === "estancias") {
      const cuentaId = await empresasCuenta.resolveCuentaMadreIdForUser(db, user);
      if (cuentaId == null) {
        return {
          intent,
          respuesta: "No pude identificar la cuenta para consultar el mapa.",
          sugerencias,
        };
      }

      const [potreros, elementos, operativas] = await Promise.all([
        campoPotreros.listCampoPotrerosMapa(db, cuentaId),
        campoElementos.listCampoMapaElementos(db, cuentaId),
        empresasCuenta.listEmpresasOperativas(db, cuentaId),
      ]);

      const porObjeto = new Map<string, { label: string; nombres: string[] }>();
      for (const el of elementos) {
        const tipo = objetoTipoDeElemento(el);
        if (!tipo) continue;
        const label = OBJETO_MAPA_LABELS[tipo] ?? tipo.replace(/_/g, " ");
        const bucket = porObjeto.get(tipo) ?? { label, nombres: [] };
        if (el.nombre.trim()) bucket.nombres.push(el.nombre.trim());
        else bucket.nombres.push(`(sin nombre #${el.id})`);
        porObjeto.set(tipo, bucket);
      }

      const estanciasMapa = elementos.filter(esMarcadorEstancia);
      const empresasActivas = operativas.filter((e) => e.activo);

      if (intent === "mapa_objetos") {
        const foco = detectObjetoMapaConsulta(pregunta);
        if (foco) {
          const bucket = porObjeto.get(foco);
          const label = OBJETO_MAPA_LABELS[foco] ?? foco;
          if (!bucket?.nombres.length) {
            return {
              intent,
              respuesta: `En el mapa no hay **${label}** cargados todavía. Podés agregarlos desde el módulo Mapa de campo.`,
              sugerencias,
            };
          }
          return {
            intent,
            respuesta: [
              `En el mapa hay **${fmtEntero(bucket.nombres.length)}** ${label}:`,
              listarNombres(bucket.nombres),
            ].join("\n"),
            sugerencias,
          };
        }

        if (!porObjeto.size) {
          return {
            intent,
            respuesta:
              "En el mapa todavía no hay objetos de infraestructura (bebederos, porteras, molinos, etc.). Cargalos desde Mapa de campo.",
            sugerencias,
          };
        }
        const lines = ["Infraestructura del predio en el mapa:"];
        for (const bucket of porObjeto.values()) {
          lines.push(`• ${bucket.label}: **${fmtEntero(bucket.nombres.length)}**`);
        }
        return { intent, respuesta: lines.join("\n"), sugerencias };
      }

      if (intent === "estancias") {
        const lines: string[] = [];
        if (empresasActivas.length) {
          lines.push(
            `Empresas / campos operativos de la cuenta: **${fmtEntero(empresasActivas.length)}**`,
          );
          lines.push(listarNombres(empresasActivas.map((e) => e.nombre)));
        } else {
          lines.push("No hay empresas operativas activas cargadas en la cuenta.");
        }
        lines.push("");
        if (estanciasMapa.length) {
          lines.push(
            `Ubicaciones / estancias marcadas en el mapa: **${fmtEntero(estanciasMapa.length)}**`,
          );
          lines.push(
            listarNombres(estanciasMapa.map((e) => e.nombre || `Marcador #${e.id}`)),
          );
        } else {
          lines.push(
            "En el mapa no hay marcadores de estancia/ubicación (marcador sin tipo de objeto).",
          );
        }
        return { intent, respuesta: lines.join("\n"), sugerencias };
      }

      // mapa_resumen
      const haTotal = potreros.reduce((s, p) => s + (Number(p.hectareas) || 0), 0);
      const lines: string[] = [
        `Resumen del mapa de campo:`,
        `• Potreros: **${fmtEntero(potreros.length)}**`,
      ];
      if (haTotal > 0) lines.push(`• Hectáreas cargadas: **${fmtHa(haTotal)} ha**`);
      if (estanciasMapa.length) {
        lines.push(`• Estancias / ubicaciones: **${fmtEntero(estanciasMapa.length)}**`);
      }
      if (empresasActivas.length) {
        lines.push(`• Empresas operativas: **${fmtEntero(empresasActivas.length)}**`);
      }
      if (porObjeto.size) {
        lines.push("• Infraestructura:");
        for (const bucket of porObjeto.values()) {
          lines.push(`  – ${bucket.label}: ${fmtEntero(bucket.nombres.length)}`);
        }
      } else {
        lines.push("• Infraestructura: sin bebederos/porteras/etc. cargados aún.");
      }
      if (potreros.length) {
        lines.push("");
        lines.push("Potreros:");
        lines.push(
          listarNombres(
            potreros.map((p) =>
              p.hectareas != null && Number(p.hectareas) > 0
                ? `${p.nombre} (${fmtHa(Number(p.hectareas))} ha)`
                : p.nombre,
            ),
          ),
        );
      }
      return { intent, respuesta: lines.join("\n"), sugerencias };
    }

    if (
      intent === "rrhh_empleados" ||
      intent === "rrhh_salarios" ||
      intent === "rrhh_aguinaldos" ||
      intent === "rrhh_sueldo_empleado" ||
      intent === "rrhh_banco_empleado" ||
      intent === "rrhh_sueldos_pendientes"
    ) {
      const cuentaId = await empresasCuenta.resolveCuentaMadreIdForUser(db, user);

      if (intent === "rrhh_empleados") {
        const funcionarios = await funcionariosDb.listFuncionarios(
          db,
          { soloActivos: true },
          cuentaId,
        );
        if (!funcionarios.length) {
          return {
            intent,
            respuesta: "No hay empleados activos cargados en RRHH.",
            sugerencias,
          };
        }
        const nombres = funcionarios.map((f) =>
          `${f.apellido}, ${f.nombre}`.replace(/^,\s*|,\s*$/g, "").trim(),
        );
        return {
          intent,
          respuesta: [
            `Empleados activos en RRHH: **${fmtEntero(funcionarios.length)}**`,
            listarNombres(nombres),
          ].join("\n"),
          sugerencias,
        };
      }

      if (intent === "rrhh_banco_empleado" || intent === "rrhh_sueldo_empleado") {
        const { matches, query } = await findFuncionariosPorConsulta(db, pregunta, cuentaId);
        if (!matches.length) {
          return {
            intent,
            respuesta: query
              ? `No encontré un empleado activo que coincida con «${query}». Probá con apellido y nombre, o la cédula.`
              : "Decime el nombre o la cédula del empleado. Ej.: «¿cuánto gana Pérez?» o «¿qué banco usa María Gómez?»",
            sugerencias,
          };
        }
        if (matches.length > 1) {
          return {
            intent,
            respuesta: [
              "Encontré más de un empleado. ¿A cuál te referís?",
              listarNombres(
                matches.map((f) => funcionariosDb.nombreFuncionarioDisplay(f)),
                10,
              ),
            ].join("\n"),
            sugerencias,
          };
        }

        const f = matches[0];
        const nombre = funcionariosDb.nombreFuncionarioDisplay(f);

        if (intent === "rrhh_banco_empleado") {
          const banco = (f.banco || "").trim();
          const cuenta = (f.cuenta || "").trim();
          const sucursal = (f.sucursal || "").trim();
          const tipo = (f.tipo_cuenta || "").trim();
          if (!banco && !cuenta) {
            return {
              intent,
              respuesta: `**${nombre}** no tiene banco ni cuenta cargados en RRHH.`,
              sugerencias,
            };
          }
          return {
            intent,
            respuesta: [
              `Datos bancarios de **${nombre}**:`,
              `• Banco: **${banco || "—"}**`,
              sucursal ? `• Sucursal: ${sucursal}` : null,
              cuenta ? `• Cuenta: ${cuenta}` : null,
              tipo ? `• Tipo de cuenta: ${tipo}` : null,
              f.titular_cuenta?.trim() ? `• Titular: ${f.titular_cuenta.trim()}` : null,
            ]
              .filter(Boolean)
              .join("\n"),
            sugerencias,
          };
        }

        // rrhh_sueldo_empleado
        const anio = new Date().getFullYear();
        const resumen = await rrhhPagos.listPagosPorCedula(
          db,
          f.cedula,
          { fecha_desde: `${anio}-01-01`, fecha_hasta: todayIso() },
          cuentaId,
        );
        if (!resumen.total_registros) {
          return {
            intent,
            respuesta: [
              `**${nombre}** (CI ${funcionariosDb.formatCedulaDisplay(f.cedula)}): no hay pagos de remuneración cargados en ${anio}.`,
              "Los sueldos se toman de los gastos de presupuesto vinculados al funcionario.",
            ].join("\n"),
            sugerencias,
          };
        }
        const ultimo = resumen.pagos[0];
        const sueldos = resumen.por_rubro.filter((r) =>
          /sueldo|jornal|salario/i.test(`${r.rubro} ${r.sub_rubro}`),
        );
        const lines = [
          `Remuneraciones de **${nombre}** en ${anio} (hasta hoy):`,
          `• Pagos: **${fmtEntero(resumen.total_registros)}**`,
          `• Total pesos: **$ ${fmtUyu(resumen.total_pesos)}**`,
          `• Equivalente USD: **USD ${fmtUsd(resumen.total_saldo_usd)}**`,
        ];
        if (sueldos.length) {
          lines.push("• Por rubro (sueldos/jornales):");
          for (const r of sueldos.slice(0, 5)) {
            const label = [r.rubro, r.sub_rubro].filter(Boolean).join(" / ");
            lines.push(
              `  – ${label}: $ ${fmtUyu(r.total_pesos)} (${fmtEntero(r.cantidad)} pagos)`,
            );
          }
        }
        if (ultimo) {
          lines.push(
            `• Último pago: ${ultimo.fecha} · $ ${fmtUyu(ultimo.pesos)} · ${ultimo.concepto || ultimo.rubro}`,
          );
        }
        return { intent, respuesta: lines.join("\n"), sugerencias };
      }

      if (intent === "rrhh_sueldos_pendientes") {
        if (cuentaId == null) {
          return {
            intent,
            respuesta: "No pude identificar la cuenta para ver sueldos pendientes.",
            sugerencias,
          };
        }
        await gastosAuto.syncGastoAutomatizacionPendientes(db, cuentaId);
        const pendientes = await gastosAuto.listGastoAutoPendientes(db, cuentaId, {
          soloPendientes: true,
        });
        const sueldosPend = pendientes.filter((p) => esPlantillaRemuneracion(p.plantilla));
        const mesLabel = new Date().toLocaleDateString("es-UY", {
          month: "long",
          year: "numeric",
        });
        if (!sueldosPend.length) {
          return {
            intent,
            respuesta: [
              `No hay sueldos/remuneraciones pendientes de aprobar para **${mesLabel}**.`,
              "Se miran las automatizaciones de gastos de personal que todavía no se aprobaron este mes.",
            ].join("\n"),
            sugerencias,
          };
        }
        let totalPesos = 0;
        let totalUsd = 0;
        const lines = [
          `Sueldos / remuneraciones pendientes este mes (**${mesLabel}**): **${fmtEntero(sueldosPend.length)}**`,
        ];
        for (const p of sueldosPend.slice(0, 10)) {
          const pl = p.plantilla;
          totalPesos += Number(pl.pesos) || 0;
          totalUsd += Number(pl.saldo_usd) || 0;
          const quien =
            pl.funcionario_cedula?.trim()
              ? `CI ${funcionariosDb.formatCedulaDisplay(pl.funcionario_cedula)}`
              : pl.razon_social_proveedor || pl.nombre || "sin titular";
          lines.push(
            `• ${p.fecha_programada} · ${quien} · $ ${fmtUyu(Number(pl.pesos) || 0)} · ${pl.concepto || pl.rubro}`,
          );
        }
        if (sueldosPend.length > 10) {
          lines.push(`• …y ${sueldosPend.length - 10} más`);
        }
        lines.push(
          `Total estimado: **$ ${fmtUyu(totalPesos)}** (USD ${fmtUsd(totalUsd)}).`,
        );
        lines.push("Podés aprobarlos desde Inicio → Pendientes de automatización, o en Presupuesto.");
        return { intent, respuesta: lines.join("\n"), sugerencias };
      }

      const anio = new Date().getFullYear();
      const desde = `${anio}-01-01`;
      const hasta = todayIso();

      if (intent === "rrhh_salarios") {
        const dash = await rrhhPagos.resumenDashboardRRHH(db, cuentaId, {
          fecha_desde: desde,
          fecha_hasta: hasta,
        });
        return {
          intent,
          respuesta: [
            `Remuneraciones ${anio} (hasta hoy):`,
            `• Empleados activos: **${fmtEntero(dash.funcionarios_activos)}**`,
            `• Pagos registrados: **${fmtEntero(dash.pagos_periodo.total_registros)}**`,
            `• Total en pesos: **$ ${fmtUyu(dash.pagos_periodo.total_pesos)}**`,
            `• Equivalente USD: **USD ${fmtUsd(dash.pagos_periodo.total_saldo_usd)}**`,
            `• Funcionarios con pagos en el período: **${fmtEntero(dash.pagos_periodo.funcionarios_con_pagos)}**`,
            "Incluye sueldos, jornales, aguinaldos y otras remuneraciones cargadas en presupuesto.",
          ].join("\n"),
          sugerencias,
        };
      }

      // aguinaldos
      let queryAgu = `SELECT COUNT(*) AS n,
        COALESCE(SUM(pesos),0) AS pesos,
        COALESCE(SUM(saldo_usd),0) AS saldo_usd
        FROM PRESUPUESTO
        WHERE (
          lower(sub_rubro) LIKE '%aguinald%'
          OR lower(concepto) LIKE '%aguinald%'
          OR lower(rubro) LIKE '%aguinald%'
        )`;
      const paramsAgu: Record<string, string | number> = {
        fecha_desde: desde,
        fecha_hasta: hasta,
      };
      queryAgu += " AND fecha >= @fecha_desde AND fecha <= @fecha_hasta";
      if (cuentaId != null) {
        queryAgu += " AND cuenta_id = @cuenta_id";
        paramsAgu.cuenta_id = cuentaId;
      }
      const agu = (await db.prepare(queryAgu).get(paramsAgu)) as {
        n: number;
        pesos: number;
        saldo_usd: number;
      };
      const lines = [
        `Aguinaldos ${anio} (hasta hoy):`,
        `• Registros: **${fmtEntero(Number(agu?.n || 0))}**`,
        `• Total en pesos: **$ ${fmtUyu(Number(agu?.pesos || 0))}**`,
        `• Equivalente USD: **USD ${fmtUsd(Number(agu?.saldo_usd || 0))}**`,
      ];
      if (!Number(agu?.n || 0)) {
        lines.push(
          "No hay movimientos de aguinaldo cargados en este período. Se buscan en rubro/sub-rubro/concepto de presupuesto.",
        );
      }
      return { intent, respuesta: lines.join("\n"), sugerencias };
    }

    if (intent === "stock_activo") {
      const categoria = detectCategoriaStockConsulta(pregunta);
      if (categoria) {
        const [dispositivos, ventasClaves] = await Promise.all([
          stockGanadero.listStockGanaderaDispositivos(db, deps.stockFilters),
          listClavesDispositivosEnVentasCerradas(db),
        ]);
        const ventas = new Set(ventasClaves);
        const activos = dispositivos.filter((d) => d.estado === "VIVO" && !ventas.has(d.clave));
        const keySet = new Set(categoria.keys);
        const porCat = activos.filter((d) => keySet.has(categoriaStockKey(d))).length;
        const totalActivos = activos.length;
        return {
          intent,
          respuesta: [
            `En tu cuenta hay **${fmtEntero(porCat)}** ${categoria.labelPlural} en stock activo.`,
            `Total de animales activos: **${fmtEntero(totalActivos)}**.`,
            "La categoría se calcula por sexo y edad (misma regla que el stock). Solo vivos, sin ventas cerradas.",
          ].join("\n"),
          sugerencias,
        };
      }

      const activos = await stockGanadero.countStockGanaderaDispositivosActivos(
        db,
        deps.stockFilters,
      );
      const total = await stockGanadero.countStockGanaderaDispositivos(db, deps.stockFilters);
      return {
        intent,
        respuesta: [
          `En tu cuenta hay **${fmtEntero(activos)}** animales activos en stock ganadero.`,
          total !== activos
            ? `Dispositivos totales registrados (incluye bajas/ventas): ${fmtEntero(total)}.`
            : null,
          "Solo se cuentan vivos y se excluyen los vinculados a ventas cerradas.",
        ]
          .filter(Boolean)
          .join("\n"),
        sugerencias,
      };
    }

    if (intent === "stock_sexo") {
      const [dispositivos, ventasClaves] = await Promise.all([
        stockGanadero.listStockGanaderaDispositivos(db, deps.stockFilters),
        listClavesDispositivosEnVentasCerradas(db),
      ]);
      const ventas = new Set(ventasClaves);
      const activos = dispositivos.filter((d) => d.estado === "VIVO" && !ventas.has(d.clave));
      const sexo = contarSexo(activos);
      const total = activos.length;
      return {
        intent,
        respuesta: [
          `Stock activo de tu cuenta: **${fmtEntero(total)}** animales.`,
          `• Machos: **${fmtEntero(sexo.machos)}**`,
          `• Hembras: **${fmtEntero(sexo.hembras)}**`,
          sexo.sinDefinir > 0 ? `• Sin sexo definido: **${fmtEntero(sexo.sinDefinir)}**` : null,
        ]
          .filter(Boolean)
          .join("\n"),
        sugerencias,
      };
    }

    if (intent === "gastos_mes") {
      const { desde, hasta, label } = mesActualRango();
      const [porEmpresa, porRubro] = await Promise.all([
        database.resumenPorEmpresa(desde, hasta, deps.resumenScope),
        database.resumenPorRubro(deps.resumenScope, desde, hasta),
      ]);
      const total = totalGastosUsd(porEmpresa, porRubro);
      return {
        intent,
        respuesta: `Gastos de **${label}** (hasta hoy): **USD ${fmtUsd(total)}** (equivalente; UYU y BRL convertidos a USD).`,
        sugerencias,
      };
    }

    if (intent === "gastos_anio_vs_anterior") {
      const anioActual = new Date().getFullYear();
      const anioAnt = anioActual - 1;
      const rActual = anioCalendarioRango(anioActual);
      const rAnt = anioCalendarioRango(anioAnt);
      const [[empAct, rubAct], [empAnt, rubAnt]] = await Promise.all([
        Promise.all([
          database.resumenPorEmpresa(rActual.desde, rActual.hasta, deps.resumenScope),
          database.resumenPorRubro(deps.resumenScope, rActual.desde, rActual.hasta),
        ]),
        Promise.all([
          database.resumenPorEmpresa(rAnt.desde, rAnt.hasta, deps.resumenScope),
          database.resumenPorRubro(deps.resumenScope, rAnt.desde, rAnt.hasta),
        ]),
      ]);
      const totalAct = totalGastosUsd(empAct, rubAct);
      const totalAnt = totalGastosUsd(empAnt, rubAnt);
      const diff = totalAct - totalAnt;
      const pct = totalAnt > 0 ? (diff / totalAnt) * 100 : null;
      const signo = diff > 0 ? "más" : diff < 0 ? "menos" : "igual";
      return {
        intent,
        respuesta: [
          `Gastos calendario **${anioActual}** vs **${anioAnt}** (USD equivalente):`,
          `• ${anioActual} (hasta hoy): **USD ${fmtUsd(totalAct)}**`,
          `• ${anioAnt} (año completo o hasta la misma fecha si aplica): **USD ${fmtUsd(totalAnt)}**`,
          diff === 0
            ? `• Diferencia: sin cambios.`
            : `• Diferencia: **USD ${fmtUsd(Math.abs(diff))}** ${signo}${
                pct != null ? ` (${pct > 0 ? "+" : ""}${pct.toFixed(1)}%)` : ""
              }.`,
        ].join("\n"),
        sugerencias,
      };
    }

    if (intent === "gastos_ejercicio") {
      const { desde, hasta, label } = ejercicioVigenteRango(user);
      const [porEmpresa, porRubro] = await Promise.all([
        database.resumenPorEmpresa(desde, hasta, deps.resumenScope),
        database.resumenPorRubro(deps.resumenScope, desde, hasta),
      ]);
      const total = totalGastosUsd(porEmpresa, porRubro);
      return {
        intent,
        respuesta: `Gastos del ejercicio **${label}** (desde ${desde} hasta ${hasta}): **USD ${fmtUsd(total)}**.`,
        sugerencias,
      };
    }

    if (intent === "precios_ganado") {
      const [gordoRows, repoRows] = await Promise.all([
        preciosGanado.listPreciosGanado(db, { segmento: "GORDO" }),
        preciosGanado.listPreciosGanado(db, { segmento: "REPOSICION" }),
      ]);
      const ultimaGordo = preciosGanado.pivotSemanas(gordoRows)[0] ?? null;
      const ultimaRepo = preciosGanado.pivotSemanas(repoRows)[0] ?? null;
      if (!ultimaGordo && !ultimaRepo) {
        return {
          intent,
          respuesta:
            "Todavía no hay precios de ganado cargados. Actualizalos desde el módulo Precios de Ganado (importación ACG).",
          sugerencias,
        };
      }
      const lines: string[] = ["Últimos precios de mercado (ACG / catálogo local):"];
      if (ultimaGordo) {
        const p = ultimaGordo.precios;
        lines.push(
          `**Gordo** · semana ${ultimaGordo.semana}/${ultimaGordo.anio} (${ultimaGordo.fecha_desde} → ${ultimaGordo.fecha_hasta})`,
        );
        if (p.NOVILLO != null) lines.push(`• Novillo: USD ${fmtUsd(p.NOVILLO)}/kg`);
        if (p.VACA != null) lines.push(`• Vaca: USD ${fmtUsd(p.VACA)}/kg`);
        if (p.VAQUILLONA != null) lines.push(`• Vaquillona: USD ${fmtUsd(p.VAQUILLONA)}/kg`);
      }
      if (ultimaRepo) {
        const p = ultimaRepo.precios;
        lines.push(
          `**Reposición** · semana ${ultimaRepo.semana}/${ultimaRepo.anio} (${ultimaRepo.fecha_desde} → ${ultimaRepo.fecha_hasta})`,
        );
        if (p.TERNERO != null) lines.push(`• Ternero: USD ${fmtUsd(p.TERNERO)}/kg`);
        if (p.TERNERA != null) lines.push(`• Ternera: USD ${fmtUsd(p.TERNERA)}/kg`);
        if (p.VACA_INVERNADA != null) {
          lines.push(`• Vaca invernada: USD ${fmtUsd(p.VACA_INVERNADA)}/kg`);
        }
      }
      return { intent, respuesta: lines.join("\n"), sugerencias };
    }

    if (intent === "divisas") {
      const indicadores = await divisasDb.getIndicadoresPorPar(db, "UYU_USD");
      const ultimo = indicadores.ultimo;
      if (!ultimo) {
        return {
          intent,
          respuesta:
            "No hay tipo de cambio USD/UYU cargado. Actualizalo desde el módulo Divisas.",
          sugerencias,
        };
      }
      const lines = [
        `Dólar (UYU por 1 USD): **${fmtUsd(ultimo.valor)}**`,
        `Fecha del TC: ${ultimo.fecha}`,
      ];
      if (indicadores.promedio_mes) {
        lines.push(
          `Promedio del mes ${indicadores.promedio_mes.mes}: ${fmtUsd(indicadores.promedio_mes.valor)} (${indicadores.promedio_mes.dias} días)`,
        );
      }
      return { intent, respuesta: lines.join("\n"), sugerencias };
    }
  } catch (err) {
    console.error("[SGG] asistente consultar:", err);
    return {
      intent,
      respuesta:
        "No pude completar esa consulta ahora. Probá de nuevo o abrí el módulo correspondiente.",
      sugerencias,
    };
  }

  return { intent: "desconocido", respuesta: respuestaDesconocida(), sugerencias };
}
