import type { ReactNode } from "react";
import type { LucideProps } from "lucide-react";
import {
  Barcode,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  History,
  KeyRound,
  Nfc,
  PillBottle,
  Syringe,
  Tags,
} from "lucide-react";
import IconoCaballoEquinoSvg from "./IconoCaballoEquinoSvg";

export type StockControlSanitarioSectionIcon =
  | "admin"
  | "producto"
  | "animal-vacuno"
  | "animal-equino"
  | "controles"
  | "historial";

export type StockControlSanitarioHeadIcon =
  | "header"
  | "modulo-ganadero"
  | "modulo-equino"
  | "registro"
  | "vid"
  | "eid"
  | "clave";

type AnyIcon = StockControlSanitarioSectionIcon | StockControlSanitarioHeadIcon;

const ICON_STROKE = 2.15;

function LucideBovineHoof({ size = 24, strokeWidth = ICON_STROKE, className }: LucideProps) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d="M9.25 18.25c-1.75 0-2.25-4.75-1.5-8.25.65-3 2.15-4.25 3.75-2.75 1.15 1.1 1.35 5.25.5 8.75-.35 1.45-.95 2.25-1.75 2.25" />
      <path d="M14.75 18.25c1.75 0 2.25-4.75 1.5-8.25-.65-3-2.15-4.25-3.75-2.75-1.15 1.1-1.35 5.25-.5 8.75.35 1.45.95 2.25 1.75 2.25" />
    </svg>
  );
}

function LucideHorseHoof({ size = 24, strokeWidth = ICON_STROKE, className }: LucideProps) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d="M12 6.75c-2.9 0-5.25 2.35-5.25 5.25 0 1.85.55 3.65 1.55 5.15.75 1.1 1.85 1.85 3.7 1.85s2.95-.75 3.7-1.85c1-1.5 1.55-3.3 1.55-5.15 0-2.9-2.35-5.25-5.25-5.25Z" />
      <path d="M10.25 18.5c.55.75 1.15 1 1.75 1s1.2-.25 1.75-1" />
    </svg>
  );
}

export function StockGanaderoModuleIcon({
  className,
  size = 16,
  strokeWidth = ICON_STROKE,
}: {
  className?: string;
  size?: number;
  strokeWidth?: number;
}) {
  return <Tags size={size} strokeWidth={strokeWidth} className={className} aria-hidden />;
}

export function StockEquinoModuleIcon({
  className,
  size = 16,
  strokeWidth = ICON_STROKE,
}: {
  className?: string;
  size?: number;
  strokeWidth?: number;
}) {
  return (
    <IconoCaballoEquinoSvg
      className={className}
      size={size}
      strokeWidth={strokeWidth}
    />
  );
}

function renderIcon(icon: AnyIcon, size: number) {
  const props: LucideProps = {
    size,
    strokeWidth: ICON_STROKE,
    "aria-hidden": true,
  };

  switch (icon) {
    case "header":
      return <Syringe {...props} />;
    case "modulo-ganadero":
      return <StockGanaderoModuleIcon size={size} strokeWidth={ICON_STROKE} />;
    case "modulo-equino":
      return <StockEquinoModuleIcon size={size} strokeWidth={ICON_STROKE} />;
    case "registro":
      return <ClipboardList {...props} />;
    case "vid":
      return <Nfc {...props} />;
    case "eid":
      return <Barcode {...props} />;
    case "clave":
      return <KeyRound {...props} />;
    case "admin":
      return <CalendarDays {...props} />;
    case "producto":
      return <PillBottle {...props} />;
    case "animal-vacuno":
      return <LucideBovineHoof {...props} />;
    case "animal-equino":
      return <LucideHorseHoof {...props} />;
    case "controles":
      return <ClipboardCheck {...props} />;
    case "historial":
      return <History {...props} />;
  }
}

export function StockControlSanitarioIconSvg({
  icon,
  size = 16,
}: {
  icon: AnyIcon;
  size?: number;
}) {
  return renderIcon(icon, size);
}

interface SectionTitleProps {
  icon: StockControlSanitarioSectionIcon;
  children: ReactNode;
  className?: string;
}

export default function StockControlSanitarioSectionTitle({
  icon,
  children,
  className = "",
}: SectionTitleProps) {
  return (
    <h3
      className={`stock-control-sanitario-section-title stock-control-sanitario-section-title--${icon.startsWith("animal-") ? "animal" : icon} ${className}`.trim()}
    >
      <span className="stock-control-sanitario-section-title-icon" aria-hidden>
        <StockControlSanitarioIconSvg icon={icon} size={14} />
      </span>
      <span className="stock-control-sanitario-section-title-text">{children}</span>
    </h3>
  );
}
