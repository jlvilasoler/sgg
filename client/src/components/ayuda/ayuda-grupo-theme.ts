import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Compass,
  MessageCircle,
  Sprout,
  Wallet,
} from "lucide-react";
import type { AyudaGrupoId } from "../../help/ayuda-manual";

export type AyudaGrupoTheme = {
  icon: LucideIcon;
  accent: string;
  soft: string;
  border: string;
  gradient: string;
};

/** Acentos por categoría sobre tarjetas blancas (estilo Inicio + verde campo). */
export const AYUDA_GRUPO_THEME: Record<AyudaGrupoId, AyudaGrupoTheme> = {
  general: {
    icon: Compass,
    accent: "#65a30d",
    soft: "#f0fdf4",
    border: "#bbf7d0",
    gradient: "linear-gradient(180deg, #f7fdf4 0%, #ffffff 100%)",
  },
  finanzas: {
    icon: Wallet,
    accent: "#059669",
    soft: "#ecfdf5",
    border: "#a7f3d0",
    gradient: "linear-gradient(180deg, #ecfdf5 0%, #ffffff 100%)",
  },
  campo: {
    icon: Sprout,
    accent: "#4d7c0f",
    soft: "#f7fee7",
    border: "#d9f99d",
    gradient: "linear-gradient(180deg, #f7fee7 0%, #ffffff 100%)",
  },
  equipo: {
    icon: MessageCircle,
    accent: "#0d9488",
    soft: "#f0fdfa",
    border: "#99f6e4",
    gradient: "linear-gradient(180deg, #f0fdfa 0%, #ffffff 100%)",
  },
  cuenta: {
    icon: Building2,
    accent: "#7c3aed",
    soft: "#f5f3ff",
    border: "#ddd6fe",
    gradient: "linear-gradient(180deg, #f5f3ff 0%, #ffffff 100%)",
  },
};
