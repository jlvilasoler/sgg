import { useCallback, useEffect, useState } from "react";
import {
  actualizarRolePermissions,
  fetchRolePermissions,
} from "../api";
import { useHeaderBackStep } from "../header-back";
import type { Modulo, Rol, RolPermisosConfig, RolPermisosInput } from "../types";
import { ROL_LABELS_DETALLE } from "../utils/auth-permissions";
import SubseccionInlinePanel from "./SubseccionInlinePanel";

interface Props {
  apiOnline: boolean;
  onVolver: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onSaved?: () => void;
}

const ROLES_EDITABLES: Rol[] = ["editor", "consulta"];

const MODULOS_SIEMPRE_ACTIVOS: Modulo[] = [
  "chat",
  "precios_ganado",
  "simulador_venta_ganado",
];

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

export default function UsuariosRolesPanel({
  apiOnline,
  onVolver,
  onError,
  onSuccess,
  onSaved,
}: Props) {
  const [roles, setRoles] = useState<RolPermisosConfig[]>([]);
  const [activeRol, setActiveRol] = useState<Rol>("editor");
  const [draft, setDraft] = useState<RolPermisosInput | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useHeaderBackStep(true, onVolver, "Usuarios");

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
    void load();
  }, [load]);

  const selectRol = (rol: Rol) => {
    setActiveRol(rol);
    const cfg = roles.find((r) => r.rol === rol);
    if (cfg) setDraft(toInput(cfg));
  };

  const toggleModulo = (modulo: Modulo, acceso: boolean) => {
    if (!draft || modulo === "usuarios" || MODULOS_SIEMPRE_ACTIVOS.includes(modulo)) return;
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

  const adminConfig = roles.find((r) => r.rol === "admin");

  return (
    <SubseccionInlinePanel
      onVolver={onVolver}
      volverLabel="Volver a Usuarios"
      title="Permisos por tipo de usuario"
      description="Definí qué sectores puede ver y modificar cada rol del sistema."
      cardClassName="usuarios-roles-inline"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onVolver}>
            Volver
          </button>
          {ROLES_EDITABLES.includes(activeRol) && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={saving || !apiOnline}
              onClick={() => void save()}
            >
              {saving ? "Guardando…" : `Guardar ${ROL_LABELS_DETALLE[activeRol]}`}
            </button>
          )}
        </>
      }
    >
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
                      .map((m) => {
                        const siempreActivo = MODULOS_SIEMPRE_ACTIVOS.includes(m.modulo);
                        const activo = siempreActivo || Boolean(draft.modulos[m.modulo]);
                        return (
                          <label
                            key={m.modulo}
                            className={`usuarios-roles-modulo${
                              activo ? " usuarios-roles-modulo--on" : ""
                            }${siempreActivo ? " usuarios-roles-modulo--locked" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={activo}
                              disabled={siempreActivo}
                              onChange={(e) => toggleModulo(m.modulo, e.target.checked)}
                            />
                            <span className="usuarios-roles-modulo-label">{m.label}</span>
                            <span className="usuarios-roles-modulo-hint">
                              {siempreActivo
                                ? "Todos los usuarios"
                                : activo
                                  ? activeRol === "consulta"
                                    ? "Solo lectura"
                                    : draft.puede_escribir
                                      ? "Ver y editar"
                                      : "Solo lectura"
                                  : "Sin acceso"}
                            </span>
                          </label>
                        );
                      })}
                  </div>
                </>
              )
            )}
          </div>
        </>
      )}
    </SubseccionInlinePanel>
  );
}

/** @deprecated Usar UsuariosRolesPanel */
export { UsuariosRolesPanel as UsuariosRolesModal };
