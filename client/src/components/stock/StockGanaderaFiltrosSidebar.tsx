import type { ReactNode } from "react";
import type { DispositivoEstado, DispositivoEmpresa } from "../../types";
import { ESTADOS_DISPOSITIVO } from "./stock-ganadera-utils";

export interface FacetCounts {
  sexo: Record<string, number>;
  empresa: Record<string, number>;
  estado: Record<string, number>;
}

interface Props {
  fechaDesde: string;
  fechaHasta: string;
  onFechaDesde: (v: string) => void;
  onFechaHasta: (v: string) => void;
  filtroSexo: Set<string>;
  filtroEmpresa: Set<string>;
  filtroEstado: Set<DispositivoEstado>;
  onToggleSexo: (key: string) => void;
  onToggleEmpresa: (key: string) => void;
  onToggleEstado: (estado: DispositivoEstado) => void;
  onLimpiarSexo: () => void;
  onLimpiarEmpresa: () => void;
  onLimpiarEstado: () => void;
  counts: FacetCounts;
  onLimpiarFacetas: () => void;
  hayFacetasActivas: boolean;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

const SEXO_OPCIONES = [
  { key: "MACHO", label: "Macho" },
  { key: "HEMBRA", label: "Hembra" },
  { key: "", label: "Sin definir" },
] as const;

const EMPRESA_OPCIONES: { key: DispositivoEmpresa | ""; label: string }[] = [
  { key: "GUAVIYU", label: "Guaviyú" },
  { key: "CHIVILCOY", label: "Chivilcoy" },
  { key: "", label: "Sin definir" },
];

function FacetGroup({
  title,
  onClear,
  showClear,
  children,
}: {
  title: string;
  onClear?: () => void;
  showClear?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="stock-facet-group">
      <div className="stock-facet-group-head">
        <h4 className="stock-facet-group-title">{title}</h4>
        {showClear && onClear ? (
          <button type="button" className="stock-facet-clear" onClick={onClear}>
            Borrar
          </button>
        ) : null}
      </div>
      <div className="stock-facet-options">{children}</div>
    </div>
  );
}

function FacetOption({
  checked,
  label,
  count,
  onChange,
}: {
  checked: boolean;
  label: string;
  count: number;
  onChange: () => void;
}) {
  return (
    <label className={`stock-facet-option${checked ? " is-checked" : ""}`}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="stock-facet-option-label">{label}</span>
      <span className="stock-facet-option-count">{count}</span>
    </label>
  );
}

export default function StockGanaderaFiltrosSidebar({
  fechaDesde,
  fechaHasta,
  onFechaDesde,
  onFechaHasta,
  filtroSexo,
  filtroEmpresa,
  filtroEstado,
  onToggleSexo,
  onToggleEmpresa,
  onToggleEstado,
  onLimpiarSexo,
  onLimpiarEmpresa,
  onLimpiarEstado,
  counts,
  onLimpiarFacetas,
  hayFacetasActivas,
  mobileOpen,
  onMobileClose,
}: Props) {
  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="stock-facet-backdrop"
          aria-label="Cerrar filtros"
          onClick={onMobileClose}
        />
      ) : null}
      <aside
        className={`stock-facet-sidebar${mobileOpen ? " is-open" : ""}`}
        aria-label="Filtros"
      >
        <div className="stock-facet-sidebar-head">
          <h3 className="stock-facet-sidebar-title">Filtros</h3>
          {hayFacetasActivas ? (
            <button
              type="button"
              className="stock-facet-clear stock-facet-clear--all"
              onClick={onLimpiarFacetas}
            >
              Limpiar todo
            </button>
          ) : null}
          <button
            type="button"
            className="stock-facet-mobile-close"
            aria-label="Cerrar"
            onClick={onMobileClose}
          >
            ×
          </button>
        </div>

        <FacetGroup title="Última lectura">
          <div className="stock-facet-dates">
            <label className="stock-facet-date">
              <span>Desde</span>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => onFechaDesde(e.target.value)}
              />
            </label>
            <label className="stock-facet-date">
              <span>Hasta</span>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => onFechaHasta(e.target.value)}
              />
            </label>
          </div>
        </FacetGroup>

        <FacetGroup
          title="Sexo"
          showClear={filtroSexo.size > 0}
          onClear={onLimpiarSexo}
        >
          {SEXO_OPCIONES.map((o) => (
            <FacetOption
              key={o.key || "sin"}
              checked={filtroSexo.has(o.key)}
              label={o.label}
              count={counts.sexo[o.key] ?? 0}
              onChange={() => onToggleSexo(o.key)}
            />
          ))}
        </FacetGroup>

        <FacetGroup
          title="Empresa"
          showClear={filtroEmpresa.size > 0}
          onClear={onLimpiarEmpresa}
        >
          {EMPRESA_OPCIONES.map((o) => (
            <FacetOption
              key={o.key || "sin"}
              checked={filtroEmpresa.has(o.key)}
              label={o.label}
              count={counts.empresa[o.key] ?? 0}
              onChange={() => onToggleEmpresa(o.key)}
            />
          ))}
        </FacetGroup>

        <FacetGroup
          title="Estado"
          showClear={filtroEstado.size > 0}
          onClear={onLimpiarEstado}
        >
          {ESTADOS_DISPOSITIVO.map((o) => (
            <FacetOption
              key={o.value}
              checked={filtroEstado.has(o.value)}
              label={o.label}
              count={counts.estado[o.value] ?? 0}
              onChange={() => onToggleEstado(o.value)}
            />
          ))}
        </FacetGroup>
      </aside>
    </>
  );
}
