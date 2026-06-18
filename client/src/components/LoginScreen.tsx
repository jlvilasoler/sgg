import { useState, type FormEvent } from "react";
import { loginAuth } from "../api";
import { apiConnectionError, apiOfflineMessage } from "../utils/api-messages";
import type { AuthUser } from "../types";
import LogoSgg from "./LogoSgg";

function PasswordEyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-8-10-8a18.45 18.45 0 0 1 5.06-5.94"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.12 14.12a3 3 0 1 1-4.24-4.24"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M1 1l22 22" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

interface Props {
  apiOnline: boolean;
  onLogin: (user: AuthUser) => void;
  onError: (msg: string) => void;
}

export default function LoginScreen({ apiOnline, onLogin, onError }: Props) {
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
              <h1 className="auth-login-title">SGG</h1>
              <p className="auth-login-sub">Sistema de Gestión Ganadera</p>
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
