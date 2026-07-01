import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { cambiarPasswordAuth, quitarAvatarFoto, subirAvatarFoto } from "../api";
import { useHeaderBackStep } from "../header-back";
import type { AuthUser } from "../types";
import {
  PASSWORD_POLICY_HINT,
  validatePasswordStrength,
} from "../utils/password-policy";
import SubseccionInlinePanel from "./SubseccionInlinePanel";
import UserAvatar from "./UserAvatar";
import PasswordVisibilityToggle from "./PasswordVisibilityToggle";

interface Props {
  user: AuthUser;
  onVolver: () => void;
  onUserUpdated: (user: AuthUser) => void;
  onPasswordChanged: (message: string) => void;
  onError: (message: string) => void;
}

const MAX_FOTO_MB = 2;
const FOTO_TIPOS = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const PW_FORM_ID = "mi-cuenta-pw-form";

export default function MiCuentaPanel({
  user,
  onVolver,
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
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [savingFoto, setSavingFoto] = useState(false);
  const [fotoAmpliada, setFotoAmpliada] = useState(false);

  useHeaderBackStep(true, onVolver, "Menú principal");

  useEffect(() => {
    if (!fotoAmpliada) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFotoAmpliada(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [fotoAmpliada]);

  const tieneFoto = user.avatar.tipo === "foto" && !!user.avatar.url;
  const busy = savingPw || savingFoto;

  const resetPasswordFields = () => {
    setActual("");
    setNueva("");
    setConfirmar("");
    setShowActual(false);
    setShowNueva(false);
    setShowConfirmar(false);
  };

  const handleVolver = () => {
    if (busy) return;
    resetPasswordFields();
    onVolver();
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
      <SubseccionInlinePanel
        onVolver={handleVolver}
        volverLabel="Volver al menú"
        icon={{ source: "hub", id: "config_admin_cuenta" }}
        title="Mi cuenta"
        cardClassName="mi-cuenta-page"
        footer={
          <div className="mi-cuenta-page-foot">
            <p className="mi-cuenta-page-foot-note muted">
              Al cambiar la contraseña se cerrará tu sesión por seguridad.
            </p>
            <div className="mi-cuenta-page-foot-actions">
              <button type="button" className="btn btn-ghost" onClick={handleVolver} disabled={busy}>
                Volver
              </button>
              <button
                type="submit"
                form={PW_FORM_ID}
                className="btn btn-primary"
                disabled={busy}
              >
                {savingPw ? "Guardando…" : "Actualizar contraseña"}
              </button>
            </div>
          </div>
        }
      >
        <section className="mi-cuenta-perfil" aria-label="Perfil">
          <div className="mi-cuenta-perfil-avatar-col">
            {tieneFoto ? (
              <button
                type="button"
                className="mi-cuenta-foto-thumb-btn mi-cuenta-perfil-avatar-btn"
                onClick={() => setFotoAmpliada(true)}
                title="Ver foto más grande"
                aria-label="Ver foto de perfil ampliada"
              >
                <UserAvatar nombre={user.nombre} avatar={user.avatar} size="lg" />
              </button>
            ) : (
              <UserAvatar nombre={user.nombre} avatar={user.avatar} size="lg" />
            )}
          </div>

          <div className="mi-cuenta-perfil-body">
            <div className="mi-cuenta-perfil-identity">
              <strong className="mi-cuenta-perfil-name">{user.nombre}</strong>
              <span className="mi-cuenta-perfil-email">{user.email}</span>
              <span className="mi-cuenta-perfil-role" data-rol={user.rol}>
                {user.rol_label}
              </span>
            </div>

            <div className="mi-cuenta-perfil-tools">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="mi-cuenta-foto-input"
                disabled={busy}
                onChange={(e) => void handleFotoChange(e)}
              />
              <div className="mi-cuenta-perfil-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                >
                  {savingFoto
                    ? "Subiendo…"
                    : user.avatar.tipo === "foto"
                      ? "Cambiar foto"
                      : "Subir foto"}
                </button>
                {user.avatar.tipo === "foto" && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={busy}
                    onClick={() => void handleQuitarFoto()}
                  >
                    Quitar foto
                  </button>
                )}
              </div>
              {tieneFoto ? (
                <span className="mi-cuenta-perfil-hint muted">Clic en la foto para ampliar</span>
              ) : (
                <span className="mi-cuenta-perfil-hint muted">
                  JPG, PNG, WebP o GIF · máx. {MAX_FOTO_MB} MB
                </span>
              )}
            </div>
          </div>
        </section>

        <section className="mi-cuenta-pw" aria-labelledby="mi-cuenta-pw-title">
          <div className="mi-cuenta-pw-head">
            <h3 id="mi-cuenta-pw-title" className="mi-cuenta-pw-title">
              Contraseña
            </h3>
            <p className="mi-cuenta-pw-hint muted">{PASSWORD_POLICY_HINT}</p>
          </div>

          <form id={PW_FORM_ID} className="mi-cuenta-pw-form" onSubmit={(e) => void submitPassword(e)}>
            <div className="field">
              <label htmlFor="pw-actual">Actual</label>
              <div className="password-field-row">
                <input
                  id="pw-actual"
                  type={showActual ? "text" : "password"}
                  autoComplete="current-password"
                  value={actual}
                  disabled={busy}
                  onChange={(e) => setActual(e.target.value)}
                />
                <PasswordVisibilityToggle
                  visible={showActual}
                  onToggle={() => setShowActual((v) => !v)}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="pw-nueva">Nueva</label>
              <div className="password-field-row">
                <input
                  id="pw-nueva"
                  type={showNueva ? "text" : "password"}
                  autoComplete="new-password"
                  value={nueva}
                  disabled={busy}
                  onChange={(e) => setNueva(e.target.value)}
                />
                <PasswordVisibilityToggle
                  visible={showNueva}
                  onToggle={() => setShowNueva((v) => !v)}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="pw-confirmar">Confirmar</label>
              <div className="password-field-row">
                <input
                  id="pw-confirmar"
                  type={showConfirmar ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmar}
                  disabled={busy}
                  onChange={(e) => setConfirmar(e.target.value)}
                />
                <PasswordVisibilityToggle
                  visible={showConfirmar}
                  onToggle={() => setShowConfirmar((v) => !v)}
                />
              </div>
            </div>
          </form>
        </section>
      </SubseccionInlinePanel>

      {fotoAmpliada && user.avatar.url
        ? createPortal(
            <div
              className="mi-cuenta-foto-modal-overlay"
              role="dialog"
              aria-modal="true"
              aria-labelledby="mi-cuenta-foto-modal-title"
              onClick={(e) => {
                if (e.target === e.currentTarget) setFotoAmpliada(false);
              }}
            >
              <div className="card mi-cuenta-foto-modal">
                <div className="form-header mi-cuenta-foto-modal-head">
                  <h2 id="mi-cuenta-foto-modal-title">Foto de perfil</h2>
                </div>
                <div className="mi-cuenta-foto-modal-body">
                  <img
                    src={user.avatar.url}
                    alt={`Foto de perfil de ${user.nombre}`}
                    className="mi-cuenta-foto-modal-img"
                  />
                </div>
                <footer className="mi-cuenta-foto-modal-foot">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setFotoAmpliada(false)}
                  >
                    Volver
                  </button>
                </footer>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

/** @deprecated Usar MiCuentaPanel */
export { MiCuentaPanel as MiCuentaModal };
