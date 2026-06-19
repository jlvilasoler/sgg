import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { cambiarPasswordAuth, quitarAvatarFoto, subirAvatarFoto } from "../api";
import type { AuthUser } from "../types";
import {
  PASSWORD_POLICY_HINT,
  validatePasswordStrength,
} from "../utils/password-policy";
import UserAvatar from "./UserAvatar";

interface Props {
  user: AuthUser;
  open: boolean;
  onClose: () => void;
  onUserUpdated: (user: AuthUser) => void;
  onPasswordChanged: (message: string) => void;
  onError: (message: string) => void;
}

const MAX_FOTO_MB = 2;
const FOTO_TIPOS = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export default function MiCuentaModal({
  user,
  open,
  onClose,
  onUserUpdated,
  onPasswordChanged,
  onError,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [showActual, setShowActual] = useState(false);
  const [showNueva, setShowNueva] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [savingFoto, setSavingFoto] = useState(false);
  const [fotoAmpliada, setFotoAmpliada] = useState(false);

  const tieneFoto = user.avatar.tipo === "foto" && !!user.avatar.url;

  useEffect(() => {
    if (!open) setFotoAmpliada(false);
  }, [open]);

  useEffect(() => {
    if (!fotoAmpliada) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFotoAmpliada(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fotoAmpliada]);

  if (!open) return null;

  const busy = savingPw || savingFoto;

  const resetPasswordFields = () => {
    setActual("");
    setNueva("");
    setConfirmar("");
    setShowActual(false);
    setShowNueva(false);
  };

  const handleClose = () => {
    if (busy) return;
    resetPasswordFields();
    onClose();
  };

  const handleFotoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!FOTO_TIPOS.includes(file.type)) {
      onError("Formato no permitido. Usá JPG, PNG, WebP o GIF.");
      return;
    }
    if (file.size > MAX_FOTO_MB * 1024 * 1024) {
      onError(`La imagen no puede superar ${MAX_FOTO_MB} MB`);
      return;
    }

    setSavingFoto(true);
    try {
      const updated = await subirAvatarFoto(file);
      onUserUpdated(updated);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al subir foto");
    } finally {
      setSavingFoto(false);
    }
  };

  const handleQuitarFoto = async () => {
    if (user.avatar.tipo !== "foto") return;
    setSavingFoto(true);
    try {
      const updated = await quitarAvatarFoto();
      onUserUpdated(updated);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al quitar foto");
    } finally {
      setSavingFoto(false);
    }
  };

  const submitPassword = async (e: FormEvent) => {
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

    setSavingPw(true);
    try {
      const msg = await cambiarPasswordAuth(actual, nueva);
      resetPasswordFields();
      onPasswordChanged(msg);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al cambiar contraseña");
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <>
    <div className="cambiar-pw-overlay" role="presentation" onClick={handleClose}>
      <div
        className="cambiar-pw-modal mi-cuenta-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mi-cuenta-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="cambiar-pw-head">
          <div className="cambiar-pw-head-user">
            <UserAvatar nombre={user.nombre} avatar={user.avatar} size="lg" />
            <div>
              <h2 id="mi-cuenta-title">Mi cuenta</h2>
              <p className="cambiar-pw-sub">
                {user.nombre} · {user.email}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost cambiar-pw-close"
            onClick={handleClose}
            disabled={busy}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </header>

        <section className="mi-cuenta-foto">
          <div className="mi-cuenta-foto-preview">
            {tieneFoto ? (
              <button
                type="button"
                className="mi-cuenta-foto-thumb-btn"
                onClick={() => setFotoAmpliada(true)}
                title="Ver foto más grande"
                aria-label="Ver foto de perfil ampliada"
              >
                <UserAvatar nombre={user.nombre} avatar={user.avatar} size="lg" />
              </button>
            ) : (
              <UserAvatar nombre={user.nombre} avatar={user.avatar} size="lg" />
            )}
            <div className="mi-cuenta-foto-text">
              <strong>Foto de perfil</strong>
              <p className="muted">
                Se muestra en el círculo del encabezado. La imagen se recorta en forma circular.
                {tieneFoto ? " Clic en la foto para verla más grande." : ""}
              </p>
            </div>
          </div>
          <div className="mi-cuenta-foto-actions">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="mi-cuenta-foto-input"
              disabled={busy}
              onChange={(e) => void handleFotoChange(e)}
            />
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              {savingFoto ? "Subiendo…" : user.avatar.tipo === "foto" ? "Cambiar foto" : "Subir foto"}
            </button>
            {user.avatar.tipo === "foto" && (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy}
                onClick={() => void handleQuitarFoto()}
              >
                Quitar foto
              </button>
            )}
          </div>
        </section>

        <form className="cambiar-pw-form" onSubmit={(e) => void submitPassword(e)}>
          <h3 className="mi-cuenta-section-title">Cambiar contraseña</h3>
          <p className="cambiar-pw-hint muted">{PASSWORD_POLICY_HINT}</p>

          <div className="field">
            <label htmlFor="pw-actual">Contraseña actual</label>
            <div className="cambiar-pw-input-wrap">
              <input
                id="pw-actual"
                type={showActual ? "text" : "password"}
                autoComplete="current-password"
                value={actual}
                disabled={busy}
                onChange={(e) => setActual(e.target.value)}
              />
              <button
                type="button"
                className="auth-login-toggle-pw cambiar-pw-toggle"
                onClick={() => setShowActual((v) => !v)}
                tabIndex={-1}
                aria-label={showActual ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showActual ? "Ocultar" : "Ver"}
              </button>
            </div>
          </div>

          <div className="field">
            <label htmlFor="pw-nueva">Nueva contraseña</label>
            <div className="cambiar-pw-input-wrap">
              <input
                id="pw-nueva"
                type={showNueva ? "text" : "password"}
                autoComplete="new-password"
                value={nueva}
                disabled={busy}
                onChange={(e) => setNueva(e.target.value)}
              />
              <button
                type="button"
                className="auth-login-toggle-pw cambiar-pw-toggle"
                onClick={() => setShowNueva((v) => !v)}
                tabIndex={-1}
                aria-label={showNueva ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showNueva ? "Ocultar" : "Ver"}
              </button>
            </div>
          </div>

          <div className="field">
            <label htmlFor="pw-confirmar">Confirmar nueva contraseña</label>
            <input
              id="pw-confirmar"
              type={showNueva ? "text" : "password"}
              autoComplete="new-password"
              value={confirmar}
              disabled={busy}
              onChange={(e) => setConfirmar(e.target.value)}
            />
          </div>

          <p className="cambiar-pw-note muted">
            Por seguridad, al guardar se cerrará tu sesión y deberás iniciar sesión con la nueva
            contraseña.
          </p>

          <footer className="cambiar-pw-foot">
            <button type="button" className="btn btn-ghost" onClick={handleClose} disabled={busy}>
              Cerrar
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {savingPw ? "Guardando…" : "Actualizar contraseña"}
            </button>
          </footer>
        </form>
      </div>
    </div>

    {fotoAmpliada && user.avatar.url && (
      <div
        className="mi-cuenta-foto-lightbox"
        role="presentation"
        onClick={() => setFotoAmpliada(false)}
      >
        <div
          className="mi-cuenta-foto-lightbox-panel"
          role="dialog"
          aria-modal="true"
          aria-label={`Foto de perfil de ${user.nombre}`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="btn btn-ghost mi-cuenta-foto-lightbox-close"
            onClick={() => setFotoAmpliada(false)}
            aria-label="Cerrar vista ampliada"
          >
            ✕
          </button>
          <img
            src={user.avatar.url}
            alt={`Foto de perfil de ${user.nombre}`}
            className="mi-cuenta-foto-lightbox-img"
          />
          <p className="mi-cuenta-foto-lightbox-caption">{user.nombre}</p>
        </div>
      </div>
    )}
    </>
  );
}
