export interface CampoMapaDispositivosMetadata {
  dispositivos_ganadero: string[];
  dispositivos_equino: string[];
}

export function emptyCampoMapaDispositivosMetadata(): CampoMapaDispositivosMetadata {
  return { dispositivos_ganadero: [], dispositivos_equino: [] };
}

export function parseCampoMapaDispositivosMetadata(
  raw: string | undefined | null,
): CampoMapaDispositivosMetadata {
  if (!raw?.trim()) return emptyCampoMapaDispositivosMetadata();
  try {
    const parsed = JSON.parse(raw) as {
      dispositivos_ganadero?: unknown;
      dispositivos_equino?: unknown;
    };
    const ganadero = Array.isArray(parsed.dispositivos_ganadero)
      ? parsed.dispositivos_ganadero.map(String).filter(Boolean)
      : [];
    const equino = Array.isArray(parsed.dispositivos_equino)
      ? parsed.dispositivos_equino.map(String).filter(Boolean)
      : [];
    return { dispositivos_ganadero: ganadero, dispositivos_equino: equino };
  } catch {
    return emptyCampoMapaDispositivosMetadata();
  }
}

export function mergeCampoMapaMetadata(
  raw: string | undefined | null,
  dispositivos: CampoMapaDispositivosMetadata,
): Record<string, unknown> {
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
  return {
    ...base,
    dispositivos_ganadero: dispositivos.dispositivos_ganadero,
    dispositivos_equino: dispositivos.dispositivos_equino,
  };
}

/** Marcador/estancia al que pertenece un potrero (clasificación por ubicación). */
export function parseCampoMapaMarcadorId(raw: string | undefined | null): number | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as { marcador_id?: unknown };
    const id = Number(parsed.marcador_id);
    return Number.isFinite(id) && id > 0 ? Math.trunc(id) : null;
  } catch {
    return null;
  }
}

export function withCampoMapaMarcadorId(
  metadata: Record<string, unknown>,
  marcadorId: number | null,
): Record<string, unknown> {
  const next = { ...metadata };
  if (marcadorId != null && marcadorId > 0) {
    next.marcador_id = marcadorId;
  } else {
    delete next.marcador_id;
  }
  return next;
}

export function enrichCampoMapaDispositivosFromStock(
  featureNombre: string,
  meta: CampoMapaDispositivosMetadata,
  ganadero: { clave: string; potrero?: string | null }[],
  equino: { clave: string; potrero?: string | null }[],
  normalizarPotrero: (value: string | null | undefined) => string,
): CampoMapaDispositivosMetadata {
  const nombreKey = normalizarPotrero(featureNombre).toLowerCase();
  if (!nombreKey) return meta;

  const ganaderoSet = new Set(meta.dispositivos_ganadero);
  const equinoSet = new Set(meta.dispositivos_equino);

  for (const d of ganadero) {
    if (normalizarPotrero(d.potrero).toLowerCase() === nombreKey) {
      ganaderoSet.add(d.clave);
    }
  }
  for (const d of equino) {
    if (normalizarPotrero(d.potrero).toLowerCase() === nombreKey) {
      equinoSet.add(d.clave);
    }
  }

  return {
    dispositivos_ganadero: [...ganaderoSet],
    dispositivos_equino: [...equinoSet],
  };
}
