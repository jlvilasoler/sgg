import { useMemo } from "react";
import { Users } from "lucide-react";
import type { AuthUser, NotaCompartido } from "../../types";
import UserAvatar from "../UserAvatar";

interface Props {
  miembros: AuthUser[];
  seleccionados: number[];
  disabled?: boolean;
  onChange: (ids: number[]) => void;
  label?: string;
  ariaLabel?: string;
  equipoNombre?: string;
  equipoDetalle?: string;
  emptyMessage?: string;
  showMiembroRolLabel?: boolean;
}

export function idsTodoElEquipo(miembros: AuthUser[]): number[] {
  return miembros.filter((m) => m.activo !== false).map((m) => m.id);
}

export function esCompartidaConTodoElEquipo(
  seleccionados: number[],
  miembros: AuthUser[]
): boolean {
  const todos = idsTodoElEquipo(miembros);
  if (!todos.length) return false;
  return todos.every((id) => seleccionados.includes(id));
}

export default function NotaCompartirPanel({
  miembros,
  seleccionados,
  disabled = false,
  onChange,
  label = "Compartir con",
  ariaLabel = "Compartir con usuarios del equipo",
  equipoNombre = "Todo el equipo",
  equipoDetalle,
  emptyMessage = "No hay otros usuarios en tu cuenta para compartir notas.",
  showMiembroRolLabel = true,
}: Props) {
  const equipo = useMemo(
    () => miembros.filter((m) => m.activo !== false),
    [miembros]
  );

  const todoElEquipo = esCompartidaConTodoElEquipo(seleccionados, equipo);

  const toggle = (userId: number) => {
    if (disabled) return;
    const set = new Set(seleccionados);
    if (set.has(userId)) set.delete(userId);
    else set.add(userId);
    onChange([...set]);
  };

  const toggleTodoElEquipo = () => {
    if (disabled) return;
    if (todoElEquipo) {
      onChange([]);
      return;
    }
    onChange(idsTodoElEquipo(equipo));
  };

  if (!equipo.length) {
    return (
      <p className="notas-share-panel-empty">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="notas-share-panel" role="group" aria-label={ariaLabel}>
      <p className="notas-share-panel-label">{label}</p>

      <ul className="notas-share-panel-list">
        <li>
          <label
            className={`notas-share-panel-item notas-share-panel-item--equipo${
              todoElEquipo ? " notas-share-panel-item--on" : ""
            }`}
          >
            <input
              type="checkbox"
              checked={todoElEquipo}
              disabled={disabled}
              onChange={toggleTodoElEquipo}
            />
            <span className="notas-share-panel-equipo-icon" aria-hidden>
              <Users size={16} />
            </span>
            <span className="notas-share-panel-meta">
              <span className="notas-share-panel-name">{equipoNombre}</span>
              <span className="notas-share-panel-rol">{equipoDetalle ?? `${equipo.length} personas`}</span>
            </span>
          </label>
        </li>

        {equipo.map((m) => {
          const checked = seleccionados.includes(m.id);
          return (
            <li key={m.id}>
              <label
                className={`notas-share-panel-item${checked ? " notas-share-panel-item--on" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggle(m.id)}
                />
                <UserAvatar
                  nombre={m.nombre}
                  avatar={m.avatar}
                  size="sm"
                  className="notas-share-panel-avatar"
                />
                <span className="notas-share-panel-meta">
                  <span className="notas-share-panel-name">{m.nombre}</span>
                  {showMiembroRolLabel && m.rol_label ? (
                    <span className="notas-share-panel-rol">{m.rol_label}</span>
                  ) : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function nombresCompartidos(
  list: NotaCompartido[],
  totalEquipo?: number
): string {
  if (!list.length) return "";
  if (totalEquipo != null && totalEquipo > 0 && list.length >= totalEquipo) {
    return "Todo el equipo";
  }
  return list.map((u) => u.nombre).join(", ");
}
