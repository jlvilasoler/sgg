import { Mic, MicOff } from "lucide-react";

type Props = {
  escuchando: boolean;
  disabled?: boolean;
  onToggle: () => void;
  className?: string;
};

/** 1 toque = empezar a preguntar · 2º toque = finalizar. */
export default function AsistenteVozButton({
  escuchando,
  disabled = false,
  onToggle,
  className = "",
}: Props) {
  return (
    <button
      type="button"
      className={`asistente-voz-btn${escuchando ? " is-listening" : ""}${className ? ` ${className}` : ""}`}
      disabled={disabled}
      aria-pressed={escuchando}
      aria-label={escuchando ? "Finalizar pregunta por voz" : "Preguntar por voz"}
      title={
        escuchando
          ? "Tocá de nuevo para finalizar la pregunta"
          : "Tocá una vez, hablá tu pregunta y tocá de nuevo al terminar"
      }
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
    >
      {escuchando ? <MicOff size={16} aria-hidden /> : <Mic size={16} aria-hidden />}
      <span>{escuchando ? "Listo" : "Voz"}</span>
    </button>
  );
}
