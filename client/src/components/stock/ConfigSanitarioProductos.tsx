import { useCallback, useEffect, useMemo, useState } from "react";
import { ImageIcon, Pencil, Plus, Search, Syringe } from "lucide-react";
import {
  deleteStockControlSanitarioProductoFicha,
  fetchStockControlSanitarioProductoFichas,
  saveStockControlSanitarioProductoFicha,
} from "../../api";
import type { StockControlSanitarioProductoFichaResumen } from "../../types";
import { confirmAction } from "../../utils/confirm";
import { IconEliminar } from "../icons/ActionIcons";
import { PageModuleHeadRow } from "../PageModuleHead";
import StockControlSanitarioProductoFichaModal from "./StockControlSanitarioProductoFichaModal";

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string, title?: string) => void;
  onVolver: () => void;
  volverLabel?: string;
}

function fmtFecha(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-UY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function ConfigSanitarioProductos({
  apiOnline,
  onError,
  onSuccess,
  onVolver,
  volverLabel = "Volver a Configuración SAG",
}: Props) {
  const [items, setItems] = useState<StockControlSanitarioProductoFichaResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [fichaAbierta, setFichaAbierta] = useState<{
    nombre: string;
    initialEdit: boolean;
  } | null>(null);
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [creando, setCreando] = useState(false);

  const cargar = useCallback(async () => {
    if (!apiOnline) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchStockControlSanitarioProductoFichas();
      setItems(data);
    } catch (e) {
      setItems([]);
      onError(e instanceof Error ? e.message : "Error al cargar productos sanitarios");
    } finally {
      setLoading(false);
    }
  }, [apiOnline, onError]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) => {
      const haystack = [
        p.nombre,
        p.laboratorio,
        p.principio_activo,
        p.via_administracion,
        p.especie,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [busqueda, items]);

  const abrirEditar = (nombre: string, initialEdit = false) => {
    setFichaAbierta({ nombre, initialEdit });
  };

  const eliminarProducto = async (nombre: string) => {
    if (!apiOnline) {
      onError("Conectá la API para eliminar productos");
      return;
    }
    const ok = await confirmAction({
      title: "Eliminar producto",
      message: `¿Eliminar «${nombre}» del catálogo sanitario?\n\nNo borra registros ya cargados en Sanidad; solo quita la ficha y deja de sugerirlo en Nombre comercial.`,
      confirmText: "Eliminar",
      variant: "danger",
    });
    if (!ok) return;

    try {
      const eliminado = await deleteStockControlSanitarioProductoFicha(nombre);
      setItems((prev) => prev.filter((p) => p.nombre !== eliminado));
      onSuccess(`Producto «${eliminado}» eliminado del catálogo`, "Sanidad");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al eliminar producto");
    }
  };

  const crearProducto = async () => {
    const nombre = nuevoNombre.trim().slice(0, 120);
    if (!nombre) {
      onError("Indicá el nombre comercial del producto");
      return;
    }
    if (!apiOnline) {
      onError("Conectá la API para agregar productos");
      return;
    }
    if (items.some((p) => p.nombre.toLocaleLowerCase("es-UY") === nombre.toLocaleLowerCase("es-UY"))) {
      onError("Ya existe un producto con ese nombre");
      return;
    }

    setCreando(true);
    try {
      await saveStockControlSanitarioProductoFicha("ganadero", {
        nombre,
        especie: "Bovinos",
      });
      setMostrarNuevo(false);
      setNuevoNombre("");
      await cargar();
      abrirEditar(nombre, true);
      onSuccess(`Producto «${nombre}» creado. Completá la ficha técnica.`, "Sanidad");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al crear producto");
    } finally {
      setCreando(false);
    }
  };

  return (
    <div className="subseccion-panel config-sanitario-productos">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ {volverLabel}
      </button>

      <div className="card config-sanitario-productos-card">
        <div className="form-header">
          <PageModuleHeadRow
            icon={{ source: "hub", id: "stock_sanidad" }}
            title="Catálogo sanitario · Nombre comercial"
            subtitle="Administración central de remedios y fichas técnicas usadas en el módulo Sanidad. Los cambios se reflejan en todos los usuarios."
          />
        </div>

        <div className="config-sanitario-productos-toolbar">
          <label className="config-sanitario-productos-search">
            <Search size={16} aria-hidden />
            <input
              type="search"
              placeholder="Buscar por nombre, laboratorio, fórmula…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              aria-label="Buscar productos sanitarios"
            />
          </label>
          <button
            type="button"
            className="btn btn-primary btn-sm config-sanitario-productos-btn-nuevo"
            disabled={!apiOnline}
            onClick={() => {
              setMostrarNuevo((v) => !v);
              setNuevoNombre("");
            }}
          >
            <Plus size={16} aria-hidden />
            Nuevo producto
          </button>
        </div>

        {mostrarNuevo ? (
          <div className="config-sanitario-productos-nuevo">
            <p className="config-sanitario-productos-nuevo-title">Agregar nombre comercial</p>
            <div className="config-sanitario-productos-nuevo-row">
              <input
                type="text"
                className="config-sanitario-productos-nuevo-input mayusculas-auto"
                maxLength={120}
                placeholder="Ej. Ivomec, Baymec, VAC-SULES…"
                value={nuevoNombre}
                disabled={creando}
                onChange={(e) => setNuevoNombre(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void crearProducto();
                  }
                }}
              />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={creando || !nuevoNombre.trim() || !apiOnline}
                onClick={() => void crearProducto()}
              >
                {creando ? "Creando…" : "Crear y editar ficha"}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={creando}
                onClick={() => setMostrarNuevo(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : null}

        <div className="config-sanitario-productos-meta muted">
          {loading
            ? "Cargando catálogo…"
            : `${filtrados.length} producto${filtrados.length === 1 ? "" : "s"}${busqueda.trim() ? ` de ${items.length}` : ""}`}
        </div>

        {!apiOnline ? (
          <p className="config-sanitario-productos-offline muted">
            Conectá la API para administrar el catálogo central.
          </p>
        ) : loading ? (
          <div className="config-sanitario-productos-loading" aria-busy="true">
            <span className="config-sanitario-productos-loading-bar" />
          </div>
        ) : filtrados.length === 0 ? (
          <p className="config-sanitario-productos-empty muted">
            {busqueda.trim()
              ? "No hay productos que coincidan con la búsqueda."
              : "No hay productos en el catálogo. Agregá el primero con «Nuevo producto»."}
          </p>
        ) : (
          <div className="config-sanitario-productos-table-wrap">
            <table className="data-table config-sanitario-productos-table">
              <thead>
                <tr>
                  <th>Nombre comercial</th>
                  <th>Laboratorio</th>
                  <th>Principio activo</th>
                  <th>Vía</th>
                  <th>Actualizado</th>
                  <th className="config-sanitario-productos-th-actions">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="config-sanitario-productos-nombre-cell">
                        <span className="config-sanitario-productos-nombre-icon" aria-hidden>
                          {p.tiene_foto ? <ImageIcon size={14} /> : <Syringe size={14} />}
                        </span>
                        <strong>{p.nombre}</strong>
                      </div>
                    </td>
                    <td>{p.laboratorio || "—"}</td>
                    <td>{p.principio_activo || "—"}</td>
                    <td>{p.via_administracion || "—"}</td>
                    <td className="config-sanitario-productos-fecha">
                      <span>{fmtFecha(p.actualizado_en)}</span>
                      {p.actualizado_por ? (
                        <span className="muted config-sanitario-productos-autor">{p.actualizado_por}</span>
                      ) : null}
                    </td>
                    <td>
                      <div className="config-sanitario-productos-actions">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm config-sanitario-productos-btn-edit"
                          title="Editar ficha"
                          onClick={() => abrirEditar(p.nombre, true)}
                        >
                          <Pencil size={14} aria-hidden />
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm config-sanitario-productos-btn-delete"
                          title={`Eliminar ${p.nombre}`}
                          aria-label={`Eliminar ${p.nombre}`}
                          onClick={() => void eliminarProducto(p.nombre)}
                        >
                          <IconEliminar size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <StockControlSanitarioProductoFichaModal
        open={fichaAbierta != null}
        nombre={fichaAbierta?.nombre ?? ""}
        modulo="ganadero"
        apiOnline={apiOnline}
        initialEdit={fichaAbierta?.initialEdit ?? false}
        onClose={() => setFichaAbierta(null)}
        onError={onError}
        onSaved={(msg) => {
          onSuccess(msg, "Sanidad");
          void cargar();
        }}
      />
    </div>
  );
}
