import { useState, type FormEvent } from "react";
import { solicitarResetPassword } from "../api";
import { apiConnectionError, apiOfflineMessage } from "../utils/api-messages";
import { APP_FULL_NAME, APP_NAME } from "../brand";
import LogoSgg from "./LogoSgg";

interface Props {
  apiOnline: boolean;
  initialEmail?: string;
  onBack: () => void;
  onError: (msg: string) => void;
}

export default function ForgotPasswordScreen({
  apiOnline,
  initialEmail = "",
  onBack,
  onError,
}: Props) {
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!apiOnline) {
      onError(apiConnectionError());
      return;
    }
    setLoading(true);
    try {
      const result = await solicitarResetPassword(email.trim());
      setSuccessMessage(result.message);
      setSent(true);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al enviar solicitud");
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
          <p className="auth-login-head-note">Recuperación de acceso</p>
        </header>

        {sent ? (
          <div className="auth-login-form auth-login-recovery-sent">
            <div className="auth-login-recovery-icon" aria-hidden>
              ✉
            </div>
            <h2 className="auth-login-recovery-title">Revisá tu correo</h2>
            <p className="auth-login-recovery-text">{successMessage}</p>
            <p className="auth-login-recovery-hint muted">
              El enlace para crear una nueva contraseña vence en 1 hora.
            </p>
            <button
              type="button"
              className="btn btn-primary auth-login-submit"
              onClick={onBack}
            >
              Volver al inicio de sesión
            </button>
          </div>
        ) : (
          <form className="auth-login-form" onSubmit={submit}>
            <p className="auth-login-recovery-intro">
              Ingresá el <strong>email registrado en tu cuenta</strong>. Te enviaremos un
              enlace seguro para restablecer tu contraseña.
            </p>

            <div className="field">
              <label htmlFor="forgot-email">Email</label>
              <input
                id="forgot-email"
                type="email"
                autoComplete="username"
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@empresa.com"
                disabled={loading || !apiOnline}
                required
                autoFocus
              />
            </div>

            {!apiOnline && (
              <p className="auth-login-offline">{apiOfflineMessage()}</p>
            )}

            <button
              type="submit"
              className="btn btn-primary auth-login-submit"
              disabled={loading || !apiOnline}
            >
              {loading ? "Enviando…" : "Enviar enlace de recuperación"}
            </button>

            <button
              type="button"
              className="auth-login-link-btn"
              onClick={onBack}
              disabled={loading}
            >
              ← Volver al inicio de sesión
            </button>
          </form>
        )}

        <footer className="auth-login-foot">
          <p className="auth-login-foot-hint">
            Por seguridad, el sistema no indica si un email existe o no en la base de datos.
          </p>
        </footer>
      </div>
    </div>
  );
}
