import { useCallback, useEffect, useState } from "react";
import {
  actualizarRolePermissions,
  fetchRolePermissions,
} from "../api";
import type { Modulo, Rol, RolPermisosConfig, RolPermisosInput } from "../types";
import { ROL_LABELS_DETALLE } from "../utils/auth-permissions";

interface Props {
  open: boolean;
  apiOnline: boolean;
  onClose: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onSaved?: () => void;
}

const ROLES_EDITABLES: Rol[] = ["editor", "consulta"];

function toInput(config: RolPermisosConfig): RolPermisosInput {
  const modulos: Partial<Record<Modulo, boolean>> = {};
  for (const m of config.modulos) {
    if (m.modulo !== "usuarios") modulos[m.modulo] = m.acceso;
  }
  return {
    puede_escribir: config.puede_escribir,
    modulos,
  };
}

export default function UsuariosRolesModal({
  open,
  apiOnline,
  onClose,
  onError,
  onSuccess,
  onSaved,
}: Props) {
  const [roles, setRoles] = useState<RolPermisosConfig[]>([]);
  const [activeRol, setActiveRol] = useState<Rol>("editor");
  const [draft, setDraft] = useState<RolPermisosInput | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const activeConfig = roles.find((r) => r.rol === activeRol) ?? null;

  const load = useCallback(async () => {
    if (!apiOnline) return;
    setLoading(true);
    try {
      const data = await fetchRolePermissions();
      setRoles(data);
      const editor = data.find((r) => r.rol === "editor");
      if (editor) setDraft(toInput(editor));
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar permisos");
    } finally {
      setLoading(false);
    }
  }, [apiOnline, onError]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const selectRol = (rol: Rol) => {
    setActiveRol(rol);
    const cfg = roles.find((r) => r.rol === rol);
    if (cfg) setDraft(toInput(cfg));
  };

  const toggleModulo = (modulo: Modulo, acceso: boolean) => {
    if (!draft || modulo === "usuarios") return;
    setDraft((d) =>
      d
        ? {
            ...d,
            modulos: { ...d.modulos, [modulo]: acceso },
          }
        : d
    );
  };

  const save = async () => {
    if (!apiOnline || !draft || activeRol === "admin") return;
    setSaving(true);
    try {
      const updated = await actualizarRolePermissions(activeRol, draft);
      setRoles((prev) => prev.map((r) => (r.rol === updated.rol ? updated : r)));
      onSuccess(`Permisos de ${ROL_LABELS_DETALLE[activeRol]} actualizados`);
      onSaved?.();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al guardar permisos");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const adminConfig = roles.find((r) => r.rol === "admin");

  return (
    <div className="usuarios-roles-overlay" role="presentation" onClick={onClose}>
      <div
        className="usuarios-roles-modal"
        role="dialog"
        aria-labelledby="usuarios-roles-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="usuarios-roles-head">
          <div>
            <h2 id="usuarios-roles-title">Permisos por tipo de usuario</h2>
            <p>Definí qué sectores puede ver y modificar cada rol del sistema.</p>
          </div>
          <button type="button" className="btn btn-ghost usuarios-roles-close" onClick={onClose}>
            ✕
          </button>
        </header>

        {loading ? (
          <p className="usuarios-roles-loading">Cargando configuración…</p>
        ) : (
          <>
            <div className="usuarios-roles-tabs">
              {(["admin", "editor", "consulta"] as Rol[]).map((rol) => (
                <button
                  key={rol}
                  type="button"
                  className={`usuarios-roles-tab usuarios-roles-tab--${rol}${
                    activeRol === rol ? " usuarios-roles-tab--active" : ""
                  }`}
                  onClick={() => selectRol(rol)}
                >
                  {ROL_LABELS_DETALLE[rol]}
                </button>
              ))}
            </div>

            <div className="usuarios-roles-body">
              {activeRol === "admin" && adminConfig ? (
                <div className="usuarios-roles-admin-note">
                  <p>
                    <strong>Administrador:</strong> acceso total a todos los sectores, incluida la
                    gestión de usuarios. Este rol no se puede restringir.
                  </p>
                  <ul className="usuarios-roles-admin-list">
                    {adminConfig.modulos.map((m) => (
                      <li key={m.modulo}>✓ {m.label}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                activeConfig &&
                draft && (
                  <>
                    <p className="usuarios-roles-desc">{activeConfig.descripcion}</p>

                    {activeRol === "editor" && (
                      <label className="usuarios-roles-write-toggle inline-check">
                        <input
                          type="checkbox"
                          checked={draft.puede_escribir}
                          onChange={(e) =>
                            setDraft((d) =>
                              d ? { ...d, puede_escribir: e.target.checked } : d
                            )
                          }
                        />
                        Permitir crear, editar y eliminar datos
                      </label>
                    )}

                    {activeRol === "consulta" && (
                      <p className="usuarios-roles-readonly-note">
                        El rol Consulta solo puede ver información; no puede modificar registros.
                      </p>
                    )}

                    <div className="usuarios-roles-grid">
                      {activeConfig.modulos
                        .filter((m) => m.modulo !== "usuarios")
                        .map((m) => (
                          <label
                            key={m.modulo}
                            className={`usuarios-roles-modulo${
                              draft.modulos[m.modulo] ? " usuarios-roles-modulo--on" : ""
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(draft.modulos[m.modulo])}
                              onChange={(e) => toggleModulo(m.modulo, e.target.checked)}
                            />
                            <span className="usuarios-roles-modulo-label">{m.label}</span>
                            <span className="usuarios-roles-modulo-hint">
                              {draft.modulos[m.modulo]
                                ? activeRol === "consulta"
                                  ? "Solo lectura"
                                  : draft.puede_escribir
                                    ? "Ver y editar"
                                    : "Solo lectura"
                                : "Sin acceso"}
                            </span>
                          </label>
                        ))}
                    </div>
                  </>
                )
              )}
            </div>

            <footer className="usuarios-roles-foot">
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Cerrar
              </button>
              {ROLES_EDITABLES.includes(activeRol) && (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={saving || !apiOnline}
                  onClick={save}
                >
                  {saving ? "Guardando…" : `Guardar ${ROL_LABELS_DETALLE[activeRol]}`}
                </button>
              )}
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
