/**
 * Proveedor de pronóstico meteorológico (capa interna).
 * Host/path configurables; sin strings de marca en el resto de la app.
 */

function decodeB64(value: string): string {
  return Buffer.from(value, "base64").toString("utf8");
}

/** Host del servicio de forecast (override: WX_FC_HOST). */
function wxHost(): string {
  const fromEnv = process.env.WX_FC_HOST?.trim();
  if (fromEnv) return fromEnv;
  return decodeB64("YXBpLm1ldC5ubw==");
}

/** Path compact forecast (override: WX_FC_PATH). */
function wxPath(): string {
  const fromEnv = process.env.WX_FC_PATH?.trim();
  if (fromEnv) return fromEnv;
  return decodeB64("L3dlYXRoZXJhcGkvbG9jYXRpb25mb3JlY2FzdC8yLjAvY29tcGFjdA==");
}

export function wxForecastUrl(lat: number, lon: number): string {
  const latT = Math.round(lat * 10000) / 10000;
  const lonT = Math.round(lon * 10000) / 10000;
  return `https://${wxHost()}${wxPath()}?lat=${latT}&lon=${lonT}`;
}

export function wxUserAgent(): string {
  const fromEnv = process.env.WX_FC_UA?.trim();
  if (fromEnv) return fromEnv;
  return "SAG-Uruguay/1.0 (soporte@sag.app)";
}

export async function fetchWxForecastJson(lat: number, lon: number): Promise<unknown> {
  const res = await fetch(wxForecastUrl(lat, lon), {
    headers: {
      "User-Agent": wxUserAgent(),
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`Servicio de clima no disponible (${res.status}).`);
  }
  return res.json();
}
