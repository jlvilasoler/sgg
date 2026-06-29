import type { ReactNode } from "react";
import type { DispositivoEstado } from "../../types";
import {
  CATEGORIA_FILTRO_HEMBRA,
  CATEGORIA_FILTRO_MACHO,
  CATEGORIA_FILTRO_OTROS,
  EDAD_FILTRO_OPCIONES,
  ESTADOS_DISPOSITIVO,
  SIN_FECHA_NAC_FILTRO_KEY,
  labelGrupoLibreFiltro,
} from "./stock-equina-utils";

export interface FacetCounts {
  sexo: Record<string, number>;
  empresa: Record<string, number>;
  estado: Record<string, number>;
  edad: Record<string, number>;
  grupoLibre: Record<string, number>;
  categoria: Record<string, number>;
  sinFechaNac: number;
}

interface Props {
  fechaDesde: string;
  fechaHasta: string;
  onFechaDesde: (v: string) => void;
  onFechaHasta: (v: string) => void;
  empresaOpciones: Array<{ key: string; label: string }>;
  filtroSexo: Set<string>;
  filtroEmpresa: Set<string>;
  filtroEstado: Set<DispositivoEstado>;
  filtroEdad: Set<string>;
  filtroGrupoLibre: Set<string>;
  filtroCategoria: Set<string>;
  filtroSinFechaNac: Set<string>;
  grupoLibreOpciones: string[];
  onToggleSexo: (key: string) => void;
  onToggleEmpresa: (key: string) => void;
  onToggleEstado: (estado: DispositivoEstado) => void;
  onToggleEdad: (key: string) => void;
  onToggleGrupoLibre: (key: string) => void;
  onToggleCategoria: (key: string) => void;
  onToggleSinFechaNac: () => void;
  onLimpiarSexo: () => void;
  onLimpiarEmpresa: () => void;
  onLimpiarEstado: () => void;
  onLimpiarEdad: () => void;
  onLimpiarGrupoLibre: () => void;
  onLimpiarCategoria: () => void;
  onLimpiarSinFechaNac: () => void;
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

function FacetGroup({
  title,
  onClear,
  showClear,
  scroll,
  children,
}: {
  title: string;
  onClear?: () => void;
  showClear?: boolean;
  scroll?: boolean;
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
      <div
        className={`stock-facet-options${scroll ? " stock-facet-options--scroll" : ""}`}
      >
        {children}
      </div>
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

export default function StockEquinaFiltrosSidebar({
  fechaDesde,
  fechaHasta,
  onFechaDesde,
  onFechaHasta,
  empresaOpciones,
  filtroSexo,
  filtroEmpresa,
  filtroEstado,
  filtroEdad,
  filtroGrupoLibre,
  filtroCategoria,
  filtroSinFechaNac,
  grupoLibreOpciones,
  onToggleSexo,
  onToggleEmpresa,
  onToggleEstado,
  onToggleEdad,
  onToggleGrupoLibre,
  onToggleCategoria,
  onToggleSinFechaNac,
  onLimpiarSexo,
  onLimpiarEmpresa,
  onLimpiarEstado,
  onLimpiarEdad,
  onLimpiarGrupoLibre,
  onLimpiarCategoria,
  onLimpiarSinFechaNac,
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
          {empresaOpciones.map((o) => (
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

        <FacetGroup
          title="Fecha nacimiento"
          showClear={filtroSinFechaNac.size > 0}
          onClear={onLimpiarSinFechaNac}
        >
          <FacetOption
            checked={filtroSinFechaNac.has(SIN_FECHA_NAC_FILTRO_KEY)}
            label="Sin fecha nacimiento"
            count={counts.sinFechaNac}
            onChange={onToggleSinFechaNac}
          />
        </FacetGroup>

        <FacetGroup
          title="Edad"
          showClear={filtroEdad.size > 0}
          onClear={onLimpiarEdad}
        >
          {EDAD_FILTRO_OPCIONES.filter((o) => (counts.edad[o.key] ?? 0) > 0).map(
            (o) => (
              <FacetOption
                key={o.key}
                checked={filtroEdad.has(o.key)}
                label={o.label}
                count={counts.edad[o.key] ?? 0}
                onChange={() => onToggleEdad(o.key)}
              />
            )
          )}
        </FacetGroup>

        <FacetGroup
          title="Categoría"
          showClear={filtroCategoria.size > 0}
          onClear={onLimpiarCategoria}
        >
          <p className="stock-facet-subtitle">Hembras</p>
          {CATEGORIA_FILTRO_HEMBRA.filter((o) => (counts.categoria[o.key] ?? 0) > 0).map(
            (o) => (
              <FacetOption
                key={o.key}
                checked={filtroCategoria.has(o.key)}
                label={o.label}
                count={counts.categoria[o.key] ?? 0}
                onChange={() => onToggleCategoria(o.key)}
              />
            )
          )}
          <p className="stock-facet-subtitle">Machos</p>
          {CATEGORIA_FILTRO_MACHO.filter((o) => (counts.categoria[o.key] ?? 0) > 0).map(
            (o) => (
              <FacetOption
                key={o.key}
                checked={filtroCategoria.has(o.key)}
                label={o.label}
                count={counts.categoria[o.key] ?? 0}
                onChange={() => onToggleCategoria(o.key)}
              />
            )
          )}
          {CATEGORIA_FILTRO_OTROS.some((o) => (counts.categoria[o.key] ?? 0) > 0) ? (
            <>
              <p className="stock-facet-subtitle">Otros</p>
              {CATEGORIA_FILTRO_OTROS.filter(
                (o) => (counts.categoria[o.key] ?? 0) > 0
              ).map((o) => (
                <FacetOption
                  key={o.key}
                  checked={filtroCategoria.has(o.key)}
                  label={o.label}
                  count={counts.categoria[o.key] ?? 0}
                  onChange={() => onToggleCategoria(o.key)}
                />
              ))}
            </>
          ) : null}
        </FacetGroup>

        {grupoLibreOpciones.length > 0 ? (
          <FacetGroup
            title="Grupo"
            showClear={filtroGrupoLibre.size > 0}
            onClear={onLimpiarGrupoLibre}
          >
            {grupoLibreOpciones.map((key) => (
              <FacetOption
                key={key || "sin"}
                checked={filtroGrupoLibre.has(key)}
                label={labelGrupoLibreFiltro(key)}
                count={counts.grupoLibre[key] ?? 0}
                onChange={() => onToggleGrupoLibre(key)}
              />
            ))}
          </FacetGroup>
        ) : null}
      </aside>
    </>
  );
}
