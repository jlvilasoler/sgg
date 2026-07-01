import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Building2,
  Calendar,
  ClipboardList,
  Clock,
  Hash,
  MapPin,
  Syringe,
  Tag,
  Timer,
  User,
  X,
} from "lucide-react";
import {
  fetchStockControlSanitario,
  fetchStockGanaderaDispositivo,
  type EmpresaOperativaStock,
} from "../../api";
import type {
  StockControlSanitarioRecord,
  StockControlSanitarioResumenItem,
  StockGanaderaDispositivo,
} from "../../types";
import { fmtEmpresaOperativa } from "./stock-empresa-utils";
import {
  categoriasDispositivo,
  labelCategoriaFiltro,
  fmtGrupo,
  fmtGrupoLibre,
  fmtPotrero,
  fmtRaza,
} from "./stock-ganadera-utils";
import IconoDispositivoWifi from "./IconoDispositivoWifi";

function fmtIsoDate(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function fmtAdminPeriodo(r: Pick<
  StockControlSanitarioRecord,
  "admin_fecha_inicio" | "admin_fecha_fin" | "admin_periodo_nota"
>): string {
  const nota = r.admin_periodo_nota.trim();
  if (nota) return nota;
  const ini = r.admin_fecha_inicio.trim();
  const fin = r.admin_fecha_fin.trim();
  if (ini && fin) return `${fmtIsoDate(ini)} – ${fmtIsoDate(fin)}`;
  if (ini) return `Desde ${fmtIsoDate(ini)}`;
  if (fin) return `Hasta ${fmtIsoDate(fin)}`;
  return "";
}

function fmtCreadoEn(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-UY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtSexo(sexo: string): string {
  if (sexo === "M") return "Macho";
  if (sexo === "H") return "Hembra";
  return sexo.trim();
}

function hasValue(v: string | undefined | null): boolean {
  const t = String(v ?? "").trim();
  return t.length > 0 && t !== "—";
}

interface Props {
  open: boolean;
  item: StockControlSanitarioResumenItem | null;
  apiOnline: boolean;
  empresasOperativas?: EmpresaOperativaStock[];
  onClose: () => void;
  onError?: (msg: string) => void;
}

export default function StockSanidadMovimientoDetalleModal({
  open,
  item,
  apiOnline,
  empresasOperativas = [],
  onClose,
  onError,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [registro, setRegistro] = useState<StockControlSanitarioRecord | null>(null);
  const [dispositivo, setDispositivo] = useState<StockGanaderaDispositivo | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !item || !apiOnline) {
      setRegistro(null);
      setDispositivo(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void Promise.all([
      fetchStockControlSanitario("ganadero", item.clave),
      fetchStockGanaderaDispositivo(item.clave).catch(() => null),
    ])
      .then(([records, dev]) => {
        if (cancelled) return;
        setRegistro(records.find((r) => r.id === item.id) ?? null);
        setDispositivo(dev);
      })
      .catch((e) => {
        if (!cancelled) {
          setRegistro(null);
          setDispositivo(null);
          onError?.(e instanceof Error ? e.message : "Error al cargar el movimiento");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, item, apiOnline, onError]);

  const datos = useMemo(() => {
    if (!item) return null;
    const r = registro;
    return {
      producto_nombre: r?.producto_nombre.trim() || item.producto_nombre.trim() || "Producto",
      producto_formula: r?.producto_formula.trim() || item.producto_formula.trim(),
      producto_forma: r?.producto_forma.trim() ?? "",
      producto_cantidad: r?.producto_cantidad.trim() ?? "",
      producto_espera: r?.producto_espera.trim() ?? "",
      control_motivo: r?.control_motivo.trim() || item.control_motivo.trim(),
      control_funcionario: r?.control_funcionario.trim() ?? "",
      admin_observaciones: r?.admin_observaciones.trim() ?? "",
      animal_id: r?.animal_id.trim() || item.animal_id.trim(),
      animal_categoria_lote: r?.animal_categoria_lote.trim() ?? "",
      admin_periodo: fmtAdminPeriodo(
        r ?? {
          admin_fecha_inicio: item.admin_fecha_inicio,
          admin_fecha_fin: item.admin_fecha_fin,
          admin_periodo_nota: item.admin_periodo_nota,
        }
      ),
      creado_en: r?.creado_en || item.creado_en,
      creado_por: (r?.creado_por || item.creado_por).trim(),
    };
  }, [item, registro]);

  const categorias = useMemo(() => {
    if (!dispositivo) return "";
    const cats = [...categoriasDispositivo(dispositivo)].map((k) => labelCategoriaFiltro(k));
    return cats.join(", ");
  }, [dispositivo]);

  const animalSpecs = useMemo(() => {
    if (!datos) return [];
    const empresaNombre = dispositivo
      ? fmtEmpresaOperativa(dispositivo.empresa, empresasOperativas)
      : "";
    const rows: { label: string; value: string; icon?: ReactNode }[] = [];

    if (hasValue(categorias)) rows.push({ label: "Categoría", value: categorias, icon: <Tag size={13} /> });
    if (hasValue(empresaNombre)) {
      rows.push({ label: "Empresa", value: empresaNombre, icon: <Building2 size={13} /> });
    }
    if (dispositivo && hasValue(fmtGrupo(dispositivo.grupo))) {
      rows.push({ label: "Generación", value: fmtGrupo(dispositivo.grupo) });
    }
    if (dispositivo && hasValue(fmtGrupoLibre(dispositivo.grupo_libre))) {
      rows.push({ label: "Grupo", value: fmtGrupoLibre(dispositivo.grupo_libre) });
    }
    if (dispositivo && hasValue(fmtPotrero(dispositivo.potrero))) {
      rows.push({ label: "Potrero", value: fmtPotrero(dispositivo.potrero), icon: <MapPin size={13} /> });
    }
    if (dispositivo && hasValue(fmtRaza(dispositivo.raza))) {
      rows.push({ label: "Raza", value: fmtRaza(dispositivo.raza) });
    }
    if (dispositivo && hasValue(fmtSexo(dispositivo.sexo))) {
      rows.push({ label: "Sexo", value: fmtSexo(dispositivo.sexo) });
    }
    if (hasValue(datos.animal_categoria_lote)) {
      rows.push({ label: "Lote en registro", value: datos.animal_categoria_lote });
    }

    return rows;
  }, [datos, dispositivo, empresasOperativas, categorias]);

  if (!open || !item || !datos) return null;

  const eid = dispositivo?.eid?.trim() ?? "";
  const vid = dispositivo?.vid?.trim() ?? "";
  const animalPrimary = datos.animal_id || vid || eid || item.clave;

  return createPortal(
    <div
      className="stock-control-sanitario-overlay stock-sanidad-movimiento-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stock-sanidad-movimiento-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="stock-sanidad-movimiento-modal">
        <div className="stock-sanidad-movimiento-accent" aria-hidden />

        <header className="stock-sanidad-movimiento-hero">
          <div className="stock-sanidad-movimiento-hero-main">
            <span className="stock-sanidad-movimiento-hero-icon" aria-hidden>
              <Syringe size={26} strokeWidth={2} />
            </span>
            <div className="stock-sanidad-movimiento-hero-copy">
              <p className="stock-sanidad-movimiento-kicker">Registro sanitario</p>
              <h2 id="stock-sanidad-movimiento-title">{datos.producto_nombre}</h2>
              {hasValue(datos.producto_formula) ? (
                <p className="stock-sanidad-movimiento-formula">{datos.producto_formula}</p>
              ) : null}
              <div className="stock-sanidad-movimiento-hero-chips">
                {hasValue(datos.producto_forma) ? (
                  <span className="stock-sanidad-movimiento-chip stock-sanidad-movimiento-chip--forma">
                    <Syringe size={11} strokeWidth={2.2} aria-hidden />
                    {datos.producto_forma}
                  </span>
                ) : null}
                {hasValue(datos.producto_cantidad) ? (
                  <span className="stock-sanidad-movimiento-chip stock-sanidad-movimiento-chip--dosis">
                    {datos.producto_cantidad}
                  </span>
                ) : null}
                {hasValue(datos.producto_espera) ? (
                  <span className="stock-sanidad-movimiento-chip stock-sanidad-movimiento-chip--espera">
                    <Timer size={11} strokeWidth={2.2} aria-hidden />
                    {datos.producto_espera}
                  </span>
                ) : null}
                {hasValue(datos.control_motivo) ? (
                  <span className="stock-sanidad-movimiento-chip stock-sanidad-movimiento-chip--motivo">
                    {datos.control_motivo}
                  </span>
                ) : null}
              </div>
              <p className="stock-sanidad-movimiento-meta">
                <Calendar size={12} aria-hidden />
                <span>{fmtCreadoEn(datos.creado_en)}</span>
                {datos.creado_por ? (
                  <>
                    <span className="stock-sanidad-movimiento-meta-sep" aria-hidden>
                      ·
                    </span>
                    <User size={12} aria-hidden />
                    <span>{datos.creado_por}</span>
                  </>
                ) : null}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="stock-sanidad-movimiento-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </header>

        {loading ? (
          <div className="stock-sanidad-movimiento-loading" aria-busy="true">
            <div className="stock-sanidad-movimiento-skeleton">
              <span className="stock-sanidad-movimiento-skeleton-bar stock-sanidad-movimiento-skeleton-bar--lg" />
              <span className="stock-sanidad-movimiento-skeleton-bar" />
              <span className="stock-sanidad-movimiento-skeleton-bar stock-sanidad-movimiento-skeleton-bar--sm" />
            </div>
            <p className="muted">Cargando detalle…</p>
          </div>
        ) : (
          <div className="stock-sanidad-movimiento-body">
            <aside className="stock-sanidad-movimiento-animal-panel">
              <div className="stock-sanidad-movimiento-animal-card">
                <IconoDispositivoWifi
                  animated
                  className="stock-sanidad-movimiento-animal-wifi"
                />
                <div className="stock-sanidad-movimiento-animal-ids">
                  <span className="stock-sanidad-movimiento-animal-primary">{animalPrimary}</span>
                  <div className="stock-sanidad-movimiento-animal-pills">
                    {hasValue(eid) ? (
                      <span className="stock-sanidad-movimiento-id-pill">
                        <span className="stock-sanidad-movimiento-id-pill-k">EID</span>
                        {eid}
                      </span>
                    ) : null}
                    {hasValue(vid) ? (
                      <span className="stock-sanidad-movimiento-id-pill">
                        <span className="stock-sanidad-movimiento-id-pill-k">VID</span>
                        {vid}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              {animalSpecs.length > 0 ? (
                <dl className="stock-sanidad-movimiento-spec-list">
                  {animalSpecs.map((row) => (
                    <div key={row.label} className="stock-sanidad-movimiento-spec-row">
                      <dt>
                        {row.icon}
                        {row.label}
                      </dt>
                      <dd>{row.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="stock-sanidad-movimiento-spec-empty muted">
                  Sin datos adicionales del dispositivo.
                </p>
              )}
            </aside>

            <div className="stock-sanidad-movimiento-detail-panel">
              {(hasValue(datos.admin_periodo) || hasValue(datos.admin_observaciones)) && (
                <section className="stock-sanidad-movimiento-card">
                  <header className="stock-sanidad-movimiento-card-head">
                    <Calendar size={15} strokeWidth={2.25} aria-hidden />
                    <h3>Administración</h3>
                  </header>
                  <div className="stock-sanidad-movimiento-card-body">
                    {hasValue(datos.admin_periodo) ? (
                      <div className="stock-sanidad-movimiento-highlight">
                        <span className="stock-sanidad-movimiento-highlight-label">Período</span>
                        <p>{datos.admin_periodo}</p>
                      </div>
                    ) : null}
                    {hasValue(datos.admin_observaciones) ? (
                      <div className="stock-sanidad-movimiento-note">
                        <span className="stock-sanidad-movimiento-highlight-label">Observaciones</span>
                        <p>{datos.admin_observaciones}</p>
                      </div>
                    ) : null}
                  </div>
                </section>
              )}

              <div className="stock-sanidad-movimiento-card-row">
                <section className="stock-sanidad-movimiento-card">
                  <header className="stock-sanidad-movimiento-card-head">
                    <ClipboardList size={15} strokeWidth={2.25} aria-hidden />
                    <h3>Control</h3>
                  </header>
                  <div className="stock-sanidad-movimiento-card-body stock-sanidad-movimiento-card-body--stack">
                    <InfoRow label="Motivo" value={datos.control_motivo} emphasize />
                    <InfoRow label="Autorizó" value={datos.control_funcionario} />
                  </div>
                </section>

                <section className="stock-sanidad-movimiento-card stock-sanidad-movimiento-card--trace">
                  <header className="stock-sanidad-movimiento-card-head">
                    <Clock size={15} strokeWidth={2.25} aria-hidden />
                    <h3>Trazabilidad</h3>
                  </header>
                  <div className="stock-sanidad-movimiento-card-body stock-sanidad-movimiento-card-body--stack">
                    <InfoRow label="Clave" value={item.clave} mono />
                    <InfoRow label="Registro #" value={String(item.id)} mono />
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}

        <footer className="stock-sanidad-movimiento-foot">
          <span className="stock-sanidad-movimiento-foot-hint muted">
            <Hash size={12} aria-hidden />
            ID {item.id}
          </span>
          <button type="button" className="btn btn-primary stock-sanidad-movimiento-btn-close" onClick={onClose}>
            Cerrar
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}

function InfoRow({
  label,
  value,
  mono = false,
  emphasize = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  emphasize?: boolean;
}) {
  const filled = hasValue(value);
  return (
    <div className="stock-sanidad-movimiento-info-row">
      <span className="stock-sanidad-movimiento-info-label">{label}</span>
      <span
        className={[
          "stock-sanidad-movimiento-info-value",
          mono ? "stock-sanidad-movimiento-info-value--mono" : "",
          emphasize && filled ? "stock-sanidad-movimiento-info-value--emph" : "",
          !filled ? "stock-sanidad-movimiento-info-value--empty" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {filled ? value : "Sin dato"}
      </span>
    </div>
  );
}
