import type { ReactNode } from "react";
import type { TabId } from "../Header";

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

function IconRegistro({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path
        d="M8 4h8l2 2v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"
        {...stroke}
      />
      <path d="M9 9h6M9 13h4" {...stroke} />
      <path d="M15 3v3h3" {...stroke} />
      <circle cx="17.5" cy="17.5" r="3.25" fill="currentColor" fillOpacity="0.14" />
      <path d="M17.5 16v3M16 17.5h3" {...stroke} strokeWidth="1.5" />
    </IconShell>
  );
}

function IconListado({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path
        d="M9 5H20a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9l4-4Z"
        {...stroke}
      />
      <path d="M9 5v4h4M8 12h8M8 16h6" {...stroke} />
    </IconShell>
  );
}

function IconResumen({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path d="M4 19V5M4 19h16" {...stroke} />
      <rect x="7" y="11" width="3" height="8" rx="1" fill="currentColor" fillOpacity="0.22" />
      <rect x="12" y="8" width="3" height="11" rx="1" fill="currentColor" fillOpacity="0.35" />
      <rect x="17" y="5" width="3" height="14" rx="1" fill="currentColor" fillOpacity="0.5" />
    </IconShell>
  );
}

function IconConfiguracion({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <circle cx="12" cy="12" r="2.75" {...stroke} />
      <path
        d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.55 1.55M16.85 16.85l1.55 1.55M5.6 18.4l1.55-1.55M16.85 7.15l1.55-1.55"
        {...stroke}
      />
    </IconShell>
  );
}

function IconDivisas({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <circle cx="8" cy="8" r="4.25" {...stroke} />
      <circle cx="16" cy="16" r="4.25" {...stroke} />
      <path d="M10.2 13.8l3.6 3.6M13.8 10.2l3.6-3.6" {...stroke} />
      <path d="M8 6.2v3.6M6.2 8h3.6M16 13.8v3.6M14.2 15.6h3.6" {...stroke} strokeWidth="1.4" />
    </IconShell>
  );
}

function IconRecursosHumanos({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <circle cx="9" cy="8.5" r="2.75" {...stroke} />
      <path d="M4.5 19v-.75c0-2.35 2.01-4.25 4.5-4.25s4.5 1.9 4.5 4.25V19" {...stroke} />
      <circle cx="16.5" cy="9.25" r="2.25" {...stroke} strokeWidth="1.45" />
      <path
        d="M14.25 19v-.5c0-1.75 1.35-3.15 3.25-3.15.55 0 1.07.12 1.5.35"
        {...stroke}
        strokeWidth="1.45"
      />
    </IconShell>
  );
}

function IconIngresosVentas({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path d="M4 17l4.5-5 3.5 3.5L16 9l4 4" {...stroke} />
      <circle cx="18.5" cy="6.5" r="3" fill="currentColor" fillOpacity="0.16" />
      <path d="M18.5 5.2v2.6M17.2 6.5h2.6" {...stroke} strokeWidth="1.4" />
      <path d="M4 19h16" {...stroke} />
    </IconShell>
  );
}

function IconStockGanadero({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path
        d="M6.5 14.5c1.2-2.8 3.4-4.5 5.5-4.5s4.3 1.7 5.5 4.5"
        {...stroke}
      />
      <path d="M4.5 14.5h15" {...stroke} />
      <path d="M8 10.5c.6-1.6 2-2.8 4-2.8s3.4 1.2 4 2.8" {...stroke} />
      <circle cx="9.25" cy="8.75" r=".85" fill="currentColor" />
      <circle cx="14.75" cy="8.75" r=".85" fill="currentColor" />
      <path d="M10.5 12.25c.55.35 1.2.55 1.9.55s1.35-.2 1.9-.55" {...stroke} strokeWidth="1.4" />
      <path
        d="M17.75 6.25l1.5 1.1-1.5 1.1"
        {...stroke}
        strokeWidth="1.4"
      />
      <path d="M16.25 7.35h3" {...stroke} strokeWidth="1.4" />
    </IconShell>
  );
}

function IconStockMovimientos({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path d="M5 6h14M5 12h10M5 18h12" {...stroke} />
      <circle cx="18.5" cy="12" r="2.5" fill="currentColor" fillOpacity="0.15" />
      <path d="M17.4 12l1.1 1.1 2.2-2.2" {...stroke} strokeWidth="1.5" />
      <path d="M8.5 6v12" {...stroke} strokeWidth="1.2" strokeOpacity="0.35" />
    </IconShell>
  );
}

function IconRegistroActividad({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path
        d="M8 4h8l2 2v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"
        {...stroke}
      />
      <path d="M9 9h6M9 13h4M9 17h5" {...stroke} />
      <path d="M15 3v3h3" {...stroke} />
      <circle cx="18" cy="18" r="3" fill="currentColor" fillOpacity="0.14" />
      <path d="M18 16.5v3M16.5 18h3" {...stroke} strokeWidth="1.4" />
    </IconShell>
  );
}

function IconUsuarios({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path
        d="M12 3.5a4.25 4.25 0 0 1 2.65 7.55A5.75 5.75 0 0 1 18.5 19H5.5a5.75 5.75 0 0 1 3.85-7.95A4.25 4.25 0 0 1 12 3.5Z"
        {...stroke}
      />
      <path d="M10.25 12.75h3.5" {...stroke} strokeWidth="1.4" />
      <circle cx="12" cy="10.25" r=".9" fill="currentColor" />
    </IconShell>
  );
}

function IconChat({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path
        d="M5 18.5V8.8a2.2 2.2 0 0 1 2.2-2.2h9.6A2.2 2.2 0 0 1 19 8.8v5.4a2.2 2.2 0 0 1-2.2 2.2H9.5L5 18.5Z"
        {...stroke}
      />
      <path d="M8.5 10h7M8.5 13h4.5" {...stroke} />
    </IconShell>
  );
}

const ICONS: Record<TabId, (props: IconProps) => ReactNode> = {
  registro: IconRegistro,
  listado: IconListado,
  resumen: IconResumen,
  configuracion: IconConfiguracion,
  divisas: IconDivisas,
  recursos_humanos: IconRecursosHumanos,
  ingresos_ventas: IconIngresosVentas,
  stock_ganadero: IconStockGanadero,
  stock_movimientos: IconStockMovimientos,
  registro_actividad: IconRegistroActividad,
  usuarios: IconUsuarios,
  chat: IconChat,
};

export function MenuAppIcon({ id, className }: { id: TabId; className?: string }) {
  const Icon = ICONS[id];
  return <Icon className={className} />;
}

export interface MenuAppTheme {
  accent: string;
  accentSoft: string;
  accentGlow: string;
}

export const MENU_APP_THEMES: Record<TabId, MenuAppTheme> = {
  registro: {
    accent: "#059669",
    accentSoft: "linear-gradient(145deg, #ecfdf5 0%, #d1fae5 52%, #a7f3d0 100%)",
    accentGlow: "rgba(5, 150, 105, 0.28)",
  },
  listado: {
    accent: "#2563eb",
    accentSoft: "linear-gradient(145deg, #eff6ff 0%, #dbeafe 52%, #bfdbfe 100%)",
    accentGlow: "rgba(37, 99, 235, 0.28)",
  },
  resumen: {
    accent: "#d97706",
    accentSoft: "linear-gradient(145deg, #fffbeb 0%, #fef3c7 52%, #fde68a 100%)",
    accentGlow: "rgba(217, 119, 6, 0.28)",
  },
  configuracion: {
    accent: "#64748b",
    accentSoft: "linear-gradient(145deg, #f8fafc 0%, #f1f5f9 52%, #e2e8f0 100%)",
    accentGlow: "rgba(100, 116, 139, 0.22)",
  },
  divisas: {
    accent: "#0d9488",
    accentSoft: "linear-gradient(145deg, #f0fdfa 0%, #ccfbf1 52%, #99f6e4 100%)",
    accentGlow: "rgba(13, 148, 136, 0.28)",
  },
  recursos_humanos: {
    accent: "#7c3aed",
    accentSoft: "linear-gradient(145deg, #f5f3ff 0%, #ede9fe 52%, #ddd6fe 100%)",
    accentGlow: "rgba(124, 58, 237, 0.28)",
  },
  ingresos_ventas: {
    accent: "#ca8a04",
    accentSoft: "linear-gradient(145deg, #fefce8 0%, #fef9c3 52%, #fde047 100%)",
    accentGlow: "rgba(202, 138, 4, 0.3)",
  },
  stock_ganadero: {
    accent: "#92400e",
    accentSoft: "linear-gradient(145deg, #fffbeb 0%, #fde68a 40%, #fbbf24 100%)",
    accentGlow: "rgba(146, 64, 14, 0.26)",
  },
  stock_movimientos: {
    accent: "#ea580c",
    accentSoft: "linear-gradient(145deg, #fff7ed 0%, #ffedd5 52%, #fed7aa 100%)",
    accentGlow: "rgba(234, 88, 12, 0.28)",
  },
  registro_actividad: {
    accent: "#0891b2",
    accentSoft: "linear-gradient(145deg, #ecfeff 0%, #cffafe 52%, #a5f3fc 100%)",
    accentGlow: "rgba(8, 145, 178, 0.28)",
  },
  usuarios: {
    accent: "#4f46e5",
    accentSoft: "linear-gradient(145deg, #eef2ff 0%, #e0e7ff 52%, #c7d2fe 100%)",
    accentGlow: "rgba(79, 70, 229, 0.28)",
  },
  chat: {
    accent: "#0d9488",
    accentSoft: "linear-gradient(145deg, #f0fdfa 0%, #ccfbf1 52%, #99f6e4 100%)",
    accentGlow: "rgba(13, 148, 136, 0.28)",
  },
};
