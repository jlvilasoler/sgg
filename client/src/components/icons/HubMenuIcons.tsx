import type { ReactNode } from "react";
import type { MenuAppTheme } from "./MenuAppIcons";

type IconProps = { className?: string };

function IconShell({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {children}
    </svg>
  );
}

const stroke = {
  stroke: "currentColor",
  strokeWidth: 1.65,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export type HubIconId =
  | "config_responsables"
  | "config_proveedores"
  | "config_clasificacion_proveedores"
  | "config_rubros"
  | "prov_ingresar"
  | "prov_listado"
  | "resp_ingresar"
  | "resp_listado"
  | "rrhh_funcionarios"
  | "rrhh_sueldos"
  | "stock_alta"
  | "stock_baja"
  | "stock_lecturas"
  | "stock_dispositivos"
  | "stock_salidas"
  | "ventas_ingresar"
  | "ventas_listado"
  | "ventas_rubros"
  | "ventas_ganado"
  | "ventas_agricultura"
  | "ventas_arrendamientos"
  | "divisas_usd"
  | "divisas_brl"
  | "usuarios_permisos_rol"
  | "arquitectura_sistema";

function IconUserBadge({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <circle cx="12" cy="8.25" r="3" {...stroke} />
      <path d="M6 19v-.5c0-2.5 2.69-4.5 6-4.5s6 2 6 4.5V19" {...stroke} />
      <path d="M16.5 6.5l2-1.5 2 1.5" {...stroke} strokeWidth="1.4" />
    </IconShell>
  );
}

function IconBuilding({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path d="M5 20V8.5l7-4.5 7 4.5V20" {...stroke} />
      <path d="M9 20v-5h6v5M9 10h.01M12 10h.01M15 10h.01M9 13.5h.01M12 13.5h.01M15 13.5h.01" {...stroke} />
    </IconShell>
  );
}

function IconTag({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path d="M4 12.5V5.75A1.75 1.75 0 0 1 5.75 4H12.5L20 11.5l-6.5 6.5L4 12.5Z" {...stroke} />
      <circle cx="8.75" cy="8.75" r="1.1" fill="currentColor" />
    </IconShell>
  );
}

function IconLayers({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path d="M12 4.5 4 9l8 4.5 8-4.5-8-4.5Z" {...stroke} />
      <path d="M4 13l8 4.5L20 13" {...stroke} />
      <path d="M4 17l8 4.5L20 17" {...stroke} />
    </IconShell>
  );
}

function IconAddCircle({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <circle cx="12" cy="12" r="8.25" {...stroke} />
      <path d="M12 8.5v7M8.5 12h7" {...stroke} />
    </IconShell>
  );
}

function IconCatalog({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path d="M6 4h11a2 2 0 0 1 2 2v14H8a2 2 0 0 1-2-2V4Z" {...stroke} />
      <path d="M6 4v16a2 2 0 0 0 2 2h11M9 8h6M9 12h6M9 16h4" {...stroke} />
    </IconShell>
  );
}

function IconUsers({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <circle cx="9" cy="8.5" r="2.75" {...stroke} />
      <path d="M4.5 19v-.75c0-2.35 2.01-4.25 4.5-4.25" {...stroke} />
      <circle cx="16.5" cy="9.25" r="2.25" {...stroke} strokeWidth="1.45" />
      <path d="M14.25 19v-.5c0-1.75 1.35-3.15 3.25-3.15" {...stroke} strokeWidth="1.45" />
    </IconShell>
  );
}

function IconWallet({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v14H6.5A2.5 2.5 0 0 1 4 16.5V7.5Z" {...stroke} />
      <path d="M18 9h2.25a1.75 1.75 0 0 1 0 3.5H18" {...stroke} />
      <circle cx="16.75" cy="10.75" r=".75" fill="currentColor" />
    </IconShell>
  );
}

function IconImport({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path d="M12 4v10M8.5 10.5 12 14l3.5-3.5" {...stroke} />
      <path d="M5 16.5v1.75A1.75 1.75 0 0 0 6.75 20h10.5A1.75 1.75 0 0 0 19 18.25V16.5" {...stroke} />
    </IconShell>
  );
}

function IconExportBaja({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path d="M12 20V10M8.5 13.5 12 10l3.5 3.5" {...stroke} />
      <path d="M5 5.5v1.75A1.75 1.75 0 0 0 6.75 9h10.5A1.75 1.75 0 0 0 19 7.25V5.5" {...stroke} />
    </IconShell>
  );
}

function IconClipboard({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path
        d="M9 5H7.75A1.75 1.75 0 0 0 6 6.75v12.5A1.75 1.75 0 0 0 7.75 21h8.5A1.75 1.75 0 0 0 18 19.25V6.75A1.75 1.75 0 0 0 16.25 5H15"
        {...stroke}
      />
      <rect x="9" y="3" width="6" height="4" rx="1" {...stroke} />
      <path d="M9 11h6M9 15h4" {...stroke} />
    </IconShell>
  );
}

function IconCattle({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path d="M6.5 14.5c1.2-2.8 3.4-4.5 5.5-4.5s4.3 1.7 5.5 4.5" {...stroke} />
      <path d="M4.5 14.5h15" {...stroke} />
      <path d="M8 10.5c.6-1.6 2-2.8 4-2.8s3.4 1.2 4 2.8" {...stroke} />
      <circle cx="9.25" cy="8.75" r=".85" fill="currentColor" />
      <circle cx="14.75" cy="8.75" r=".85" fill="currentColor" />
      <path d="M17.75 6.25l1.5 1.1-1.5 1.1M16.25 7.35h3" {...stroke} strokeWidth="1.4" />
    </IconShell>
  );
}

function IconSalidas({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path d="M5 12h9.5" {...stroke} />
      <path d="M12.5 8.5 16 12l-3.5 3.5" {...stroke} />
      <path d="M5 6.5v11" {...stroke} strokeWidth="1.3" strokeOpacity="0.35" />
      <circle cx="18.5" cy="12" r="2.25" fill="currentColor" fillOpacity="0.14" />
      <path d="M17.6 12.9 18.9 14.2 20.8 12" {...stroke} strokeWidth="1.4" />
    </IconShell>
  );
}

function IconInvoice({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path d="M7 4h10l2 2v14l-2 2H7l-2-2V6l2-2Z" {...stroke} />
      <path d="M9 9h6M9 13h6M9 17h4" {...stroke} />
      <path d="M15 4v3h3" {...stroke} />
    </IconShell>
  );
}

function IconDollar({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <circle cx="12" cy="12" r="8.25" {...stroke} />
      <path
        d="M12 6.75v10.5M9.75 9.25c0-1.1 1-2 2.25-2s2.25.75 2.25 1.75c0 1.15-1.35 1.55-2.25 1.75-1.35.25-2.25.95-2.25 2.05 0 1.05.95 1.85 2.25 1.85s2.25-.75 2.25-1.75"
        {...stroke}
        strokeWidth="1.5"
      />
    </IconShell>
  );
}

function IconReal({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <circle cx="12" cy="12" r="8.25" {...stroke} />
      <path
        d="M8.25 9.25h5.25c1.2 0 2.15.75 2.15 1.85S14.7 13 13.5 13H9.75"
        {...stroke}
        strokeWidth="1.5"
      />
      <path d="M9.75 9.25V15.5M12.75 9.25V15.5" {...stroke} strokeWidth="1.5" />
    </IconShell>
  );
}

function IconWheat({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path d="M12 20V7.5" {...stroke} />
      <path d="M8.5 11.5C7 9 5 8.5 4 10s1 4 3.5 4.5M15.5 11.5c1.5-2.5 3.5-3 4.5-1.5s-1 4-3.5 4.5" {...stroke} />
      <path d="M9 14.5c-1-2-2.5-2.5-4-1.5s0 3 2 3.5M15 14.5c1-2 2.5-2.5 4-1.5s0 3-2 3.5" {...stroke} />
      <path d="M10 17.5c-.5-1.5-1.5-2-2.5-1.2s-.2 2 1.5 2.3M14 17.5c.5-1.5 1.5-2 2.5-1.2s.2 2-1.5 2.3" {...stroke} />
    </IconShell>
  );
}

function IconArrendamiento({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path d="M4.5 20V11l7.5-5 7.5 5v9" {...stroke} />
      <path d="M9.5 20v-5.5h5V20" {...stroke} />
      <path d="M15.25 8.75 17.5 10l-2.25 1.25" {...stroke} strokeWidth="1.4" />
      <circle cx="17.5" cy="10" r="1.35" {...stroke} strokeWidth="1.35" />
    </IconShell>
  );
}

function IconPermisosRol({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path
        d="M12 3.5 5.5 6.25V11c0 3.65 2.75 7.05 6.5 8 3.75-.95 6.5-4.35 6.5-8V6.25L12 3.5Z"
        {...stroke}
      />
      <path d="M9.25 11.75 11 13.5l3.75-3.75" {...stroke} strokeWidth="1.75" />
    </IconShell>
  );
}

function IconArquitecturaSistema({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <rect x="3" y="15" width="18" height="5" rx="1.25" {...stroke} />
      <rect x="5.5" y="9.5" width="13" height="4.5" rx="1.25" {...stroke} />
      <rect x="8" y="4" width="8" height="4.5" rx="1.25" {...stroke} />
      <path d="M12 8.5v1.25M12 14v1" {...stroke} strokeWidth="1.5" />
    </IconShell>
  );
}

const ICONS: Record<HubIconId, (props: IconProps) => ReactNode> = {
  config_responsables: IconUserBadge,
  config_proveedores: IconBuilding,
  config_clasificacion_proveedores: IconLayers,
  config_rubros: IconTag,
  prov_ingresar: IconAddCircle,
  prov_listado: IconCatalog,
  resp_ingresar: IconAddCircle,
  resp_listado: IconUsers,
  rrhh_funcionarios: IconUserBadge,
  rrhh_sueldos: IconWallet,
  stock_alta: IconImport,
  stock_baja: IconExportBaja,
  stock_lecturas: IconClipboard,
  stock_dispositivos: IconCattle,
  stock_salidas: IconSalidas,
  ventas_ingresar: IconInvoice,
  ventas_listado: IconClipboard,
  ventas_rubros: IconTag,
  ventas_ganado: IconCattle,
  ventas_agricultura: IconWheat,
  ventas_arrendamientos: IconArrendamiento,
  divisas_usd: IconDollar,
  divisas_brl: IconReal,
  usuarios_permisos_rol: IconPermisosRol,
  arquitectura_sistema: IconArquitecturaSistema,
};

export function HubMenuIcon({
  id,
  className = "menu-app-icon-svg",
}: {
  id: HubIconId;
  className?: string;
}) {
  const Icon = ICONS[id];
  return <Icon className={className} />;
}

export const HUB_ICON_THEMES: Record<HubIconId, MenuAppTheme> = {
  config_responsables: {
    accent: "#4f46e5",
    accentSoft: "linear-gradient(145deg, #eef2ff 0%, #e0e7ff 52%, #c7d2fe 100%)",
    accentGlow: "rgba(79, 70, 229, 0.28)",
  },
  config_proveedores: {
    accent: "#7c3aed",
    accentSoft: "linear-gradient(145deg, #f5f3ff 0%, #ede9fe 52%, #ddd6fe 100%)",
    accentGlow: "rgba(124, 58, 237, 0.28)",
  },
  config_clasificacion_proveedores: {
    accent: "#0d9488",
    accentSoft: "linear-gradient(145deg, #f0fdfa 0%, #ccfbf1 52%, #99f6e4 100%)",
    accentGlow: "rgba(13, 148, 136, 0.28)",
  },
  config_rubros: {
    accent: "#d97706",
    accentSoft: "linear-gradient(145deg, #fffbeb 0%, #fef3c7 52%, #fde68a 100%)",
    accentGlow: "rgba(217, 119, 6, 0.28)",
  },
  prov_ingresar: {
    accent: "#059669",
    accentSoft: "linear-gradient(145deg, #ecfdf5 0%, #d1fae5 52%, #a7f3d0 100%)",
    accentGlow: "rgba(5, 150, 105, 0.28)",
  },
  prov_listado: {
    accent: "#2563eb",
    accentSoft: "linear-gradient(145deg, #eff6ff 0%, #dbeafe 52%, #bfdbfe 100%)",
    accentGlow: "rgba(37, 99, 235, 0.28)",
  },
  resp_ingresar: {
    accent: "#3b82f6",
    accentSoft: "linear-gradient(145deg, #eff6ff 0%, #dbeafe 52%, #bfdbfe 100%)",
    accentGlow: "rgba(59, 130, 246, 0.28)",
  },
  resp_listado: {
    accent: "#475569",
    accentSoft: "linear-gradient(145deg, #f8fafc 0%, #f1f5f9 52%, #e2e8f0 100%)",
    accentGlow: "rgba(71, 85, 105, 0.22)",
  },
  rrhh_funcionarios: {
    accent: "#7c3aed",
    accentSoft: "linear-gradient(145deg, #f5f3ff 0%, #ede9fe 52%, #ddd6fe 100%)",
    accentGlow: "rgba(124, 58, 237, 0.28)",
  },
  rrhh_sueldos: {
    accent: "#059669",
    accentSoft: "linear-gradient(145deg, #ecfdf5 0%, #d1fae5 52%, #a7f3d0 100%)",
    accentGlow: "rgba(5, 150, 105, 0.28)",
  },
  stock_alta: {
    accent: "#059669",
    accentSoft: "linear-gradient(145deg, #ecfdf5 0%, #d1fae5 52%, #a7f3d0 100%)",
    accentGlow: "rgba(5, 150, 105, 0.28)",
  },
  stock_baja: {
    accent: "#ea580c",
    accentSoft: "linear-gradient(145deg, #fff7ed 0%, #ffedd5 52%, #fed7aa 100%)",
    accentGlow: "rgba(234, 88, 12, 0.28)",
  },
  stock_lecturas: {
    accent: "#2563eb",
    accentSoft: "linear-gradient(145deg, #eff6ff 0%, #dbeafe 52%, #bfdbfe 100%)",
    accentGlow: "rgba(37, 99, 235, 0.28)",
  },
  stock_dispositivos: {
    accent: "#92400e",
    accentSoft: "linear-gradient(145deg, #fffbeb 0%, #fde68a 40%, #fbbf24 100%)",
    accentGlow: "rgba(146, 64, 14, 0.26)",
  },
  stock_salidas: {
    accent: "#be123c",
    accentSoft: "linear-gradient(145deg, #fff1f2 0%, #ffe4e6 52%, #fecdd3 100%)",
    accentGlow: "rgba(190, 18, 60, 0.26)",
  },
  ventas_ingresar: {
    accent: "#059669",
    accentSoft: "linear-gradient(145deg, #ecfdf5 0%, #d1fae5 52%, #a7f3d0 100%)",
    accentGlow: "rgba(5, 150, 105, 0.28)",
  },
  ventas_listado: {
    accent: "#2563eb",
    accentSoft: "linear-gradient(145deg, #eff6ff 0%, #dbeafe 52%, #bfdbfe 100%)",
    accentGlow: "rgba(37, 99, 235, 0.28)",
  },
  ventas_rubros: {
    accent: "#d97706",
    accentSoft: "linear-gradient(145deg, #fffbeb 0%, #fef3c7 52%, #fde68a 100%)",
    accentGlow: "rgba(217, 119, 6, 0.28)",
  },
  ventas_ganado: {
    accent: "#92400e",
    accentSoft: "linear-gradient(145deg, #fffbeb 0%, #fde68a 40%, #fbbf24 100%)",
    accentGlow: "rgba(146, 64, 14, 0.26)",
  },
  ventas_agricultura: {
    accent: "#16a34a",
    accentSoft: "linear-gradient(145deg, #f0fdf4 0%, #dcfce7 52%, #bbf7d0 100%)",
    accentGlow: "rgba(22, 163, 74, 0.28)",
  },
  ventas_arrendamientos: {
    accent: "#7c3aed",
    accentSoft: "linear-gradient(145deg, #f5f3ff 0%, #ede9fe 52%, #ddd6fe 100%)",
    accentGlow: "rgba(124, 58, 237, 0.28)",
  },
  divisas_usd: {
    accent: "#0d9488",
    accentSoft: "linear-gradient(145deg, #f0fdfa 0%, #ccfbf1 52%, #99f6e4 100%)",
    accentGlow: "rgba(13, 148, 136, 0.28)",
  },
  divisas_brl: {
    accent: "#16a34a",
    accentSoft: "linear-gradient(145deg, #f0fdf4 0%, #dcfce7 52%, #bbf7d0 100%)",
    accentGlow: "rgba(22, 163, 74, 0.28)",
  },
  usuarios_permisos_rol: {
    accent: "#b45309",
    accentSoft: "linear-gradient(145deg, #fffbeb 0%, #fef3c7 52%, #fde68a 100%)",
    accentGlow: "rgba(180, 83, 9, 0.28)",
  },
  arquitectura_sistema: {
    accent: "#0369a1",
    accentSoft: "linear-gradient(145deg, #f0f9ff 0%, #e0f2fe 52%, #bae6fd 100%)",
    accentGlow: "rgba(3, 105, 161, 0.28)",
  },
};
