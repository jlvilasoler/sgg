import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchStockEquinaDispositivos, fetchStockGanaderaDispositivos } from "../../api";
import type { StockGanaderaDispositivo } from "../../types";
import { etiquetaCaravana } from "../stock/stock-ganadera-utils";
import type { CampoMapaDispositivosMetadata } from "./campo-mapa-metadata";

interface Props {
  apiOnline: boolean;
  value: CampoMapaDispositivosMetadata;
  onChange: (next: CampoMapaDispositivosMetadata) => void;
  disabled?: boolean;
  potreroNombre?: string;
}

function deviceLabel(d: StockGanaderaDispositivo): string {
  const numero = etiquetaCaravana(d);
  const potrero = d.potrero?.trim();
  return potrero ? `${numero} · ${potrero}` : numero;
}

export default function CampoMapaDispositivosPicker({
  apiOnline,
  value,
  onChange,
  disabled = false,
  potreroNombre,
}: Props) {
  const [ganadero, setGanadero] = useState<StockGanaderaDispositivo[]>([]);
  const [equino, setEquino] = useState<StockGanaderaDispositivo[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtro, setFiltro] = useState("");

  const load = useCallback(async () => {
    if (!apiOnline) {
      setGanadero([]);
      setEquino([]);
      return;
    }
    setLoading(true);
    try {
      const [g, e] = await Promise.all([
        fetchStockGanaderaDispositivos({}),
        fetchStockEquinaDispositivos({}),
      ]);
      setGanadero(g.filter((d) => d.estado === "VIVO"));
      setEquino(e.filter((d) => d.estado === "VIVO"));
    } catch {
      setGanadero([]);
      setEquino([]);
    } finally {
      setLoading(false);
    }
  }, [apiOnline]);

  useEffect(() => {
    void load();
  }, [load]);

  const q = filtro.trim().toLowerCase();

  const ganaderoFiltrado = useMemo(() => {
    if (!q) return ganadero.slice(0, 80);
    return ganadero
      .filter((d) => {
        const hay = `${d.clave} ${d.eid} ${d.vid} ${d.potrero}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 80);
  }, [ganadero, q]);

  const equinoFiltrado = useMemo(() => {
    if (!q) return equino.slice(0, 80);
    return equino
      .filter((d) => {
        const hay = `${d.clave} ${d.eid} ${d.vid} ${d.potrero}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 80);
  }, [equino, q]);

  const toggle = (kind: "ganadero" | "equino", clave: string) => {
    const key = kind === "ganadero" ? "dispositivos_ganadero" : "dispositivos_equino";
    const set = new Set(value[key]);
    if (set.has(clave)) set.delete(clave);
    else set.add(clave);
    onChange({ ...value, [key]: [...set] });
  };

  const total = value.dispositivos_ganadero.length + value.dispositivos_equino.length;

  return (
    <div className="campo-mapa-dispositivos-picker">
      <div className="campo-mapa-dispositivos-picker-head">
        <span className="campo-mapa-dispositivos-picker-label">Dispositivos asignados</span>
        <span className="campo-mapa-dispositivos-picker-count">{total} seleccionados</span>
      </div>
      {potreroNombre?.trim() ? (
        <p className="campo-mapa-aside-hint">
          Al guardar, el potrero <strong>{potreroNombre.trim()}</strong> se sincroniza en stock
          ganadero y equino.
        </p>
      ) : (
        <p className="campo-mapa-aside-hint">
          Vinculá animales del stock ganadero y equino a este elemento del mapa.
        </p>
      )}
      <input
        className="campo-mapa-dispositivos-picker-search"
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        placeholder="Buscar EID o potrero…"
        disabled={disabled || !apiOnline}
      />
      {loading ? <p className="campo-mapa-aside-hint">Cargando dispositivos…</p> : null}
      {!loading && !apiOnline ? (
        <p className="campo-mapa-aside-hint">Sin conexión API para listar dispositivos.</p>
      ) : null}

      <div className="campo-mapa-dispositivos-picker-group">
        <p className="campo-mapa-dispositivos-picker-group-title">Stock ganadero</p>
        <ul className="campo-mapa-dispositivos-picker-list">
          {ganaderoFiltrado.map((d) => (
            <li key={`g-${d.clave}`}>
              <label className="campo-mapa-dispositivos-picker-item">
                <input
                  type="checkbox"
                  checked={value.dispositivos_ganadero.includes(d.clave)}
                  onChange={() => toggle("ganadero", d.clave)}
                  disabled={disabled}
                />
                <span>{deviceLabel(d)}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="campo-mapa-dispositivos-picker-group">
        <p className="campo-mapa-dispositivos-picker-group-title">Stock equino</p>
        <ul className="campo-mapa-dispositivos-picker-list">
          {equinoFiltrado.map((d) => (
            <li key={`e-${d.clave}`}>
              <label className="campo-mapa-dispositivos-picker-item">
                <input
                  type="checkbox"
                  checked={value.dispositivos_equino.includes(d.clave)}
                  onChange={() => toggle("equino", d.clave)}
                  disabled={disabled}
                />
                <span>{deviceLabel(d)}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
