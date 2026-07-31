import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchStockOvinaDispositivo } from "../../api";
import { useHeaderBackStep } from "../../header-back";
import type { StockOvinaDispositivoDetalle } from "../../types";
import { fmtDate } from "../../utils";
import TablePagination, {
  paginateSlice,
  type PageSize,
} from "../TablePagination";
import BadgeEstadoDispositivo from "../stock/BadgeEstadoDispositivo";
import IconoDispositivoReg from "./IconoDispositivoReg";
import StockOvinaHistorialCambiosPanel from "./StockOvinaHistorialCambiosPanel";
import { fmtEdadMeses, fmtNacimiento, fmtRegOvino } from "./stock-ovina-utils";
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
      className={`stock-ovina-detalle-campo${full ? " stock-ovina-detalle-campo--full" : ""}`}
    >
      <span className="stock-ovina-detalle-label">{label}</span>
      {children ?? (
        <span
          className={`stock-ovina-detalle-valor${mono ? " num" : ""}${
            vacio ? " stock-ovina-detalle-valor--vacio" : ""
          }`}
        >
          {vacio ? "—" : texto}
        </span>
      )}
    </div>
  );
}

function fmtSexo(sexo: StockOvinaDispositivoDetalle["sexo"]): string {
  if (sexo === "MACHO") return "Macho";
  if (sexo === "HEMBRA") return "Hembra";
  return "";
}

export default function StockOvinaDetalle({
  clave,
  apiOnline,
  onError,
  onVolver,
}: Props) {
  const [detalle, setDetalle] = useState<StockOvinaDispositivoDetalle | null>(
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
      const data = await fetchStockOvinaDispositivo(clave);
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

  useHeaderBackStep(!verHistorialCambios, onVolver, "Stock Ovino");

  if (verHistorialCambios && detalle) {
    return (
      <StockOvinaHistorialCambiosPanel
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

      <div className="card stock-ovina-detalle-page">
        <div className="form-header stock-ovina-detalle-page-head">
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
          <p className="empty stock-ovina-detalle-empty">Cargando detalle…</p>
        ) : !detalle ? (
          <p className="empty stock-ovina-detalle-empty">No se encontró el dispositivo.</p>
        ) : (
          <>
            <div className="stock-ovina-detalle-hero">
              <div className="stock-ovina-detalle-hero-main">
                <span className="stock-ovina-detalle-hero-icon" aria-hidden>
                  <IconoDispositivoReg className="stock-ovina-detalle-wifi-icon" />
                </span>
                <div className="stock-ovina-detalle-hero-text">
                  <span className="stock-ovina-detalle-hero-kicker">
                    Caravana electrónica
                  </span>
                  <div className="stock-ovina-detalle-hero-ids">
                    <span className="stock-ovina-detalle-hero-badge num">
                      REG {fmtRegOvino(detalle.eid, detalle.vid) || "—"}
                    </span>
                  </div>
                  <div className="stock-ovina-detalle-hero-meta">
                    <BadgeEstadoDispositivo estado={detalle.estado} />
                    <span className="stock-ovina-detalle-hero-stat num">
                      {detalle.total_lecturas} lectura
                      {detalle.total_lecturas === 1 ? "" : "s"}
                    </span>
                    <span className="stock-ovina-detalle-hero-stat num">
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

            <div className="stock-ovina-detalle-body">
              <section className="stock-ovina-detalle-block" aria-label="Identificación">
                <h3 className="stock-ovina-detalle-block-title">Identificación</h3>
                <div className="stock-ovina-detalle-fields stock-ovina-detalle-fields--3">
                  <Campo
                    label="REG"
                    value={fmtRegOvino(detalle.eid, detalle.vid)}
                    mono
                  />
                  <Campo label="Clave" value={detalle.clave} mono />
                  <Campo label="Estado">
                    <BadgeEstadoDispositivo estado={detalle.estado} />
                  </Campo>
                </div>
              </section>

              <section className="stock-ovina-detalle-block" aria-label="Ficha del animal">
                <h3 className="stock-ovina-detalle-block-title">Ficha del animal</h3>
                <div className="stock-ovina-detalle-fields stock-ovina-detalle-fields--3">
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
                  <div className="stock-ovina-detalle-obs">
                    <span className="stock-ovina-detalle-label">Observaciones</span>
                    <p className="stock-ovina-detalle-obs-texto">
                      {detalle.observaciones.trim()}
                    </p>
                  </div>
                ) : null}
              </section>

              <section className="stock-ovina-detalle-block" aria-label="Lecturas">
                <h3 className="stock-ovina-detalle-block-title">Resumen de lecturas</h3>
                <div className="stock-ovina-detalle-fields stock-ovina-detalle-fields--4">
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
                className="stock-ovina-detalle-block stock-ovina-detalle-block--table"
                aria-label="Historial de lecturas"
              >
                <div className="stock-ovina-detalle-block-head">
                  <h3 className="stock-ovina-detalle-block-title">Historial de lecturas</h3>
                  <span className="stock-ovina-detalle-table-count muted">
                    {lecturas.length} registro{lecturas.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="table-wrap table-wrap-stock-pro stock-ovina-detalle-table-wrap">
                  <table className="data-table stock-ovina-detalle-table">
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
                            <td className="stock-ovina-detalle-archivo">
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

        <footer className="subseccion-inline-foot stock-ovina-detalle-foot">
          <button type="button" className="btn btn-ghost" onClick={onVolver}>
            Volver
          </button>
        </footer>
      </div>
    </div>
  );
}
