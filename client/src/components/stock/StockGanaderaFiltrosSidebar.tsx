import type { ReactNode } from "react";
import type { DispositivoEstado } from "../../types";
import {
  CATEGORIA_FILTRO_OPCIONES,
  EDAD_FILTRO_OPCIONES,
  ESTADOS_DISPOSITIVO,
  SIN_FECHA_NAC_FILTRO_KEY,
  labelGeneracionFiltro,
  labelGrupoLibreFiltro,
  labelRazaFiltro,
  labelUltimaLecturaMesFiltro,
} from "./stock-ganadera-utils";

export interface FacetCounts {
  sexo: Record<string, number>;
  empresa: Record<string, number>;
  estado: Record<string, number>;
  edad: Record<string, number>;
  grupoLibre: Record<string, number>;
  raza: Record<string, number>;
  generacion: Record<string, number>;
  ultimaLecturaMes: Record<string, number>;
  categoria: Record<string, number>;
  sinFechaNac: number;
}

interface Props {
  fechaDesde: string;
  fechaHasta: string;
  onFechaDesde: (v: string) => void;
  onFechaHasta: (v: string) => void;
  filtroUltimaLecturaMes: Set<string>;
  onToggleUltimaLecturaMes: (key: string) => void;
  onLimpiarUltimaLectura: () => void;
  ultimaLecturaMesOpciones: string[];
  empresaOpciones: Array<{ key: string; label: string }>;
  filtroSexo: Set<string>;
  filtroEmpresa: Set<string>;
  filtroEstado: Set<DispositivoEstado>;
  filtroEdad: Set<string>;
  filtroGrupoLibre: Set<string>;
  filtroRaza: Set<string>;
  filtroGeneracion: Set<string>;
  filtroCategoria: Set<string>;
  filtroSinFechaNac: Set<string>;
  grupoLibreOpciones: string[];
  razaOpciones: string[];
  generacionOpciones: string[];
  onToggleSexo: (key: string) => void;
  onToggleEmpresa: (key: string) => void;
  onToggleEstado: (estado: DispositivoEstado) => void;
  onToggleEdad: (key: string) => void;
  onToggleGrupoLibre: (key: string) => void;
  onToggleRaza: (key: string) => void;
  onToggleGeneracion: (key: string) => void;
  onToggleCategoria: (key: string) => void;
  onToggleSinFechaNac: () => void;
  onLimpiarSexo: () => void;
  onLimpiarEmpresa: () => void;
  onLimpiarEstado: () => void;
  onLimpiarEdad: () => void;
  onLimpiarGrupoLibre: () => void;
  onLimpiarRaza: () => void;
  onLimpiarGeneracion: () => void;
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

export default function StockGanaderaFiltrosSidebar({
  fechaDesde,
  fechaHasta,
  onFechaDesde,
  onFechaHasta,
  filtroUltimaLecturaMes,
  onToggleUltimaLecturaMes,
  onLimpiarUltimaLectura,
  ultimaLecturaMesOpciones,
  empresaOpciones,
  filtroSexo,
  filtroEmpresa,
  filtroEstado,
  filtroEdad,
  filtroGrupoLibre,
  filtroRaza,
  filtroGeneracion,
  filtroCategoria,
  filtroSinFechaNac,
  grupoLibreOpciones,
  razaOpciones,
  generacionOpciones,
  onToggleSexo,
  onToggleEmpresa,
  onToggleEstado,
  onToggleEdad,
  onToggleGrupoLibre,
  onToggleRaza,
  onToggleGeneracion,
  onToggleCategoria,
  onToggleSinFechaNac,
  onLimpiarSexo,
  onLimpiarEmpresa,
  onLimpiarEstado,
  onLimpiarEdad,
  onLimpiarGrupoLibre,
  onLimpiarRaza,
  onLimpiarGeneracion,
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

        <FacetGroup
          title="Última lectura"
          showClear={
            Boolean(fechaDesde || fechaHasta || filtroUltimaLecturaMes.size > 0)
          }
          onClear={onLimpiarUltimaLectura}
        >
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
          {ultimaLecturaMesOpciones.length > 0 ? (
            <>
              <p className="stock-facet-subtitle">Por mes</p>
              {ultimaLecturaMesOpciones.map((key) => (
                <FacetOption
                  key={key || "sin"}
                  checked={filtroUltimaLecturaMes.has(key)}
                  label={labelUltimaLecturaMesFiltro(key)}
                  count={counts.ultimaLecturaMes[key] ?? 0}
                  onChange={() => onToggleUltimaLecturaMes(key)}
                />
              ))}
            </>
          ) : null}
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

        {razaOpciones.length > 0 ? (
          <FacetGroup
            title="Raza"
            showClear={filtroRaza.size > 0}
            onClear={onLimpiarRaza}
            scroll={razaOpciones.length > 8}
          >
            {razaOpciones.map((key) => (
              <FacetOption
                key={key || "sin"}
                checked={filtroRaza.has(key)}
                label={labelRazaFiltro(key)}
                count={counts.raza[key] ?? 0}
                onChange={() => onToggleRaza(key)}
              />
            ))}
          </FacetGroup>
        ) : null}

        {generacionOpciones.length > 0 ? (
          <FacetGroup
            title="Generación"
            showClear={filtroGeneracion.size > 0}
            onClear={onLimpiarGeneracion}
            scroll={generacionOpciones.length > 8}
          >
            {generacionOpciones.map((key) => (
              <FacetOption
                key={key || "sin"}
                checked={filtroGeneracion.has(key)}
                label={labelGeneracionFiltro(key)}
                count={counts.generacion[key] ?? 0}
                onChange={() => onToggleGeneracion(key)}
              />
            ))}
          </FacetGroup>
        ) : null}

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
          scroll
        >
          {CATEGORIA_FILTRO_OPCIONES.filter((o) => (counts.categoria[o.key] ?? 0) > 0)
            .sort((a, b) => a.label.localeCompare(b.label, "es"))
            .map((o) => (
              <FacetOption
                key={o.key}
                checked={filtroCategoria.has(o.key)}
                label={o.label}
                count={counts.categoria[o.key] ?? 0}
                onChange={() => onToggleCategoria(o.key)}
              />
            ))}
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
