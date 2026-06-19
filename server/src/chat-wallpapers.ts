/** Fondos de chat disponibles (validación servidor). */
export const CHAT_WALLPAPER_IDS = [
  "default",
  "clasico",
  "verde",
  "cielo",
  "lavanda",
  "atardecer",
  "arena",
  "geometria",
  "hojas",
  "rosado",
  "piedra",
  "noche",
] as const;

export type ChatWallpaperId = (typeof CHAT_WALLPAPER_IDS)[number];

const VALID = new Set<string>(CHAT_WALLPAPER_IDS);

export function isValidChatWallpaperId(id: string): id is ChatWallpaperId {
  return VALID.has(id);
}

export const CHAT_WALLPAPER_PRESETS: { id: ChatWallpaperId; label: string }[] = [
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
];
