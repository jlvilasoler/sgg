import fs from "fs";
import path from "path";
import { scgDataPath } from "./data-dir.js";

export interface CuotaPatenteSucive {
  cuota: number;
  fecha: string;
}

export interface PatenteSuciveCalendarioConfig {
  anio: number;
  titulo: string;
  subtitulo: string;
  fuenteUrl: string;
  fuenteUrlPago: string;
  fuenteNota: string;
  primeraCuotaPagoContado: boolean;
  cuotas: CuotaPatenteSucive[];
}

export interface PatenteSuciveCalendariosStore {
  updatedAt: string;
  updatedBy: string;
  calendario: PatenteSuciveCalendarioConfig;
}

const STORE_FILE = path.join(scgDataPath(), "patente-sucive-calendarios.json");

let cachedStore: PatenteSuciveCalendariosStore | null = null;
let cachedStoreMtime = -1;

function readStoreFromDisk(): PatenteSuciveCalendariosStore {
  const defaults = defaultPatenteSuciveCalendarios();
  try {
    if (!fs.existsSync(STORE_FILE)) return defaults;
    const raw = fs.readFileSync(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as PatenteSuciveCalendariosStore;
    const merged: PatenteSuciveCalendariosStore = {
      ...parsed,
      calendario: { ...defaults.calendario, ...parsed.calendario },
    };
    if (validatePatenteSuciveCalendarios(merged)) {
      return defaults;
    }
    return merged;
  } catch {
    return defaults;
  }
}

export function defaultPatenteSuciveCalendarios(): PatenteSuciveCalendariosStore {
  return {
    updatedAt: "",
    updatedBy: "",
    calendario: {
      anio: 2026,
      titulo: "Patente de rodados",
      subtitulo: "SUCIVE · Uruguay (calendario nacional)",
      fuenteUrl: "https://montevideo.gub.uy/areas-tematicas/movilidad/patente-de-rodados",
      fuenteUrlPago: "https://www.sucive.gub.uy/consulta_patente",
      fuenteNota:
        "Calendario único para todo el país (SUCIVE). Pago contado anual: 20% de descuento hasta el vencimiento de la 1ª cuota. Cuotas bimestrales: 10% de bonificación por pago en fecha. Pagos: sucive.gub.uy · Abitab · Red Pagos · Correo. Si el vencimiento cae en sábado, domingo o feriado, no hay multas hasta el primer día hábil.",
      primeraCuotaPagoContado: true,
      cuotas: [
        { cuota: 1, fecha: "2026-01-20" },
        { cuota: 2, fecha: "2026-03-20" },
        { cuota: 3, fecha: "2026-05-20" },
        { cuota: 4, fecha: "2026-07-20" },
        { cuota: 5, fecha: "2026-09-21" },
        { cuota: 6, fecha: "2026-11-20" },
      ],
    },
  };
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function validatePatenteSuciveCalendarios(input: PatenteSuciveCalendariosStore): string | null {
  const c = input.calendario;
  if (!c) return "Falta el calendario de patente SUCIVE.";
  const anio = Number(c.anio);
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
    return "Ejercicio de patente inválido.";
  }
  for (const url of [c.fuenteUrl, c.fuenteUrlPago]) {
    const trimmed = String(url ?? "").trim();
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      return "Los links oficiales deben comenzar con http:// o https://.";
    }
  }
  if (!Array.isArray(c.cuotas) || c.cuotas.length === 0) {
    return "Indicá al menos una cuota de patente.";
  }
  for (const item of c.cuotas) {
    if (!Number.isInteger(item.cuota) || item.cuota < 1) {
      return "Número de cuota de patente inválido.";
    }
    if (!isIsoDate(String(item.fecha ?? "").trim())) {
      return `Fecha inválida en cuota ${item.cuota} de patente.`;
    }
  }
  return null;
}

export function loadPatenteSuciveCalendarios(): PatenteSuciveCalendariosStore {
  try {
    if (!fs.existsSync(STORE_FILE)) {
      if (!cachedStore) cachedStore = defaultPatenteSuciveCalendarios();
      return cachedStore;
    }
    const mtime = fs.statSync(STORE_FILE).mtimeMs;
    if (cachedStore && mtime === cachedStoreMtime) return cachedStore;
    cachedStore = readStoreFromDisk();
    cachedStoreMtime = mtime;
    return cachedStore;
  } catch {
    if (!cachedStore) cachedStore = defaultPatenteSuciveCalendarios();
    return cachedStore;
  }
}

export function savePatenteSuciveCalendarios(
  input: PatenteSuciveCalendariosStore,
  updatedBy: string,
): PatenteSuciveCalendariosStore {
  const err = validatePatenteSuciveCalendarios(input);
  if (err) throw new Error(err);

  const store: PatenteSuciveCalendariosStore = {
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
