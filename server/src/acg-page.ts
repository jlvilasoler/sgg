const PAGE_URL = "https://acg.com.uy/";

export const ACG_FETCH_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
  Referer: "https://acg.com.uy/",
};

export async function fetchAcgHomeHtml(): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);

  try {
    const res = await fetch(PAGE_URL, {
      headers: ACG_FETCH_HEADERS,
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`El servicio respondió ${res.status}. Intentá de nuevo en unos minutos.`);
    }
    return await res.text();
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Tiempo de espera agotado al obtener los precios.");
    }
    throw e instanceof Error ? e : new Error("No se pudieron obtener los precios de ganado.");
  } finally {
    clearTimeout(timer);
  }
}
