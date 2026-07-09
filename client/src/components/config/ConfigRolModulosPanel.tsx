import { CheckSquare, Lock, Square } from "lucide-react";
import type { HomeLayoutConfigurableRol } from "../../utils/home-layout-config";
import type { Modulo, RolPermisosInput } from "../../types";
import { MODULO_LABELS, MODULOS_SOLO_ADMIN } from "../../utils/auth-permissions";
import {
  MODULO_PERMISO_HINTS,
  MODULO_TODOS,
  MODULOS_CONFIGURABLES,
  countModulosHabilitados,
  isModuloHabilitado,
  modoEdicionModulo,
  modoEdicionModuloLabel,
  type ModoEdicionModulo,
} from "../../utils/rol-modulos-config";

interface Props {
  rol: HomeLayoutConfigurableRol;
  draft: RolPermisosInput | null;
  onToggleModulo: (modulo: Modulo, activo: boolean) => void;
  onSetModo: (modulo: Modulo, modo: ModoEdicionModulo) => void;
  onPuedeEscribirChange: (value: boolean) => void;
  onMarcarTodos: () => void;
  onDesmarcarTodos: () => void;
}

export default function ConfigRolModulosPanel({
  rol,
  draft,
  onToggleModulo,
  onSetModo,
  onPuedeEscribirChange,
  onMarcarTodos,
  onDesmarcarTodos,
}: Props) {
  const habilitados = countModulosHabilitados(draft);
  const edicionBloqueada = rol === "consulta" || !draft?.puede_escribir;

  return (
    <section
      className="config-home-layout-section config-home-layout-section--modules"
      aria-labelledby={`config-rol-modulos-${rol}`}
    >
      <header className="config-home-layout-section-head config-home-layout-section-head--split">
        <div>
          <p className="config-home-layout-section-kicker">Módulos de la cuenta</p>
          <h3 id={`config-rol-modulos-${rol}`}>Menú y permisos</h3>
          <p className="config-home-layout-section-lead muted">
            {habilitados} de {MODULOS_CONFIGURABLES.length} secciones habilitadas en el menú
            principal.
          </p>
        </div>
        <div className="config-home-layout-bulk">
          <button type="button" className="home-hub-link" onClick={onMarcarTodos}>
            Activar todas
          </button>
          <button type="button" className="home-hub-link" onClick={onDesmarcarTodos}>
            Quitar todas
          </button>
        </div>
      </header>

      {draft && (rol === "editor" || rol === "gestor_n2") ? (
        <label className="config-home-layout-write-toggle">
          <input
            type="checkbox"
            checked={draft.puede_escribir}
            onChange={(e) => onPuedeEscribirChange(e.target.checked)}
          />
          <span>Permitir edición en los módulos marcados como &quot;Ver y editar&quot;</span>
        </label>
      ) : null}

      {rol === "consulta" ? (
        <p className="config-home-layout-readonly-note">
          Consulta solo puede ver; las secciones habilitadas quedan en solo lectura.
        </p>
      ) : null}

      {draft && habilitados === 0 ? (
        <p className="config-home-layout-modules-warn" role="status">
          Activá al menos una sección para este tipo de cuenta.
        </p>
      ) : null}

      <ul className="config-home-layout-toggle-list config-home-layout-module-list">
        {MODULOS_CONFIGURABLES.map((modulo) => {
          if (!draft) return null;
          const on = isModuloHabilitado(draft, modulo);
          const modo = modoEdicionModulo(draft, rol, modulo);
          return (
            <li key={modulo} className="config-home-layout-module-item">
              <button
                type="button"
                className={`config-home-layout-toggle${on ? " is-on" : ""}`}
                onClick={() => onToggleModulo(modulo, !on)}
                aria-pressed={on}
              >
                <span className="config-home-layout-toggle-icon" aria-hidden>
                  {on ? <CheckSquare size={16} /> : <Square size={16} />}
                </span>
                <span className="config-home-layout-toggle-copy">
                  <strong>{MODULO_LABELS[modulo]}</strong>
                  <small>{MODULO_PERMISO_HINTS[modulo]}</small>
                </span>
                <span className={`config-home-layout-switch${on ? " is-on" : ""}`}>
                  <span className="config-home-layout-switch-thumb" />
                </span>
              </button>
              {on ? (
                <div className="config-home-layout-module-modo">
                  <label className="config-home-layout-module-modo-label" htmlFor={`modo-${rol}-${modulo}`}>
                    Acceso
                  </label>
                  <select
                    id={`modo-${rol}-${modulo}`}
                    className="config-home-layout-module-modo-select"
                    value={modo}
                    disabled={edicionBloqueada}
                    onChange={(e) => onSetModo(modulo, e.target.value as ModoEdicionModulo)}
                  >
                    <option value="lectura">Solo lectura</option>
                    <option value="edicion">Ver y editar</option>
                  </select>
                  <span className="config-home-layout-module-modo-pill">
                    {modoEdicionModuloLabel(modo)}
                  </span>
                </div>
              ) : (
                <p className="config-home-layout-module-off muted">Sin acceso al módulo</p>
              )}
            </li>
          );
        })}

        <li>
          <div className="config-home-layout-toggle is-on is-locked">
            <span className="config-home-layout-toggle-icon" aria-hidden>
              <Lock size={15} />
            </span>
            <span className="config-home-layout-toggle-copy">
              <strong>{MODULO_LABELS[MODULO_TODOS]}</strong>
              <small>Siempre disponible para todos los usuarios de la cuenta.</small>
            </span>
            <span className="config-home-layout-locked-tag">Fijo</span>
          </div>
        </li>

        {MODULOS_SOLO_ADMIN.map((modulo) => (
          <li key={modulo}>
            <div className="config-home-layout-toggle is-locked">
              <span className="config-home-layout-toggle-icon" aria-hidden>
                <Lock size={15} />
              </span>
              <span className="config-home-layout-toggle-copy">
                <strong>{MODULO_LABELS[modulo]}</strong>
                <small>Reservado al administrador de la cuenta.</small>
              </span>
              <span className="config-home-layout-locked-tag">Admin</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
