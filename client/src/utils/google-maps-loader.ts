const SCRIPT_ID = "sag-google-maps-sdk";

let loadPromise: Promise<void> | null = null;

export function getGoogleMapsApiKey(): string {
  return String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "").trim();
}

export function loadGoogleMapsApi(): Promise<void> {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    return Promise.reject(
      new Error(
        "Falta configurar VITE_GOOGLE_MAPS_API_KEY para usar el mapa satelital.",
      ),
    );
  }

  if (typeof window !== "undefined" && window.google?.maps?.Map) {
    return Promise.resolve();
  }

  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("No se pudo cargar Google Maps.")),
      );
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=geometry&v=weekly`;
    script.onload = () => {
      if (window.google?.maps?.Map) resolve();
      else reject(new Error("Google Maps no quedó disponible en el navegador."));
    };
    script.onerror = () => reject(new Error("No se pudo cargar Google Maps."));
    document.head.appendChild(script);
  });

  return loadPromise;
}
