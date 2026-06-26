import { useEffect, useRef, useState } from "react";
import { fetchTipoCambioParaFecha } from "../api";
import {
  MONEDAS_GASTO,
  aplicarImporteMoneda,
  calcularSaldoUsd,
  etiquetaTc,
  importeDesdeRegistro,
  inferirMonedaDesdeRegistro,
  parDivisaDeMoneda,
  tcDesdeRegistro,
  type MonedaGasto,
} from "../utils/importeMoneda";
import { fmtNum } from "../utils";

type MoneyPatch = ReturnType<typeof aplicarImporteMoneda>;

interface Props {
  fecha: string;
  apiOnline: boolean;
  pesos: number;
  dolares_usd: number;
  reales: number;
  tc_usd: number;
  tc_reales: number;
  saldo_usd: number;
  onMoneyChange: (patch: MoneyPatch) => void;
  /** Cambia al cargar otro registro para editar. */
  syncKey?: number;
}

export default function ImporteMoneda({
  fecha,
  apiOnline,
  pesos,
  dolares_usd,
  reales,
  tc_usd,
  tc_reales,
  saldo_usd,
  onMoneyChange,
  syncKey = 0,
}: Props) {
  const [moneda, setMoneda] = useState<MonedaGasto>("UYU");
  const [importe, setImporte] = useState(0);
  const [tc, setTc] = useState(0);
  const [tcAuto, setTcAuto] = useState(false);
  const [tcFecha, setTcFecha] = useState("");
  const importeRef = useRef(importe);
  importeRef.current = importe;

  useEffect(() => {
    const row = { pesos, dolares_usd, reales, tc_usd, tc_reales };
    const m = inferirMonedaDesdeRegistro(row);
    setMoneda(m);
    setImporte(importeDesdeRegistro(m, row));
    setTc(tcDesdeRegistro(m, row));
    setTcAuto(false);
  }, [syncKey]);

  const push = (m: MonedaGasto, imp: number, tipoCambio: number) => {
    onMoneyChange(aplicarImporteMoneda(m, imp, tipoCambio));
  };

  useEffect(() => {
    if (moneda === "USD") {
      push(moneda, importe, 0);
      return;
    }
    const par = parDivisaDeMoneda(moneda);
    if (!par || !fecha || !apiOnline) return;

    let cancelled = false;
    fetchTipoCambioParaFecha(par, fecha)
      .then((row) => {
        if (cancelled || !row || row.valor <= 0) return;
        setTc(row.valor);
        setTcAuto(true);
        setTcFecha(row.fecha_tc);
        onMoneyChange(aplicarImporteMoneda(moneda, importeRef.current, row.valor));
      })
      .catch(() => {
        if (!cancelled) setTcAuto(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fecha, moneda, apiOnline]);

  useEffect(() => {
    if (moneda === "USD") {
      onMoneyChange(aplicarImporteMoneda("USD", importe, 0));
    }
  }, [moneda, importe, onMoneyChange]);

  const saldo =
    moneda === "USD" ? importe : calcularSaldoUsd(importe, tc > 0 ? tc : 0);

  return (
    <div className="importe-moneda-block">
      <div className="field">
        <span className="label-block">Moneda</span>
        <div className="moneda-selector" role="group" aria-label="Moneda del importe">
          {MONEDAS_GASTO.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`moneda-btn${moneda === m.id ? " is-active" : ""}`}
              onClick={() => {
                setMoneda(m.id);
                setTcAuto(false);
                if (m.id === "USD") {
                  setTc(0);
                  push(m.id, importe, 0);
                } else {
                  const t = m.id === "UYU" ? tc_usd : tc_reales;
                  setTc(t);
                  push(m.id, importe, t);
                }
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field money">
        <label htmlFor="importe-moneda">Importe ({MONEDAS_GASTO.find((m) => m.id === moneda)?.corto})</label>
        <input
          type="number"
          id="importe-moneda"
          step="0.01"
          min={0}
          value={importe || ""}
          onChange={(e) => {
            const imp = Number(e.target.value) || 0;
            setImporte(imp);
            push(moneda, imp, moneda === "USD" ? 0 : tc);
          }}
        />
      </div>

      {moneda !== "USD" && (
        <div className="field">
          <label htmlFor="tc-moneda">{etiquetaTc(moneda)}</label>
          <input
            type="number"
            id="tc-moneda"
            step="0.0001"
            min={0}
            value={tc || ""}
            onChange={(e) => {
              const v = Number(e.target.value) || 0;
              setTc(v);
              setTcAuto(false);
              push(moneda, importe, v);
            }}
          />
          {tcAuto && tcFecha && (
            <p className="hint-muted">
              TC del {tcFecha} (catálogo Divisas). Podés modificarlo.
            </p>
          )}
          {!apiOnline && (
            <p className="hint-muted">Sin API: ingresá el TC manualmente.</p>
          )}
        </div>
      )}

      <div className="field money importe-moneda-usd">
        <label>Equivalente USD</label>
        <output className="importe-usd-output" aria-live="polite">
          {fmtNum(saldo > 0 ? saldo : saldo_usd)} USD
        </output>
        <p className="hint-muted">Siempre convertido a dólares (USD).</p>
      </div>
    </div>
  );
}
