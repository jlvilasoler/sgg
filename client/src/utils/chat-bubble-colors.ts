import type { CSSProperties } from "react";

export interface ChatBubbleColor {
  bg: string;
  text: string;
  author: string;
  time: string;
}

/** Verde claro estilo WhatsApp para mensajes propios. */
const OWN_BUBBLE: ChatBubbleColor = {
  bg: "#d9fdd3",
  text: "#111b21",
  author: "#0b6e4f",
  time: "rgba(17, 27, 33, 0.55)",
};

/** Paleta de globos para identificar a cada usuario en el chat grupal. */
const USER_BUBBLE_PALETTE: ChatBubbleColor[] = [
  { bg: "#ffffff", text: "#111b21", author: "#0277bd", time: "rgba(17, 27, 33, 0.5)" },
  { bg: "#fff9c4", text: "#3e2723", author: "#f57f17", time: "rgba(62, 39, 35, 0.5)" },
  { bg: "#ffe0f0", text: "#4a1942", author: "#c2185b", time: "rgba(74, 25, 66, 0.5)" },
  { bg: "#e3f2fd", text: "#0d2744", author: "#1565c0", time: "rgba(13, 39, 68, 0.5)" },
  { bg: "#e8f5e9", text: "#1b3a24", author: "#2e7d32", time: "rgba(27, 58, 36, 0.5)" },
  { bg: "#f3e5f5", text: "#311b36", author: "#7b1fa2", time: "rgba(49, 27, 54, 0.5)" },
  { bg: "#fff3e0", text: "#3e2723", author: "#ef6c00", time: "rgba(62, 39, 35, 0.5)" },
  { bg: "#e0f7fa", text: "#0d3d47", author: "#00838f", time: "rgba(13, 61, 71, 0.5)" },
  { bg: "#fce4ec", text: "#4a1027", author: "#d81b60", time: "rgba(74, 16, 39, 0.5)" },
  { bg: "#f1f8e9", text: "#263a16", author: "#558b2f", time: "rgba(38, 58, 22, 0.5)" },
  { bg: "#ede7f6", text: "#311b92", author: "#5e35b1", time: "rgba(49, 27, 146, 0.5)" },
  { bg: "#ffecb3", text: "#3e2723", author: "#ff8f00", time: "rgba(62, 39, 35, 0.5)" },
];

export function bubbleColorForSender(senderId: number, esPropio: boolean): ChatBubbleColor {
  if (esPropio) return OWN_BUBBLE;
  const idx = Math.abs(senderId) % USER_BUBBLE_PALETTE.length;
  return USER_BUBBLE_PALETTE[idx];
}

export function bubbleStyleVars(color: ChatBubbleColor): CSSProperties {
  return {
    "--chat-bubble-bg": color.bg,
    "--chat-bubble-text": color.text,
    "--chat-bubble-author": color.author,
    "--chat-bubble-time": color.time,
  } as CSSProperties;
}
