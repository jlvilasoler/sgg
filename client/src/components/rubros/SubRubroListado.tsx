import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GrupoIconoInfo } from "../../api";
import type { SubRubro, SubRubroItem } from "../../types";
import {
  GASTOS_RUBROS_API,
  GASTOS_RUBROS_COPY,
  type RubrosListadoApi,
  type RubrosListadoCopy,
} from "./rubrosListadoConfig";
import { iconoGrupo } from "../../utils/catalogoIconos";
import { normalizarTituloRubro } from "../../utils/formText";
import { grupoClaveOrden, grupoTituloCanon } from "../../utils/grupoRubro";
import { confirmAction } from "../../utils/confirm";
import { captureScrollY, restoreScrollY, withScrollPreserve } from "../../utils/scrollPreserve";
import GrupoIconoPickerModal from "./GrupoIconoPickerModal";
import SubRubroItemsCell from "./SubRubroItemsCell";
import SubRubroNombre from "./SubRubroNombre";
import {
  IconCancelar,
  IconEditar,
  IconEliminar,
  IconGuardar,
} from "../icons/ActionIcons";

type InlineDraft = {
  mode: "new" | "edit";
  grupo: string;
  nombre: string;
  activo: boolean;
  id?: number;
  /** Alta de sub-rubro dentro de un grupo existente. */
  anchorGrupo?: string;
  /** Permite editar el nombre del rubro (grupo) en la fila. */
  editGrupo?: boolean;
  /** Alta de rubro nuevo (fuera de las secciones existentes). */
  nuevoRubro?: boolean;
};

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onVolver: () => void;
  onCatalogosChanged?: () => void;
  /** Texto tras «Volver» (por defecto «al inicio»). */
  volverLabel?: string;
  rubrosApi?: RubrosListadoApi;
  copy?: RubrosListadoCopy;
}

export default function SubRubroListado({
  apiOnline,
  onError,
  onSuccess,
  onVolver,
  onCatalogosChanged,
  volverLabel = "al inicio",
  rubrosApi = GASTOS_RUBROS_API,
  copy = GASTOS_RUBROS_COPY,
}: Props) {
  const [rows, setRows] = useState<SubRubro[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroGrupo, setFiltroGrupo] = useState("");
  const [inline, setInline] = useState<InlineDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [iconosPorGrupo, setIconosPorGrupo] = useState<Record<string, GrupoIconoInfo>>({});
  const [iconPickerGrupo, setIconPickerGrupo] = useState<string | null>(null);
  const [subiendoIconoGrupo, setSubiendoIconoGrupo] = useState<string | null>(null);
  const [itemsBySubRubro, setItemsBySubRubro] = useState<Record<number, SubRubroItem[]>>(
    {}
  );
  const [renamingGrupo, setRenamingGrupo] = useState<string | null>(null);
  const [grupoRenameDraft, setGrupoRenameDraft] = useState("");
  const grupoRef = useRef<HTMLInputElement>(null);
  const grupoRenameRef = useRef<HTMLInputElement>(null);
  const nombreRef = useRef<HTMLInputElement>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);
  const iconoPendienteRef = useRef<string | null>(null);
  const pendingFocus = useRef<"grupo" | "nombre" | null>(null);
  const hasContentRef = useRef(false);

  const loadIconos = useCallback(async () => {
    if (!apiOnline) {
      setIconosPorGrupo({});
      return;
    }
    try {
      setIconosPorGrupo(await rubrosApi.fetchGrupoIconos());
    } catch {
      setIconosPorGrupo({});
    }
  }, [apiOnline, rubrosApi]);

  const loadItemsBatch = useCallback(
    async (subs: SubRubro[]) => {
      if (!apiOnline || !subs.length) {
        setItemsBySubRubro({});
        return;
      }
      try {
        const ids = subs.map((s) => s.id);
        setItemsBySubRubro(await rubrosApi.fetchSubRubroItemsBatch(ids));
      } catch {
        setItemsBySubRubro({});
      }
    },
    [apiOnline, rubrosApi]
  );

  const patchItems = useCallback(
    (subRubroId: number, updater: (list: SubRubroItem[]) => SubRubroItem[]) => {
      setItemsBySubRubro((prev) => ({
        ...prev,
        [subRubroId]: updater(prev[subRubroId] ?? []),
      }));
    },
    []
  );

  const load = useCallback(async () => {
    if (!apiOnline) {
      setRows([]);
      setItemsBySubRubro({});
      hasContentRef.current = false;
      setLoading(false);
      return;
    }
    const preserveUi = hasContentRef.current;
    const scrollY = preserveUi ? captureScrollY() : 0;
    if (!preserveUi) setLoading(true);
    try {
      const [subs] = await Promise.all([rubrosApi.fetchSubRubros(false), loadIconos()]);
      setRows(subs);
      await loadItemsBatch(subs);
      hasContentRef.current = true;
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
      if (preserveUi) restoreScrollY(scrollY);
    }
  }, [apiOnline, onError, loadIconos, loadItemsBatch, rubrosApi]);

  useEffect(() => {
    load();
  }, [load]);

  /** Si el usuario cierra el selector sin elegir archivo, liberar el rubro pendiente. */
  useEffect(() => {
    const onWindowFocus = () => {
      window.setTimeout(() => {
        if (iconoPendienteRef.current && !iconInputRef.current?.files?.length) {
          iconoPendienteRef.current = null;
        }
      }, 400);
    };
    window.addEventListener("focus", onWindowFocus);
    return () => window.removeEventListener("focus", onWindowFocus);
  }, []);

  useEffect(() => {
    if (!inline || !pendingFocus.current) return;
    const field = pendingFocus.current;
    pendingFocus.current = null;
    requestAnimationFrame(() => {
      (field === "grupo" ? grupoRef : nombreRef).current?.focus();
    });
  }, [
    inline?.mode,
    inline?.id,
    inline?.nuevoRubro,
    inline?.anchorGrupo,
    inline?.editGrupo,
  ]);

  const grupos = useMemo(() => {
    const titulos = new Map<string, string>();
    for (const r of rows) {
      const clave = grupoClaveOrden(r.grupo);
      if (!titulos.has(clave)) titulos.set(clave, grupoTituloCanon(r.grupo));
    }
    return [...titulos.values()].sort((a, b) => a.localeCompare(b, "es"));
  }, [rows]);

  const filtrados = useMemo(() => {
    if (!filtroGrupo) return rows;
    const claveFiltro = grupoClaveOrden(filtroGrupo);
    return rows.filter((r) => grupoClaveOrden(r.grupo) === claveFiltro);
  }, [rows, filtroGrupo]);

  const porGrupo = useMemo(() => {
    const map = new Map<string, SubRubro[]>();
    const titulos = new Map<string, string>();
    for (const r of filtrados) {
      const clave = grupoClaveOrden(r.grupo);
      const list = map.get(clave) ?? [];
      list.push(r);
      map.set(clave, list);
      if (!titulos.has(clave)) titulos.set(clave, grupoTituloCanon(r.grupo));
    }
    return [...map.entries()]
      .map(([clave, list]) => [titulos.get(clave) ?? clave, list] as const)
      .sort(([a], [b]) => a.localeCompare(b, "es"));
  }, [filtrados]);

  const startNewSub = (grupo: string) => {
    pendingFocus.current = "nombre";
    setInline({
      mode: "new",
      grupo,
      nombre: "",
      activo: true,
      anchorGrupo: grupo,
    });
  };

  const startNewRubro = () => {
    pendingFocus.current = "grupo";
    setInline({
      mode: "new",
      grupo: "",
      nombre: "",
      activo: true,
      editGrupo: true,
      nuevoRubro: true,
    });
  };

  const startEdit = (r: SubRubro) => {
    pendingFocus.current = "nombre";
    setInline({
      mode: "edit",
      id: r.id,
      grupo: r.grupo,
      nombre: r.nombre,
      activo: r.activo !== 0,
      anchorGrupo: r.grupo,
    });
  };

  const cancelInline = () => {
    pendingFocus.current = null;
    setInline(null);
  };

  const eliminarInline = async () => {
    if (!inline) return;
    if (inline.mode === "new") {
      cancelInline();
      return;
    }
    if (inline.id) await borrar(inline.id);
  };

  const guardarInline = async () => {
    if (!apiOnline || !inline) return;
    const grupo = normalizarTituloRubro(inline.grupo);
    const nombre = normalizarTituloRubro(inline.nombre);
    if (!grupo || !nombre) {
      onError("Completá rubro (grupo) y sub-rubro");
      return;
    }
    setSaving(true);
    try {
      const body = { grupo, nombre, activo: inline.activo };
      if (inline.mode === "edit" && inline.id) {
        await rubrosApi.updateSubRubro(inline.id, body);
        onSuccess("Sub-rubro actualizado");
      } else {
        await rubrosApi.createSubRubro(body);
        onSuccess("Sub-rubro creado");
      }
      setInline(null);
      onCatalogosChanged?.();
      await withScrollPreserve(load);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const borrar = async (id: number) => {
    const ok = await confirmAction({
      title: "Eliminar sub-rubro",
      message: copy.deleteSubRubroMessage,
      confirmText: "Eliminar",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await rubrosApi.deleteSubRubro(id);
      onSuccess("Sub-rubro eliminado");
      onCatalogosChanged?.();
      if (inline?.id === id) setInline(null);
      await withScrollPreserve(load);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al eliminar");
    }
  };

  const startRenameGrupo = (grupo: string) => {
    if (inline || renamingGrupo) return;
    setRenamingGrupo(grupo);
    setGrupoRenameDraft(grupo);
    setTimeout(() => grupoRenameRef.current?.focus(), 0);
  };

  const cancelRenameGrupo = () => {
    setRenamingGrupo(null);
    setGrupoRenameDraft("");
  };

  const guardarRenameGrupo = async () => {
    if (!apiOnline || !renamingGrupo) return;
    const nuevo = normalizarTituloRubro(grupoRenameDraft);
    if (!nuevo) {
      onError("Ingresá el nuevo nombre del rubro");
      return;
    }
    if (
      nuevo.localeCompare(renamingGrupo, "es", { sensitivity: "accent" }) === 0
    ) {
      cancelRenameGrupo();
      return;
    }
    setSaving(true);
    try {
      const result = await rubrosApi.renameSubRubroGrupo(renamingGrupo, nuevo);
      onSuccess(
        result.updated > 0
          ? `Rubro renombrado a «${result.nombre}»`
          : "Sin cambios en el nombre del rubro"
      );
      cancelRenameGrupo();
      if (inline?.grupo === renamingGrupo || inline?.anchorGrupo === renamingGrupo) {
        setInline(null);
      }
      onCatalogosChanged?.();
      await withScrollPreserve(load);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al renombrar rubro");
    } finally {
      setSaving(false);
    }
  };

  const borrarRubro = async (grupo: string, cantidad: number) => {
    const msg =
      cantidad === 0
        ? `¿Eliminar el rubro «${grupo}»? (no tiene sub-rubros guardados)`
        : `¿Eliminar el rubro «${grupo}» y sus ${cantidad} sub-rubro(s)?\n\nLos que tengan gastos asociados no se borrarán.`;
    const ok = await confirmAction({
      title: "Eliminar rubro",
      message: msg,
      confirmText: "Eliminar",
      variant: "danger",
    });
    if (!ok) return;
    try {
      const result = await rubrosApi.deleteSubRubrosGrupo(grupo);
      if (result.blocked.length > 0) {
        onError(
          `Se eliminaron ${result.deleted} sub-rubro(s). ${result.blocked.length} no se pudieron borrar (${copy.deleteGrupoBlockedSuffix}).`
        );
      } else if (result.deleted > 0) {
        onSuccess(`Rubro «${grupo}» eliminado (${result.deleted} sub-rubro(s))`);
      } else {
        onSuccess(`Rubro «${grupo}» sin registros guardados`);
      }
      if (inline && (inline.anchorGrupo === grupo || inline.grupo === grupo)) {
        setInline(null);
      }
      onCatalogosChanged?.();
      await withScrollPreserve(load);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al eliminar rubro");
    }
  };

  const abrirSelectorIcono = (grupo: string) => {
    if (subiendoIconoGrupo) return;
    setIconPickerGrupo(grupo);
  };

  const cerrarSelectorIcono = () => setIconPickerGrupo(null);

  const subirIconoDesdePc = () => {
    const grupo = iconPickerGrupo;
    if (!grupo) return;
    const input = iconInputRef.current;
    if (!input) return;
    iconoPendienteRef.current = grupo;
    input.value = "";
    input.oncancel = () => {
      iconoPendienteRef.current = null;
    };
    input.click();
  };

  const onIconFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const grupo = iconoPendienteRef.current;
    iconoPendienteRef.current = null;
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!grupo || !file) return;
    if (!file.type.startsWith("image/")) {
      onError("Seleccioná un archivo de imagen (JPG, PNG, WebP o GIF).");
      return;
    }
    setSubiendoIconoGrupo(grupo);
    try {
      const icono = await rubrosApi.uploadGrupoIcono(grupo, file);
      setIconosPorGrupo((prev) => ({ ...prev, [grupo]: icono }));
      setIconPickerGrupo(null);
      onSuccess(`Icono de «${grupo}» actualizado`);
      onCatalogosChanged?.();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al subir imagen");
    } finally {
      setSubiendoIconoGrupo(null);
    }
  };

  const elegirIconoBanco = async (emoji: string) => {
    const grupo = iconPickerGrupo;
    if (!grupo) return;
    if (!apiOnline) {
      onError("Conectá la API (npm run dev en la carpeta del proyecto) para guardar el icono.");
      return;
    }
    setSubiendoIconoGrupo(grupo);
    try {
      const icono = await rubrosApi.setGrupoIconoEmoji(grupo, emoji);
      setIconosPorGrupo((prev) => ({ ...prev, [grupo]: icono }));
      setIconPickerGrupo(null);
      onSuccess(`Icono de «${grupo}» actualizado`);
      onCatalogosChanged?.();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al guardar icono");
    } finally {
      setSubiendoIconoGrupo(null);
    }
  };

  const restaurarIconoAutomatico = async () => {
    const grupo = iconPickerGrupo;
    if (!grupo) return;
    setSubiendoIconoGrupo(grupo);
    try {
      await rubrosApi.clearGrupoIcono(grupo);
      setIconosPorGrupo((prev) => {
        const next = { ...prev };
        delete next[grupo];
        return next;
      });
      setIconPickerGrupo(null);
      onSuccess(`Icono de «${grupo}» restaurado`);
      onCatalogosChanged?.();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al restaurar icono");
    } finally {
      setSubiendoIconoGrupo(null);
    }
  };

  const iconoPickerActual = iconPickerGrupo
    ? rubrosApi.resolveGrupoIcono(iconosPorGrupo, iconPickerGrupo)
    : undefined;

  const GrupoIcon = ({
    grupo,
    size = "md",
    clickable = false,
  }: {
    grupo: string;
    size?: "sm" | "md";
    clickable?: boolean;
  }) => {
    const custom = rubrosApi.resolveGrupoIcono(iconosPorGrupo, grupo);
    const busy = subiendoIconoGrupo === grupo;
    const className = [
      "rubro-grupo-badge",
      `rubro-grupo-badge--${size}`,
      clickable ? "rubro-grupo-badge--clickable" : "",
      busy ? "rubro-grupo-badge--loading" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const inner =
      custom?.tipo === "imagen" ? (
        <img
          src={custom.url}
          alt=""
          className="rubro-grupo-badge-img"
          draggable={false}
        />
      ) : custom?.tipo === "emoji" ? (
        <span className="rubro-grupo-badge-emoji" aria-hidden>
          {custom.emoji}
        </span>
      ) : (
        iconoGrupo(grupo)
      );

    if (!clickable) {
      return (
        <span className={className} aria-hidden title={grupo}>
          {inner}
        </span>
      );
    }

    return (
      <button
        type="button"
        className={className}
        title="Clic para elegir icono o subir imagen"
        aria-label={`Cambiar icono de ${grupo}`}
        disabled={busy}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          abrirSelectorIcono(grupo);
        }}
      >
        {inner}
      </button>
    );
  };

  const renderEstadoEditor = () => {
    if (!inline) return null;
    const on = inline.activo;
    return (
      <label
        className={`badge-estado-toggle ${on ? "badge-ok" : "badge-muted"}`}
        title="Clic para cambiar estado"
      >
        <input
          type="checkbox"
          className="badge-estado-check"
          checked={on}
          onChange={(e) =>
            setInline((d) => d && { ...d, activo: e.target.checked })
          }
        />
        <span>{on ? "Activo" : "Inactivo"}</span>
      </label>
    );
  };

  const renderEditActions = () => (
    <div className="actions-cell-inner subrubro-row-actions">
      <button
        type="button"
        className="btn btn-sm btn-primary btn-icon-only"
        disabled={saving || !apiOnline}
        onClick={guardarInline}
        aria-label="Guardar"
        title="Guardar"
      >
        {saving ? "…" : <IconGuardar size={17} />}
      </button>
      <button
        type="button"
        className="btn btn-sm btn-icon-only"
        disabled={saving}
        onClick={cancelInline}
        aria-label="Cancelar"
        title="Cancelar"
      >
        <IconCancelar size={17} />
      </button>
      <button
        type="button"
        className="btn btn-sm btn-danger btn-icon-only"
        disabled={saving || (inline?.mode === "edit" && !apiOnline)}
        onClick={eliminarInline}
        aria-label={
          inline?.mode === "new" ? "Quitar fila sin guardar" : "Eliminar sub-rubro"
        }
        title={
          inline?.mode === "new"
            ? "Quitar esta fila sin guardar"
            : "Eliminar este sub-rubro"
        }
      >
        <IconEliminar size={17} />
      </button>
    </div>
  );

  const renderInlineRow = (key: string) => {
    if (!inline) return null;
    const editableGrupo = inline.editGrupo === true;

    if (editableGrupo) {
      return (
        <tr className="subrubro-row--editing subrubro-row--new" key={key}>
          <td colSpan={2} className="subrubro-grupo-cell subrubro-grupo-cell--inline-fields">
            <div className="subrubro-inline-grupo-nombre">
              <input
                ref={grupoRef}
                className="inline-input"
                data-sin-mayusculas="true"
                value={inline.grupo}
                placeholder="Nombre del rubro"
                onChange={(e) =>
                  setInline((d) => d && { ...d, grupo: e.target.value })
                }
                onKeyDown={(e) =>
                  e.key === "Enter" && (e.preventDefault(), guardarInline())
                }
              />
              <input
                ref={nombreRef}
                className="inline-input subrubro-nombre-input"
                data-sin-mayusculas="true"
                value={inline.nombre}
                placeholder="Nombre del sub-rubro"
                onChange={(e) =>
                  setInline((d) => d && { ...d, nombre: e.target.value })
                }
                onKeyDown={(e) =>
                  e.key === "Enter" && (e.preventDefault(), guardarInline())
                }
              />
            </div>
          </td>
          <td className="subrubro-items-col muted subrubro-items-col--empty">—</td>
          <td>{renderEstadoEditor()}</td>
          <td className="actions-cell">{renderEditActions()}</td>
        </tr>
      );
    }

    return (
      <tr className="subrubro-row--editing subrubro-row--new" key={key}>
        <td
          className="muted subrubro-grupo-cell subrubro-grupo-cell--icon-only"
          title={inline.grupo}
        >
          <GrupoIcon grupo={inline.grupo} size="sm" />
          <span className="sr-only">{inline.grupo}</span>
        </td>
        <td className="col-subrubro-name">
          <input
            ref={nombreRef}
            className="inline-input subrubro-nombre-input"
            data-sin-mayusculas="true"
            value={inline.nombre}
            placeholder="Nombre del sub-rubro"
            onChange={(e) =>
              setInline((d) => d && { ...d, nombre: e.target.value })
            }
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), guardarInline())}
          />
        </td>
        <td className="subrubro-items-col muted subrubro-items-col--empty">—</td>
        <td>{renderEstadoEditor()}</td>
        <td className="actions-cell">{renderEditActions()}</td>
      </tr>
    );
  };

  const inlineNuevoRubro = inline?.nuevoRubro === true;

  const inlineNuevoSubEnGrupo = (grupo: string) =>
    inline &&
    !inline.nuevoRubro &&
    inline.mode === "new" &&
    inline.anchorGrupo === grupo;

  return (
    <div className="subseccion-panel">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver {volverLabel}
      </button>

      <div className="card">
        <div className="form-header">
          <h2>{copy.title}</h2>
          <p className="muted">
            {loading
              ? copy.subtitleLoading
              : copy.subtitleLoaded(filtrados.length, porGrupo.length)}
          </p>
        </div>

        <div className="listado-toolbar">
          <div className="filters filters-inline mayusculas-auto">
            <div className="field">
              <label htmlFor="filtro-grupo-sub">Grupo</label>
              <select
                id="filtro-grupo-sub"
                value={filtroGrupo}
                onChange={(e) => {
                  setFiltroGrupo(e.target.value);
                  setInline(null);
                }}
              >
                <option value="">Todos los grupos</option>
                {grupos.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-accent"
            disabled={!apiOnline || !!inline}
            onClick={startNewRubro}
          >
            + Nuevo rubro
          </button>
        </div>

        <input
          ref={iconInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={onIconFileSelected}
        />

        <div className="table-wrap table-wrap-rubros">
          <table className="data-table data-table-rubros">
            <thead>
              <tr>
                <th className="col-grupo">Grupo</th>
                <th className="col-subrubro">Sub-rubro</th>
                <th className="col-items">Ítems</th>
                <th className="col-estado">Estado</th>
                <th className="col-acciones" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="muted">
                    Cargando...
                  </td>
                </tr>
              ) : porGrupo.length === 0 && !inlineNuevoRubro ? (
                <tr>
                  <td colSpan={5} className="muted">
                    No hay sub-rubros en este filtro.
                  </td>
                </tr>
              ) : (
                <>
                  {inlineNuevoRubro && (
                    <Fragment key="nuevo-rubro-block">
                      <tr className="subrubro-grupo-row subrubro-grupo-row--nuevo">
                        <td colSpan={5} className="subrubro-grupo-head-cell">
                          <span className="subrubro-grupo-title">
                            <span className="rubro-grupo-badge" aria-hidden>
                              ✨
                            </span>
                            <strong>Nuevo rubro</strong>
                            <span className="muted"> — completá y guardá en esta fila</span>
                          </span>
                        </td>
                      </tr>
                      {renderInlineRow("new-rubro")}
                    </Fragment>
                  )}
                  {porGrupo.map(([grupo, items]) => (
                    <Fragment key={grupo}>
                      <tr className="subrubro-grupo-row">
                        <td colSpan={5} className="subrubro-grupo-head-cell">
                          <div className="subrubro-grupo-head">
                            {renamingGrupo === grupo ? (
                              <div className="subrubro-grupo-rename">
                                <GrupoIcon grupo={grupo} size="sm" />
                                <input
                                  ref={grupoRenameRef}
                                  className="inline-input subrubro-grupo-rename-input"
                                  data-sin-mayusculas="true"
                                  value={grupoRenameDraft}
                                  placeholder="Nombre del rubro"
                                  disabled={saving}
                                  onChange={(e) => setGrupoRenameDraft(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      guardarRenameGrupo();
                                    }
                                    if (e.key === "Escape") {
                                      e.preventDefault();
                                      cancelRenameGrupo();
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  className="btn btn-sm btn-primary btn-icon-only"
                                  disabled={saving || !apiOnline}
                                  onClick={guardarRenameGrupo}
                                  title="Guardar nombre del rubro"
                                  aria-label="Guardar nombre del rubro"
                                >
                                  <IconGuardar size={17} />
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-secondary btn-icon-only"
                                  disabled={saving}
                                  onClick={cancelRenameGrupo}
                                  title="Cancelar"
                                  aria-label="Cancelar renombrar rubro"
                                >
                                  <IconCancelar size={17} />
                                </button>
                              </div>
                            ) : (
                              <span
                                className="subrubro-grupo-title subrubro-grupo-title--picker"
                                onClick={(e) => {
                                  if ((e.target as HTMLElement).closest("button")) return;
                                  abrirSelectorIcono(grupo);
                                }}
                              >
                                <GrupoIcon grupo={grupo} clickable />
                                <strong>{grupo}</strong>
                                <span className="muted"> ({items.length})</span>
                              </span>
                            )}
                            <div className="subrubro-grupo-btns">
                              {renamingGrupo !== grupo && (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-secondary"
                                  disabled={!apiOnline || !!inline || !!renamingGrupo}
                                  onClick={() => startRenameGrupo(grupo)}
                                  title="Cambiar el nombre de este rubro"
                                >
                                  Renombrar rubro
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                disabled={
                                  !apiOnline || !!inline || renamingGrupo === grupo
                                }
                                onClick={() => startNewSub(grupo)}
                              >
                                + Nuevo sub-rubro
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-danger"
                                disabled={
                                  !apiOnline || !!inline || renamingGrupo === grupo
                                }
                                onClick={() => borrarRubro(grupo, items.length)}
                                title="Eliminar este rubro y todos sus sub-rubros"
                              >
                                Eliminar rubro
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                      {items.map((r) => {
                        const isEditing =
                          inline?.mode === "edit" && inline.id === r.id;
                        return (
                          <tr
                            key={r.id}
                            className={isEditing ? "subrubro-row--editing" : undefined}
                          >
                            <td
                              className="muted subrubro-grupo-cell subrubro-grupo-cell--icon-only"
                              title={grupo}
                            >
                              <GrupoIcon grupo={grupo} size="sm" clickable />
                              <span className="sr-only">{grupo}</span>
                            </td>
                            <td className="col-subrubro-name">
                              {isEditing ? (
                                <input
                                  ref={nombreRef}
                                  className="inline-input subrubro-nombre-input"
                                  data-sin-mayusculas="true"
                                  value={inline.nombre}
                                  placeholder="Nombre del sub-rubro"
                                  onChange={(e) =>
                                    setInline(
                                      (d) => d && { ...d, nombre: e.target.value }
                                    )
                                  }
                                  onKeyDown={(e) =>
                                    e.key === "Enter" &&
                                    (e.preventDefault(), guardarInline())
                                  }
                                />
                              ) : (
                                <SubRubroNombre nombre={r.nombre} />
                              )}
                            </td>
                            <td className="subrubro-items-col">
                              <SubRubroItemsCell
                                subRubroId={r.id}
                                items={itemsBySubRubro[r.id] ?? []}
                                apiOnline={apiOnline}
                                createItem={rubrosApi.createSubRubroItem}
                                deleteItem={rubrosApi.deleteSubRubroItem}
                                onError={onError}
                                onSuccess={onSuccess}
                                onItemAdded={(item) =>
                                  patchItems(r.id, (list) => [...list, item])
                                }
                                onItemRemoved={(itemId) =>
                                  patchItems(r.id, (list) =>
                                    list.filter((i) => i.id !== itemId)
                                  )
                                }
                              />
                            </td>
                            <td className="col-estado-cell">
                              {isEditing ? (
                                renderEstadoEditor()
                              ) : (
                                <span
                                  className={r.activo ? "badge-ok" : "badge-muted"}
                                >
                                  {r.activo ? "Activo" : "Inactivo"}
                                </span>
                              )}
                            </td>
                            <td className="actions-cell">
                              {isEditing ? (
                                renderEditActions()
                              ) : (
                                <div className="actions-cell-inner">
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-icon-only"
                                    disabled={!!inline}
                                    onClick={() => startEdit(r)}
                                    aria-label="Editar"
                                    title="Editar"
                                  >
                                    <IconEditar size={17} />
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-danger btn-icon-only"
                                    disabled={!!inline}
                                    onClick={() => borrar(r.id)}
                                    aria-label="Eliminar"
                                    title="Eliminar"
                                  >
                                    <IconEliminar size={17} />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {inlineNuevoSubEnGrupo(grupo) && renderInlineRow(`new-${grupo}`)}
                    </Fragment>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {iconPickerGrupo && (
        <GrupoIconoPickerModal
          grupo={iconPickerGrupo}
          apiOnline={apiOnline}
          guardando={!!subiendoIconoGrupo}
          iconoActual={iconoPickerActual}
          onCerrar={cerrarSelectorIcono}
          onElegirEmoji={elegirIconoBanco}
          onSubirPc={subirIconoDesdePc}
          onRestaurar={restaurarIconoAutomatico}
        />
      )}
    </div>
  );
}
