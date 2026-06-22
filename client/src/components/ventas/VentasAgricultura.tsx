import { useMemo, useState } from "react";
import { fmtNum } from "../../utils";
import {
  CULTIVOS_AGRICULTURA,
  EMPRESAS_AGRICULTURA,
  MESES_AGRICULTURA,
  ANIOS_AGRICULTURA,
  calcularImporteAgricultura,
  calcularTotalProduccionAgricultura,
  formatRendimientoAgricultura,
  formatTotalProduccionAgricultura,
  parsePositiveDecimal,
  type CultivoAgriculturaId,
  type EmpresaAgricultura,
  type MesAgricultura,
} from "./ventas-agricultura-utils";

interface Props {
  onVolver: () => void;
}

export default function VentasAgricultura({ onVolver }: Props) {
  const [empresa, setEmpresa] = useState<EmpresaAgricultura>("");
  const [mes, setMes] = useState<MesAgricultura>("");
  const [anio, setAnio] = useState<number | "">("");
  const [hectareas, setHectareas] = useState("");
  const [cultivo, setCultivo] = useState<CultivoAgriculturaId>("SOJA");
  const [rendimiento, setRendimiento] = useState("");
  const [precio, setPrecio] = useState("");

  const hasNum = useMemo(() => parsePositiveDecimal(hectareas), [hectareas]);
  const rendimientoNum = useMemo(() => parsePositiveDecimal(rendimiento), [rendimiento]);
  const precioNum = useMemo(() => parsePositiveDecimal(precio), [precio]);

  const totalProduccion = useMemo(
    () => calcularTotalProduccionAgricultura(hasNum, rendimientoNum),
    [hasNum, rendimientoNum]
  );

  const importeTotal = useMemo(
    () => calcularImporteAgricultura(totalProduccion, precioNum),
    [totalProduccion, precioNum]
  );

  const limpiar = () => {
    setEmpresa("");
    setMes("");
    setAnio("");
    setHectareas("");
    setCultivo("SOJA");
    setRendimiento("");
    setPrecio("");
  };

  return (
    <div className="subseccion-panel">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver a Ingresos por ventas
      </button>

      <form
        className="card form-card ventas-agricultura-card"
        onSubmit={(e) => e.preventDefault()}
      >
        <div className="form-header">
          <h2>Ventas agricultura</h2>
          <p className="muted">
            Simulá la producción y el ingreso por cultivo. Total: <strong>Has × Rendimiento</strong>.
            Importe estimado: <strong>Total × Precio ÷ 1000</strong>.
          </p>
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="va-empresa">Empresa</label>
            <select
              id="va-empresa"
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value as EmpresaAgricultura)}
            >
              <option value="">Seleccionar...</option>
              {EMPRESAS_AGRICULTURA.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="va-mes">Mes</label>
            <select
              id="va-mes"
              value={mes === "" ? "" : String(mes)}
              onChange={(e) => {
                const v = e.target.value;
                setMes(v === "" ? "" : (Number(v) as MesAgricultura));
              }}
            >
              <option value="">Seleccionar...</option>
              {MESES_AGRICULTURA.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="va-anio">Año</label>
            <select
              id="va-anio"
              value={anio === "" ? "" : String(anio)}
              onChange={(e) => {
                const v = e.target.value;
                setAnio(v === "" ? "" : Number(v));
              }}
            >
              <option value="">Seleccionar...</option>
              {ANIOS_AGRICULTURA.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="va-has">Cantidad de has</label>
            <input
              id="va-has"
              type="number"
              min="0"
              step="0.01"
              placeholder="Ej: 120"
              value={hectareas}
              onChange={(e) => setHectareas(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="va-cultivo">Tipo de cultivo</label>
            <select
              id="va-cultivo"
              value={cultivo}
              onChange={(e) => setCultivo(e.target.value as CultivoAgriculturaId)}
            >
              {CULTIVOS_AGRICULTURA.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="va-rendimiento">Rendimiento (ton/ha)</label>
            <input
              id="va-rendimiento"
              type="number"
              min="0"
              step="0.01"
              placeholder="Ej: 650"
              value={rendimiento}
              onChange={(e) => setRendimiento(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="va-precio">Precio del cultivo (USD/ton)</label>
            <input
              id="va-precio"
              type="number"
              min="0"
              step="0.01"
              placeholder="Ej: 401"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="va-total-prod">Total (ton)</label>
            <input
              id="va-total-prod"
              type="text"
              readOnly
              data-sin-mayusculas="true"
              className="input-readonly ventas-agricultura-total"
              value={
                totalProduccion != null ? formatTotalProduccionAgricultura(totalProduccion) : ""
              }
              placeholder="Has × Rendimiento"
              aria-readonly="true"
            />
          </div>
        </div>

        <div className="ventas-agricultura-resumen" aria-live="polite">
          <div className="ventas-agricultura-resumen-item">
            <span className="ventas-agricultura-resumen-label">Cálculo</span>
            <strong>
              {hasNum != null && rendimientoNum != null
                ? `${fmtNum(hasNum, 2)} ha × ${formatRendimientoAgricultura(rendimientoNum)}`
                : "Completá has y rendimiento"}
            </strong>
          </div>
          <div className="ventas-agricultura-resumen-item ventas-agricultura-resumen-item--hero">
            <span className="ventas-agricultura-resumen-label">Total producción</span>
            <strong>
              {totalProduccion != null ? formatTotalProduccionAgricultura(totalProduccion) : "—"}
            </strong>
          </div>
          <div className="ventas-agricultura-resumen-item">
            <span className="ventas-agricultura-resumen-label">Importe estimado</span>
            <strong>
              {importeTotal != null ? `USD ${fmtNum(importeTotal, 2)}` : "—"}
            </strong>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={limpiar}>
            Limpiar
          </button>
        </div>
      </form>
    </div>
  );
}
