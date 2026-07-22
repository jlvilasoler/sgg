import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createStockEquinoPelaje,
  deleteStockEquinoPelaje,
  fetchStockEquinoPelajes,
} from "../../api";
import { confirmAction } from "../../utils/confirm";
import { IconCancelar, IconConfirmar, IconEliminar } from "../icons/ActionIcons";
import {
  esRazaPredefinidaEn,
  normalizarRaza,
  RAZA_OTRA_VALUE,
} from "../stock/stock-ganadera-utils";

const PELAJE_AGREGAR_LABEL = "Agregar otro pelaje ->";
const PELAJES_EQUINO_FALLBACK = [
  "ALAZÁN",
  "BAYO",
  "ZAINO",
  "NEGRO",
  "TORDILLO",
  "OVERO",
  "ROSILLO",
  "MORO",
  "PANGARÉ",
  "GATEADO",
] as const;

interface Props {
  value: string;
  onChange: (pelaje: string) => void;
  disabled?: boolean;
  id?: string;
  apiOnline?: boolean;
  onError?: (msg: string) => void;
  onSuccess?: (msg: string, title?: string) => void;
  puedeEliminarPelaje?: boolean;
  selectClassName?: string;
}

function ordenarPelajes(pelajes: Iterable<string>): string[] {
  return [...new Set([...pelajes].map(normalizarRaza).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "es")
  );
}

export default function SelectPelajeEquinoDispositivo({
  value,
  onChange,
  disabled = false,
  id,
  apiOnline = true,
  onError,
  onSuccess,
  puedeEliminarPelaje = false,
  selectClassName = "stock-edit-select",
}: Props) {
  const [catalogo, setCatalogo] = useState<string[]>(() =>
    ordenarPelajes(PELAJES_EQUINO_FALLBACK)
  );
  const [cargandoCatalogo, setCargandoCatalogo] = useState(false);
  const [pelajeNuevoNombre, setPelajeNuevoNombre] = useState("");
  const [guardandoPelaje, setGuardandoPelaje] = useState(false);
  const [eliminandoPelaje, setEliminandoPelaje] = useState(false);
  const [modoAgregar, setModoAgregar] = useState(false);

  const cargarCatalogo = useCallback(async () => {
    if (!apiOnline) {
      setCatalogo(ordenarPelajes(PELAJES_EQUINO_FALLBACK));
      return;
    }
    setCargandoCatalogo(true);
    try {
      const pelajes = await fetchStockEquinoPelajes();
      setCatalogo(ordenarPelajes(pelajes.length ? pelajes : PELAJES_EQUINO_FALLBACK));
    } catch (e) {
      setCatalogo(ordenarPelajes(PELAJES_EQUINO_FALLBACK));
      onError?.(e instanceof Error ? e.message : "Error al cargar pelajes");
    } finally {
      setCargandoCatalogo(false);
    }
  }, [apiOnline, onError]);

  useEffect(() => {
    void cargarCatalogo();
  }, [cargarCatalogo]);

  const norm = normalizarRaza(value);

  const normPrev = useRef(norm);
  useEffect(() => {
    if (normPrev.current && !norm) {
      setModoAgregar(false);
      setPelajeNuevoNombre("");
    }
    normPrev.current = norm;
  }, [norm]);

  const opciones = useMemo(() => {
    const list = [...catalogo];
    if (norm && !esRazaPredefinidaEn(norm, list)) list.push(norm);
    return ordenarPelajes(list);
  }, [catalogo, norm]);

  const enCatalogo = norm !== "" && esRazaPredefinidaEn(norm, catalogo);

  const cancelarPelajeNuevo = () => {
    setModoAgregar(false);
    setPelajeNuevoNombre("");
  };

  const handlePelajeSelect = (v: string) => {
    if (v === RAZA_OTRA_VALUE) {
      setModoAgregar(true);
      setPelajeNuevoNombre("");
      return;
    }
    setModoAgregar(false);
    setPelajeNuevoNombre("");
    onChange(v);
  };

  const guardarPelajeNuevo = async () => {
    const nombre = normalizarRaza(pelajeNuevoNombre);
    if (!nombre) {
      onError?.("Ingresá un nombre de pelaje");
      return;
    }
    if (!apiOnline) {
      onError?.("Conectá la API para agregar pelajes al catálogo");
      return;
    }
    setGuardandoPelaje(true);
    try {
      const guardado = await createStockEquinoPelaje(nombre);
      setCatalogo((prev) => ordenarPelajes([...prev, guardado]));
      setModoAgregar(false);
      setPelajeNuevoNombre("");
      onChange(guardado);
      onSuccess?.(`Pelaje «${guardado}» agregado al catálogo`, "Catálogo");
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "Error al agregar pelaje");
    } finally {
      setGuardandoPelaje(false);
    }
  };

  const eliminarPelajeCatalogo = async () => {
    if (!norm || !puedeEliminarPelaje || !enCatalogo) return;
    if (!apiOnline) {
      onError?.("Conectá la API para eliminar pelajes del catálogo");
      return;
    }
    const ok = await confirmAction({
      title: "Eliminar pelaje",
      message: `¿Eliminar «${norm}» del catálogo de pelajes equinos?\n\nNo se borra de animales ya guardados; solo deja de aparecer en el listado.`,
      confirmText: "Eliminar",
      variant: "danger",
    });
    if (!ok) return;

    setEliminandoPelaje(true);
    try {
      const eliminado = await deleteStockEquinoPelaje(norm);
      setCatalogo((prev) => prev.filter((p) => p !== eliminado));
      onChange("");
      onSuccess?.(`Pelaje «${eliminado}» eliminado del catálogo`, "Catálogo");
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "Error al eliminar pelaje");
    } finally {
      setEliminandoPelaje(false);
    }
  };

  if (modoAgregar) {
    return (
      <div className="stock-raza-unified">
        <div className="concepto-input-group">
          <input
            id={id}
            type="text"
            className="concepto-unificado mayusculas-auto"
            maxLength={32}
            disabled={disabled || guardandoPelaje}
            placeholder="Nombre del nuevo pelaje…"
            value={pelajeNuevoNombre}
            autoComplete="off"
            autoFocus
            onChange={(e) => setPelajeNuevoNombre(normalizarRaza(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                void guardarPelajeNuevo();
              }
            }}
            aria-label="Nombre del nuevo pelaje"
          />
          <div className="concepto-acciones">
            <button
              type="button"
              className="concepto-btn concepto-btn--guardar"
              disabled={
                disabled || guardandoPelaje || !pelajeNuevoNombre.trim() || !apiOnline
              }
              onClick={() => void guardarPelajeNuevo()}
              title="Agregar pelaje al catálogo"
              aria-label="Agregar pelaje"
            >
              {guardandoPelaje ? (
                <span className="concepto-btn-spinner" aria-hidden />
              ) : (
                <IconConfirmar size={18} />
              )}
            </button>
            <button
              type="button"
              className="concepto-btn concepto-btn--cancelar"
              disabled={disabled || guardandoPelaje}
              onClick={cancelarPelajeNuevo}
              title="Cancelar"
              aria-label="Cancelar"
            >
              <IconCancelar size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="stock-raza-unified">
      <div className="stock-raza-select-row">
        <select
          id={id}
          className={selectClassName}
          value={norm}
          disabled={disabled || cargandoCatalogo || eliminandoPelaje}
          onChange={(e) => handlePelajeSelect(e.target.value)}
        >
          <option value="">—</option>
          {opciones.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
          <option value={RAZA_OTRA_VALUE}>{PELAJE_AGREGAR_LABEL}</option>
        </select>
        {puedeEliminarPelaje && enCatalogo ? (
          <button
            type="button"
            className="stock-raza-delete-btn"
            disabled={disabled || eliminandoPelaje || !apiOnline}
            title={`Eliminar «${norm}» del catálogo`}
            aria-label={`Eliminar pelaje ${norm}`}
            onClick={() => void eliminarPelajeCatalogo()}
          >
            {eliminandoPelaje ? (
              <span className="concepto-btn-spinner concepto-btn-spinner--muted" aria-hidden />
            ) : (
              <IconEliminar size={18} />
            )}
          </button>
        ) : null}
      </div>
    </div>
  );
}
