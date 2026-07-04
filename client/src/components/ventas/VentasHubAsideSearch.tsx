import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Search } from "lucide-react";
import type { VentasHubItem } from "./VentasHubTypes";
import {
  filtrarModulosVentasHub,
  mostrarDashboardEnBusquedaVentas,
} from "./ventas-hub-search";

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
}

export function VentasHubAsideSearchField({ value, onChange, inputRef }: SearchFieldProps) {
  return (
    <label className="sg-hub-aside-search">
      <Search size={15} aria-hidden />
      <input
        ref={inputRef}
        type="search"
        className="sg-hub-aside-search-input"
        placeholder="Buscar en módulos…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Buscar módulos en la barra lateral"
      />
    </label>
  );
}

export function useVentasHubAsideSearch(items: VentasHubItem[]) {
  const [busquedaModulos, setBusquedaModulos] = useState("");
  const busquedaInputRef = useRef<HTMLInputElement>(null);

  const consultaActiva = busquedaModulos.trim().length > 0;
  const itemsFiltrados = useMemo(
    () => filtrarModulosVentasHub(items, busquedaModulos),
    [items, busquedaModulos]
  );
  const mostrarDashboard = useMemo(
    () => mostrarDashboardEnBusquedaVentas(busquedaModulos),
    [busquedaModulos]
  );

  const enfocarBusqueda = useCallback(() => {
    busquedaInputRef.current?.focus();
    busquedaInputRef.current?.select();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        enfocarBusqueda();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enfocarBusqueda]);

  return {
    busquedaModulos,
    setBusquedaModulos,
    busquedaInputRef,
    consultaActiva,
    itemsFiltrados,
    mostrarDashboard,
  };
}
