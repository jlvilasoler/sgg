import fs from "fs";
import path from "path";
import { scgDataPath } from "./data-dir.js";

export type ContribucionRuralJurisdiccionId =
  | "artigas"
  | "rivera"
  | "rionegro"
  | "florida"
  | "flores"
  | "colonia"
  | "soriano"
  | "sanjose"
  | "montevideo"
  | "canelones"
  | "maldonado"
  | "rocha"
  | "lavalleja"
  | "durazno"
  | "cerrolargo"
  | "tacuarembo"
  | "paysandu"
  | "salto"
  | "treintaytres";

export const CONTRIBUCION_RURAL_JURISDICCION_IDS: ContribucionRuralJurisdiccionId[] = [
  "artigas",
  "rivera",
  "rionegro",
  "florida",
  "flores",
  "colonia",
  "soriano",
  "sanjose",
  "montevideo",
  "canelones",
  "maldonado",
  "rocha",
  "lavalleja",
  "durazno",
  "cerrolargo",
  "tacuarembo",
  "paysandu",
  "salto",
  "treintaytres",
];

export interface CuotaContribucionRural {
  cuota: number;
  fecha: string;
}

export interface ContribucionRuralPlanConfig {
  label: string;
  cuotas: CuotaContribucionRural[];
}

export interface ContribucionRuralJurisdiccionConfig {
  id: ContribucionRuralJurisdiccionId;
  label: string;
  intendenciaLabel: string;
  anio: number;
  fuenteUrl: string;
  fuenteNota: string;
  /** Cuotas fijas (Río Negro, Florida). */
  cuotas?: CuotaContribucionRural[];
  /** Planes múltiples (Rivera). */
  planes?: Record<"4" | "6" | "12", ContribucionRuralPlanConfig>;
  primeraCuotaPagoContado?: boolean;
}

export interface ContribucionRuralCalendariosStore {
  updatedAt: string;
  updatedBy: string;
  jurisdicciones: Record<ContribucionRuralJurisdiccionId, ContribucionRuralJurisdiccionConfig>;
}

const STORE_FILE = path.join(scgDataPath(), "contribucion-rural-calendarios.json");

let cachedStore: ContribucionRuralCalendariosStore | null = null;
let cachedStoreMtime = -1;

function readStoreFromDisk(): ContribucionRuralCalendariosStore {
  const defaults = defaultContribucionRuralCalendarios();
  try {
    if (!fs.existsSync(STORE_FILE)) return defaults;
    const raw = fs.readFileSync(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as ContribucionRuralCalendariosStore;
    const merged: ContribucionRuralCalendariosStore = {
      ...parsed,
      jurisdicciones: { ...defaults.jurisdicciones, ...parsed.jurisdicciones },
    };
    if (validateContribucionRuralCalendarios(merged)) {
      return defaults;
    }
    return merged;
  } catch {
    return defaults;
  }
}

export function defaultContribucionRuralCalendarios(): ContribucionRuralCalendariosStore {
  return {
    updatedAt: "",
    updatedBy: "",
    jurisdicciones: {
      artigas: {
        id: "artigas",
        label: "Artigas",
        intendenciaLabel: "Intendencia Departamental de Artigas",
        anio: 2026,
        fuenteUrl: "https://www.artigas.gub.uy/resolucion-n-1331-025/",
        fuenteNota:
          "6 cuotas bimestrales (Res. 1331/025). Pago contado y 1ª cuota: 22/01/2026, prorrogado al 05/02/2026 (Res. 1398/026). Descuentos: 15% contado + 10% buen pagador. Consultas: 1884 · artigas.gub.uy.",
        primeraCuotaPagoContado: true,
        cuotas: [
          { cuota: 1, fecha: "2026-01-22" },
          { cuota: 2, fecha: "2026-03-19" },
          { cuota: 3, fecha: "2026-05-21" },
          { cuota: 4, fecha: "2026-07-23" },
          { cuota: 5, fecha: "2026-09-24" },
          { cuota: 6, fecha: "2026-11-19" },
        ],
      },
      rivera: {
        id: "rivera",
        label: "Rivera",
        intendenciaLabel: "Intendencia Municipal de Rivera",
        anio: 2026,
        fuenteUrl: "https://www.rivera.gub.uy/portal/category/tributos/",
        fuenteNota: "Tributos: Agraciada 570 · 462 31900.",
        planes: {
          "12": {
            label: "12 cuotas",
            cuotas: [
              { cuota: 1, fecha: "2026-01-20" },
              { cuota: 2, fecha: "2026-02-20" },
              { cuota: 3, fecha: "2026-03-20" },
              { cuota: 4, fecha: "2026-04-20" },
              { cuota: 5, fecha: "2026-05-20" },
              { cuota: 6, fecha: "2026-06-22" },
              { cuota: 7, fecha: "2026-07-20" },
              { cuota: 8, fecha: "2026-08-20" },
              { cuota: 9, fecha: "2026-09-21" },
              { cuota: 10, fecha: "2026-10-20" },
              { cuota: 11, fecha: "2026-11-20" },
              { cuota: 12, fecha: "2026-12-21" },
            ],
          },
          "6": {
            label: "6 cuotas",
            cuotas: [
              { cuota: 1, fecha: "2026-02-20" },
              { cuota: 2, fecha: "2026-04-20" },
              { cuota: 3, fecha: "2026-06-22" },
              { cuota: 4, fecha: "2026-08-20" },
              { cuota: 5, fecha: "2026-10-20" },
              { cuota: 6, fecha: "2026-12-21" },
            ],
          },
          "4": {
            label: "4 cuotas",
            cuotas: [
              { cuota: 1, fecha: "2026-01-20" },
              { cuota: 2, fecha: "2026-04-20" },
              { cuota: 3, fecha: "2026-07-20" },
              { cuota: 4, fecha: "2026-10-20" },
            ],
          },
        },
      },
      rionegro: {
        id: "rionegro",
        label: "Río Negro",
        intendenciaLabel: "Intendencia de Río Negro",
        anio: 2026,
        fuenteUrl: "https://www.rionegro.gub.uy/",
        fuenteNota: "",
        primeraCuotaPagoContado: true,
        cuotas: [
          { cuota: 1, fecha: "2026-02-13" },
          { cuota: 2, fecha: "2026-04-10" },
          { cuota: 3, fecha: "2026-06-12" },
          { cuota: 4, fecha: "2026-08-14" },
          { cuota: 5, fecha: "2026-10-16" },
          { cuota: 6, fecha: "2026-12-18" },
        ],
      },
      florida: {
        id: "florida",
        label: "Florida",
        intendenciaLabel: "Intendencia de Florida",
        anio: 2026,
        fuenteUrl: "https://www.gub.uy/intendencia-florida/tematica/vencimientos",
        fuenteNota: "Tributos: Independencia 586 · 4352 5161.",
        cuotas: [
          { cuota: 1, fecha: "2026-03-19" },
          { cuota: 2, fecha: "2026-06-18" },
          { cuota: 3, fecha: "2026-09-17" },
          { cuota: 4, fecha: "2026-12-17" },
        ],
      },
      flores: {
        id: "flores",
        label: "Flores",
        intendenciaLabel: "Intendencia Departamental de Flores",
        anio: 2026,
        fuenteUrl: "https://www.flores.gub.uy/calendario",
        fuenteNota: "Tributos: Santísima Trinidad 597 · 4364 2210.",
        primeraCuotaPagoContado: true,
        cuotas: [
          { cuota: 1, fecha: "2026-04-10" },
          { cuota: 2, fecha: "2026-06-10" },
          { cuota: 3, fecha: "2026-08-10" },
          { cuota: 4, fecha: "2026-10-09" },
          { cuota: 5, fecha: "2026-12-10" },
        ],
      },
      colonia: {
        id: "colonia",
        label: "Colonia",
        intendenciaLabel: "Intendencia de Colonia",
        anio: 2026,
        fuenteUrl: "https://www.colonia.gub.uy/",
        fuenteNota: "Hacienda: Gral. Flores 467 · 4522 6296.",
        cuotas: [
          { cuota: 1, fecha: "2026-07-24" },
          { cuota: 2, fecha: "2026-08-21" },
          { cuota: 3, fecha: "2026-10-23" },
          { cuota: 4, fecha: "2026-11-20" },
          { cuota: 5, fecha: "2026-12-22" },
        ],
      },
      soriano: {
        id: "soriano",
        label: "Soriano",
        intendenciaLabel: "Intendencia de Soriano",
        anio: 2026,
        fuenteUrl: "https://www.soriano.gub.uy/vencimientos.html",
        fuenteNota: "Pago contado antes de la 1ª cuota: 10% de descuento.",
        primeraCuotaPagoContado: true,
        cuotas: [
          { cuota: 1, fecha: "2026-04-23" },
          { cuota: 2, fecha: "2026-05-15" },
          { cuota: 3, fecha: "2026-06-26" },
          { cuota: 4, fecha: "2026-08-28" },
          { cuota: 5, fecha: "2026-10-30" },
          { cuota: 6, fecha: "2026-12-18" },
        ],
      },
      sanjose: {
        id: "sanjose",
        label: "San José",
        intendenciaLabel: "Intendencia de San José",
        anio: 2026,
        fuenteUrl: "https://sanjose.gub.uy/2026-1-9vencimientos-2026/",
        fuenteNota: "Ingresos Territoriales: Edificio Marín · 4342 9000 int. 1150.",
        cuotas: [
          { cuota: 1, fecha: "2026-03-13" },
          { cuota: 2, fecha: "2026-04-15" },
          { cuota: 3, fecha: "2026-06-15" },
          { cuota: 4, fecha: "2026-08-14" },
          { cuota: 5, fecha: "2026-10-15" },
          { cuota: 6, fecha: "2026-12-15" },
        ],
      },
      montevideo: {
        id: "montevideo",
        label: "Montevideo",
        intendenciaLabel: "Intendencia de Montevideo",
        anio: 2026,
        fuenteUrl: "https://tramites.montevideo.gub.uy/tramites-y-tributos/contribucion-inmobiliaria-rural",
        fuenteNota:
          "3 cuotas cuatrimestrales (mar, jul, nov). Pago anual en marzo evita ajuste IPC. Desarrollo Rural: 1950 4390 · montevideorural@imm.gub.uy",
        primeraCuotaPagoContado: true,
        cuotas: [
          { cuota: 1, fecha: "2026-03-10" },
          { cuota: 2, fecha: "2026-07-10" },
          { cuota: 3, fecha: "2026-11-10" },
        ],
      },
      canelones: {
        id: "canelones",
        label: "Canelones",
        intendenciaLabel: "Intendencia de Canelones",
        anio: 2026,
        fuenteUrl: "https://www.imcanelones.gub.uy/servicios/consultas/calendario-pagos-2026",
        fuenteNota:
          "4 cuotas (may, jul, set, nov). Vencen el día 15; si cae inhábil, pasa al día hábil siguiente.",
        cuotas: [
          { cuota: 1, fecha: "2026-05-15" },
          { cuota: 2, fecha: "2026-07-15" },
          { cuota: 3, fecha: "2026-09-15" },
          { cuota: 4, fecha: "2026-11-15" },
        ],
      },
      maldonado: {
        id: "maldonado",
        label: "Maldonado",
        intendenciaLabel: "Intendencia de Maldonado",
        anio: 2026,
        fuenteUrl: "https://maldonado.gub.uy/portal-tributario",
        fuenteNota: "5 cuotas ajustadas por IPC. Bonificación 6% (+ buen pagador) en enero/febrero según calendario IDM.",
        cuotas: [
          { cuota: 1, fecha: "2026-03-02" },
          { cuota: 2, fecha: "2026-04-30" },
          { cuota: 3, fecha: "2026-06-30" },
          { cuota: 4, fecha: "2026-08-31" },
          { cuota: 5, fecha: "2026-11-03" },
        ],
      },
      rocha: {
        id: "rocha",
        label: "Rocha",
        intendenciaLabel: "Intendencia Departamental de Rocha",
        anio: 2026,
        fuenteUrl: "https://www.rocha.gub.uy/portal/index.php?info=vencimientos",
        fuenteNota: "Pago contado en la 1ª cuota. Consultas: recuperactivos@rocha.gub.uy",
        primeraCuotaPagoContado: true,
        cuotas: [
          { cuota: 1, fecha: "2026-05-20" },
          { cuota: 2, fecha: "2026-06-18" },
          { cuota: 3, fecha: "2026-09-18" },
          { cuota: 4, fecha: "2026-12-18" },
        ],
      },
      lavalleja: {
        id: "lavalleja",
        label: "Lavalleja",
        intendenciaLabel: "Intendencia Departamental de Lavalleja",
        anio: 2026,
        fuenteUrl:
          "https://www.gub.uy/intendencia-lavalleja/comunicacion/publicaciones/preguntas-frecuentes/preguntas-frecuentes/vence-contribucion-rural",
        fuenteNota:
          "1ª cuota prorrogada al 27/03/2026 (Res. 5186/025). Consultas: 0800 0440 · 4442 0388.",
        cuotas: [
          { cuota: 1, fecha: "2026-03-27" },
          { cuota: 2, fecha: "2026-05-29" },
          { cuota: 3, fecha: "2026-08-31" },
          { cuota: 4, fecha: "2026-11-30" },
        ],
      },
      durazno: {
        id: "durazno",
        label: "Durazno",
        intendenciaLabel: "Intendencia Departamental de Durazno",
        anio: 2026,
        fuenteUrl: "https://durazno.uy/index.php/contribuyente/calendario-de-vencimientos.html",
        fuenteNota:
          "1ª cuota prorrogada al 16/03/2026 (Res. 1482/2026). Pagos: durazno.uy · redes de cobranza.",
        cuotas: [
          { cuota: 1, fecha: "2026-03-16" },
          { cuota: 2, fecha: "2026-04-20" },
          { cuota: 3, fecha: "2026-06-22" },
          { cuota: 4, fecha: "2026-09-21" },
          { cuota: 5, fecha: "2026-12-21" },
        ],
      },
      cerrolargo: {
        id: "cerrolargo",
        label: "Cerro Largo",
        intendenciaLabel: "Intendencia Departamental de Cerro Largo",
        anio: 2026,
        fuenteUrl: "https://www.gub.uy/intendencia-cerro-largo/politicas-y-gestion/vencimientos-2026",
        fuenteNota:
          "Mismo calendario que contribución urbana. Bonificación por pago contado en 1ª cuota. Consultas: 4642 2655.",
        primeraCuotaPagoContado: true,
        cuotas: [
          { cuota: 1, fecha: "2026-02-27" },
          { cuota: 2, fecha: "2026-04-10" },
          { cuota: 3, fecha: "2026-06-10" },
          { cuota: 4, fecha: "2026-08-10" },
          { cuota: 5, fecha: "2026-10-09" },
          { cuota: 6, fecha: "2026-12-10" },
        ],
      },
      tacuarembo: {
        id: "tacuarembo",
        label: "Tacuarembó",
        intendenciaLabel: "Intendencia Departamental de Tacuarembó",
        anio: 2026,
        fuenteUrl: "https://tacuarembo.gub.uy/?p=34884",
        fuenteNota: "Pagos en línea: tacuarembo.gub.uy · redes de cobranza · débito bancario.",
        cuotas: [
          { cuota: 1, fecha: "2026-01-30" },
          { cuota: 2, fecha: "2026-03-27" },
          { cuota: 3, fecha: "2026-05-29" },
          { cuota: 4, fecha: "2026-09-30" },
          { cuota: 5, fecha: "2026-11-30" },
        ],
      },
      paysandu: {
        id: "paysandu",
        label: "Paysandú",
        intendenciaLabel: "Intendencia Departamental de Paysandú",
        anio: 2026,
        fuenteUrl: "https://www.paysandu.gub.uy/tramites/calendario-de-vencimientos/",
        fuenteNota:
          "Todos los dígitos. Pago contado anual con 10% de descuento hasta el 31/03/2026. Consultas: 1865 · paysandu.gub.uy.",
        cuotas: [
          { cuota: 1, fecha: "2026-04-15" },
          { cuota: 2, fecha: "2026-06-15" },
          { cuota: 3, fecha: "2026-08-15" },
          { cuota: 4, fecha: "2026-10-15" },
          { cuota: 5, fecha: "2026-12-15" },
        ],
      },
      salto: {
        id: "salto",
        label: "Salto",
        intendenciaLabel: "Intendencia Departamental de Salto",
        anio: 2026,
        fuenteUrl: "https://salto.gub.uy/vencimientos",
        fuenteNota:
          "Pago contado hasta el 13/02/2026. También plan de 12 cuotas (día 15 de cada mes). Pagos: salto.gub.uy · Abitab · Red Pagos.",
        cuotas: [
          { cuota: 1, fecha: "2026-03-13" },
          { cuota: 2, fecha: "2026-06-15" },
          { cuota: 3, fecha: "2026-09-15" },
          { cuota: 4, fecha: "2026-12-15" },
        ],
      },
      treintaytres: {
        id: "treintaytres",
        label: "Treinta y Tres",
        intendenciaLabel: "Intendencia Departamental de Treinta y Tres",
        anio: 2026,
        fuenteUrl: "https://treintaytres.gub.uy/vencimientos/",
        fuenteNota:
          "Bonificación 10% buen pagador en fecha. Exoneración hasta 50 Has. (Ley 17.286) hasta el 30/04/2026. Consultas: 4452 2108 int. 105.",
        cuotas: [
          { cuota: 1, fecha: "2026-02-13" },
          { cuota: 2, fecha: "2026-04-17" },
          { cuota: 3, fecha: "2026-06-12" },
          { cuota: 4, fecha: "2026-08-14" },
          { cuota: 5, fecha: "2026-10-16" },
        ],
      },
    },
  };
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validateCuotas(cuotas: CuotaContribucionRural[], label: string): string | null {
  if (!Array.isArray(cuotas) || cuotas.length === 0) {
    return `${label}: indicá al menos una cuota.`;
  }
  for (const item of cuotas) {
    if (!Number.isInteger(item.cuota) || item.cuota < 1) {
      return `${label}: número de cuota inválido.`;
    }
    if (!isIsoDate(String(item.fecha ?? "").trim())) {
      return `${label}: fecha inválida en cuota ${item.cuota}.`;
    }
  }
  return null;
}

export function validateContribucionRuralCalendarios(
  input: ContribucionRuralCalendariosStore
): string | null {
  for (const id of CONTRIBUCION_RURAL_JURISDICCION_IDS) {
    const j = input.jurisdicciones?.[id];
    if (!j) return `Falta la jurisdicción ${id}.`;
    const anio = Number(j.anio);
    if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
      return `${j.label}: ejercicio inválido.`;
    }
    const url = String(j.fuenteUrl ?? "").trim();
    if (url && !/^https?:\/\//i.test(url)) {
      return `${j.label}: el link oficial debe comenzar con http:// o https://.`;
    }
    if (j.planes) {
      for (const planKey of ["4", "6", "12"] as const) {
        const plan = j.planes[planKey];
        if (!plan) continue;
        const err = validateCuotas(plan.cuotas, `${j.label} · plan ${planKey} cuotas`);
        if (err) return err;
      }
    }
    if (j.cuotas) {
      const err = validateCuotas(j.cuotas, j.label);
      if (err) return err;
    }
  }
  return null;
}

export function loadContribucionRuralCalendarios(): ContribucionRuralCalendariosStore {
  try {
    if (!fs.existsSync(STORE_FILE)) {
      if (!cachedStore) cachedStore = defaultContribucionRuralCalendarios();
      return cachedStore;
    }
    const mtime = fs.statSync(STORE_FILE).mtimeMs;
    if (cachedStore && mtime === cachedStoreMtime) return cachedStore;
    cachedStore = readStoreFromDisk();
    cachedStoreMtime = mtime;
    return cachedStore;
  } catch {
    if (!cachedStore) cachedStore = defaultContribucionRuralCalendarios();
    return cachedStore;
  }
}

export function saveContribucionRuralCalendarios(
  input: ContribucionRuralCalendariosStore,
  updatedBy: string
): ContribucionRuralCalendariosStore {
  const err = validateContribucionRuralCalendarios(input);
  if (err) throw new Error(err);

  const store: ContribucionRuralCalendariosStore = {
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
