import { useState } from "react";
import { createSubRubroItem, deleteSubRubroItem } from "../../api";
import type { SubRubroItem } from "../../types";
import { confirmAction } from "../../utils/confirm";

interface Props {
  subRubroId: number;
  items: SubRubroItem[];
  apiOnline: boolean;
  createItem?: (subRubroId: number, nombre: string) => Promise<SubRubroItem>;
  deleteItem?: (id: number) => Promise<void>;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onItemAdded: (item: SubRubroItem) => void;
  onItemRemoved: (itemId: number) => void;
}

export default function SubRubroItemsCell({
  subRubroId,
  items,
  apiOnline,
  createItem = createSubRubroItem,
  deleteItem = deleteSubRubroItem,
  onError,
  onSuccess,
  onItemAdded,
  onItemRemoved,
}: Props) {
  const [nuevoItem, setNuevoItem] = useState("");
  const [saving, setSaving] = useState(false);

  const activos = items.filter((i) => i.activo);

  const agregar = async () => {
    if (!apiOnline) {
      onError("API no conectada");
      return;
    }
    const nombre = nuevoItem.trim();
    if (!nombre) {
      onError("Escribí el nombre del ítem");
      return;
    }
    setSaving(true);
    try {
      const item = await createItem(subRubroId, nombre);
      setNuevoItem("");
      onSuccess("Ítem agregado");
      onItemAdded(item);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al guardar ítem");
    } finally {
      setSaving(false);
    }
  };

  const borrar = async (item: SubRubroItem) => {
    const ok = await confirmAction({
      title: "Quitar ítem",
      message: `¿Quitar «${item.nombre}» del sub-rubro?`,
      confirmText: "Quitar",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await deleteItem(item.id);
      onSuccess("Ítem eliminado");
      onItemRemoved(item.id);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al eliminar");
    }
  };

  return (
    <div className="subrubro-items-cell">
      <div className="subrubro-items-flow" role="list">
        {activos.map((it) => (
          <span key={it.id} className="subrubro-item-chip" role="listitem">
            <span className="subrubro-item-chip-label" title={it.nombre}>
              {it.nombre}
            </span>
            <button
              type="button"
              className="subrubro-item-chip-remove"
              disabled={!apiOnline}
              onClick={() => borrar(it)}
              aria-label={`Quitar ${it.nombre}`}
              title="Quitar"
            >
              ×
            </button>
          </span>
        ))}
        <div className="subrubro-items-add-inline">
          <input
            type="text"
            className="subrubro-items-input"
            data-sin-mayusculas="true"
            placeholder={activos.length ? "Agregar…" : "Nuevo ítem…"}
            value={nuevoItem}
            disabled={!apiOnline || saving}
            onChange={(e) => setNuevoItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                agregar();
              }
            }}
          />
          <button
            type="button"
            className="btn btn-sm btn-primary subrubro-items-add-btn"
            disabled={!apiOnline || saving}
            onClick={agregar}
            title="Agregar ítem"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
