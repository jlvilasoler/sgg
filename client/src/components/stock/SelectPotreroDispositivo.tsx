import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createStockGanaderoPotrero,
  fetchStockGanaderoPotreros,
} from "../../api";
import { IconCancelar, IconConfirmar } from "../icons/ActionIcons";
import {
  esPotreroEnCatalogo,
  normalizarPotrero,
  POTRERO_OTRA_VALUE,
} from "./stock-ganadera-utils";

const POTRERO_AGREGAR_LABEL = "Agregar otro potrero ->";

interface Props {
  value: string;
  onChange: (potrero: string) => void;
  disabled?: boolean;
  id?: string;
  apiOnline?: boolean;
  onError?: (msg: string) => void;
  onSuccess?: (msg: string, title?: string) => void;
  selectClassName?: string;
}

function ordenarPotreros(potreros: Iterable<string>): string[] {
  return [...new Set([...potreros].map(normalizarPotrero).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "es")
  );
}

export default function SelectPotreroDispositivo({
  value,
  onChange,
  disabled = false,
  id,
  apiOnline = true,
  onError,
  onSuccess,
  selectClassName = "stock-edit-select",
}: Props) {
  const [catalogo, setCatalogo] = useState<string[]>([]);
  const [cargandoCatalogo, setCargandoCatalogo] = useState(false);
  const [potreroNuevoNombre, setPotreroNuevoNombre] = useState("");
  const [guardandoPotrero, setGuardandoPotrero] = useState(false);
  const [modoAgregar, setModoAgregar] = useState(false);

  const cargarCatalogo = useCallback(async () => {
    if (!apiOnline) {
      setCatalogo([]);
      return;
    }
    setCargandoCatalogo(true);
    try {
      const potreros = await fetchStockGanaderoPotreros();
      setCatalogo(ordenarPotreros(potreros));
    } catch (e) {
      setCatalogo([]);
      onError?.(e instanceof Error ? e.message : "Error al cargar potreros");
    } finally {
      setCargandoCatalogo(false);
    }
  }, [apiOnline, onError]);

  useEffect(() => {
    void cargarCatalogo();
  }, [cargarCatalogo]);

  const norm = normalizarPotrero(value);

  const normPrev = useRef(norm);
  useEffect(() => {
    if (normPrev.current && !norm) {
      setModoAgregar(false);
      setPotreroNuevoNombre("");
    }
    normPrev.current = norm;
  }, [norm]);

  const opciones = useMemo(() => {
    const list = [...catalogo];
    if (norm && !esPotreroEnCatalogo(norm, list)) list.push(norm);
    return ordenarPotreros(list);
  }, [catalogo, norm]);

  const cancelarPotreroNuevo = () => {
    setModoAgregar(false);
    setPotreroNuevoNombre("");
  };

  const handlePotreroSelect = (v: string) => {
    if (v === POTRERO_OTRA_VALUE) {
      setModoAgregar(true);
      setPotreroNuevoNombre("");
      return;
    }
    setModoAgregar(false);
    setPotreroNuevoNombre("");
    onChange(v);
  };

  const guardarPotreroNuevo = async () => {
    const nombre = normalizarPotrero(potreroNuevoNombre);
    if (!nombre) {
      onError?.("Ingresá un nombre de potrero");
      return;
    }
    if (!apiOnline) {
      onError?.("Conectá la API para agregar potreros al catálogo");
      return;
    }
    setGuardandoPotrero(true);
    try {
      const guardado = await createStockGanaderoPotrero(nombre);
      setCatalogo((prev) => ordenarPotreros([...prev, guardado]));
      setModoAgregar(false);
      setPotreroNuevoNombre("");
      onChange(guardado);
      onSuccess?.(`Potrero «${guardado}» agregado al catálogo`, "Catálogo");
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "Error al agregar potrero");
    } finally {
      setGuardandoPotrero(false);
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
            maxLength={48}
            disabled={disabled || guardandoPotrero}
            placeholder="Nombre del nuevo potrero…"
            value={potreroNuevoNombre}
            autoComplete="off"
            autoFocus
            onChange={(e) => setPotreroNuevoNombre(normalizarPotrero(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                void guardarPotreroNuevo();
              }
            }}
            aria-label="Nombre del nuevo potrero"
          />
          <div className="concepto-acciones">
            <button
              type="button"
              className="concepto-btn concepto-btn--guardar"
              disabled={disabled || guardandoPotrero || !potreroNuevoNombre.trim() || !apiOnline}
              onClick={() => void guardarPotreroNuevo()}
              title="Agregar potrero al catálogo"
              aria-label="Agregar potrero"
            >
              {guardandoPotrero ? (
                <span className="concepto-btn-spinner" aria-hidden />
              ) : (
                <IconConfirmar size={18} />
              )}
            </button>
            <button
              type="button"
              className="concepto-btn concepto-btn--cancelar"
              disabled={disabled || guardandoPotrero}
              onClick={cancelarPotreroNuevo}
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
          disabled={disabled || cargandoCatalogo}
          onChange={(e) => handlePotreroSelect(e.target.value)}
        >
          <option value="">—</option>
          {opciones.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
          <option value={POTRERO_OTRA_VALUE}>{POTRERO_AGREGAR_LABEL}</option>
        </select>
      </div>
    </div>
  );
}
