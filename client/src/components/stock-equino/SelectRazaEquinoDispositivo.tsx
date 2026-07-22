import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createStockEquinoRaza,
  deleteStockEquinoRaza,
  fetchStockEquinoRazas,
} from "../../api";
import { confirmAction } from "../../utils/confirm";
import { IconCancelar, IconConfirmar, IconEliminar } from "../icons/ActionIcons";
import {
  esRazaPredefinidaEn,
  normalizarRaza,
  RAZA_OTRA_VALUE,
} from "../stock/stock-ganadera-utils";

const RAZA_AGREGAR_LABEL = "Agregar otra raza ->";
const RAZAS_EQUINO_FALLBACK = ["CRIOLLA"] as const;

interface Props {
  value: string;
  onChange: (raza: string) => void;
  disabled?: boolean;
  id?: string;
  apiOnline?: boolean;
  onError?: (msg: string) => void;
  onSuccess?: (msg: string, title?: string) => void;
  puedeEliminarRaza?: boolean;
  selectClassName?: string;
}

function ordenarRazas(razas: Iterable<string>): string[] {
  return [...new Set([...razas].map(normalizarRaza).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "es")
  );
}

export default function SelectRazaEquinoDispositivo({
  value,
  onChange,
  disabled = false,
  id,
  apiOnline = true,
  onError,
  onSuccess,
  puedeEliminarRaza = false,
  selectClassName = "stock-edit-select",
}: Props) {
  const [catalogo, setCatalogo] = useState<string[]>(() =>
    ordenarRazas(RAZAS_EQUINO_FALLBACK)
  );
  const [cargandoCatalogo, setCargandoCatalogo] = useState(false);
  const [razaNuevaNombre, setRazaNuevaNombre] = useState("");
  const [guardandoRaza, setGuardandoRaza] = useState(false);
  const [eliminandoRaza, setEliminandoRaza] = useState(false);
  const [modoAgregar, setModoAgregar] = useState(false);

  const cargarCatalogo = useCallback(async () => {
    if (!apiOnline) {
      setCatalogo(ordenarRazas(RAZAS_EQUINO_FALLBACK));
      return;
    }
    setCargandoCatalogo(true);
    try {
      const razas = await fetchStockEquinoRazas();
      setCatalogo(ordenarRazas(razas.length ? razas : RAZAS_EQUINO_FALLBACK));
    } catch (e) {
      setCatalogo(ordenarRazas(RAZAS_EQUINO_FALLBACK));
      onError?.(e instanceof Error ? e.message : "Error al cargar razas");
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
      setRazaNuevaNombre("");
    }
    normPrev.current = norm;
  }, [norm]);

  const opciones = useMemo(() => {
    const list = [...catalogo];
    if (norm && !esRazaPredefinidaEn(norm, list)) list.push(norm);
    return ordenarRazas(list);
  }, [catalogo, norm]);

  const enCatalogo = norm !== "" && esRazaPredefinidaEn(norm, catalogo);

  const cancelarRazaNueva = () => {
    setModoAgregar(false);
    setRazaNuevaNombre("");
  };

  const handleRazaSelect = (v: string) => {
    if (v === RAZA_OTRA_VALUE) {
      setModoAgregar(true);
      setRazaNuevaNombre("");
      return;
    }
    setModoAgregar(false);
    setRazaNuevaNombre("");
    onChange(v);
  };

  const guardarRazaNueva = async () => {
    const nombre = normalizarRaza(razaNuevaNombre);
    if (!nombre) {
      onError?.("Ingresá un nombre de raza");
      return;
    }
    if (!apiOnline) {
      onError?.("Conectá la API para agregar razas al catálogo");
      return;
    }
    setGuardandoRaza(true);
    try {
      const guardada = await createStockEquinoRaza(nombre);
      setCatalogo((prev) => ordenarRazas([...prev, guardada]));
      setModoAgregar(false);
      setRazaNuevaNombre("");
      onChange(guardada);
      onSuccess?.(`Raza «${guardada}» agregada al catálogo`, "Catálogo");
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "Error al agregar raza");
    } finally {
      setGuardandoRaza(false);
    }
  };

  const eliminarRazaCatalogo = async () => {
    if (!norm || !puedeEliminarRaza || !enCatalogo) return;
    if (!apiOnline) {
      onError?.("Conectá la API para eliminar razas del catálogo");
      return;
    }
    const ok = await confirmAction({
      title: "Eliminar raza",
      message: `¿Eliminar «${norm}» del catálogo de razas equinas?\n\nNo se borra de animales ya guardados; solo deja de aparecer en el listado.`,
      confirmText: "Eliminar",
      variant: "danger",
    });
    if (!ok) return;

    setEliminandoRaza(true);
    try {
      const eliminada = await deleteStockEquinoRaza(norm);
      setCatalogo((prev) => prev.filter((r) => r !== eliminada));
      onChange("");
      onSuccess?.(`Raza «${eliminada}» eliminada del catálogo`, "Catálogo");
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "Error al eliminar raza");
    } finally {
      setEliminandoRaza(false);
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
            disabled={disabled || guardandoRaza}
            placeholder="Nombre de la nueva raza…"
            value={razaNuevaNombre}
            autoComplete="off"
            autoFocus
            onChange={(e) => setRazaNuevaNombre(normalizarRaza(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                void guardarRazaNueva();
              }
            }}
            aria-label="Nombre de la nueva raza"
          />
          <div className="concepto-acciones">
            <button
              type="button"
              className="concepto-btn concepto-btn--guardar"
              disabled={disabled || guardandoRaza || !razaNuevaNombre.trim() || !apiOnline}
              onClick={() => void guardarRazaNueva()}
              title="Agregar raza al catálogo"
              aria-label="Agregar raza"
            >
              {guardandoRaza ? (
                <span className="concepto-btn-spinner" aria-hidden />
              ) : (
                <IconConfirmar size={18} />
              )}
            </button>
            <button
              type="button"
              className="concepto-btn concepto-btn--cancelar"
              disabled={disabled || guardandoRaza}
              onClick={cancelarRazaNueva}
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
          disabled={disabled || cargandoCatalogo || eliminandoRaza}
          onChange={(e) => handleRazaSelect(e.target.value)}
        >
          <option value="">—</option>
          {opciones.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
          <option value={RAZA_OTRA_VALUE}>{RAZA_AGREGAR_LABEL}</option>
        </select>
        {puedeEliminarRaza && enCatalogo ? (
          <button
            type="button"
            className="stock-raza-delete-btn"
            disabled={disabled || eliminandoRaza || !apiOnline}
            title={`Eliminar «${norm}» del catálogo`}
            aria-label={`Eliminar raza ${norm}`}
            onClick={() => void eliminarRazaCatalogo()}
          >
            {eliminandoRaza ? (
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
