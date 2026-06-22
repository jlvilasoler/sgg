import type { StockGanaderaDispositivoHistorial } from "../../types";

export function fmtHistorialOrigen(origen: string): string {
  switch (origen.trim().toUpperCase()) {
    case "FICHA":
      return "Edición manual";
    case "MASIVO":
      return "Edición masiva";
    case "BAJA":
      return "Baja de stock";
    case "IMPORT":
      return "Importación";
    case "LECTURA":
      return "Lectura importada";
    case "VENTA":
      return "Venta simulador";
    case "SISTEMA":
      return "Proceso automático";
    default:
      return origen.trim() ? origen : "Registro histórico";
  }
}

export function fmtHistorialUsuario(item: Pick<
  StockGanaderaDispositivoHistorial,
  "user_id" | "user_nombre" | "user_email" | "origen"
>): string {
  const nombre = item.user_nombre?.trim();
  const email = item.user_email?.trim();
  if (nombre && email) return `${nombre} (${email})`;
  if (nombre) return nombre;
  if (email) return email;
  if (item.user_id) return `Usuario #${item.user_id}`;
  const origen = item.origen?.trim().toUpperCase();
  if (origen === "LECTURA") return "Importación de lecturas";
  if (origen === "VENTA") return "Simulador de ventas";
  if (origen === "IMPORT") return "Importación de bajas";
  if (origen === "SISTEMA") return "Sistema";
  return "Sin usuario registrado";
}

export function grupoHistorialKey(item: StockGanaderaDispositivoHistorial): string {
  return [
    item.creado_en,
    item.user_id ?? "",
    item.user_nombre ?? "",
    item.user_email ?? "",
    item.origen ?? "",
  ].join("\0");
}

export interface GrupoHistorialCambios {
  key: string;
  creado_en: string;
  items: StockGanaderaDispositivoHistorial[];
  usuario: string;
  origen: string;
  origenLabel: string;
}

export function agruparHistorialCambios(
  filas: StockGanaderaDispositivoHistorial[]
): GrupoHistorialCambios[] {
  const map = new Map<string, StockGanaderaDispositivoHistorial[]>();
  for (const f of filas) {
    const key = grupoHistorialKey(f);
    const prev = map.get(key);
    if (prev) prev.push(f);
    else map.set(key, [f]);
  }
  return [...map.entries()].map(([key, items]) => {
    const first = items[0]!;
    return {
      key,
      creado_en: first.creado_en,
      items,
      usuario: fmtHistorialUsuario(first),
      origen: first.origen ?? "",
      origenLabel: fmtHistorialOrigen(first.origen ?? ""),
    };
  });
}

export function resumenHistorialCambios(filas: StockGanaderaDispositivoHistorial[]) {
  const grupos = agruparHistorialCambios(filas);
  const usuarios = new Set(grupos.map((g) => g.usuario));
  const campos = new Set(filas.map((f) => f.campo));
  return {
    grupos,
    totalCambios: filas.length,
    totalSesiones: grupos.length,
    totalUsuarios: usuarios.size,
    totalCampos: campos.size,
  };
}
