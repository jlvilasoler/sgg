import { useCallback, useEffect, useMemo, useState } from "react";
import { Save, Users } from "lucide-react";
import {
  EMPRESA_MODULO_ACCESO_LABELS,
  EMPRESA_MODULOS_ACCESO,
  fetchEmpresaUsuariosVisibilidad,
  saveEmpresaUsuariosVisibilidad,
  type EmpresaModuloAcceso,
  type EmpresaUsuarioVisibilidadItem,
} from "../../api";
import type { TabId } from "../Header";
import { MenuAppIcon } from "../icons/MenuAppIcons";
import UserAvatar from "../UserAvatar";

interface Props {
  cuentaId: number;
  empresaId: number;
  empresaNombre: string;
  apiOnline: boolean;
  onError: (msg: string) => void;
}

const MODULO_MENU_ICON: Record<EmpresaModuloAcceso, TabId> = {
  presupuesto: "registro",
  stock_ganadero: "stock_ganadero",
  stock_equino: "stock_equino",
  stock_ovino: "stock_ovino",
  campo_mapa: "campo_mapa",
  tareas_operativas: "tareas_operativas",
  ventas: "ingresos_ventas",
  rrhh: "recursos_humanos",
  divisas: "divisas",
  precios_ganado: "precios_ganado",
  simulador_venta_ganado: "simulador_venta_ganado",
};

function rolLabel(rol: string): string {
  const r = rol.trim().toLowerCase();
  if (r === "admin") return "Administrador";
  if (r === "editor") return "Editor / Gestor N1";
  if (r === "gestor_n2") return "Gestor N2";
  if (r === "consulta" || r === "viewer" || r === "lectura") return "Consulta";
  return rol;
}

function snapshotKey(rows: EmpresaUsuarioVisibilidadItem[]): string {
  return JSON.stringify(
    rows
      .filter((u) => !u.bypass)
      .map((u) => ({
        id: u.id,
        visible: u.visible,
        modulos: EMPRESA_MODULOS_ACCESO.map((m) => [m, Boolean(u.modulos?.[m])]),
      }))
      .sort((a, b) => a.id - b.id)
  );
}

function allModulosOn(): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const m of EMPRESA_MODULOS_ACCESO) map[m] = true;
  return map;
}

function modulosDenegadosDeRow(u: EmpresaUsuarioVisibilidadItem): string[] {
  return EMPRESA_MODULOS_ACCESO.filter((m) => u.modulos?.[m] === false);
}

export default function MiCuentaEmpresaUsuariosVisibilidad({
  cuentaId,
  empresaId,
  empresaNombre,
  apiOnline,
  onError,
}: Props) {
  const [rows, setRows] = useState<EmpresaUsuarioVisibilidadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);
  const [baseline, setBaseline] = useState<string>("");

  const load = useCallback(async () => {
    if (!apiOnline) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setOk(false);
    try {
      const data = await fetchEmpresaUsuariosVisibilidad(cuentaId, empresaId);
      const normalized = data.map((u) => ({
        ...u,
        modulos: { ...allModulosOn(), ...(u.modulos ?? {}) },
      }));
      setRows(normalized);
      setBaseline(snapshotKey(normalized));
    } catch (e) {
      onError(
        e instanceof Error
          ? e.message
          : "No se pudieron cargar los usuarios de la empresa"
      );
      setRows([]);
      setBaseline("");
    } finally {
      setLoading(false);
    }
  }, [apiOnline, cuentaId, empresaId, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const currentKey = useMemo(() => snapshotKey(rows), [rows]);
  const dirty = baseline !== "" && currentKey !== baseline;

  const toggleVisible = (userId: number, checked: boolean) => {
    setOk(false);
    setRows((prev) =>
      prev.map((u) => {
        if (u.id !== userId || u.bypass) return u;
        return {
          ...u,
          visible: checked,
          modulos: checked ? { ...allModulosOn(), ...u.modulos } : allModulosOn(),
        };
      })
    );
  };

  const toggleModulo = (
    userId: number,
    modulo: EmpresaModuloAcceso,
    checked: boolean
  ) => {
    setOk(false);
    setRows((prev) =>
      prev.map((u) => {
        if (u.id !== userId || u.bypass || !u.visible) return u;
        return {
          ...u,
          modulos: { ...u.modulos, [modulo]: checked },
        };
      })
    );
  };

  const guardar = async () => {
    if (saving || !dirty) return;
    setSaving(true);
    setOk(false);
    try {
      const visibles = rows.filter((u) => u.visible).map((u) => u.id);
      const modulosDenegados: Record<number, string[]> = {};
      for (const u of rows) {
        if (u.bypass || !u.visible) continue;
        modulosDenegados[u.id] = modulosDenegadosDeRow(u);
      }
      const data = await saveEmpresaUsuariosVisibilidad(
        cuentaId,
        empresaId,
        visibles,
        modulosDenegados
      );
      const normalized = data.map((u) => ({
        ...u,
        modulos: { ...allModulosOn(), ...(u.modulos ?? {}) },
      }));
      setRows(normalized);
      setBaseline(snapshotKey(normalized));
      setOk(true);
    } catch (e) {
      onError(
        e instanceof Error
          ? e.message
          : "No se pudo guardar el acceso de usuarios"
      );
    } finally {
      setSaving(false);
    }
  };

  const configurables = rows.filter((u) => !u.bypass);
  const admins = rows.filter((u) => u.bypass);

  return (
    <div className="mi-cuenta-empresa-section mi-cuenta-empresa-section--box mi-cuenta-empresa-usuarios">
      <p className="mi-cuenta-empresa-section-label">
        <Users size={13} strokeWidth={2.2} aria-hidden="true" />
        Accesos a esta empresa
      </p>
      <p className="muted mi-cuenta-empresa-usuarios-hint">
        Solo usuarios de esta cuenta. Marcá la empresa y, debajo, los módulos a
        los que puede acceder cada uno en <strong>{empresaNombre}</strong>. Los
        administradores siempre tienen acceso total.
      </p>

      {loading ? (
        <p className="muted">Cargando usuarios…</p>
      ) : rows.length === 0 ? (
        <p className="muted">No hay usuarios en esta cuenta.</p>
      ) : (
        <ul className="mi-cuenta-empresa-usuarios-list mi-cuenta-empresa-usuarios-list--modulos">
          {admins.map((u) => (
            <li key={u.id} className="mi-cuenta-acceso-row is-bypass">
              <div className="mi-cuenta-acceso-panel">
                <span className="mi-cuenta-acceso-check is-locked" aria-hidden="true">
                  <input type="checkbox" checked disabled readOnly tabIndex={-1} />
                </span>
                <span className="mi-cuenta-acceso-avatar">
                  <UserAvatar
                    nombre={u.nombre}
                    avatar={u.avatar}
                    variant="header-sm"
                    className="mi-cuenta-acceso-avatar-inner"
                  />
                </span>
                <div className="mi-cuenta-acceso-identity">
                  <div className="mi-cuenta-acceso-name-row">
                    <strong className="mi-cuenta-acceso-name">{u.nombre}</strong>
                    <span className="mi-cuenta-acceso-role" data-rol={u.rol}>
                      {rolLabel(u.rol)}
                    </span>
                    <span className="mi-cuenta-acceso-badge">Acceso total</span>
                  </div>
                  <span className="mi-cuenta-acceso-email">{u.email}</span>
                </div>
                <span className="mi-cuenta-acceso-modulos-spacer" aria-hidden="true" />
              </div>
            </li>
          ))}
          {configurables.map((u) => (
            <li
              key={u.id}
              className={`mi-cuenta-acceso-row${!u.activo ? " is-inactive" : ""}${
                u.visible ? " is-enabled" : " is-disabled"
              }`}
            >
              <div className="mi-cuenta-acceso-panel">
                <label className="mi-cuenta-acceso-check">
                  <input
                    type="checkbox"
                    checked={u.visible}
                    disabled={saving}
                    onChange={(e) => toggleVisible(u.id, e.target.checked)}
                    aria-label={`Acceso de ${u.nombre} a la empresa`}
                  />
                </label>
                <span className="mi-cuenta-acceso-avatar">
                  <UserAvatar
                    nombre={u.nombre}
                    avatar={u.avatar}
                    variant="header-sm"
                    className="mi-cuenta-acceso-avatar-inner"
                  />
                </span>
                <div className="mi-cuenta-acceso-identity">
                  <div className="mi-cuenta-acceso-name-row">
                    <strong className="mi-cuenta-acceso-name">{u.nombre}</strong>
                    <span className="mi-cuenta-acceso-role" data-rol={u.rol}>
                      {rolLabel(u.rol)}
                    </span>
                    {!u.activo ? (
                      <span className="mi-cuenta-acceso-badge is-warn">Inactivo</span>
                    ) : null}
                  </div>
                  <span className="mi-cuenta-acceso-email">{u.email}</span>
                </div>
                {u.visible ? (
                  <div
                    className="mi-cuenta-acceso-modulos"
                    role="group"
                    aria-label={`Módulos de ${u.nombre}`}
                  >
                    {EMPRESA_MODULOS_ACCESO.map((mod) => {
                      const on = u.modulos?.[mod] !== false;
                      return (
                        <label
                          key={mod}
                          className={`mi-cuenta-acceso-mod${on ? " is-on" : ""}`}
                          title={EMPRESA_MODULO_ACCESO_LABELS[mod]}
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            disabled={saving}
                            onChange={(e) =>
                              toggleModulo(u.id, mod, e.target.checked)
                            }
                          />
                          <span className="mi-cuenta-acceso-mod-icon" aria-hidden="true">
                            <MenuAppIcon
                              id={MODULO_MENU_ICON[mod]}
                              className="menu-app-icon-svg"
                            />
                          </span>
                          <span className="mi-cuenta-acceso-mod-copy">
                            <span className="mi-cuenta-acceso-mod-kicker">Módulo</span>
                            <span className="mi-cuenta-acceso-mod-name">
                              {EMPRESA_MODULO_ACCESO_LABELS[mod]}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <span className="mi-cuenta-acceso-off">Sin acceso a la empresa</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {!loading && configurables.length > 0 ? (
        <div className="mi-cuenta-empresa-usuarios-actions">
          {ok && !dirty ? (
            <span className="mi-cuenta-ejercicio-ok">Acceso actualizado</span>
          ) : null}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => void guardar()}
            disabled={!dirty || saving}
          >
            <Save size={15} strokeWidth={2.1} />
            {saving ? "Guardando…" : "Guardar acceso"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
