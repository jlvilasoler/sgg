/**
 * @deprecated logo1 — logo fotográfico legacy (public/logo-hereford.png).
 * Usar LogoSgg en pantallas nuevas.
 */
import LogoSgg from "./LogoSgg";

export default function LogoHereford({ className = "" }: { className?: string }) {
  return <LogoSgg className={className} variant="badge" />;
}
