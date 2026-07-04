import { useState, type FormEvent } from "react";
import { solicitarResetPassword } from "../api";
import { apiConnectionError, apiOfflineMessage } from "../utils/api-messages";
import AuthLoginShell from "./AuthLoginShell";

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
    <AuthLoginShell
      title={
        sent ? (
          <>Revisá tu <span className="auth-login-accent">correo</span></>
        ) : (
          <>Recuperar tu <span className="auth-login-accent">contraseña</span></>
        )
      }
      footer={
        <p className="auth-login-foot-hint">
          Por seguridad, el sistema no indica si un email existe o no en la base de datos.
        </p>
      }
    >
      {sent ? (
        <div className="auth-login-recovery-sent auth-login-recovery-sent--split">
          <div className="auth-login-recovery-icon auth-login-recovery-icon--split" aria-hidden>
            ✉
          </div>
          <p className="auth-login-recovery-text auth-login-recovery-text--split">{successMessage}</p>
          <p className="auth-login-recovery-hint auth-login-recovery-hint--split">
            El enlace para crear una nueva contraseña vence en 1 hora.
          </p>
          <button
            type="button"
            className="auth-login-submit auth-login-submit--split"
            onClick={onBack}
          >
            Volver al inicio de sesión
          </button>
        </div>
      ) : (
        <form className="auth-login-form auth-login-form--split" onSubmit={submit}>
          <p className="auth-login-recovery-intro auth-login-recovery-intro--split">
            Ingresá el <strong>email registrado en tu cuenta</strong>. Te enviaremos un enlace seguro
            para restablecer tu contraseña.
          </p>

          <input
            id="forgot-email"
            type="email"
            className="auth-login-input"
            autoComplete="username"
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail"
            disabled={loading || !apiOnline}
            required
            autoFocus
            aria-label="E-mail"
          />

          {!apiOnline && (
            <p className="auth-login-offline auth-login-offline--split">{apiOfflineMessage()}</p>
          )}

          <button
            type="submit"
            className="auth-login-submit auth-login-submit--split"
            disabled={loading || !apiOnline}
          >
            {loading ? "Enviando…" : "Enviar enlace de recuperación"}
          </button>

          <div className="auth-login-forgot-wrap auth-login-forgot-wrap--split">
            <button
              type="button"
              className="auth-login-forgot-link auth-login-forgot-link--split"
              onClick={onBack}
              disabled={loading}
            >
              ← Volver al inicio de sesión
            </button>
          </div>
        </form>
      )}
    </AuthLoginShell>
  );
}
