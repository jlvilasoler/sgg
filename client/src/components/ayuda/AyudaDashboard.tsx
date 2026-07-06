import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronRight,
  Layers,
  Search,
} from "lucide-react";
import { HubMenuIcon } from "../icons/HubMenuIcons";
import {
  AYUDA_ARTICULOS,
  AYUDA_GRUPOS,
  ayudaArticulosPorGrupo,
  buscarAyudaArticulos,
  type AyudaArticulo,
  type AyudaGrupoId,
} from "../../help/ayuda-manual";
import { AYUDA_GRUPO_THEME } from "./ayuda-grupo-theme";

interface Props {
  onSelect: (id: string) => void;
}

export default function AyudaDashboard({ onSelect }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const resultados = useMemo(() => buscarAyudaArticulos(busqueda), [busqueda]);
  const destacados = useMemo(
    () => AYUDA_ARTICULOS.filter((a) => a.destacado),
    []
  );
  const consultaActiva = busqueda.trim().length > 0;

  return (
    <div className="ayuda-dashboard">
      <section className="ayuda-dash-intro sg-hub-panel">
        <header className="sg-hub-panel-head ayuda-dash-intro-head">
          <div>
            <p className="sg-hub-panel-kicker">Centro de ayuda SAG</p>
            <h2 className="ayuda-dash-hero-title">¿Cómo funciona SAG?</h2>
            <p className="ayuda-dash-hero-lead">
              Manual visual de cada módulo y del flujo operativo en la explotación.
            </p>
          </div>
        </header>

        <div className="sg-hub-kpi-strip ayuda-dash-kpi-strip" aria-label="Resumen del manual">
          <div className="sg-hub-kpi sg-hub-kpi--dark">
            <p className="sg-hub-kpi-kicker">Guías</p>
            <p className="sg-hub-kpi-value">{AYUDA_ARTICULOS.length}</p>
            <p className="sg-hub-kpi-hint">artículos en el manual</p>
          </div>
          <div className="sg-hub-kpi sg-hub-kpi--dark">
            <p className="sg-hub-kpi-kicker">Áreas</p>
            <p className="sg-hub-kpi-value">{AYUDA_GRUPOS.length}</p>
            <p className="sg-hub-kpi-hint">categorías temáticas</p>
          </div>
          <div className="sg-hub-kpi sg-hub-kpi--dark">
            <p className="sg-hub-kpi-kicker">Inicio rápido</p>
            <p className="sg-hub-kpi-value">{destacados.length}</p>
            <p className="sg-hub-kpi-hint">para empezar hoy</p>
          </div>
        </div>

        <label className="ayuda-dash-search">
          <Search size={18} aria-hidden />
          <input
            type="search"
            placeholder="Buscar tema, módulo o proceso…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar en el manual de ayuda"
          />
          <kbd className="ayuda-dash-search-hint" aria-hidden>
            ↵
          </kbd>
        </label>
      </section>

      {consultaActiva ? (
        <section className="ayuda-dash-section sg-hub-panel">
          <header className="sg-hub-panel-head">
            <p className="sg-hub-panel-kicker">Búsqueda</p>
            <h3 className="sg-hub-panel-title">
              {resultados.length} resultado{resultados.length === 1 ? "" : "s"}
            </h3>
          </header>
          {resultados.length > 0 ? (
            <div className="ayuda-dash-resultados-grid">
              {resultados.map((a, i) => (
                <AyudaTemaCard key={a.id} articulo={a} onSelect={onSelect} index={i} />
              ))}
            </div>
          ) : (
            <div className="ayuda-dash-empty">
              <Layers size={28} aria-hidden />
              <p>No encontramos temas con ese texto.</p>
              <span>Probá con «gastos», «stock» o «mapa».</span>
            </div>
          )}
        </section>
      ) : (
        <>
          <section className="ayuda-dash-section sg-hub-panel">
            <header className="sg-hub-panel-head">
              <p className="sg-hub-panel-kicker">Primeros pasos</p>
              <h3 className="sg-hub-panel-title">Empezá por acá</h3>
            </header>
            <div className="ayuda-dash-quick-grid">
              {destacados.map((a, i) => (
                <AyudaQuickCard key={a.id} articulo={a} index={i} onSelect={onSelect} />
              ))}
            </div>
          </section>

          <section className="ayuda-dash-section sg-hub-panel">
            <header className="sg-hub-panel-head">
              <p className="sg-hub-panel-kicker">Explorar</p>
              <h3 className="sg-hub-panel-title">Todos los temas</h3>
            </header>
            <div className="ayuda-dash-grupos-mosaic">
              {AYUDA_GRUPOS.map((grupo) => {
                const items = ayudaArticulosPorGrupo(grupo.id);
                if (items.length === 0) return null;
                return (
                  <AyudaGrupoCard
                    key={grupo.id}
                    grupoId={grupo.id}
                    label={grupo.label}
                    items={items}
                    onSelect={onSelect}
                  />
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function AyudaQuickCard({
  articulo,
  index,
  onSelect,
}: {
  articulo: AyudaArticulo;
  index: number;
  onSelect: (id: string) => void;
}) {
  const theme = AYUDA_GRUPO_THEME[articulo.grupo];
  const ThemeIcon = theme.icon;

  return (
    <button
      type="button"
      className="ayuda-quick-card"
      style={
        {
          "--ayuda-card-accent": theme.accent,
          "--ayuda-card-soft": theme.soft,
          "--ayuda-card-border": theme.border,
          animationDelay: `${index * 60}ms`,
        } as CSSProperties
      }
      onClick={() => onSelect(articulo.id)}
    >
      <span className="ayuda-quick-card-step" aria-hidden>
        {String(index + 1).padStart(2, "0")}
      </span>
      <span className="ayuda-quick-card-icon" aria-hidden>
        <HubMenuIcon id={articulo.icon} />
      </span>
      <span className="ayuda-quick-card-body">
        <span className="ayuda-quick-card-grupo">
          <ThemeIcon size={12} aria-hidden />
          {AYUDA_GRUPOS.find((g) => g.id === articulo.grupo)?.label}
        </span>
        <strong>{articulo.label}</strong>
        <span>{articulo.subtitle}</span>
      </span>
      <ArrowRight size={17} className="ayuda-quick-card-arrow" aria-hidden />
    </button>
  );
}

function AyudaGrupoCard({
  grupoId,
  label,
  items,
  onSelect,
}: {
  grupoId: AyudaGrupoId;
  label: string;
  items: AyudaArticulo[];
  onSelect: (id: string) => void;
}) {
  const theme = AYUDA_GRUPO_THEME[grupoId];
  const GrupoIcon = theme.icon;

  return (
    <article
      className="ayuda-grupo-card"
      style={
        {
          "--ayuda-grupo-accent": theme.accent,
          "--ayuda-grupo-soft": theme.soft,
          "--ayuda-grupo-border": theme.border,
          "--ayuda-grupo-gradient": theme.gradient,
        } as CSSProperties
      }
    >
      <header className="ayuda-grupo-card-head">
        <span className="ayuda-grupo-card-icon" aria-hidden>
          <GrupoIcon size={17} />
        </span>
        <div>
          <h4 className="ayuda-grupo-card-title">{label}</h4>
          <p className="ayuda-grupo-card-count">
            {items.length} guía{items.length === 1 ? "" : "s"}
          </p>
        </div>
      </header>
      <ul className="ayuda-grupo-card-list">
        {items.map((a) => (
          <li key={a.id}>
            <button type="button" className="ayuda-grupo-topic" onClick={() => onSelect(a.id)}>
              <span className="ayuda-grupo-topic-icon" aria-hidden>
                <HubMenuIcon id={a.icon} />
              </span>
              <span className="ayuda-grupo-topic-copy">
                <strong>{a.label}</strong>
                <span>{a.subtitle}</span>
              </span>
              <ChevronRight size={16} className="ayuda-grupo-topic-chevron" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </article>
  );
}

function AyudaTemaCard({
  articulo,
  index,
  onSelect,
}: {
  articulo: AyudaArticulo;
  index: number;
  onSelect: (id: string) => void;
}) {
  const theme = AYUDA_GRUPO_THEME[articulo.grupo];

  return (
    <button
      type="button"
      className="ayuda-tema-card"
      style={
        {
          "--ayuda-card-accent": theme.accent,
          "--ayuda-card-soft": theme.soft,
          animationDelay: `${index * 40}ms`,
        } as CSSProperties
      }
      onClick={() => onSelect(articulo.id)}
    >
      <span className="ayuda-tema-card-icon" aria-hidden>
        <HubMenuIcon id={articulo.icon} />
      </span>
      <span className="ayuda-tema-card-body">
        <strong>{articulo.label}</strong>
        <span>{articulo.subtitle}</span>
      </span>
      <ChevronRight size={16} aria-hidden />
    </button>
  );
}
