import type { ReactNode } from "react";
import { APP_FULL_NAME, APP_NAME } from "../brand";
import LogoSgg from "./LogoSgg";

interface Props {
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

export default function AuthLoginShell({ title, children, footer }: Props) {
  return (
    <div className="auth-login-page auth-login-page--split">
      <aside className="auth-login-brand-panel">
        <div className="auth-login-brand-art" aria-hidden />
        <div className="auth-login-brand-glow" aria-hidden />
        <div className="auth-login-brand-content">
          <LogoSgg className="auth-login-brand-logo" variant="badge" />
          <p className="auth-login-brand-name">{APP_NAME}</p>
          <p className="auth-login-brand-tagline">{APP_FULL_NAME}</p>
        </div>
      </aside>

      <main className="auth-login-form-panel">
        <div className="auth-login-form-inner">
          <h1 className="auth-login-split-title">{title}</h1>
          {children}
          {footer ? <footer className="auth-login-split-foot">{footer}</footer> : null}
        </div>
      </main>
    </div>
  );
}
