import fs from "fs";
import path from "path";
import { scgDataPath } from "./data-dir.js";

export interface CuotaPrimariaRural {
  cuota: number;
  fecha: string;
}

export type RegimenPrimariaRuralKey = "con_explotacion" | "sin_explotacion";

export interface RegimenPrimariaRuralConfig {
  label: string;
  detalle: string;
  cuotas: CuotaPrimariaRural[];
}

export interface PrimariaRuralCalendarioConfig {
  anio: number;
  titulo: string;
  subtitulo: string;
  fuenteUrl: string;
  fuenteUrlPadrones: string;
  fuenteUrlDj: string;
  fuenteUrlPago: string;
  fuenteNota: string;
  declaracionJuradaFecha: string;
  declaracionJuradaNota: string;
  boletoNota: string;
  exoneracionNota: string;
  regimens: Record<RegimenPrimariaRuralKey, RegimenPrimariaRuralConfig>;
}

export interface PrimariaRuralCalendariosStore {
  updatedAt: string;
  updatedBy: string;
  calendario: PrimariaRuralCalendarioConfig;
}

const STORE_FILE = path.join(scgDataPath(), "primaria-rural-calendarios.json");

let cachedStore: PrimariaRuralCalendariosStore | null = null;
let cachedStoreMtime = -1;

function readStoreFromDisk(): PrimariaRuralCalendariosStore {
  const defaults = defaultPrimariaRuralCalendarios();
  try {
    if (!fs.existsSync(STORE_FILE)) return defaults;
    const raw = fs.readFileSync(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as PrimariaRuralCalendariosStore;
    const merged: PrimariaRuralCalendariosStore = {
      ...parsed,
      calendario: {
        ...defaults.calendario,
        ...parsed.calendario,
        regimens: {
          con_explotacion: {
            ...defaults.calendario.regimens.con_explotacion,
            ...parsed.calendario?.regimens?.con_explotacion,
          },
          sin_explotacion: {
            ...defaults.calendario.regimens.sin_explotacion,
            ...parsed.calendario?.regimens?.sin_explotacion,
          },
        },
      },
    };
    if (validatePrimariaRuralCalendarios(merged)) {
      return defaults;
    }
    return merged;
  } catch {
    return defaults;
  }
}

export function defaultPrimariaRuralCalendarios(): PrimariaRuralCalendariosStore {
  return {
    updatedAt: "",
    updatedBy: "",
    calendario: {
      anio: 2026,
      titulo: "Impuesto de Enseñanza Primaria",
      subtitulo: "DGI · Padrones rurales · Uruguay (calendario nacional)",
      fuenteUrl:
        "https://www.gub.uy/direccion-general-impositiva/impuesto-primaria/sobre-pagos/vencimientos",
      fuenteUrlPadrones:
        "https://www.gub.uy/direccion-general-impositiva/impuesto-primaria/padrones-rurales",
      fuenteUrlDj:
        "https://www.gub.uy/direccion-general-impositiva/impuesto-primaria/padrones-rurales/padrones-rurales-informacion-para-presentar-declaracion-jurada",
      fuenteUrlPago:
        "https://www.gub.uy/direccion-general-impositiva/impuesto-primaria/sobre-pagos",
      fuenteNota:
        "Impuesto administrado por la Dirección General Impositiva (DGI) sobre padrones rurales. Se paga en tres cuotas anuales mediante boleto 2/908 (códigos agrupados 38: 450 Primaria, 821 multa, 822 recargos). El mes del boleto es enero del ejercicio que se paga, igual para las tres cuotas. Pago por internet o redes de cobranza habilitadas.",
      declaracionJuradaFecha: "2026-04-30",
      declaracionJuradaNota:
        "Padrones rurales con explotación agropecuaria: presentar declaración jurada (formulario 3981 en línea con datos precargados, o Sigma en medios magnéticos) hasta el 30 de abril de 2026. Resolución Nº 9495/2017.",
      boletoNota:
        "Boleto de pago 2/908 · código agrupado 38 (450 Impuesto Primaria, 821 multa, 822 recargos). Mes: enero · Año: ejercicio fiscal.",
      exoneracionNota:
        "Exoneración posible para explotaciones entre 200 y 300 ha índice CONEAT 100 que cumplan requisitos (declaración jurada antes del 30/04). Obligatorio pagar si el conjunto de padrones con explotación supera 300 ha índice CONEAT 100.",
      regimens: {
        con_explotacion: {
          label: "Con explotación agropecuaria",
          detalle:
            "Padrones afectados directa o indirectamente a explotaciones agropecuarias. Tres cuotas con vencimiento fijo. Requiere declaración jurada anual.",
          cuotas: [
            { cuota: 1, fecha: "2026-05-29" },
            { cuota: 2, fecha: "2026-08-31" },
            { cuota: 3, fecha: "2026-10-30" },
          ],
        },
        sin_explotacion: {
          label: "Sin explotación agropecuaria",
          detalle:
            "Padrones rurales sin explotación ni declarados para autoconsumo en BPS. Régimen asimilado al urbano: ventanas de pago por cuota (fechas indicadas son el último día del período).",
          cuotas: [
            { cuota: 1, fecha: "2026-05-29" },
            { cuota: 2, fecha: "2026-08-31" },
            { cuota: 3, fecha: "2026-10-30" },
          ],
        },
      },
    },
  };
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validateRegimen(
  key: string,
  regimen: RegimenPrimariaRuralConfig | undefined,
): string | null {
  if (!regimen) return `Falta el régimen ${key} de Primaria rural.`;
  if (!Array.isArray(regimen.cuotas) || regimen.cuotas.length === 0) {
    return `Indicá al menos una cuota en régimen ${key} de Primaria rural.`;
  }
  for (const item of regimen.cuotas) {
    if (!Number.isInteger(item.cuota) || item.cuota < 1) {
      return `Número de cuota inválido en régimen ${key} de Primaria rural.`;
    }
    if (!isIsoDate(String(item.fecha ?? "").trim())) {
      return `Fecha inválida en cuota ${item.cuota} (${key}) de Primaria rural.`;
    }
  }
  return null;
}

export function validatePrimariaRuralCalendarios(input: PrimariaRuralCalendariosStore): string | null {
  const c = input.calendario;
  if (!c) return "Falta el calendario de Primaria rural.";
  const anio = Number(c.anio);
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
    return "Ejercicio de Primaria rural inválido.";
  }
  for (const url of [c.fuenteUrl, c.fuenteUrlPadrones, c.fuenteUrlDj, c.fuenteUrlPago]) {
    const trimmed = String(url ?? "").trim();
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      return "Los links oficiales deben comenzar con http:// o https://.";
    }
  }
  if (!isIsoDate(String(c.declaracionJuradaFecha ?? "").trim())) {
    return "Fecha de declaración jurada inválida.";
  }
  for (const key of ["con_explotacion", "sin_explotacion"] as const) {
    const err = validateRegimen(key, c.regimens?.[key]);
    if (err) return err;
  }
  return null;
}

export function loadPrimariaRuralCalendarios(): PrimariaRuralCalendariosStore {
  try {
    if (!fs.existsSync(STORE_FILE)) {
      if (!cachedStore) cachedStore = defaultPrimariaRuralCalendarios();
      return cachedStore;
    }
    const mtime = fs.statSync(STORE_FILE).mtimeMs;
    if (cachedStore && mtime === cachedStoreMtime) return cachedStore;
    cachedStore = readStoreFromDisk();
    cachedStoreMtime = mtime;
    return cachedStore;
  } catch {
    if (!cachedStore) cachedStore = defaultPrimariaRuralCalendarios();
    return cachedStore;
  }
}

export function savePrimariaRuralCalendarios(
  input: PrimariaRuralCalendariosStore,
  updatedBy: string,
): PrimariaRuralCalendariosStore {
  const err = validatePrimariaRuralCalendarios(input);
  if (err) throw new Error(err);

  const store: PrimariaRuralCalendariosStore = {
    ...input,
    updatedAt: new Date().toISOString(),
    updatedBy: updatedBy.trim().slice(0, 200),
  };
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), "utf8");
  cachedStore = store;
  try {
    cachedStoreMtime = fs.statSync(STORE_FILE).mtimeMs;
  } catch {
    cachedStoreMtime = Date.now();
  }
  return store;
}
