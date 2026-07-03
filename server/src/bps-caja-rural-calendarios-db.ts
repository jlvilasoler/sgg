import fs from "fs";
import path from "path";
import { scgDataPath } from "./data-dir.js";

export interface CuotaBpsCajaRural {
  cuota: number;
  fecha: string;
}

export interface BpsCajaRuralCalendarioConfig {
  anio: number;
  titulo: string;
  subtitulo: string;
  fuenteUrl: string;
  fuenteUrlPago: string;
  fuenteNota: string;
  primeraCuotaPagoContado: boolean;
  cuotas: CuotaBpsCajaRural[];
}

export interface BpsCajaRuralCalendariosStore {
  updatedAt: string;
  updatedBy: string;
  calendario: BpsCajaRuralCalendarioConfig;
}

const STORE_FILE = path.join(scgDataPath(), "bps-caja-rural-calendarios.json");

let cachedStore: BpsCajaRuralCalendariosStore | null = null;
let cachedStoreMtime = -1;

function readStoreFromDisk(): BpsCajaRuralCalendariosStore {
  const defaults = defaultBpsCajaRuralCalendarios();
  try {
    if (!fs.existsSync(STORE_FILE)) return defaults;
    const raw = fs.readFileSync(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as BpsCajaRuralCalendariosStore;
    const merged: BpsCajaRuralCalendariosStore = {
      ...parsed,
      calendario: { ...defaults.calendario, ...parsed.calendario },
    };
    if (validateBpsCajaRuralCalendarios(merged)) {
      return defaults;
    }
    return merged;
  } catch {
    return defaults;
  }
}

export function defaultBpsCajaRuralCalendarios(): BpsCajaRuralCalendariosStore {
  return {
    updatedAt: "",
    updatedBy: "",
    calendario: {
      anio: 2026,
      titulo: "Aportes rurales BPS",
      subtitulo: "BPS · Caja rural · Uruguay (calendario nacional)",
      fuenteUrl: "https://www.bps.gub.uy/10954/guia-rural.html",
      fuenteUrlPago: "https://www.bps.gub.uy/7530/vencimientos.html",
      fuenteNota:
        "Obligaciones cuatrimestrales de la aportación rural BPS. 1er cuatrimestre (ene–abr): pago en mayo; 2do (may–ago): en setiembre; 3er (sep–dic): en enero del año siguiente. Las fechas exactas dependen del último dígito del número de empresa según el calendario oficial BPS. Presentación de nóminas en las fechas del calendario; pago por internet, red de cobranza o locales habilitados. Consulte prórrogas y excepciones en bps.gub.uy.",
      primeraCuotaPagoContado: false,
      cuotas: [
        { cuota: 1, fecha: "2026-05-20" },
        { cuota: 2, fecha: "2026-09-21" },
        { cuota: 3, fecha: "2027-01-20" },
      ],
    },
  };
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function validateBpsCajaRuralCalendarios(input: BpsCajaRuralCalendariosStore): string | null {
  const c = input.calendario;
  if (!c) return "Falta el calendario de BPS Caja rural.";
  const anio = Number(c.anio);
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
    return "Ejercicio de BPS Caja rural inválido.";
  }
  for (const url of [c.fuenteUrl, c.fuenteUrlPago]) {
    const trimmed = String(url ?? "").trim();
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      return "Los links oficiales deben comenzar con http:// o https://.";
    }
  }
  if (!Array.isArray(c.cuotas) || c.cuotas.length === 0) {
    return "Indicá al menos una cuota de BPS Caja rural.";
  }
  for (const item of c.cuotas) {
    if (!Number.isInteger(item.cuota) || item.cuota < 1) {
      return "Número de cuota de BPS Caja rural inválido.";
    }
    if (!isIsoDate(String(item.fecha ?? "").trim())) {
      return `Fecha inválida en cuota ${item.cuota} de BPS Caja rural.`;
    }
  }
  return null;
}

export function loadBpsCajaRuralCalendarios(): BpsCajaRuralCalendariosStore {
  try {
    if (!fs.existsSync(STORE_FILE)) {
      if (!cachedStore) cachedStore = defaultBpsCajaRuralCalendarios();
      return cachedStore;
    }
    const mtime = fs.statSync(STORE_FILE).mtimeMs;
    if (cachedStore && mtime === cachedStoreMtime) return cachedStore;
    cachedStore = readStoreFromDisk();
    cachedStoreMtime = mtime;
    return cachedStore;
  } catch {
    if (!cachedStore) cachedStore = defaultBpsCajaRuralCalendarios();
    return cachedStore;
  }
}

export function saveBpsCajaRuralCalendarios(
  input: BpsCajaRuralCalendariosStore,
  updatedBy: string,
): BpsCajaRuralCalendariosStore {
  const err = validateBpsCajaRuralCalendarios(input);
  if (err) throw new Error(err);

  const store: BpsCajaRuralCalendariosStore = {
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
