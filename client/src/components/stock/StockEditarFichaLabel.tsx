export type FichaLabelIcon =
  | "empresa"
  | "color"
  | "raza"
  | "sexo"
  | "nacimiento"
  | "anio"
  | "grupo"
  | "potrero"
  | "edad"
  | "generacion"
  | "estado"
  | "nombre"
  | "observaciones";

interface Props {
  icon: FichaLabelIcon;
  children: string;
  htmlFor?: string;
  as?: "label" | "span";
  variant?: "toolbar" | "stat" | "cabana";
  className?: string;
}

export function FichaLabelIconSvg({ icon }: { icon: FichaLabelIcon }) {
  switch (icon) {
    case "empresa":
      return (
        <svg viewBox="0 0 24 24" aria-hidden focusable="false">
          <path
            d="M4 20V4h8v4h8v12H4Zm2-2h4v-4H6v4Zm0-6h4V8H6v4Zm6 6h4v-7h-4v7Zm0-9h4V6h-4v3Z"
            fill="currentColor"
          />
        </svg>
      );
    case "color":
      return (
        <svg viewBox="0 0 24 24" aria-hidden focusable="false">
          <path
            d="M12 3c-4.97 0-9 4.03-9 9 0 2.39 1.01 4.55 2.62 6.07L12 22l6.38-3.93C19.99 16.55 21 14.39 21 12c0-4.97-4.03-9-9-9Zm0 2.5c3.59 0 6.5 2.91 6.5 6.5 0 1.55-.55 2.98-1.46 4.09L12 19.5l-5.04-3.41A6.44 6.44 0 0 1 5.5 12c0-3.59 2.91-6.5 6.5-6.5Z"
            fill="currentColor"
          />
        </svg>
      );
    case "raza":
      return (
        <svg viewBox="0 0 24 24" aria-hidden focusable="false">
          <path
            d="M12 3c-1.2 1.8-2.4 3.1-3.6 4.2C6.8 8.8 5 10.6 5 13c0 3.9 3.1 7 7 7s7-3.1 7-7c0-2.4-1.8-4.2-3.4-5.8C14.4 6.1 13.2 4.8 12 3Zm0 16.5c-2.9 0-5.2-2.3-5.2-5.2 0-1.5 1.1-2.8 2.4-4.1 1-.9 2-1.9 2.8-3.1.8 1.2 1.8 2.2 2.8 3.1 1.3 1.3 2.4 2.6 2.4 4.1 0 2.9-2.3 5.2-5.2 5.2Z"
            fill="currentColor"
          />
        </svg>
      );
    case "sexo":
      return (
        <svg viewBox="0 0 24 24" aria-hidden focusable="false">
          <path
            d="M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM14.5 13a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM7.8 12.2 6 14h3.6l-.8-1.8ZM16.2 11.8 18 10h-3.6l.8 1.8Z"
            fill="currentColor"
          />
        </svg>
      );
    case "nacimiento":
      return (
        <svg viewBox="0 0 24 24" aria-hidden focusable="false">
          <path
            d="M7 2h2v2h6V2h2v2h3a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3V2Zm13 8H4v10h16V10ZM9 14h2v2H9v-2Z"
            fill="currentColor"
          />
        </svg>
      );
    case "anio":
      return (
        <svg viewBox="0 0 24 24" aria-hidden focusable="false">
          <path
            d="M5 4h14a1 1 0 0 1 1 1v3H4V5a1 1 0 0 1 1-1Zm15 6v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9h16ZM8 16h2v2H8v-2Zm4-3h2v5h-2v-5Zm4 1h2v4h-2v-4Z"
            fill="currentColor"
          />
        </svg>
      );
    case "grupo":
      return (
        <svg viewBox="0 0 24 24" aria-hidden focusable="false">
          <path
            d="M4 6a2 2 0 0 1 2-2h3v14H6a2 2 0 0 1-2-2V6Zm7-2h3a2 2 0 0 1 2 2v12h-5V4Zm7 0h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-3V4Z"
            fill="currentColor"
          />
        </svg>
      );
    case "potrero":
      return (
        <svg viewBox="0 0 24 24" aria-hidden focusable="false">
          <path
            d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Zm2 1.2V19h3v-6h8v6h3v-7.3L12 6.6 5 11.7Z"
            fill="currentColor"
          />
        </svg>
      );
    case "edad":
      return (
        <svg viewBox="0 0 24 24" aria-hidden focusable="false">
          <path
            d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 2a8 8 0 1 1-8 8 8 8 0 0 1 8-8Zm-.75 3.5v5.25l4.5 2.7.75-1.23-3.75-2.22V7.5h-1.5Z"
            fill="currentColor"
          />
        </svg>
      );
    case "generacion":
      return (
        <svg viewBox="0 0 24 24" aria-hidden focusable="false">
          <path
            d="M12 3 4 9v12h6v-7h4v7h6V9l-8-6Zm0 2.8L18 10v9h-2v-7h-8v7H6v-9l6-4.2Z"
            fill="currentColor"
          />
        </svg>
      );
    case "estado":
      return (
        <svg viewBox="0 0 24 24" aria-hidden focusable="false">
          <path
            d="M12 2a7 7 0 0 0-4 12.8V22h8v-7.2A7 7 0 0 0 12 2Zm0 2a5 5 0 0 1 3.2 8.8l-.2.2V20h-6v-7l-.2-.2A5 5 0 0 1 12 4Z"
            fill="currentColor"
          />
        </svg>
      );
    case "nombre":
      return (
        <svg viewBox="0 0 24 24" aria-hidden focusable="false">
          <path
            d="M21.41 11.58 12.59 2.76A2 2 0 0 0 11.17 2H4c-1.1 0-2 .9-2 2v7.17c0 .53.21 1.04.59 1.41l8.82 8.82c.78.78 2.05.78 2.83 0l7.17-7.17c.78-.78.78-2.05 0-2.83ZM6 7.5A1.5 1.5 0 1 1 7.5 6 1.5 1.5 0 0 1 6 7.5Z"
            fill="currentColor"
          />
        </svg>
      );
    case "observaciones":
      return (
        <svg viewBox="0 0 24 24" aria-hidden focusable="false">
          <path
            d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2Zm-5 14H7v-2h7v2Zm3-4H7v-2h10v2Zm0-4H7V7h10v2Z"
            fill="currentColor"
          />
        </svg>
      );
  }
}

export default function StockEditarFichaLabel({
  icon,
  children,
  htmlFor,
  as,
  variant = "toolbar",
  className = "",
}: Props) {
  const Tag = as ?? (htmlFor ? "label" : "span");
  const baseClass =
    variant === "cabana"
      ? "stock-edit-cabana-field-label"
      : variant === "stat"
        ? "stock-editar-ficha-stat-label"
        : Tag === "span"
          ? "stock-editar-ficha-stat-label"
          : "stock-editar-ficha-label";

  return (
    <Tag
      className={`${baseClass} stock-editar-ficha-label--${icon} ${className}`.trim()}
      {...(htmlFor ? { htmlFor } : {})}
    >
      <span className="stock-editar-ficha-label-icon" aria-hidden>
        <FichaLabelIconSvg icon={icon} />
      </span>
      <span className="stock-editar-ficha-label-text">{children}</span>
    </Tag>
  );
}
