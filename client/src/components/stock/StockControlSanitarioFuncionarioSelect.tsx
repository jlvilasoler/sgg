import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchUsuariosMiCuenta } from "../../api";
import type { AuthUser } from "../../types";

function usuarioNombre(u: AuthUser): string {
  return u.nombre.trim() || u.email.trim();
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  apiOnline: boolean;
  currentUser?: AuthUser | null;
  historialNombres?: string[];
  onError: (msg: string) => void;
}

export default function StockControlSanitarioFuncionarioSelect({
  value,
  onChange,
  disabled = false,
  apiOnline,
  currentUser = null,
  historialNombres = [],
  onError,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [usuarios, setUsuarios] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(false);

  const loadUsuarios = useCallback(async () => {
    if (!apiOnline) {
      setUsuarios([]);
      return;
    }
    setLoading(true);
    try {
      setUsuarios(await fetchUsuariosMiCuenta());
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar usuarios de la cuenta");
      setUsuarios([]);
    } finally {
      setLoading(false);
    }
  }, [apiOnline, onError]);

  useEffect(() => {
    if (!apiOnline) return;
    void loadUsuarios();
  }, [apiOnline, loadUsuarios]);

  useEffect(() => {
    if (!abierto) return;
    void loadUsuarios();
  }, [abierto, loadUsuarios]);

  const cuentaNombre = useMemo(() => {
    const nombre =
      currentUser?.cuenta_actividad_nombre?.trim() ||
      currentUser?.empresa_nombre?.trim() ||
      "";
    return nombre || "la cuenta";
  }, [currentUser]);

  const opciones = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    const push = (nombre: string) => {
      const t = nombre.trim();
      if (!t) return;
      const key = t.toLocaleLowerCase("es-UY");
      if (seen.has(key)) return;
      seen.add(key);
      list.push(t);
    };
    for (const u of usuarios) push(usuarioNombre(u));
    for (const n of historialNombres) push(n);
    if (value.trim()) push(value);
    return list.sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [historialNombres, usuarios, value]);

  const listaFiltrada = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    if (!t) return opciones;
    return opciones.filter((nombre) => {
      const lower = nombre.toLowerCase();
      if (lower.includes(t)) return true;
      const user = usuarios.find(
        (u) => usuarioNombre(u).toLocaleLowerCase("es-UY") === nombre.toLocaleLowerCase("es-UY")
      );
      return user?.email.toLowerCase().includes(t) ?? false;
    });
  }, [busqueda, opciones, usuarios]);

  const cerrar = useCallback(() => {
    setAbierto(false);
    setBusqueda("");
  }, []);

  const elegir = useCallback(
    (nombre: string) => {
      onChange(nombre);
      cerrar();
    },
    [onChange, cerrar]
  );

  const abrir = () => {
    if (disabled) return;
    setAbierto(true);
    setBusqueda("");
  };

  useEffect(() => {
    if (!abierto) return;
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        cerrar();
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [abierto, cerrar]);

  const textoSeleccion = value.trim() || "— Seleccionar —";

  return (
    <div className="stock-control-sanitario-funcionario-select" ref={rootRef}>
      <div className="stock-control-sanitario-select-shell">
        <button
          type="button"
          id="cs-control-funcionario-trigger"
          className="stock-control-sanitario-field-trigger"
          aria-expanded={abierto}
          aria-haspopup="listbox"
          onClick={() => (abierto ? cerrar() : abrir())}
          disabled={disabled}
        >
          <span className={value.trim() ? "" : "stock-control-sanitario-field-trigger-placeholder"}>
            {textoSeleccion}
          </span>
        </button>
        {value.trim() && !disabled ? (
          <button
            type="button"
            className="stock-control-sanitario-field-clear"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            title="Quitar funcionario"
            aria-label="Quitar funcionario"
          >
            ×
          </button>
        ) : null}
      </div>

      {abierto && !disabled ? (
        <div className="proveedor-panel stock-control-sanitario-formula-panel">
          <div className="proveedor-panel-search">
            <label htmlFor="cs-funcionario-busqueda" className="sr-only">
              Buscar usuario
            </label>
            <input
              ref={searchRef}
              id="cs-funcionario-busqueda"
              type="search"
              className="proveedor-search-input"
              placeholder="Buscar por nombre o email…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") cerrar();
              }}
            />
          </div>
          <p className="proveedor-panel-meta">
            {loading
              ? "Cargando usuarios…"
              : busqueda.trim()
                ? `${listaFiltrada.length} coincidencia(s) de ${opciones.length}`
                : `${opciones.length} usuario(s) de ${cuentaNombre}`}
          </p>

          <ul className="proveedor-dropdown" role="listbox">
            {listaFiltrada.length === 0 && !loading ? (
              <li className="proveedor-dropdown-empty muted">Sin coincidencias</li>
            ) : null}
            {listaFiltrada.map((nombre) => {
              const user = usuarios.find(
                (u) =>
                  usuarioNombre(u).toLocaleLowerCase("es-UY") ===
                  nombre.toLocaleLowerCase("es-UY")
              );
              return (
                <li key={nombre}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={value === nombre}
                    onClick={() => elegir(nombre)}
                  >
                    <span>{nombre}</span>
                    {user?.rol_label ? (
                      <span className="stock-control-sanitario-funcionario-rol muted">
                        {user.rol_label}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
