import { useState, type FormEvent } from "react";
import { loginAuth } from "../api";
import { apiConnectionError, apiOfflineMessage } from "../utils/api-messages";
import { APP_FULL_NAME, APP_NAME } from "../brand";
import type { AuthUser } from "../types";
import PasswordEyeIcon from "./icons/PasswordEyeIcon";
import LogoSgg from "./LogoSgg";

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
          <p className="auth-login-head-note">Acceso seguro con email y contraseña</p>
        </header>

        <form className="auth-login-form" onSubmit={submit}>
          <div className="field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@empresa.com"
              disabled={loading || !apiOnline}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="login-password">Contraseña</label>
            <div className="auth-login-password-wrap">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                data-sin-mayusculas="true"
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading || !apiOnline}
                required
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

          {onForgotPassword && (
            <div className="auth-login-forgot-wrap">
              <button
                type="button"
                className="auth-login-forgot-link"
                onClick={() => onForgotPassword(email.trim())}
                disabled={loading}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          )}

          {!apiOnline && (
            <p className="auth-login-offline">{apiOfflineMessage()}</p>
          )}

          <button
            type="submit"
            className="btn btn-primary auth-login-submit"
            disabled={loading || !apiOnline}
          >
            {loading ? "Ingresando…" : "Ingresar"}
          </button>
        </form>

        <footer className="auth-login-foot">
          {import.meta.env.DEV ? (
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
          )}
        </footer>
      </div>
    </div>
  );
}
