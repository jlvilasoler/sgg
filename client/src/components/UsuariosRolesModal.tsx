import { useCallback, useEffect, useState } from "react";
import {
  actualizarRolePermissions,
  fetchRolePermissions,
} from "../api";
import { useHeaderBackStep } from "../header-back";
import type { Modulo, Rol, RolPermisosConfig, RolPermisosInput } from "../types";
import { ALL_ROLES } from "../types";
import { MODULO_LABELS, MODULOS_SOLO_ADMIN, ROL_LABELS_DETALLE } from "../utils/auth-permissions";
import {
  MODULO_TODOS,
  MODULOS_CONFIGURABLES,
  countModulosHabilitados,
  desmarcarTodosModulosPermiso,
  isModuloHabilitado,
  marcarTodosModulosPermiso,
  modoEdicionModulo,
  modoEdicionModuloLabel,
  rolPermisosToInput,
  setModoEdicionModulo,
  toggleModuloPermiso,
  type ModoEdicionModulo,
} from "../utils/rol-modulos-config";
import SubseccionInlinePanel from "./SubseccionInlinePanel";

interface Props {
  apiOnline: boolean;
  onVolver: () => void;
  volverLabel?: string;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onSaved?: () => void;
}

const ROLES_EDITABLES: Rol[] = ["editor", "gestor_n2", "consulta"];

export default function UsuariosRolesPanel({
  apiOnline,
  onVolver,
  volverLabel = "Volver a Usuarios",
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
  const habilitadosCount = countModulosHabilitados(draft);

  const load = useCallback(async () => {
    if (!apiOnline) return;
    setLoading(true);
    try {
      const data = await fetchRolePermissions();
      setRoles(data);
      const editor = data.find((r) => r.rol === "editor");
      if (editor) setDraft(rolPermisosToInput(editor));
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
    if (cfg) setDraft(rolPermisosToInput(cfg));
  };

  const toggleModulo = (modulo: Modulo, activo: boolean) => {
    if (!draft) return;
    setDraft(toggleModuloPermiso(draft, activeRol, modulo, activo));
  };

  const setModoEdicion = (modulo: Modulo, modo: ModoEdicionModulo) => {
    if (!draft) return;
    setDraft(setModoEdicionModulo(draft, modulo, modo));
  };

  const marcarTodas = () => {
    if (!draft) return;
    setDraft(marcarTodosModulosPermiso(draft, activeRol));
  };

  const desmarcarTodas = () => {
    if (!draft) return;
    setDraft(desmarcarTodosModulosPermiso(draft));
  };

  const save = async () => {
    if (!apiOnline || !draft || activeRol === "admin") return;
    setSaving(true);
    try {
      const updated = await actualizarRolePermissions(activeRol, draft);
      setRoles((prev) => prev.map((r) => (r.rol === updated.rol ? updated : r)));
      setDraft(rolPermisosToInput(updated));
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
      volverLabel={volverLabel}
      icon={{ source: "hub", id: "usuarios_permisos_rol" }}
      title="Permisos por tipo de usuario"
      description="Solo el administrador define qué secciones ve cada rol y si puede editar."
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
              disabled={saving || !apiOnline || habilitadosCount === 0}
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
            {ALL_ROLES.map((rol) => (
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
                  <strong>Administrador:</strong> acceso total a todos los sectores. Este rol no
                  se puede restringir.
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
                  <div className="usuarios-roles-toolbar">
                    <p className="usuarios-roles-desc usuarios-roles-desc--inline">
                      Marcá las secciones que verá este rol en el inicio.{" "}
                      <strong>{habilitadosCount}</strong> de{" "}
                      {MODULOS_CONFIGURABLES.length} habilitadas.
                    </p>
                    <div className="usuarios-roles-toolbar-actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={marcarTodas}
                      >
                        Activar todas
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={desmarcarTodas}
                      >
                        Quitar todas
                      </button>
                    </div>
                  </div>

                  {(activeRol === "editor" || activeRol === "gestor_n2") && (
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
                      Permitir edición en los sectores marcados como &quot;Ver y editar&quot;
                    </label>
                  )}

                  {activeRol === "consulta" && (
                    <p className="usuarios-roles-readonly-note">
                      Consulta solo puede ver; las secciones habilitadas quedan en solo lectura.
                    </p>
                  )}

                  {habilitadosCount === 0 && (
                    <p className="usuarios-roles-empty usuarios-roles-empty--warn">
                      Activá al menos una sección para este rol.
                    </p>
                  )}

                  <div className="usuarios-roles-grid usuarios-roles-grid--simple">
                    {MODULOS_CONFIGURABLES.map((modulo) => {
                      const activo = isModuloHabilitado(draft, modulo);
                      const modo = modoEdicionModulo(draft, activeRol, modulo);
                      const edicionBloqueada =
                        activeRol === "consulta" || !draft.puede_escribir;
                      return (
                        <label
                          key={modulo}
                          className={`usuarios-roles-modulo usuarios-roles-modulo--simple${
                            activo ? " usuarios-roles-modulo--on" : ""
                          }`}
                        >
                          <div className="usuarios-roles-modulo-top">
                            <input
                              type="checkbox"
                              checked={activo}
                              onChange={(e) => toggleModulo(modulo, e.target.checked)}
                            />
                            <span className="usuarios-roles-modulo-label">
                              {MODULO_LABELS[modulo]}
                            </span>
                          </div>
                          {activo ? (
                            <select
                              className="usuarios-roles-modo-select usuarios-roles-modo-select--inline"
                              value={modo}
                              disabled={edicionBloqueada}
                              aria-label={`Acceso para ${MODULO_LABELS[modulo]}`}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) =>
                                setModoEdicion(modulo, e.target.value as ModoEdicionModulo)
                              }
                            >
                              <option value="lectura">Solo lectura</option>
                              <option value="edicion">Ver y editar</option>
                            </select>
                          ) : (
                            <span className="usuarios-roles-modulo-hint">Sin acceso</span>
                          )}
                          {activo && (
                            <span className="usuarios-roles-modulo-hint usuarios-roles-modulo-hint--active">
                              {modoEdicionModuloLabel(modo)}
                            </span>
                          )}
                        </label>
                      );
                    })}
                    <div
                      className="usuarios-roles-modulo usuarios-roles-modulo--simple usuarios-roles-modulo--locked usuarios-roles-modulo--on"
                      aria-label="Chat interno — todos los usuarios"
                    >
                      <div className="usuarios-roles-modulo-top">
                        <input type="checkbox" checked disabled aria-hidden />
                        <span className="usuarios-roles-modulo-label">
                          {MODULO_LABELS[MODULO_TODOS]}
                        </span>
                      </div>
                      <span className="usuarios-roles-modulo-hint">Todos los usuarios</span>
                    </div>
                    {MODULOS_SOLO_ADMIN.map((modulo) => (
                      <div
                        key={modulo}
                        className="usuarios-roles-modulo usuarios-roles-modulo--simple usuarios-roles-modulo--locked"
                        aria-label={`${MODULO_LABELS[modulo]} — solo administrador`}
                      >
                        <div className="usuarios-roles-modulo-top">
                          <input type="checkbox" checked disabled aria-hidden />
                          <span className="usuarios-roles-modulo-label">
                            {MODULO_LABELS[modulo]}
                          </span>
                        </div>
                        <span className="usuarios-roles-modulo-hint">Solo administrador</span>
                      </div>
                    ))}
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
