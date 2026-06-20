import { useState, type FormEvent } from "react";
import { cambiarPasswordAuth } from "../api";
import type { AuthUser } from "../types";
import {
  PASSWORD_POLICY_HINT,
  validatePasswordStrength,
} from "../utils/password-policy";
import PasswordVisibilityToggle from "./PasswordVisibilityToggle";

interface Props {
  user: AuthUser;
  open: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

function userIniciales(nombre: string): string {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function CambiarPasswordModal({
  user,
  open,
  onClose,
  onSuccess,
  onError,
}: Props) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [showActual, setShowActual] = useState(false);
  const [showNueva, setShowNueva] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const reset = () => {
    setActual("");
    setNueva("");
    setConfirmar("");
    setShowActual(false);
    setShowNueva(false);
    setShowConfirmar(false);
  };

  const handleClose = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!actual.trim()) {
      onError("Ingresá tu contraseña actual");
      return;
    }
    const pwErr = validatePasswordStrength(nueva);
    if (pwErr) {
      onError(pwErr);
      return;
    }
    if (nueva !== confirmar) {
      onError("La nueva contraseña y la confirmación no coinciden");
      return;
    }
    if (actual === nueva) {
      onError("La nueva contraseña debe ser distinta a la actual");
      return;
    }

    setSaving(true);
    try {
      const msg = await cambiarPasswordAuth(actual, nueva);
      reset();
      onSuccess(msg);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al cambiar contraseña");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cambiar-pw-overlay" role="presentation" onClick={handleClose}>
      <div
        className="cambiar-pw-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cambiar-pw-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="cambiar-pw-head">
          <div className="cambiar-pw-head-user">
            <span className="main-header-user-avatar main-header-user-avatar--lg" aria-hidden>
              {userIniciales(user.nombre)}
            </span>
            <div>
              <h2 id="cambiar-pw-title">Cambiar contraseña</h2>
              <p className="cambiar-pw-sub">
                {user.nombre} · {user.email}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost cambiar-pw-close"
            onClick={handleClose}
            disabled={saving}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </header>

        <form className="cambiar-pw-form" onSubmit={(e) => void submit(e)}>
          <p className="cambiar-pw-hint muted">{PASSWORD_POLICY_HINT}</p>

          <div className="field">
            <label htmlFor="pw-actual">Contraseña actual</label>
            <div className="password-field-row">
              <input
                id="pw-actual"
                type={showActual ? "text" : "password"}
                autoComplete="current-password"
                value={actual}
                disabled={saving}
                onChange={(e) => setActual(e.target.value)}
              />
              <PasswordVisibilityToggle
                visible={showActual}
                onToggle={() => setShowActual((v) => !v)}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="pw-nueva">Nueva contraseña</label>
            <div className="password-field-row">
              <input
                id="pw-nueva"
                type={showNueva ? "text" : "password"}
                autoComplete="new-password"
                value={nueva}
                disabled={saving}
                onChange={(e) => setNueva(e.target.value)}
              />
              <PasswordVisibilityToggle
                visible={showNueva}
                onToggle={() => setShowNueva((v) => !v)}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="pw-confirmar">Confirmar nueva contraseña</label>
            <div className="password-field-row">
              <input
                id="pw-confirmar"
                type={showConfirmar ? "text" : "password"}
                autoComplete="new-password"
                value={confirmar}
                disabled={saving}
                onChange={(e) => setConfirmar(e.target.value)}
              />
              <PasswordVisibilityToggle
                visible={showConfirmar}
                onToggle={() => setShowConfirmar((v) => !v)}
              />
            </div>
          </div>

          <p className="cambiar-pw-note muted">
            Por seguridad, al guardar se cerrará tu sesión y deberás iniciar sesión con la nueva
            contraseña.
          </p>

          <footer className="cambiar-pw-foot">
            <button type="button" className="btn btn-ghost" onClick={handleClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Guardando…" : "Actualizar contraseña"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

export function userInicialesFromNombre(nombre: string): string {
  return userIniciales(nombre);
}
