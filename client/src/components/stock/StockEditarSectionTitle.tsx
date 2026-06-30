type SectionIcon = "ficha" | "foto" | "evolucion";

interface Props {
  icon: SectionIcon;
  children: string;
  className?: string;
  as?: "h3" | "h4";
}

function SectionIconSvg({ icon }: { icon: SectionIcon }) {
  switch (icon) {
    case "ficha":
      return (
        <svg viewBox="0 0 24 24" aria-hidden focusable="false">
          <path
            d="M8 3h8l2 2h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h3Zm1 7h6v1.5H9V10Zm0 3.5h4V15H9v-1.5Z"
            fill="currentColor"
          />
        </svg>
      );
    case "foto":
      return (
        <svg viewBox="0 0 24 24" aria-hidden focusable="false">
          <path
            d="M9 3h6l1 2h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l1-2Zm3 16a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"
            fill="currentColor"
          />
        </svg>
      );
    case "evolucion":
      return (
        <svg viewBox="0 0 24 24" aria-hidden focusable="false">
          <path
            d="M4 18.5V5.75A.75.75 0 0 1 4.75 5h2.5a.75.75 0 0 1 .75.75V16.5h11.75a.75.75 0 0 1 .75.75v2.5a.75.75 0 0 1-.75.75H4.75a.75.75 0 0 1-.75-.75ZM8.22 14.03l2.56-2.8 2.35 2.1 3.42-4.38a.75.75 0 0 1 1.18.93l-4.05 5.18a.75.75 0 0 1-1.1.04l-2.62-2.34-1.74 1.9a.75.75 0 0 1-1.06-1.06Z"
            fill="currentColor"
          />
        </svg>
      );
  }
}

export default function StockEditarSectionTitle({
  icon,
  children,
  className = "",
  as: Tag = "h3",
}: Props) {
  return (
    <Tag
      className={`stock-editar-section-title stock-editar-section-title--${icon} ${className}`.trim()}
    >
      <span className="stock-editar-section-title-icon" aria-hidden>
        <SectionIconSvg icon={icon} />
      </span>
      <span className="stock-editar-section-title-text">{children}</span>
    </Tag>
  );
}
