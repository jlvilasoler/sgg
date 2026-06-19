export const CHAT_WALLPAPER_PRESETS = [
  { id: "default", label: "Predeterminado" },
  { id: "clasico", label: "Clásico" },
  { id: "verde", label: "Verde suave" },
  { id: "cielo", label: "Cielo" },
  { id: "lavanda", label: "Lavanda" },
  { id: "atardecer", label: "Atardecer" },
  { id: "arena", label: "Arena" },
  { id: "geometria", label: "Geometría" },
  { id: "hojas", label: "Hojas" },
  { id: "rosado", label: "Rosado" },
  { id: "piedra", label: "Piedra" },
  { id: "noche", label: "Noche suave" },
] as const;

export type ChatWallpaperId = (typeof CHAT_WALLPAPER_PRESETS)[number]["id"];

export function chatWallpaperClass(id: string | undefined): string {
  if (!id || id === "default") return "";
  return `chat-wallpaper--${id}`;
}
