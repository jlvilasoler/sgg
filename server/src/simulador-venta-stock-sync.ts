import type { Db } from "./db/pg-client.js";
import type { SimuladorVentaGanadoRow } from "./simulador-venta-ganado-db.js";
import {
  listDispositivosBySimulacion,
  replaceDispositivosBySimulacionInTx,
  type SimuladorVentaDispositivoInput,
  type SimuladorVentaDispositivoRow,
} from "./simulador-venta-dispositivos-db.js";
import {
  aplicarBajaDispositivoStock,
  HISTORIAL_AUTOR_VENTA,
  HISTORIAL_AUTOR_SISTEMA,
  restaurarDispositivoVivoStock,
  type BajaDispositivoSnapshot,
  type TipoBaja,
} from "./stock-ganadero-db.js";

export function fechaEmbarqueIso(ventaRealizadaEn: string | null): string {
  if (ventaRealizadaEn) {
    const d = new Date(ventaRealizadaEn);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
    const m = ventaRealizadaEn.trim().match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1]!;
  }
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const dia = String(hoy.getDate()).padStart(2, "0");
  return `${hoy.getFullYear()}-${mes}-${dia}`;
}

export function tipoBajaDesdeSimuladorVenta(
  tipo: SimuladorVentaGanadoRow["tipo"]
): TipoBaja {
  return tipo === "EN_PIE" ? "VENTA_PRODUCTOR" : "VENTA_FRIGORIFICO";
}

export function maxDispositivosPermitidosVenta(
  sim: Pick<SimuladorVentaGanadoRow, "modo_kg" | "real_cantidad_animales">
): number | null {
  if (sim.modo_kg !== "CABEZAS") return null;
  if (sim.real_cantidad_animales == null) return null;
  const n = Math.round(Number(sim.real_cantidad_animales));
  return n > 0 ? n : null;
}

export function validarCantidadDispositivosVenta(
  sim: Pick<SimuladorVentaGanadoRow, "modo_kg" | "real_cantidad_animales">,
  count: number
): void {
  const max = maxDispositivosPermitidosVenta(sim);
  if (max != null && count > max) {
    throw new Error(
      `No puede vincular más de ${max} dispositivo(s). La venta cerró con ${max} cabeza(s).`
    );
  }
}

export interface SyncSimuladorVentaDispositivosResult {
  data: SimuladorVentaDispositivoRow[];
  bajados: BajaDispositivoSnapshot[];
  restaurados: number;
}

export async function syncAndReplaceSimuladorVentaDispositivos(
  db: Db,
  simulacion: SimuladorVentaGanadoRow,
  items: SimuladorVentaDispositivoInput[]
): Promise<SyncSimuladorVentaDispositivosResult> {
  const anteriores = await listDispositivosBySimulacion(db, simulacion.id);
  const prevClaves = new Set(anteriores.map((d) => d.clave));
  const normalized: SimuladorVentaDispositivoInput[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const clave = String(item.clave ?? "").trim();
    if (!clave || seen.has(clave)) continue;
    seen.add(clave);
    normalized.push({
      clave,
      eid: String(item.eid ?? "").trim(),
      vid: String(item.vid ?? "").trim(),
    });
  }
  validarCantidadDispositivosVenta(simulacion, normalized.length);
  const nextClaves = new Set(normalized.map((d) => d.clave));

  const tipo_baja = tipoBajaDesdeSimuladorVenta(simulacion.tipo);
  const fechaIso = fechaEmbarqueIso(simulacion.venta_realizada_en);
  const refVenta = simulacion.numero_operacion || `SIM-${simulacion.id}`;
  const observaciones = `Venta simulador ${refVenta}`;

  const bajados: BajaDispositivoSnapshot[] = [];
  let restaurados = 0;

  await db.transaction(async (tx) => {
    for (const ant of anteriores) {
      if (!nextClaves.has(ant.clave)) {
        if (await restaurarDispositivoVivoStock(tx, ant.clave, ant.eid, HISTORIAL_AUTOR_SISTEMA)) {
          restaurados += 1;
        }
      }
    }

    for (const item of normalized) {
      if (!prevClaves.has(item.clave)) {
        const snap = await aplicarBajaDispositivoStock(tx, item.clave, item.eid, {
          tipo_baja,
          fecha_baja_iso: fechaIso,
          observaciones,
          numero_guia: refVenta,
          autor: HISTORIAL_AUTOR_VENTA,
        });
        bajados.push(snap);
      }
    }

    await replaceDispositivosBySimulacionInTx(tx, simulacion.id, normalized);
  });

  const data = await listDispositivosBySimulacion(db, simulacion.id);
  return { data, bajados, restaurados };
}

export async function revertirStockDispositivosSimulacion(
  db: Db,
  simulacionId: number
): Promise<number> {
  const dispositivos = await listDispositivosBySimulacion(db, simulacionId);
  let restaurados = 0;
  await db.transaction(async (tx) => {
    for (const d of dispositivos) {
      if (await restaurarDispositivoVivoStock(tx, d.clave, d.eid, HISTORIAL_AUTOR_SISTEMA)) {
        restaurados += 1;
      }
    }
  });
  return restaurados;
}
