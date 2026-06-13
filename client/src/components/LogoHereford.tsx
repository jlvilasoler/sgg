/** Logo oficial (adjunto 1) — public/logo-hereford.png */
export default function LogoHereford({ className = "" }: { className?: string }) {
  return (
    <img
      src="/logo-hereford.png?v=8"
      className={className}
      alt=""
      width={56}
      height={56}
      decoding="async"
    />
  );
}
