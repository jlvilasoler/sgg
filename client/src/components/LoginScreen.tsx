import { useState, type FormEvent } from "react";
import { loginAuth } from "../api";
import { apiConnectionError, apiOfflineMessage } from "../utils/api-messages";
import type { AuthUser } from "../types";
import AuthLoginShell from "./AuthLoginShell";
import PasswordEyeIcon from "./icons/PasswordEyeIcon";

interface Props {
  apiOnline: boolean;
  onLogin: (user: AuthUser) => void;
  onError: (msg: string) => void;
  onForgotPassword?: (email: string) => void;
}

export default function LoginScreen({ apiOnline, onLogin, onError, onForgotPassword }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!apiOnline) {
      onError(apiConnectionError());
      return;
    }
    setLoading(true);
    try {
      const user = await loginAuth(email.trim(), password);
      onLogin(user);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLoginShell
      title={
        <>
          Iniciar sesión en tu <span className="auth-login-accent">cuenta</span>
        </>
      }
      footer={
        import.meta.env.DEV ? (
          <>
            <p>
              Acceso administrador: <strong>jlvilasoler@gmail.com</strong> /{" "}
              <strong>Admin123</strong>
            </p>
            <p className="auth-login-foot-hint">
              Solo visible en desarrollo. Cambiá la contraseña en producción.
            </p>
          </>
        ) : (
          <p className="auth-login-foot-hint">
            Acceso restringido. Contactá al administrador del sistema.
          </p>
        )
      }
    >
      <form className="auth-login-form auth-login-form--split" onSubmit={submit}>
        <input
          id="login-email"
          type="email"
          className="auth-login-input"
          autoComplete="username"
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-mail"
          disabled={loading || !apiOnline}
          required
          aria-label="E-mail"
        />

        <div className="auth-login-password-wrap auth-login-password-wrap--split">
          <input
            id="login-password"
            type={showPassword ? "text" : "password"}
            className="auth-login-input"
            autoComplete="current-password"
            data-sin-mayusculas="true"
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            disabled={loading || !apiOnline}
            required
            aria-label="Contraseña"
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

        {!apiOnline && (
          <p className="auth-login-offline auth-login-offline--split">{apiOfflineMessage()}</p>
        )}

        <button
          type="submit"
          className="auth-login-submit auth-login-submit--split"
          disabled={loading || !apiOnline}
        >
          {loading ? "Ingresando…" : "Iniciar sesión"}
        </button>

        {onForgotPassword && (
          <div className="auth-login-forgot-wrap auth-login-forgot-wrap--split">
            <button
              type="button"
              className="auth-login-forgot-link auth-login-forgot-link--split"
              onClick={() => onForgotPassword(email.trim())}
              disabled={loading}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>
        )}
      </form>

      <section className="auth-login-secondary" aria-label="Información de acceso">
        <p className="auth-login-secondary-prompt">¿Aún no tenés una cuenta?</p>
        <p className="auth-login-secondary-note">
          El alta la realiza el administrador de tu empresa. Escribile para solicitar acceso.
        </p>
      </section>
    </AuthLoginShell>
  );
}
