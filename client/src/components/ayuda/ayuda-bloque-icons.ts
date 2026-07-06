import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  ClipboardList,
  FileText,
  Layers,
  Lightbulb,
  ListChecks,
  MapPin,
  MessageCircle,
  Search,
  Settings,
  Shield,
  Sparkles,
  Upload,
  Users,
  Wallet,
} from "lucide-react";

export function iconoParaBloque(titulo: string): LucideIcon {
  const t = titulo.toLowerCase();
  if (t.includes("ingresar") || t.includes("cargar") || t.includes("registr")) {
    return ClipboardList;
  }
  if (t.includes("listado") || t.includes("consulta") || t.includes("revis")) {
    return Search;
  }
  if (t.includes("import")) return Upload;
  if (t.includes("usuario") || t.includes("permiso") || t.includes("rol")) {
    return Users;
  }
  if (t.includes("configur") || t.includes("catálogo") || t.includes("catalogo")) {
    return Settings;
  }
  if (t.includes("mapa") || t.includes("potrero") || t.includes("campo")) {
    return MapPin;
  }
  if (t.includes("chat") || t.includes("mensaj")) return MessageCircle;
  if (t.includes("pago") || t.includes("suscrip") || t.includes("plan")) {
    return Wallet;
  }
  if (t.includes("buenas") || t.includes("consejo") || t.includes("antes")) {
    return Lightbulb;
  }
  if (t.includes("estructura") || t.includes("multi")) return Layers;
  if (t.includes("segur") || t.includes("contraseña")) return Shield;
  if (t.includes("simulador") || t.includes("venta")) return Sparkles;
  if (t.includes("pasos") || t.includes("uso")) return ListChecks;
  if (t.includes("guía") || t.includes("guia")) return BookOpen;
  return FileText;
}

export function limpiarPasoNumerado(paso: string): string {
  return paso.replace(/^\d+\.\s*/, "").trim();
}
