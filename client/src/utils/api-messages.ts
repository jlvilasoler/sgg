const IS_DEV = import.meta.env.DEV;

export function apiOfflineMessage(): string {
  return IS_DEV
    ? "Esperando conexión con la API en el puerto 3001…"
    : "Conectando con el servidor…";
}

export function apiConnectionError(): string {
  return IS_DEV
    ? "No se pudo conectar con la API (puerto 3001). Ejecutá npm run dev desde la carpeta SCG."
    : "No se pudo conectar con el servidor. Esperá unos segundos y recargá la página.";
}
