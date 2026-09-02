import type { AuthUser } from "../types";

/**
 * Nombre de la empresa operativa activa en modo individual.
 * Vacío en consolidado, sin elegir, o sesión "Todas las empresas" (id 0).
 */
export function empresaOperativaSesionNombre(
  user: AuthUser | null | undefined,
): string {
  if (!user || user.login_mode !== "individual") return "";
  const activaId = user.empresa_operativa_activa_id;
  if (activaId == null || activaId === 0) return "";
  return user.empresa_activa_nombre?.trim() || "";
}
