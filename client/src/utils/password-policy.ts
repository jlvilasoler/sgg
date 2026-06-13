export const PASSWORD_POLICY_HINT =
  "Mínimo 10 caracteres, con mayúscula, minúscula, número y símbolo especial.";

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 10) {
    return "La contraseña debe tener al menos 10 caracteres";
  }
  if (password.length > 128) {
    return "La contraseña no puede superar 128 caracteres";
  }
  if (!/[a-z]/.test(password)) {
    return "La contraseña debe incluir al menos una minúscula";
  }
  if (!/[A-Z]/.test(password)) {
    return "La contraseña debe incluir al menos una mayúscula";
  }
  if (!/[0-9]/.test(password)) {
    return "La contraseña debe incluir al menos un número";
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return "La contraseña debe incluir al menos un símbolo especial";
  }
  return null;
}
