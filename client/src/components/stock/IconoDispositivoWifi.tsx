/** Icono señal / dispositivo RFID — filas y cabecera de edición */
export default function IconoDispositivoWifi({
  className = "",
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
    >
      <path
        d="M12 3C7.03 3 2.75 5.11 0 8.25l1.68 1.58C3.98 7.19 7.78 5.25 12 5.25s8.02 1.94 10.32 4.58L24 8.25C21.25 5.11 16.97 3 12 3zm0 5c-2.87 0-5.43 1.19-7.28 3.1l1.67 1.57C7.56 11.26 9.66 10.25 12 10.25s4.44 1.01 6.61 2.42l1.67-1.57C18.43 9.19 15.87 8 12 8zm0 5c-1.57 0-2.98.64-4.01 1.67L12 18.5l4.01-3.83C14.98 13.64 13.57 13 12 13z"
        fill="currentColor"
      />
    </svg>
  );
}
