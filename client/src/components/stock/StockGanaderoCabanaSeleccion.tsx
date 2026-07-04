import { useCallback, useEffect, useId, useMemo, useState, type FormEvent } from "react";
import {
  fetchStockGanaderaDispositivos,
  fetchStockGanaderaVentasDispositivos,
  quitarCabanaSeleccion,
  saveCabanaSeleccion,
} from "../../api";
import type { AuthUser, StockGanaderaDispositivo } from "../../types";
import { confirmAction } from "../../utils/confirm";
import BuscadorCaravanaActiva from "./BuscadorCaravanaActiva";
import SelectRazaDispositivo from "./SelectRazaDispositivo";
import {
  etiquetaCaravana,
  filtrarDispositivosActivosStock,
  fmtRaza,
  normalizarEstadoDispositivo,
  normalizarRaza,
} from "./stock-ganadera-utils";
import { PageModuleHeadRow } from "../PageModuleHead";

interface Props {
  apiOnline: boolean;
  currentUser?: AuthUser | null;
  onError: (msg: string) => void;
  onSuccess: (msg: string, title?: string) => void;
  onVolver: () => void;
  embedded?: boolean;
}

interface CabanaPendiente {
  id: string;
  clave: string;
  etiqueta: string;
  nombre_cabana: string;
  raza: string;
  observaciones: string;
}

let pendienteIdSeq = 0;
function nextPendienteId(): string {
  pendienteIdSeq += 1;
  return `cabana-${pendienteIdSeq}`;
}

export default function StockGanaderoCabanaSeleccion({
  apiOnline,
  currentUser,
  onError,
  onSuccess,
  onVolver,
  embedded = false,
}: Props) {
  const formId = useId();
  const [seleccion, setSeleccion] = useState<StockGanaderaDispositivo | null>(null);
  const [nombreCabana, setNombreCabana] = useState("");
  const [raza, setRaza] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [pendientes, setPendientes] = useState<CabanaPendiente[]>([]);
  const [guardados, setGuardados] = useState<StockGanaderaDispositivo[]>([]);
  const [totalStock, setTotalStock] = useState(0);
  const [loadingGuardados, setLoadingGuardados] = useState(true);
  const [listaRefresh, setListaRefresh] = useState(0);
  const [guardando, setGuardando] = useState(false);

  const cargarGuardados = useCallback(async () => {
    if (!apiOnline) {
      setGuardados([]);
      setTotalStock(0);
      setLoadingGuardados(false);
      return;
    }
    setLoadingGuardados(true);
    try {
      const rows = await fetchStockGanaderaDispositivos({});
      let activos: StockGanaderaDispositivo[];
      try {
        const ventas = await fetchStockGanaderaVentasDispositivos();
        activos = filtrarDispositivosActivosStock(rows, new Set(ventas.claves));
      } catch {
        activos = rows.filter((d) => normalizarEstadoDispositivo(d.estado) === "VIVO");
      }
      setTotalStock(activos.length);
      setGuardados(
        rows
          .filter((d) => d.cabana_premium && d.nombre_cabana.trim())
          .sort((a, b) => a.nombre_cabana.localeCompare(b.nombre_cabana, "es"))
      );
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar animales de cabaña");
      setGuardados([]);
      setTotalStock(0);
    } finally {
      setLoadingGuardados(false);
    }
  }, [apiOnline, onError, listaRefresh]);

  useEffect(() => {
    void cargarGuardados();
  }, [cargarGuardados]);

  const excludeClaves = useMemo(() => {
    const set = new Set(pendientes.map((p) => p.clave));
    if (seleccion) set.add(seleccion.clave);
    return set;
  }, [pendientes, seleccion]);

  const limpiarFormulario = () => {
    setSeleccion(null);
    setNombreCabana("");
    setRaza("");
    setObservaciones("");
  };

  const elegirDispositivo = (d: StockGanaderaDispositivo) => {
    setSeleccion(d);
    setRaza(d.raza ?? "");
    setObservaciones(d.observaciones ?? "");
  };

  const validarNombre = (): boolean => {
    if (!nombreCabana.trim()) {
      onError("Ingresá un nombre de identificación para el animal");
      return false;
    }
    return true;
  };

  const agregarPendiente = (e: FormEvent) => {
    e.preventDefault();
    if (!seleccion) {
      onError("Seleccioná un dispositivo del stock");
      return;
    }
    if (!validarNombre()) return;

    const nombre = nombreCabana.trim();
    setPendientes((prev) => {
      const sinDuplicado = prev.filter((p) => p.clave !== seleccion.clave);
      return [
        ...sinDuplicado,
        {
          id: nextPendienteId(),
          clave: seleccion.clave,
          etiqueta: etiquetaCaravana(seleccion),
          nombre_cabana: nombre,
          raza: normalizarRaza(raza),
          observaciones: observaciones.trim(),
        },
      ];
    });
    limpiarFormulario();
  };

  const guardarItems = async (items: CabanaPendiente[]) => {
    if (!items.length) {
      onError("Ingresá al menos un animal para seleccionar");
      return;
    }
    setGuardando(true);
    try {
      const result = await saveCabanaSeleccion(
        items.map((item) => ({
          clave: item.clave,
          nombre_cabana: item.nombre_cabana,
          raza: item.raza,
          observaciones: item.observaciones,
        }))
      );
      if (result.errores.length) {
        onError(result.errores.map((e) => `${e.clave}: ${e.mensaje}`).join(" · "));
      }
      if (result.guardados > 0) {
        onSuccess(
          `${result.guardados} animal(es) seleccionado(s) como selección de cabaña`,
          "Selección guardada"
        );
        setPendientes((prev) =>
          prev.filter((p) => result.errores.some((e) => e.clave === p.clave))
        );
        setListaRefresh((k) => k + 1);
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al guardar selección");
    } finally {
      setGuardando(false);
    }
  };

  const confirmarSeleccion = () => {
    if (!seleccion) {
      onError("Seleccioná un dispositivo del stock");
      return;
    }
    if (!validarNombre()) return;
    void guardarItems([
      {
        id: nextPendienteId(),
        clave: seleccion.clave,
        etiqueta: etiquetaCaravana(seleccion),
        nombre_cabana: nombreCabana.trim(),
        raza: normalizarRaza(raza),
        observaciones: observaciones.trim(),
      },
    ]).then(() => limpiarFormulario());
  };

  const quitarPendiente = (id: string) => {
    setPendientes((prev) => prev.filter((p) => p.id !== id));
  };

  const quitarGuardado = async (d: StockGanaderaDispositivo) => {
    const ok = await confirmAction({
      title: "Quitar de cabaña",
      message: `¿Quitar a ${d.nombre_cabana || etiquetaCaravana(d)} de la selección de cabaña?`,
      confirmText: "Quitar",
      variant: "danger",
    });
    if (!ok) return;
    setGuardando(true);
    try {
      const { quitados } = await quitarCabanaSeleccion([d.clave]);
      if (quitados > 0) {
        onSuccess("Animal quitado de la selección de cabaña", "Actualizado");
        setListaRefresh((k) => k + 1);
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al quitar selección");
    } finally {
      setGuardando(false);
    }
  };

  const editarGuardado = (d: StockGanaderaDispositivo) => {
    setSeleccion(d);
    setNombreCabana(d.nombre_cabana);
    setRaza(d.raza ?? "");
    setObservaciones(d.observaciones ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const btnGhost = embedded ? "sg-hub-cta sg-hub-cta--ghost" : "btn btn-ghost";
  const btnGhostSm = embedded ? "sg-hub-cta sg-hub-cta--ghost" : "btn btn-ghost btn-sm";
  const btnSecondary = embedded ? "sg-hub-cta sg-hub-cta--ghost" : "btn btn-secondary";
  const btnPrimary = embedded ? "sg-hub-cta" : "btn btn-primary stock-import-action--cabana";

  const hubKpiStrip = embedded ? (
    <section className="sg-hub-kpi-strip sg-module-kpi-strip" aria-label="Resumen selección cabaña">
      <article className="sg-hub-kpi sg-hub-kpi--dark">
        <div className="sg-hub-kpi-top">
          <div>
            <p className="sg-hub-kpi-kicker">Activos en stock</p>
            <p className="sg-hub-kpi-value">{loadingGuardados ? "—" : totalStock}</p>
          </div>
        </div>
        <p className="sg-hub-kpi-hint">Dispositivos EID activos disponibles.</p>
      </article>
      <article className="sg-hub-kpi">
        <div className="sg-hub-kpi-top">
          <div>
            <p className="sg-hub-kpi-kicker">En selección</p>
            <p className="sg-hub-kpi-value">{loadingGuardados ? "—" : guardados.length}</p>
          </div>
        </div>
        <p className="sg-hub-kpi-hint">Animales ya marcados como cabaña.</p>
      </article>
      <article className="sg-hub-kpi">
        <div className="sg-hub-kpi-top">
          <div>
            <p className="sg-hub-kpi-kicker">Pendientes</p>
            <p className="sg-hub-kpi-value">{pendientes.length}</p>
          </div>
        </div>
        <p className="sg-hub-kpi-hint">Listos para confirmar en lote.</p>
      </article>
    </section>
  ) : null;

  const offlineBanner = !apiOnline ? (
    <div className="stock-import-offline" role="status">
      Conectá la API (puerto 3001) para seleccionar animales de cabaña.
    </div>
  ) : null;

  const cabanaFormFields = (
    <>
      <div className="field stock-cabana-field">
        <label htmlFor={`${formId}-buscador`} className="stock-import-spec-label">
          Dispositivo del stock
        </label>
        <BuscadorCaravanaActiva
          id={`${formId}-buscador`}
          apiOnline={apiOnline}
          disabled={guardando}
          variant="cabana"
          excludeClaves={excludeClaves}
          refreshKey={listaRefresh}
          onError={onError}
          onSelect={elegirDispositivo}
        />
        <p className="stock-cabana-field-hint">
          Solo dispositivos activos (estado Vivo). Excluye animales dados de baja o vendidos.
        </p>
      </div>

      {seleccion ? (
        <div className={`stock-cabana-seleccion${embedded ? " stock-cabana-seleccion--hub" : ""}`}>
          <header className="stock-baja-manual-resultado-head">
            <div>
              <p className="stock-baja-manual-kicker">Dispositivo seleccionado</p>
              <h4 className="stock-baja-manual-titulo num">{etiquetaCaravana(seleccion)}</h4>
              <p className="stock-baja-manual-meta muted">
                {[seleccion.sexo, seleccion.empresa].filter(Boolean).join(" · ") ||
                  "Sin datos adicionales"}
                {seleccion.cabana_premium && seleccion.nombre_cabana
                  ? ` · Selección: ${seleccion.nombre_cabana}`
                  : ""}
              </p>
            </div>
            <button
              type="button"
              className="stock-baja-manual-limpiar"
              aria-label="Quitar selección"
              onClick={() => {
                setSeleccion(null);
                setRaza("");
                setObservaciones("");
              }}
            >
              Limpiar
            </button>
          </header>
        </div>
      ) : null}

      <div className="field stock-cabana-field stock-cabana-field--raza">
        <label htmlFor={`${formId}-raza`} className="stock-import-spec-label">
          Raza
        </label>
        <SelectRazaDispositivo
          id={`${formId}-raza`}
          value={raza}
          disabled={!apiOnline || guardando}
          apiOnline={apiOnline}
          onError={onError}
          onSuccess={onSuccess}
          puedeEliminarRaza={Boolean(currentUser?.es_super_admin)}
          selectClassName="stock-baja-manual-input stock-cabana-raza-select"
          otraInputClassName="stock-baja-manual-input stock-raza-otra-input mayusculas-auto"
          onChange={setRaza}
        />
      </div>

      <div className="field stock-cabana-field">
        <label htmlFor={`${formId}-nombre`} className="stock-import-spec-label">
          Nombre del animal
        </label>
        <input
          id={`${formId}-nombre`}
          type="text"
          className="stock-baja-manual-input mayusculas-auto"
          value={nombreCabana}
          disabled={!apiOnline || guardando}
          placeholder="Ingresar nombre del animal seleccionado (puro por cruza o de sangre seleccionado)"
          maxLength={64}
          onChange={(e) => setNombreCabana(e.target.value)}
        />
      </div>

      <div className="field stock-cabana-field stock-cabana-field--observaciones">
        <label htmlFor={`${formId}-observaciones`} className="stock-import-spec-label">
          Observaciones
          <span className="stock-cabana-label-hint">opcional</span>
        </label>
        <textarea
          id={`${formId}-observaciones`}
          className="stock-baja-manual-input stock-cabana-observaciones mayusculas-auto"
          value={observaciones}
          disabled={!apiOnline || guardando}
          placeholder="Detalles relevantes a documentar del animal (selección, cruza, sangre, notas de cabaña…)"
          maxLength={2000}
          rows={3}
          onChange={(e) => setObservaciones(e.target.value)}
        />
      </div>
    </>
  );

  const cabanaForm = (
    <form id={formId} className="stock-cabana-form-grid" onSubmit={agregarPendiente}>
      {embedded ? (
        <div className="stock-cabana-form-fields-box">{cabanaFormFields}</div>
      ) : (
        cabanaFormFields
      )}

      <div className={`stock-cabana-acciones${embedded ? " stock-cabana-acciones--hub" : ""}`}>
        <button
          type="button"
          className={btnGhost}
          disabled={!apiOnline || guardando}
          onClick={() => {
            limpiarFormulario();
            setPendientes([]);
          }}
        >
          Limpiar todo
        </button>
        <button
          type="submit"
          className={btnSecondary}
          disabled={!apiOnline || guardando || !seleccion}
        >
          Agregar y buscar otro
        </button>
        <button
          type="button"
          className={btnPrimary}
          disabled={!apiOnline || guardando || !seleccion}
          onClick={confirmarSeleccion}
        >
          Confirmar selección
        </button>
      </div>
    </form>
  );

  const pendientesPanel = pendientes.length > 0 ? (
    <section
      className={
        embedded
          ? "stock-cabana-hub-box stock-cabana-hub-box--pendientes"
          : "stock-import-panel card stock-cabana-pendientes"
      }
      aria-label="Pendientes de guardar"
    >
      <header className={embedded ? "stock-cabana-hub-head-box stock-cabana-hub-head-box--panel" : "stock-cabana-section-head"}>
        <div>
          {embedded ? (
            <>
              <p className="sg-hub-panel-kicker">Lista temporal</p>
              <h2 className="stock-cabana-hub-title">Pendientes de guardar</h2>
            </>
          ) : (
            <>
              <p className="stock-cabana-kicker">Lista temporal</p>
              <h3 className="stock-cabana-section-title">Pendientes de guardar</h3>
            </>
          )}
        </div>
        <span className={`stock-cabana-count${embedded ? " stock-cabana-count--hub" : ""}`}>
          {pendientes.length}
        </span>
      </header>
      <ul className="stock-cabana-rows">
        {pendientes.map((row) => (
          <li key={row.id} className="stock-cabana-row stock-cabana-row--pendiente">
            <div className="stock-cabana-row-main">
              <span className="stock-cabana-row-device num">{row.etiqueta}</span>
              <span className="stock-cabana-row-name">{row.nombre_cabana}</span>
              {row.raza ? <span className="stock-cabana-row-meta">{fmtRaza(row.raza)}</span> : null}
            </div>
            <button
              type="button"
              className="stock-cabana-row-remove"
              aria-label="Quitar de pendientes"
              disabled={guardando}
              onClick={() => quitarPendiente(row.id)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <footer className="stock-cabana-panel-foot">
        <button
          type="button"
          className={btnPrimary}
          disabled={!apiOnline || guardando}
          onClick={() => void guardarItems(pendientes)}
        >
          {guardando ? "Guardando…" : `Guardar ${pendientes.length} selección(es)`}
        </button>
      </footer>
    </section>
  ) : null;

  const listaPanel = (
    <section
      className={
        embedded ? "stock-cabana-hub-box stock-cabana-hub-box--lista" : "stock-import-panel card stock-cabana-lista"
      }
      aria-label="Animales de cabaña seleccionados"
    >
      <header className={embedded ? "stock-cabana-hub-head-box stock-cabana-hub-head-box--panel" : "stock-cabana-section-head"}>
        <div>
          {embedded ? (
            <>
              <p className="sg-hub-panel-kicker">Registro guardado</p>
              <h2 className="stock-cabana-hub-title">Animales de cabaña seleccionados</h2>
            </>
          ) : (
            <>
              <p className="stock-cabana-kicker">Registro guardado</p>
              <h3 className="stock-cabana-section-title">Animales de cabaña seleccionados</h3>
            </>
          )}
        </div>
        <span className={`stock-cabana-count${embedded ? " stock-cabana-count--hub" : ""}`}>
          {guardados.length}
        </span>
      </header>

      {loadingGuardados ? (
        <p className="stock-cabana-empty muted">Cargando selección…</p>
      ) : guardados.length === 0 ? (
        <div className="stock-cabana-empty-state">
          <span className="stock-cabana-empty-icon" aria-hidden>
            ★
          </span>
          <p>Todavía no hay animales marcados en selección de cabaña.</p>
        </div>
      ) : (
        <ul className="stock-cabana-rows">
          {guardados.map((d) => (
            <li key={d.clave} className="stock-cabana-row stock-cabana-row--guardado">
              <div className="stock-cabana-row-main">
                <span className="stock-cabana-row-device num">{etiquetaCaravana(d)}</span>
                <span className="stock-cabana-row-name stock-cabana-row-name--premium">
                  ★ {d.nombre_cabana}
                </span>
                {[d.sexo, d.empresa, d.raza].filter(Boolean).length > 0 ? (
                  <span className="stock-cabana-row-meta">
                    {[d.sexo, d.empresa, d.raza ? fmtRaza(d.raza) : ""].filter(Boolean).join(" · ")}
                  </span>
                ) : null}
              </div>
              <div className="stock-cabana-row-actions">
                <button
                  type="button"
                  className={btnGhostSm}
                  disabled={guardando}
                  onClick={() => editarGuardado(d)}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className={`${btnGhostSm} stock-cabana-btn-quitar`.trim()}
                  disabled={guardando}
                  onClick={() => void quitarGuardado(d)}
                >
                  Quitar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  const panel = embedded ? (
    <>
      {hubKpiStrip}
      {offlineBanner}
      <div className="stock-cabana-hub-workspace">
        <section className="stock-cabana-hub-box" aria-label="Guía de selección">
          <header className="stock-cabana-hub-head-box">
            <p className="sg-hub-panel-kicker">Selección</p>
            <h2 className="stock-cabana-hub-title">Animales de cabaña</h2>
            <p className="stock-cabana-hub-sub muted">
              Buscá la caravana en el stock activo, asigná un nombre de identificación y confirmá la
              selección.
            </p>
          </header>
          <p className="stock-cabana-hub-note muted">
            Podés sumar varios animales a la lista pendiente y guardarlos juntos. Solo aparecen
            dispositivos <strong>activos</strong> del stock ganadero (excluye vendidos, muertos,
            frigorífico y perdidos).
          </p>
        </section>

        <section className="stock-cabana-hub-box stock-cabana-hub-box--form" aria-label="Nueva selección">
          <header className="stock-cabana-hub-head-box stock-cabana-hub-head-box--panel">
            <p className="sg-hub-panel-kicker">Nueva selección</p>
            <h2 className="stock-cabana-hub-title">Elegir dispositivo</h2>
          </header>
          {cabanaForm}
        </section>

        {pendientesPanel}
        {listaPanel}
      </div>
    </>
  ) : (
    <>
      <div className="stock-import-hero card stock-import-hero--cabana">
        <PageModuleHeadRow
          icon={{ source: "hub", id: "stock_cabana" }}
          title="Selección Animales de Cabaña"
          subtitle={
            <>
              Elegí dispositivos activos del stock y asignales un nombre de identificación para
              marcarlos como <strong>animales de selección</strong> de cabaña.
            </>
          }
          className="stock-import-hero-head"
        />
        <div className="stock-cabana-kpis" aria-label="Resumen">
          <div className="stock-cabana-kpi">
            <span className="stock-cabana-kpi-val">{loadingGuardados ? "—" : totalStock}</span>
            <span className="stock-cabana-kpi-label">Activos en stock</span>
          </div>
          <div className="stock-cabana-kpi">
            <span className="stock-cabana-kpi-val">{loadingGuardados ? "—" : guardados.length}</span>
            <span className="stock-cabana-kpi-label">En selección</span>
          </div>
          <div className="stock-cabana-kpi">
            <span className="stock-cabana-kpi-val">{pendientes.length}</span>
            <span className="stock-cabana-kpi-label">Pendientes</span>
          </div>
        </div>
      </div>

      {offlineBanner}

      <div className="card stock-import-shell stock-import-shell--cabana">
        <div className="stock-ganadera-layout stock-import-layout">
          <aside
            className="stock-facet-sidebar stock-import-sidebar stock-import-sidebar--cabana"
            aria-label="Guía de selección"
          >
            <div className="stock-facet-sidebar-head stock-import-sidebar-head">
              <h3 className="stock-facet-sidebar-title">Selección</h3>
            </div>

            <div className="stock-facet-group">
              <div className="stock-facet-group-head">
                <h4 className="stock-facet-group-title">Cómo funciona</h4>
              </div>
              <p className="stock-import-sidebar-note">
                Buscá la caravana en el stock activo, asigná un nombre de identificación y
                confirmá la selección.
              </p>
              <p className="stock-import-sidebar-note">
                Podés sumar varios animales a la lista pendiente y guardarlos juntos.
              </p>
            </div>

            <div className="stock-facet-group">
              <div className="stock-facet-group-head">
                <h4 className="stock-facet-group-title">Stock disponible</h4>
              </div>
              <p className="stock-import-sidebar-note">
                Solo aparecen dispositivos <strong>activos</strong> del stock ganadero
                (excluye vendidos, muertos, frigorífico y perdidos).
              </p>
            </div>
          </aside>

          <div className="stock-ganadera-main stock-import-main">
            <div className="stock-cabana-form card stock-baja-manual-buscar">
              <header className="stock-cabana-section-head">
                <div>
                  <p className="stock-cabana-kicker">Nueva selección</p>
                  <h3 className="stock-cabana-section-title">Elegir dispositivo</h3>
                </div>
              </header>
              {cabanaForm}
            </div>

            {pendientesPanel}
            {listaPanel}
          </div>
        </div>
      </div>
    </>
  );

  if (embedded) return panel;

  return (
    <div className="subseccion-panel stock-import-page stock-cabana-page">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver a Stock Ganadero
      </button>
      {panel}
    </div>
  );
}
