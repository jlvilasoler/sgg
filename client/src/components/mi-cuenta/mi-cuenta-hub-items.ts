import type { SgHubItem } from "../hub/SgHubTypes";

export const MI_CUENTA_HUB_ITEMS: SgHubItem[] = [
  {
    id: "perfil",
    label: "Perfil",
    subtitle: "Foto e identidad",
    icon: "config_admin_cuenta",
  },
  {
    id: "inicio",
    label: "Mi inicio",
    subtitle: "Bloques del dashboard",
    icon: "arquitectura_sistema",
  },
  {
    id: "chat",
    label: "Solicitudes Pendiente",
    subtitle: "Solicitudes entre cuentas",
    icon: "config_responsables",
  },
  {
    id: "password",
    label: "Contraseña",
    subtitle: "Seguridad de acceso",
    icon: "usuarios_permisos_rol",
  },
];

export type MiCuentaVista = (typeof MI_CUENTA_HUB_ITEMS)[number]["id"];

export const MI_CUENTA_HUB_META: Record<MiCuentaVista, { title: string; subtitle: string }> = {
  perfil: {
    title: "Perfil",
    subtitle: "Tu foto, nombre y rol en el sistema.",
  },
  inicio: {
    title: "Mi inicio",
    subtitle: "Elegí qué bloques ver en tu dashboard, dentro de lo habilitado por tu rol.",
  },
  chat: {
    title: "Solicitudes Pendiente",
    subtitle: "Confirmá o descartá solicitudes para chatear entre cuentas.",
  },
  password: {
    title: "Contraseña",
    subtitle: "Actualizá tu clave de acceso con los requisitos de seguridad.",
  },
};

export function miCuentaHubMeta(vista: MiCuentaVista) {
  return MI_CUENTA_HUB_META[vista];
}
