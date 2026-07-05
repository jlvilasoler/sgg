import type { Db } from "./db/pg-client.js";
import { listCampoPotrerosMapa, updateCampoPotreroMapa } from "./campo-potrero-mapa-db.js";
import { normalizarPotrero } from "./stock-ganadero-potrero-db.js";

export type CampoMapaDispositivoKind = "ganadero" | "equino";

interface CampoMapaDispositivosMetadata {
  dispositivos_ganadero: string[];
  dispositivos_equino: string[];
}

function metadataKey(
  kind: CampoMapaDispositivoKind,
): "dispositivos_ganadero" | "dispositivos_equino" {
  return kind === "ganadero" ? "dispositivos_ganadero" : "dispositivos_equino";
}

function parseMetadata(raw: string): CampoMapaDispositivosMetadata & Record<string, unknown> {
  let base: Record<string, unknown> = {};
  if (raw?.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        base = parsed as Record<string, unknown>;
      }
    } catch {
      base = {};
    }
  }
  const ganadero = Array.isArray(base.dispositivos_ganadero)
    ? base.dispositivos_ganadero.map(String).filter(Boolean)
    : [];
  const equino = Array.isArray(base.dispositivos_equino)
    ? base.dispositivos_equino.map(String).filter(Boolean)
    : [];
  return {
    ...base,
    dispositivos_ganadero: ganadero,
    dispositivos_equino: equino,
  };
}

function potreroNombreKey(nombre: string): string {
  return normalizarPotrero(nombre).toLowerCase();
}

async function findPotreroMapaPorNombre(
  db: Db,
  cuentaId: number,
  nombre: string,
) {
  const key = potreroNombreKey(nombre);
  if (!key) return null;
  const potreros = await listCampoPotrerosMapa(db, cuentaId);
  return potreros.find((p) => potreroNombreKey(p.nombre) === key) ?? null;
}

async function quitarDispositivoDePotreroMapa(
  db: Db,
  cuentaId: number,
  potreroNombre: string,
  clave: string,
  kind: CampoMapaDispositivoKind,
): Promise<void> {
  const potrero = await findPotreroMapaPorNombre(db, cuentaId, potreroNombre);
  if (!potrero) return;

  const key = metadataKey(kind);
  const meta = parseMetadata(potrero.metadata);
  const nextList = meta[key].filter((item) => item !== clave);
  if (nextList.length === meta[key].length) return;

  await updateCampoPotreroMapa(db, cuentaId, potrero.id, {
    metadata: { ...meta, [key]: nextList },
  });
}

async function agregarDispositivoAPotreroMapa(
  db: Db,
  cuentaId: number,
  potreroNombre: string,
  clave: string,
  kind: CampoMapaDispositivoKind,
): Promise<void> {
  const potrero = await findPotreroMapaPorNombre(db, cuentaId, potreroNombre);
  if (!potrero) return;

  const key = metadataKey(kind);
  const meta = parseMetadata(potrero.metadata);
  if (meta[key].includes(clave)) return;

  await updateCampoPotreroMapa(db, cuentaId, potrero.id, {
    metadata: { ...meta, [key]: [...meta[key], clave] },
  });
}

/** Vincula automáticamente un dispositivo de stock con el potrero dibujado en el mapa. */
export async function syncStockDispositivoPotreroEnMapa(
  db: Db,
  cuentaId: number | null,
  clave: string,
  kind: CampoMapaDispositivoKind,
  nextPotrero: string,
  prevPotrero: string,
): Promise<void> {
  if (cuentaId == null || !Number.isFinite(cuentaId) || cuentaId <= 0) return;
  const claveNorm = String(clave ?? "").trim();
  if (!claveNorm) return;

  const prev = normalizarPotrero(prevPotrero);
  const next = normalizarPotrero(nextPotrero);

  if (prev && potreroNombreKey(prev) !== potreroNombreKey(next)) {
    await quitarDispositivoDePotreroMapa(db, cuentaId, prev, claveNorm, kind);
  }

  if (!next) return;
  await agregarDispositivoAPotreroMapa(db, cuentaId, next, claveNorm, kind);
}
