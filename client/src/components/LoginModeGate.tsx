import { useState } from "react";
import { Layers, LogOut, SplitSquareHorizontal } from "lucide-react";
import { actualizarMiModoInicio } from "../api";
import type { AuthUser, LoginMode } from "../types";

interface Props {
  user: AuthUser;
  onChosen: (user: AuthUser) => void;
  onError: (msg: string) => void;
  onLogout: () => void;
}

export default function LoginModeGate({ user, onChosen, onError, onLogout }: Props) {
  const [saving, setSaving] = useState<LoginMode | null>(null);

  const elegir = async (mode: LoginMode) => {
    if (saving) return;
    setSaving(mode);
    try {
      const updated = await actualizarMiModoInicio(mode);
      onChosen(updated);
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo guardar el modo de inicio");
      setSaving(null);
    }
  };

  return (
    <div className="empresa-gate">
      <div className="empresa-gate-card empresa-gate-card--modo">
        <div className="empresa-gate-head">
          <span className="empresa-gate-icon" aria-hidden="true">
            <Layers size={22} strokeWidth={2.1} />
          </span>
          <div>
            <h1 className="empresa-gate-title">¿Cómo querés operar tu cuenta?</h1>
            <p className="empresa-gate-sub">
              Hola {user.nombre}. Tu cuenta ahora tiene más de una empresa. Elegí cómo
              iniciar sesión de ahora en adelante. Podés cambiarlo cuando quieras desde
              Mi cuenta → Perfil.
            </p>
          </div>
        </div>

        <div className="empresa-gate-modo-options">
          <button
            type="button"
            className="mi-cuenta-modo-card"
            onClick={() => void elegir("consolidado")}
            disabled={saving != null}
          >
            <Layers size={18} strokeWidth={2} />
            <strong>Todas juntas (consolidado)</strong>
            <span className="muted">
              Entrás directo y ves todas las empresas de la cuenta a la vez.
            </span>
            {saving === "consolidado" ? (
              <span className="muted empresa-gate-item-loading">Guardando…</span>
            ) : null}
          </button>
          <button
            type="button"
            className="mi-cuenta-modo-card"
            onClick={() => void elegir("individual")}
            disabled={saving != null}
          >
            <SplitSquareHorizontal size={18} strokeWidth={2} />
            <strong>Elegir empresa al iniciar</strong>
            <span className="muted">
              Cada inicio de sesión te pregunta con qué empresa de la cuenta operar.
            </span>
            {saving === "individual" ? (
              <span className="muted empresa-gate-item-loading">Guardando…</span>
            ) : null}
          </button>
        </div>

        <button type="button" className="empresa-gate-logout" onClick={onLogout}>
          <LogOut size={15} strokeWidth={2} />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
