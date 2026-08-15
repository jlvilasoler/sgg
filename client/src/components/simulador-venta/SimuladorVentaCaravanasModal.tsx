import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchSimuladorVentaDispositivos,
  saveSimuladorVentaDispositivos,
} from "../../api";
import type {
  AuthUser,
  CategoriaPrecioGanado,
  SimuladorVentaGanadoRow,
  StockGanaderaDispositivo,
} from "../../types";
import { fmtNum } from "../divisas/divisas-utils";
import BuscadorCaravanaActiva from "../stock/BuscadorCaravanaActiva";
import { etiquetaCaravana, categoriasDispositivo } from "../stock/stock-ganadera-utils";
import { useHeaderBackStep } from "../../header-back";
import { canWriteSimuladorVentaGanado } from "../../utils/auth-permissions";
import { simuladorCategoriaAFiltroKeys, type SimuladorVentaTipoConfig } from "./simulador-venta-config";
import {
  limiteDispositivosVenta,
  mensajeLimiteDispositivosVenta,
  puedeAgregarDispositivoVenta,
} from "./simulador-venta-dispositivos-utils";

/** Inferencia rápida en UI al elegir un dispositivo (el servidor confirma al guardar). */
function categoriaDesdeDispositivoUi(
  tipo: SimuladorVentaGanadoRow["tipo"],
  d: StockGanaderaDispositivo,
  categoriasValidas: readonly string[]
): CategoriaPrecioGanado | null {
  const permitidas = new Set(categoriasValidas);
  const keys = [...categoriasDispositivo(d)];
  const map: Record<string, Record<string, string>> = {
    EN_PIE: { TERNERO: "TERNERO", TERNERA: "TERNERA", VACA: "VACA_INVERNADA" },
    CUARTA_BALANZA: {
      NOVILLO_1_2: "NOVILLO",
      NOVILLO_MAS_2: "NOVILLO",
      TORO_1_2: "NOVILLO",
      TORO_MAS_2: "NOVILLO",
      VACA: "VACA",
      VAQUILLONA_1_2: "VAQUILLONA",
      VAQUILLONA_MAS_2: "VAQUILLONA",
    },
  };
  const found = new Set<string>();
  for (const k of keys) {
    const cat = map[tipo]?.[k];
    if (cat && permitidas.has(cat)) found.add(cat);
  }
  if (found.size === 1) return [...found][0] as CategoriaPrecioGanado;
  if (d.sexo === "HEMBRA") {
    const fb = tipo === "EN_PIE" ? "VACA_INVERNADA" : "VACA";
    return permitidas.has(fb) ? (fb as CategoriaPrecioGanado) : null;
  }
  if (d.sexo === "MACHO") {
    const fb = tipo === "EN_PIE" ? "TERNERO" : "NOVILLO";
    return permitidas.has(fb) ? (fb as CategoriaPrecioGanado) : null;
  }
  return null;
}

interface Props {
  row: SimuladorVentaGanadoRow;
  config: SimuladorVentaTipoConfig;
  user: AuthUser;
  apiOnline: boolean;
  onVolver: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onDispositivosSaved?: (payload: {
    count: number;
    categoria?: CategoriaPrecioGanado;
  }) => void;
  /** Aviso suave cuando se corrige categoría al abrir (sin guardar). */
  onCategoriaCorregida?: (msg: string) => void;
}

type Seleccion = Pick<StockGanaderaDispositivo, "clave" | "eid" | "vid">;

export default function SimuladorVentaCaravanasPanel({
  row,
  config,
  user,
  apiOnline,
  onVolver,
  onError,
  onSuccess,
  onDispositivosSaved,
  onCategoriaCorregida,
}: Props) {
  useHeaderBackStep(true, onVolver, "Simulador de ventas");
  const [seleccionadas, setSeleccionadas] = useState<Seleccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [categoriaActual, setCategoriaActual] = useState<CategoriaPrecioGanado>(row.categoria);
  const [filtroCategoria, setFiltroCategoria] = useState<string>(row.categoria);
  const [incluirFueraDeStock, setIncluirFueraDeStock] = useState(false);

  const puedeGuardar = canWriteSimuladorVentaGanado(user);
  const catLabel = config.labels[categoriaActual] ?? categoriaActual;
  const opCode = row.numero_operacion || `#${row.id}`;
  const cabObjetivo = limiteDispositivosVenta(row);
  const limiteAlcanzado =
    cabObjetivo != null && seleccionadas.length >= cabObjetivo;

  const filtroCategoriaKeys = useMemo(
    () => (filtroCategoria ? simuladorCategoriaAFiltroKeys(filtroCategoria) : new Set<string>()),
    [filtroCategoria]
  );

  const filtroCategoriaLabel = filtroCategoria
    ? (config.labels[filtroCategoria] ?? filtroCategoria)
    : undefined;

  const load = useCallback(async () => {
    if (!apiOnline) {
      setSeleccionadas([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetchSimuladorVentaDispositivos(row.id);
      setSeleccionadas(
        res.data.map((d) => ({ clave: d.clave, eid: d.eid, vid: d.vid }))
      );
      if (res.categoria) {
        setCategoriaActual(res.categoria);
      }
      if (res.categoria_corregida) {
        const { labelAntes, labelDespues, despues } = res.categoria_corregida;
        setCategoriaActual(despues);
        setFiltroCategoria(despues);
        onDispositivosSaved?.({
          count: res.data.length,
          categoria: despues,
        });
        onCategoriaCorregida?.(
          `Categoría corregida según el dispositivo: ${labelAntes} → ${labelDespues}`
        );
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar dispositivos");
      setSeleccionadas([]);
    } finally {
      setLoading(false);
    }
  }, [apiOnline, onError, onDispositivosSaved, onCategoriaCorregida, row.id]);

  useEffect(() => {
    setCategoriaActual(row.categoria);
  }, [row.categoria]);

  useEffect(() => {
    void load();
  }, [load]);

  const excludeClaves = useMemo(
    () => new Set(seleccionadas.map((d) => d.clave)),
    [seleccionadas]
  );

  const agregar = (d: StockGanaderaDispositivo) => {
    if (!puedeAgregarDispositivoVenta(row, seleccionadas.length)) {
      if (cabObjetivo != null) onError(mensajeLimiteDispositivosVenta(cabObjetivo));
      return;
    }
    setSeleccionadas((prev) => {
      if (prev.some((x) => x.clave === d.clave)) return prev;
      return [...prev, { clave: d.clave, eid: d.eid, vid: d.vid }];
    });
    const inferida = categoriaDesdeDispositivoUi(row.tipo, d, config.categorias);
    if (inferida && inferida !== categoriaActual) {
      setCategoriaActual(inferida);
      setFiltroCategoria(inferida);
    }
  };

  const quitar = (clave: string) => {
    setSeleccionadas((prev) => prev.filter((d) => d.clave !== clave));
  };

  const handleSave = async () => {
    if (!puedeGuardar || !apiOnline) return;
    if (cabObjetivo != null && seleccionadas.length > cabObjetivo) {
      onError(mensajeLimiteDispositivosVenta(cabObjetivo));
      return;
    }
    setSaving(true);
    try {
      const res = await saveSimuladorVentaDispositivos(row.id, seleccionadas);
      setSeleccionadas(
        res.data.map((d) => ({ clave: d.clave, eid: d.eid, vid: d.vid }))
      );
      setRefreshKey((k) => k + 1);
      onDispositivosSaved?.({
        count: res.data.length,
        categoria: res.categoria_corregida?.despues ?? res.categoria,
      });
      if (res.categoria_corregida?.despues) {
        setCategoriaActual(res.categoria_corregida.despues);
      } else if (res.categoria) {
        setCategoriaActual(res.categoria);
      }
      onSuccess(res.message);
      onVolver();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al guardar dispositivos");
    } finally {
      setSaving(false);
    }
  };

  const diffCab =
    cabObjetivo != null && seleccionadas.length !== cabObjetivo
      ? seleccionadas.length - cabObjetivo
      : null;

  return (
    <div className="subseccion-panel">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver al simulador
      </button>

      <div className="card subseccion-inline-card sim-caravanas-inline">
        <div className="sim-caravanas-modal sim-caravanas-modal--inline">
        <header className="sim-caravanas-head">
          <div className="sim-caravanas-head-main">
            <div className="sim-caravanas-head-icon" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 7h16M4 12h10M4 17h6"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
                <circle cx="17" cy="14" r="3.25" stroke="currentColor" strokeWidth="1.75" />
                <path
                  d="M19.5 16.5 21 18"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div>
              <p className="sim-caravanas-kicker">Venta cerrada · Dispositivos</p>
              <h2 id="sim-caravanas-titulo">Vincular dispositivos</h2>
              <div className="sim-caravanas-meta-row">
                <span className="sim-caravanas-op-badge">{opCode}</span>
                <span className="sim-caravanas-cat">{catLabel}</span>
              </div>
            </div>
          </div>
        </header>

        <div className="sim-caravanas-body">
          <div className="sim-caravanas-kpis">
            <div className="sim-caravanas-kpi sim-caravanas-kpi--hero">
              <span className="sim-caravanas-kpi-label">Seleccionadas</span>
              <strong>{loading ? "…" : fmtNum(seleccionadas.length, 0)}</strong>
            </div>
            {cabObjetivo != null && (
              <div className="sim-caravanas-kpi">
                <span className="sim-caravanas-kpi-label">Cab. venta</span>
                <strong>{fmtNum(cabObjetivo, 0)}</strong>
              </div>
            )}
            {diffCab != null && diffCab !== 0 && (
              <div
                className={`sim-caravanas-kpi sim-caravanas-kpi--hint${diffCab > 0 ? " is-over" : " is-under"}`}
              >
                <span className="sim-caravanas-kpi-label">Diferencia</span>
                <strong>
                  {diffCab > 0 ? "+" : ""}
                  {diffCab}
                </strong>
              </div>
            )}
            {limiteAlcanzado && (
              <div className="sim-caravanas-kpi sim-caravanas-kpi--hint is-over">
                <span className="sim-caravanas-kpi-label">Límite</span>
                <strong>Completo</strong>
              </div>
            )}
          </div>

          {limiteAlcanzado && (
            <p className="sim-caravanas-search-hint muted" role="status">
              Ya vinculaste {cabObjetivo} dispositivo{cabObjetivo === 1 ? "" : "s"} (máximo
              permitido). Quitá uno para agregar otro.
            </p>
          )}

          {puedeGuardar && (
            <section className="sim-caravanas-search">
              <label htmlFor="sim-caravanas-buscador" className="sim-caravanas-search-label">
                {incluirFueraDeStock
                  ? "Buscar dispositivo (activos y salidas)"
                  : "Buscar dispositivo activo"}
              </label>
              {!limiteAlcanzado && (
                <p className="sim-caravanas-search-hint muted">
                  EID, VID o número de dispositivo · filtrá por categoría en el mismo campo.
                </p>
              )}
              <label className="sim-caravanas-alcance">
                <input
                  type="checkbox"
                  checked={incluirFueraDeStock}
                  disabled={saving || loading || limiteAlcanzado}
                  onChange={(e) => setIncluirFueraDeStock(e.target.checked)}
                />
                <span>
                  Incluir también dispositivos <strong>fuera del sistema</strong> (salidas). No se
                  agregan solos: solo aparecen en la búsqueda para que los elijas.
                </span>
              </label>
              <BuscadorCaravanaActiva
                id="sim-caravanas-buscador"
                variant="dispositivos"
                apiOnline={apiOnline}
                disabled={saving || loading || limiteAlcanzado}
                excludeClaves={excludeClaves}
                filtroCategoria={filtroCategoriaKeys}
                filtroCategoriaLabel={filtroCategoriaLabel}
                incluirFueraDeStock={incluirFueraDeStock}
                categoriaSelect={{
                  id: "sim-caravanas-filtro-cat",
                  value: filtroCategoria,
                  disabled: saving || loading,
                  options: [
                    { value: "", label: "Todas" },
                    ...config.categorias.map((cat) => ({
                      value: cat,
                      label: config.labels[cat] ?? cat,
                    })),
                  ],
                  onChange: setFiltroCategoria,
                }}
                refreshKey={refreshKey}
                onError={onError}
                onSelect={agregar}
              />
            </section>
          )}

          <section className="sim-caravanas-lista-wrap">
            {loading ? (
              <div className="sim-caravanas-state">
                <span className="sim-caravanas-spinner" aria-hidden />
                Cargando…
              </div>
            ) : seleccionadas.length === 0 ? (
              <p className="stock-import-queue-empty muted sim-caravanas-queue-empty">
                Buscá y agregá los dispositivos embarcados en esta venta.
              </p>
            ) : (
              <div className="stock-import-queue sim-caravanas-queue">
                <div className="stock-import-queue-head">
                  <h4>Dispositivos vinculados</h4>
                  <span className="muted">{seleccionadas.length}</span>
                </div>
                <ul className="stock-import-numero-lista sim-caravanas-numero-lista">
                  {seleccionadas.map((d) => (
                    <li key={d.clave} className="stock-import-numero-item">
                      <div className="stock-import-numero-item-body">
                        <span className="stock-import-numero-valor num">
                          {etiquetaCaravana(d)}
                        </span>
                        <span className="muted sim-caravanas-item-clave">Clave {d.clave}</span>
                      </div>
                      {puedeGuardar && (
                        <button
                          type="button"
                          className="stock-import-queue-remove"
                          onClick={() => quitar(d.clave)}
                          disabled={saving}
                          aria-label={`Quitar ${etiquetaCaravana(d)}`}
                        >
                          ×
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>

        <footer className="sim-caravanas-foot subseccion-inline-foot">
          <button type="button" className="btn btn-ghost" onClick={onVolver} disabled={saving}>
            {puedeGuardar ? "Cancelar" : "Volver"}
          </button>
          {puedeGuardar && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleSave()}
              disabled={
                saving ||
                loading ||
                !apiOnline ||
                (cabObjetivo != null && seleccionadas.length > cabObjetivo)
              }
            >
              {saving ? "Guardando…" : "Guardar dispositivos"}
            </button>
          )}
        </footer>
        </div>
      </div>
    </div>
  );
}

/** @deprecated Usar SimuladorVentaCaravanasPanel */
export { SimuladorVentaCaravanasPanel as SimuladorVentaCaravanasModal };
