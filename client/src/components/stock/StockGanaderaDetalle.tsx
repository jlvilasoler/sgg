import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchStockGanaderaDispositivo } from "../../api";
import { useHeaderBackStep } from "../../header-back";
import type { StockGanaderaDispositivoDetalle } from "../../types";
import { fmtDate } from "../../utils";
import TablePagination, {
  paginateSlice,
  type PageSize,
} from "../TablePagination";
import BadgeEstadoDispositivo from "./BadgeEstadoDispositivo";
import IconoDispositivoWifi from "./IconoDispositivoWifi";
import StockGanaderaHistorialCambiosPanel from "./StockGanaderaHistorialCambiosPanel";
import { fmtEdadMeses, fmtNacimiento } from "./stock-ganadera-utils";
import { PageModuleHeadRow } from "../PageModuleHead";

interface Props {
  clave: string;
  apiOnline: boolean;
  onError: (msg: string) => void;
  onVolver: () => void;
}

function Campo({
  label,
  value,
  mono,
  children,
  full,
}: {
  label: string;
  value?: string | number | null;
  mono?: boolean;
  children?: ReactNode;
  full?: boolean;
}) {
  const texto =
    value === null || value === undefined
      ? ""
      : typeof value === "number"
        ? String(value)
        : value.trim();
  const vacio = !texto && !children;

  return (
    <div
      className={`stock-ganadera-detalle-campo${full ? " stock-ganadera-detalle-campo--full" : ""}`}
    >
      <span className="stock-ganadera-detalle-label">{label}</span>
      {children ?? (
        <span
          className={`stock-ganadera-detalle-valor${mono ? " num" : ""}${
            vacio ? " stock-ganadera-detalle-valor--vacio" : ""
          }`}
        >
          {vacio ? "—" : texto}
        </span>
      )}
    </div>
  );
}

function fmtSexo(sexo: StockGanaderaDispositivoDetalle["sexo"]): string {
  if (sexo === "MACHO") return "Macho";
  if (sexo === "HEMBRA") return "Hembra";
  return "";
}

export default function StockGanaderaDetalle({
  clave,
  apiOnline,
  onError,
  onVolver,
}: Props) {
  const [detalle, setDetalle] = useState<StockGanaderaDispositivoDetalle | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(20);
  const [verHistorialCambios, setVerHistorialCambios] = useState(false);

  const load = useCallback(async () => {
    if (!apiOnline) {
      setDetalle(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchStockGanaderaDispositivo(clave);
      setDetalle(data);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar");
      setDetalle(null);
    } finally {
      setLoading(false);
    }
  }, [apiOnline, clave, onError]);

  useEffect(() => {
    load();
  }, [load]);

  const lecturas = detalle?.lecturas ?? [];
  const totalPages = Math.max(1, Math.ceil(lecturas.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const lecturasPagina = useMemo(
    () => paginateSlice(lecturas, pageSafe, pageSize),
    [lecturas, pageSafe, pageSize]
  );

  useHeaderBackStep(!verHistorialCambios, onVolver, "Stock Ganadero");

  if (verHistorialCambios && detalle) {
    return (
      <StockGanaderaHistorialCambiosPanel
        clave={detalle.clave}
        vid={detalle.vid}
        eid={detalle.eid}
        apiOnline={apiOnline}
        onVolver={() => setVerHistorialCambios(false)}
        volverLabel="Volver al detalle"
        onError={onError}
      />
    );
  }

  return (
    <div className="subseccion-panel">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver al listado de dispositivos
      </button>

      <div className="card stock-ganadera-detalle-page">
        <div className="form-header stock-ganadera-detalle-page-head">
          <PageModuleHeadRow
            icon={{ source: "hub", id: "stock_dispositivos" }}
            title="Detalle del dispositivo"
            subtitle={
              loading
                ? "Cargando…"
                : detalle
                  ? "Ficha completa, lecturas importadas e historial de cambios."
                  : "Dispositivo no encontrado"
            }
          />
        </div>

        {loading ? (
          <p className="empty stock-ganadera-detalle-empty">Cargando detalle…</p>
        ) : !detalle ? (
          <p className="empty stock-ganadera-detalle-empty">No se encontró el dispositivo.</p>
        ) : (
          <>
            <div className="stock-ganadera-detalle-hero">
              <div className="stock-ganadera-detalle-hero-main">
                <span className="stock-ganadera-detalle-hero-icon" aria-hidden>
                  <IconoDispositivoWifi className="stock-ganadera-detalle-wifi-icon" />
                </span>
                <div className="stock-ganadera-detalle-hero-text">
                  <span className="stock-ganadera-detalle-hero-kicker">
                    Caravana electrónica
                  </span>
                  <div className="stock-ganadera-detalle-hero-ids">
                    <span className="stock-ganadera-detalle-hero-badge num">
                      EID {detalle.eid}
                    </span>
                    {detalle.vid ? (
                      <span className="stock-ganadera-detalle-hero-badge stock-ganadera-detalle-hero-badge--vid num">
                        {detalle.vid}
                      </span>
                    ) : null}
                  </div>
                  <div className="stock-ganadera-detalle-hero-meta">
                    <BadgeEstadoDispositivo estado={detalle.estado} />
                    <span className="stock-ganadera-detalle-hero-stat num">
                      {detalle.total_lecturas} lectura
                      {detalle.total_lecturas === 1 ? "" : "s"}
                    </span>
                    <span className="stock-ganadera-detalle-hero-stat num">
                      {detalle.lotes_distintos} importación
                      {detalle.lotes_distintos === 1 ? "" : "es"}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setVerHistorialCambios(true)}
              >
                Historial de cambios
              </button>
            </div>

            <div className="stock-ganadera-detalle-body">
              <section className="stock-ganadera-detalle-block" aria-label="Identificación">
                <h3 className="stock-ganadera-detalle-block-title">Identificación</h3>
                <div className="stock-ganadera-detalle-fields stock-ganadera-detalle-fields--4">
                  <Campo label="EID" value={detalle.eid} mono />
                  <Campo label="VID" value={detalle.vid} mono />
                  <Campo label="Clave" value={detalle.clave} mono />
                  <Campo label="Estado">
                    <BadgeEstadoDispositivo estado={detalle.estado} />
                  </Campo>
                </div>
              </section>

              <section className="stock-ganadera-detalle-block" aria-label="Ficha del animal">
                <h3 className="stock-ganadera-detalle-block-title">Ficha del animal</h3>
                <div className="stock-ganadera-detalle-fields stock-ganadera-detalle-fields--3">
                  <Campo label="Empresa" value={detalle.empresa} />
                  <Campo label="Generación" value={detalle.grupo} />
                  <Campo label="Grupo" value={detalle.grupo_libre} />
                  <Campo label="Sexo" value={fmtSexo(detalle.sexo)} />
                  <Campo
                    label="Edad"
                    value={fmtEdadMeses(detalle.nacimiento_mes, detalle.nacimiento_anio)}
                  />
                  <Campo
                    label="Fecha de nacimiento"
                    value={fmtNacimiento(detalle.nacimiento_mes, detalle.nacimiento_anio)}
                  />
                </div>
                {detalle.observaciones?.trim() ? (
                  <div className="stock-ganadera-detalle-obs">
                    <span className="stock-ganadera-detalle-label">Observaciones</span>
                    <p className="stock-ganadera-detalle-obs-texto">
                      {detalle.observaciones.trim()}
                    </p>
                  </div>
                ) : null}
              </section>

              <section className="stock-ganadera-detalle-block" aria-label="Lecturas">
                <h3 className="stock-ganadera-detalle-block-title">Resumen de lecturas</h3>
                <div className="stock-ganadera-detalle-fields stock-ganadera-detalle-fields--4">
                  <Campo label="Total lecturas" value={detalle.total_lecturas} mono />
                  <Campo label="Primera lectura" value={fmtDate(detalle.primera_fecha)} />
                  <Campo
                    label="Última lectura"
                    value={`${fmtDate(detalle.ultima_fecha)}${
                      detalle.ultima_hora ? ` ${detalle.ultima_hora}` : ""
                    }`}
                  />
                  <Campo label="Última condición" value={detalle.ultima_condicion} />
                </div>
              </section>

              <section
                className="stock-ganadera-detalle-block stock-ganadera-detalle-block--table"
                aria-label="Historial de lecturas"
              >
                <div className="stock-ganadera-detalle-block-head">
                  <h3 className="stock-ganadera-detalle-block-title">Historial de lecturas</h3>
                  <span className="stock-ganadera-detalle-table-count muted">
                    {lecturas.length} registro{lecturas.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="table-wrap table-wrap-stock-pro stock-ganadera-detalle-table-wrap">
                  <table className="data-table stock-ganadera-detalle-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Hora</th>
                        <th>Condición</th>
                        <th>Archivo importado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lecturas.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="empty">
                            Sin lecturas registradas
                          </td>
                        </tr>
                      ) : (
                        lecturasPagina.map((l) => (
                          <tr key={l.id}>
                            <td>{fmtDate(l.fecha)}</td>
                            <td className="num">{l.hora || "—"}</td>
                            <td>{l.condicion || "—"}</td>
                            <td className="stock-ganadera-detalle-archivo">
                              {l.nombre_archivo}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {lecturas.length > 0 && (
                  <TablePagination
                    total={lecturas.length}
                    page={pageSafe}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={(size) => {
                      setPageSize(size);
                      setPage(1);
                    }}
                  />
                )}
              </section>
            </div>
          </>
        )}

        <footer className="subseccion-inline-foot stock-ganadera-detalle-foot">
          <button type="button" className="btn btn-ghost" onClick={onVolver}>
            Volver
          </button>
        </footer>
      </div>
    </div>
  );
}
