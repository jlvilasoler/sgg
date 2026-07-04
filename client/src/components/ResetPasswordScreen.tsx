import { useEffect, useState, type FormEvent } from "react";
import { confirmarResetPassword, validarResetPasswordToken } from "../api";
import { apiConnectionError, apiOfflineMessage } from "../utils/api-messages";
import {
  PASSWORD_POLICY_HINT,
  validatePasswordStrength,
} from "../utils/password-policy";
import AuthLoginShell from "./AuthLoginShell";
import PasswordEyeIcon from "./icons/PasswordEyeIcon";

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

  const title = checking ? (
    <>Verificando <span className="auth-login-accent">enlace</span></>
  ) : tokenError ? (
    <>Enlace no <span className="auth-login-accent">disponible</span></>
  ) : (
    <>Nueva <span className="auth-login-accent">contraseña</span></>
  );

  return (
    <AuthLoginShell
      title={title}
      footer={
        !checking && !tokenError ? (
          <p className="auth-login-foot-hint">
            Al guardar, se cerrarán todas las sesiones activas de tu cuenta.
          </p>
        ) : undefined
      }
    >
      {checking ? (
        <div className="auth-login-recovery-sent auth-login-recovery-sent--split">
          <p className="auth-login-recovery-text auth-login-recovery-text--split">Verificando enlace…</p>
        </div>
      ) : tokenError ? (
        <div className="auth-login-recovery-sent auth-login-recovery-sent--split">
          <div
            className="auth-login-recovery-icon auth-login-recovery-icon--split auth-login-recovery-icon--warn"
            aria-hidden
          >
            !
          </div>
          <p className="auth-login-recovery-text auth-login-recovery-text--split">{tokenError}</p>
          <button
            type="button"
            className="auth-login-submit auth-login-submit--split"
            onClick={onBack}
          >
            Ir al inicio de sesión
          </button>
        </div>
      ) : (
        <form className="auth-login-form auth-login-form--split" onSubmit={submit}>
          <p className="auth-login-recovery-intro auth-login-recovery-intro--split">
            Elegí una contraseña nueva para tu cuenta. {PASSWORD_POLICY_HINT}
          </p>

          <div className="auth-login-password-wrap auth-login-password-wrap--split">
            <input
              id="reset-password"
              type={showPassword ? "text" : "password"}
              className="auth-login-input"
              autoComplete="new-password"
              data-sin-mayusculas="true"
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nueva contraseña"
              disabled={loading || !apiOnline}
              required
              autoFocus
              aria-label="Nueva contraseña"
            />
            <button
              type="button"
              className="auth-login-toggle-pw auth-login-toggle-pw--split"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              aria-pressed={showPassword}
            >
              <PasswordEyeIcon open={showPassword} />
            </button>
          </div>

          <div className="auth-login-password-wrap auth-login-password-wrap--split">
            <input
              id="reset-confirm"
              type={showConfirmar ? "text" : "password"}
              className="auth-login-input"
              autoComplete="new-password"
              data-sin-mayusculas="true"
              maxLength={128}
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              placeholder="Confirmar contraseña"
              disabled={loading || !apiOnline}
              required
              aria-label="Confirmar contraseña"
            />
            <button
              type="button"
              className="auth-login-toggle-pw auth-login-toggle-pw--split"
              onClick={() => setShowConfirmar((v) => !v)}
              tabIndex={-1}
              aria-label={showConfirmar ? "Ocultar contraseña" : "Mostrar contraseña"}
              aria-pressed={showConfirmar}
            >
              <PasswordEyeIcon open={showConfirmar} />
            </button>
          </div>

          {!apiOnline && (
            <p className="auth-login-offline auth-login-offline--split">{apiOfflineMessage()}</p>
          )}

          <button
            type="submit"
            className="auth-login-submit auth-login-submit--split"
            disabled={loading || !apiOnline}
          >
            {loading ? "Guardando…" : "Guardar nueva contraseña"}
          </button>
        </form>
      )}
    </AuthLoginShell>
  );
}
