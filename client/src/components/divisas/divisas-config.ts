import type { HubIconId } from "../icons/HubMenuIcons";
import { PAR_DIVISA_LABELS, type ParDivisa } from "../../types";

export type DivisasMonedaId = "dolares" | "reales";

export interface DivisasMonedaConfig {
  id: DivisasMonedaId;
  par: ParDivisa;
  titulo: string;
  subtitulo: string;
  icon: HubIconId;
  /** Importación automática al abrir histórico */
  autoImport: "bcu" | "yahoo" | null;
  importLabel: string;
  importHint: string;
  columnaCsv: string;
}

export const DIVISAS_MONEDAS: Record<DivisasMonedaId, DivisasMonedaConfig> = {
  dolares: {
    id: "dolares",
    par: "UYU_USD",
    titulo: "Dólares",
    subtitulo: PAR_DIVISA_LABELS.UYU_USD,
    icon: "divisas_usd",
    autoImport: "bcu",
    importLabel: "Importar USD → $U (BCU)",
    importHint:
      "Cotización oficial del BCU (TCC): dólares estadounidenses a pesos uruguayos — cuántos $U equivalen a 1 USD. Los datos quedan guardados, no se editan ni eliminan, y al abrir se completan solo los días nuevos.",
    columnaCsv: "uyu_usd",
  },
  reales: {
    id: "reales",
    par: "BRL_USD",
    titulo: "Reales",
    subtitulo: PAR_DIVISA_LABELS.BRL_USD,
    icon: "divisas_brl",
    autoImport: "yahoo",
    importLabel: "Importar USD → R$ (histórico)",
    importHint:
      "Histórico diario: dólares estadounidenses a reales brasileños — cuántos R$ equivalen a 1 USD. Los datos quedan guardados, no se editan ni eliminan, y al abrir se completan solo los días nuevos.",
    columnaCsv: "brl_usd",
  },
};

export const DIVISAS_MONEDA_LIST = Object.values(DIVISAS_MONEDAS);
