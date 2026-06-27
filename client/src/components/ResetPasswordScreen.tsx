import { useEffect, useState, type FormEvent } from "react";
import { confirmarResetPassword, validarResetPasswordToken } from "../api";
import { apiConnectionError, apiOfflineMessage } from "../utils/api-messages";
import { APP_FULL_NAME, APP_NAME } from "../brand";
import {
  PASSWORD_POLICY_HINT,
  validatePasswordStrength,
} from "../utils/password-policy";
import PasswordEyeIcon from "./icons/PasswordEyeIcon";
import LogoSgg from "./LogoSgg";

interface Props {
  token: string;
  apiOnline: boolean;
  onSuccess: (message: string) => void;
  onBack: () => void;
  onError: (msg: string) => void;
}

export default function ResetPasswordScreen({
  token,
  apiOnline,
  onSuccess,
  onBack,
  onError,
}: Props) {
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);

  useEffect(() => {
    if (!apiOnline) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const result = await validarResetPasswordToken(token);
        if (cancelled) return;
        if (!result.valid) {
          const msg =
            result.reason === "expired"
              ? "Este enlace expiró. Solicitá uno nuevo desde la pantalla de inicio de sesión."
              : result.reason === "used"
                ? "Este enlace ya fue utilizado. Solicitá uno nuevo si necesitás cambiar la contraseña."
                : "El enlace de recuperación no es válido. Solicitá uno nuevo.";
          setTokenError(msg);
        }
      } catch {
        if (!cancelled) {
          setTokenError("No se pudo validar el enlace. Intentá nuevamente más tarde.");
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiOnline, token]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!apiOnline) {
      onError(apiConnectionError());
      return;
    }
    const pwErr = validatePasswordStrength(password);
    if (pwErr) {
      onError(pwErr);
      return;
    }
    if (password !== confirmar) {
      onError("La contraseña y la confirmación no coinciden");
      return;
    }

    setLoading(true);
    try {
      const msg = await confirmarResetPassword(token, password);
      onSuccess(msg);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al restablecer contraseña");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-login-page">
      <div className="auth-login-shell">
        <header className="auth-login-head">
          <div className="auth-login-brand">
            <LogoSgg className="auth-login-logo" />
            <div>
              <h1 className="auth-login-title">{APP_NAME}</h1>
              <p className="auth-login-sub">{APP_FULL_NAME}</p>
            </div>
          </div>
          <p className="auth-login-head-note">Nueva contraseña</p>
        </header>

        {checking ? (
          <div className="auth-login-form auth-login-recovery-sent">
            <p className="muted">Verificando enlace…</p>
          </div>
        ) : tokenError ? (
          <div className="auth-login-form auth-login-recovery-sent">
            <div className="auth-login-recovery-icon auth-login-recovery-icon--warn" aria-hidden>
              !
            </div>
            <h2 className="auth-login-recovery-title">Enlace no disponible</h2>
            <p className="auth-login-recovery-text">{tokenError}</p>
            <button
              type="button"
              className="btn btn-primary auth-login-submit"
              onClick={onBack}
            >
              Ir al inicio de sesión
            </button>
          </div>
        ) : (
          <form className="auth-login-form" onSubmit={submit}>
            <p className="auth-login-recovery-intro">
              Elegí una contraseña nueva para tu cuenta. {PASSWORD_POLICY_HINT}
            </p>

            <div className="field">
              <label htmlFor="reset-password">Nueva contraseña</label>
              <div className="auth-login-password-wrap">
                <input
                  id="reset-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  data-sin-mayusculas="true"
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading || !apiOnline}
                  required
                  autoFocus
                />
                <button
                  type="button"
                  className="auth-login-toggle-pw"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-pressed={showPassword}
                >
                  <PasswordEyeIcon open={showPassword} />
                </button>
              </div>
            </div>

            <div className="field">
              <label htmlFor="reset-confirm">Confirmar contraseña</label>
              <div className="auth-login-password-wrap">
                <input
                  id="reset-confirm"
                  type={showConfirmar ? "text" : "password"}
                  autoComplete="new-password"
                  data-sin-mayusculas="true"
                  maxLength={128}
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading || !apiOnline}
                  required
                />
                <button
                  type="button"
                  className="auth-login-toggle-pw"
                  onClick={() => setShowConfirmar((v) => !v)}
                  tabIndex={-1}
                  aria-label={showConfirmar ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-pressed={showConfirmar}
                >
                  <PasswordEyeIcon open={showConfirmar} />
                </button>
              </div>
            </div>

            {!apiOnline && (
              <p className="auth-login-offline">{apiOfflineMessage()}</p>
            )}

            <button
              type="submit"
              className="btn btn-primary auth-login-submit"
              disabled={loading || !apiOnline}
            >
              {loading ? "Guardando…" : "Guardar nueva contraseña"}
            </button>
          </form>
        )}

        <footer className="auth-login-foot">
          <p className="auth-login-foot-hint">
            Al guardar, se cerrarán todas las sesiones activas de tu cuenta.
          </p>
        </footer>
      </div>
    </div>
  );
}
