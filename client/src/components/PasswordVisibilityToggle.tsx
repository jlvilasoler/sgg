import PasswordEyeIcon from "./icons/PasswordEyeIcon";

interface Props {
  visible: boolean;
  onToggle: () => void;
}

export default function PasswordVisibilityToggle({ visible, onToggle }: Props) {
  return (
    <button
      type="button"
      className="password-visibility-toggle"
      onClick={onToggle}
      tabIndex={-1}
      aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
      aria-pressed={visible}
      title={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
    >
      <PasswordEyeIcon open={visible} size={20} />
    </button>
  );
}
