import type { ReactNode } from "react";
import { ArrowLeftRight, CircleDollarSign } from "lucide-react";
import type { TabId } from "../Header";
import { StockGanaderoModuleIcon, StockEquinoModuleIcon } from "../stock/StockControlSanitarioSectionTitle";

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
  return <ArrowLeftRight className={className} strokeWidth={1.65} />;
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
  return <StockGanaderoModuleIcon className={className} size={24} strokeWidth={1.65} />;
}

function IconStockEquino({ className }: IconProps) {
  return <StockEquinoModuleIcon className={className} size={24} strokeWidth={1.65} />;
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

function IconPreciosGanado({ className }: IconProps) {
  return (
    <CircleDollarSign
      className={className}
      size={24}
      strokeWidth={1.65}
      aria-hidden
    />
  );
}

function IconSimuladorVentaGanado({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <rect x="5" y="4" width="14" height="16" rx="2" {...stroke} />
      <path d="M8 8h8M8 11h3M13 11h3M8 14h3M13 14h3M8 17h8" {...stroke} strokeWidth="1.4" />
      <circle cx="17.5" cy="6.5" r="3" fill="currentColor" fillOpacity="0.14" />
      <path d="M16.2 6.5h2.6M17.5 5.2v2.6" {...stroke} strokeWidth="1.3" />
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

function IconNotas({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path
        d="M7 4.5h10l2 2V19a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1Z"
        {...stroke}
      />
      <path d="M15 4.5V7h2.5" {...stroke} />
      <path d="M8.5 10.5h7M8.5 13.5h7M8.5 16.5h5" {...stroke} strokeWidth="1.4" />
      <path
        d="M16.75 15.25h2.75l-1 1 .4 1.35-1.15-.7-1.15.7.4-1.35-1-1Z"
        fill="currentColor"
        fillOpacity="0.22"
        stroke="currentColor"
        strokeWidth="1.1"
      />
    </IconShell>
  );
}

function IconPanelAdminSitio({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path
        d="M12 3.5 5.5 6.25V11c0 3.65 2.75 7.05 6.5 8 3.75-.95 6.5-4.35 6.5-8V6.25L12 3.5Z"
        {...stroke}
      />
      <rect x="8.5" y="9.25" width="7" height="5.25" rx="1.1" {...stroke} strokeWidth="1.45" />
      <path d="M10.25 11.75h3.5M10.25 13.5h2.25" {...stroke} strokeWidth="1.35" />
      <circle cx="12" cy="7.25" r="1.1" fill="currentColor" fillOpacity="0.22" />
    </IconShell>
  );
}

function IconVencimientosImpuestos({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path d="M7 4v2M17 4v2" {...stroke} />
      <rect x="4" y="5.5" width="16" height="14.5" rx="2" {...stroke} />
      <path d="M4 10.5h16" {...stroke} />
      <path d="M8 14.5h3M8 17h5" {...stroke} strokeWidth="1.4" />
      <circle cx="16.5" cy="16.5" r="2.25" fill="currentColor" fillOpacity="0.18" {...stroke} strokeWidth="1.4" />
    </IconShell>
  );
}

function IconCampoMapa({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path
        d="M4.5 18.5 12 5.5l7.5 13"
        {...stroke}
      />
      <path d="M8.5 14.5h7" {...stroke} />
      <circle cx="12" cy="11.5" r="1.35" fill="currentColor" fillOpacity="0.35" />
      <path
        d="M16.5 8.5c1.4.8 2.3 2.1 2.5 3.8"
        {...stroke}
        strokeWidth="1.4"
      />
    </IconShell>
  );
}

function IconTareasOperativas({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <rect x="4.5" y="5.5" width="15" height="14" rx="1.5" {...stroke} />
      <path d="M8 4v3M16 4v3M4.5 10h15" {...stroke} strokeWidth="1.4" />
      <path d="M8.5 13.5h2.2M8.5 16.5h4.5" {...stroke} strokeWidth="1.4" />
      <path
        d="M14.5 14.2 15.8 15.5 18.2 12.8"
        {...stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconShell>
  );
}

function IconDocumentosDigitales({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path
        d="M6 5.5h7l3 3V18.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1Z"
        {...stroke}
      />
      <path d="M13 5.5V8.5h3" {...stroke} />
      <path d="M8 11.5h8M8 14.5h6M8 17.5h4" {...stroke} strokeWidth="1.4" />
      <path
        d="M16.5 14.5h3.5l-1.2 1.2.45 1.55-1.35-.8-1.35.8.45-1.55-1.2-1.2Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </IconShell>
  );
}

function IconAyuda({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <path d="M5.5 5.5A6.5 6.5 0 0 1 18.5 8.5c0 2.2-1.2 3.8-2.8 4.9-.9.7-1.5 1.3-1.9 2.1-.4.8-.5 1.5-.5 2.5" {...stroke} />
      <path d="M12 18.75h.01" {...stroke} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M6 4.5h11.5a1.5 1.5 0 0 1 1.5 1.5V18a1.5 1.5 0 0 1-1.5 1.5H8l-2.5 2v-2.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" {...stroke} />
    </IconShell>
  );
}

function IconAsistente({ className }: IconProps) {
  return (
    <IconShell className={className}>
      <circle cx="12" cy="12" r="8.25" {...stroke} />
      <path d="M8.2 13.2c.7 1.5 2 2.4 3.8 2.4s3.1-.9 3.8-2.4" {...stroke} strokeWidth="1.4" />
      <circle cx="9.2" cy="10.2" r="0.9" fill="currentColor" />
      <circle cx="14.8" cy="10.2" r="0.9" fill="currentColor" />
      <path d="M12 4.2v1.6M12 18.2v1.6M4.2 12h1.6M18.2 12h1.6" {...stroke} strokeWidth="1.3" />
    </IconShell>
  );
}

const ICONS: Record<TabId, (props: IconProps) => ReactNode> = {
  registro: IconRegistro,
  listado: IconListado,
  vencimientos_impuestos: IconVencimientosImpuestos,
  resumen: IconResumen,
  configuracion: IconConfiguracion,
  divisas: IconDivisas,
  precios_ganado: IconPreciosGanado,
  simulador_venta_ganado: IconSimuladorVentaGanado,
  recursos_humanos: IconRecursosHumanos,
  ingresos_ventas: IconIngresosVentas,
  stock_ganadero: IconStockGanadero,
  campo_mapa: IconCampoMapa,
  tareas_operativas: IconTareasOperativas,
  stock_equino: IconStockEquino,
  stock_movimientos: IconStockMovimientos,
  registro_actividad: IconRegistroActividad,
  notas: IconNotas,
  usuarios: IconUsuarios,
  panel_admin_sitio: IconPanelAdminSitio,
  chat: IconChat,
  ayuda: IconAyuda,
  asistente: IconAsistente,
  documentos_digitales: IconDocumentosDigitales,
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
  vencimientos_impuestos: {
    accent: "#be123c",
    accentSoft: "linear-gradient(145deg, #fff1f2 0%, #ffe4e6 52%, #fecdd3 100%)",
    accentGlow: "rgba(190, 18, 60, 0.28)",
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
  precios_ganado: {
    accent: "#b45309",
    accentSoft: "linear-gradient(145deg, #fffbeb 0%, #fde68a 45%, #fbbf24 100%)",
    accentGlow: "rgba(180, 83, 9, 0.28)",
  },
  simulador_venta_ganado: {
    accent: "#0d9488",
    accentSoft: "linear-gradient(145deg, #ecfdf5 0%, #ccfbf1 52%, #99f6e4 100%)",
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
  campo_mapa: {
    accent: "#15803d",
    accentSoft: "linear-gradient(145deg, #f0fdf4 0%, #dcfce7 52%, #bbf7d0 100%)",
    accentGlow: "rgba(21, 128, 61, 0.28)",
  },
  tareas_operativas: {
    accent: "#0369a1",
    accentSoft: "linear-gradient(145deg, #f0f9ff 0%, #e0f2fe 52%, #bae6fd 100%)",
    accentGlow: "rgba(3, 105, 161, 0.28)",
  },
  stock_equino: {
    accent: "#4338ca",
    accentSoft: "linear-gradient(145deg, #eef2ff 0%, #e0e7ff 45%, #c7d2fe 100%)",
    accentGlow: "rgba(67, 56, 202, 0.28)",
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
  notas: {
    accent: "#ca8a04",
    accentSoft: "linear-gradient(145deg, #fefce8 0%, #fef9c3 52%, #fde68a 100%)",
    accentGlow: "rgba(202, 138, 4, 0.28)",
  },
  usuarios: {
    accent: "#4f46e5",
    accentSoft: "linear-gradient(145deg, #eef2ff 0%, #e0e7ff 52%, #c7d2fe 100%)",
    accentGlow: "rgba(79, 70, 229, 0.28)",
  },
  panel_admin_sitio: {
    accent: "#b45309",
    accentSoft: "linear-gradient(145deg, #fff7ed 0%, #ffedd5 45%, #fdba74 100%)",
    accentGlow: "rgba(180, 83, 9, 0.32)",
  },
  chat: {
    accent: "#0d9488",
    accentSoft: "linear-gradient(145deg, #f0fdfa 0%, #ccfbf1 52%, #99f6e4 100%)",
    accentGlow: "rgba(13, 148, 136, 0.28)",
  },
  documentos_digitales: {
    accent: "#0369a1",
    accentSoft: "linear-gradient(145deg, #f0f9ff 0%, #e0f2fe 52%, #bae6fd 100%)",
    accentGlow: "rgba(3, 105, 161, 0.28)",
  },
  ayuda: {
    accent: "#4f46e5",
    accentSoft: "linear-gradient(145deg, #eef2ff 0%, #e0e7ff 52%, #c7d2fe 100%)",
    accentGlow: "rgba(79, 70, 229, 0.28)",
  },
  asistente: {
    accent: "#0f766e",
    accentSoft: "linear-gradient(145deg, #f0fdfa 0%, #ccfbf1 52%, #99f6e4 100%)",
    accentGlow: "rgba(15, 118, 110, 0.28)",
  },
};
