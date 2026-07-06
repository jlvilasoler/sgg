import { useCallback, useEffect, useMemo, useState } from "react";
import { Cpu, X } from "lucide-react";
import {
  fetchEmpresasOperativasStock,
  fetchStockEquinaDispositivos,
  fetchStockGanaderaDispositivos,
  type EmpresaOperativaStock,
} from "../../api";
import type { StockGanaderaDispositivo } from "../../types";
import { etiquetaCaravana } from "../stock/stock-ganadera-utils";
import CampoMapaDispositivosPicker, {
  CampoMapaDispositivoEmpresaMeta,
} from "./CampoMapaDispositivosPicker";
import type { CampoMapaDispositivosMetadata } from "./campo-mapa-metadata";

interface Props {
  open: boolean;
  apiOnline: boolean;
  puedeEditar: boolean;
  nombre: string;
  subtitulo?: string;
  dispositivos: CampoMapaDispositivosMetadata;
  onChange: (next: CampoMapaDispositivosMetadata) => void;
  onClose: () => void;
  onSave: () => void | Promise<void>;
  saving?: boolean;
  potreroNombre?: string;
}

function deviceChipLabel(d: StockGanaderaDispositivo): string {
  return etiquetaCaravana(d);
}

export default function CampoMapaDispositivosModal({
  open,
  apiOnline,
  puedeEditar,
  nombre,
  subtitulo,
  dispositivos,
  onChange,
  onClose,
  onSave,
  saving = false,
  potreroNombre,
}: Props) {
  const [ganadero, setGanadero] = useState<StockGanaderaDispositivo[]>([]);
  const [equino, setEquino] = useState<StockGanaderaDispositivo[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaOperativaStock[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!apiOnline) {
      setGanadero([]);
      setEquino([]);
      setEmpresas([]);
      return;
    }
    setLoading(true);
    try {
      const [g, e, emp] = await Promise.all([
        fetchStockGanaderaDispositivos({}),
        fetchStockEquinaDispositivos({}),
        fetchEmpresasOperativasStock(),
      ]);
      setGanadero(g);
      setEquino(e);
      setEmpresas(emp);
    } catch {
      setGanadero([]);
      setEquino([]);
      setEmpresas([]);
    } finally {
      setLoading(false);
    }
  }, [apiOnline]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [load, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, open, saving]);

  const asignadosGanadero = useMemo(
    () => ganadero.filter((d) => dispositivos.dispositivos_ganadero.includes(d.clave)),
    [dispositivos.dispositivos_ganadero, ganadero],
  );

  const asignadosEquino = useMemo(
    () => equino.filter((d) => dispositivos.dispositivos_equino.includes(d.clave)),
    [dispositivos.dispositivos_equino, equino],
  );

  const totalAsignados = asignadosGanadero.length + asignadosEquino.length;

  if (!open) return null;

  const handleClose = () => {
    if (saving) return;
    onClose();
  };

  return (
    <div
      className="campo-mapa-dispositivos-modal-overlay"
      role="presentation"
      onClick={handleClose}
    >
      <div
        className="campo-mapa-dispositivos-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="campo-mapa-dispositivos-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="campo-mapa-dispositivos-modal-head">
          <div className="campo-mapa-dispositivos-modal-head-main">
            <p className="campo-mapa-dispositivos-modal-kicker">Dispositivos en el mapa</p>
            <h2 id="campo-mapa-dispositivos-modal-title">{nombre}</h2>
            {subtitulo ? <p className="campo-mapa-dispositivos-modal-sub">{subtitulo}</p> : null}
          </div>
          <button
            type="button"
            className="campo-mapa-dispositivos-modal-close"
            onClick={handleClose}
            disabled={saving}
            aria-label="Cerrar"
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="campo-mapa-dispositivos-modal-body">
          <section className="campo-mapa-dispositivos-modal-resumen">
            <div className="campo-mapa-dispositivos-modal-resumen-head">
              <Cpu size={16} aria-hidden />
              <span>En este lugar</span>
              <strong>{totalAsignados}</strong>
            </div>
            {loading ? (
              <p className="campo-mapa-dispositivos-modal-hint">Cargando dispositivos…</p>
            ) : null}
            {!loading && !apiOnline ? (
              <p className="campo-mapa-dispositivos-modal-hint">Sin conexión API.</p>
            ) : null}
            {!loading && apiOnline && totalAsignados === 0 ? (
              <p className="campo-mapa-dispositivos-modal-hint">
                Todavía no hay dispositivos asignados a este lugar.
              </p>
            ) : null}
            {!loading && totalAsignados > 0 ? (
              <div className="campo-mapa-dispositivos-modal-chips">
                {asignadosGanadero.map((d) => (
                  <span key={`g-${d.clave}`} className="campo-mapa-dispositivos-modal-chip">
                    <span className="campo-mapa-dispositivos-modal-chip-kind">Ganadero</span>
                    <span className="campo-mapa-dispositivos-modal-chip-body">
                      <span className="campo-mapa-dispositivos-modal-chip-num">
                        {deviceChipLabel(d)}
                      </span>
                      <CampoMapaDispositivoEmpresaMeta d={d} empresas={empresas} />
                    </span>
                  </span>
                ))}
                {asignadosEquino.map((d) => (
                  <span key={`e-${d.clave}`} className="campo-mapa-dispositivos-modal-chip">
                    <span className="campo-mapa-dispositivos-modal-chip-kind">Equino</span>
                    <span className="campo-mapa-dispositivos-modal-chip-body">
                      <span className="campo-mapa-dispositivos-modal-chip-num">
                        {deviceChipLabel(d)}
                      </span>
                      <CampoMapaDispositivoEmpresaMeta d={d} empresas={empresas} />
                    </span>
                  </span>
                ))}
              </div>
            ) : null}
          </section>

          {puedeEditar ? (
            <CampoMapaDispositivosPicker
              apiOnline={apiOnline}
              value={dispositivos}
              onChange={onChange}
              disabled={saving}
              potreroNombre={potreroNombre}
            />
          ) : (
            <p className="campo-mapa-dispositivos-modal-hint">
              Solo lectura: no tenés permisos para editar el mapa.
            </p>
          )}
        </div>

        <footer className="campo-mapa-dispositivos-modal-foot">
          <button
            type="button"
            className="campo-mapa-dispositivos-modal-btn"
            onClick={handleClose}
            disabled={saving}
          >
            Cerrar
          </button>
          {puedeEditar ? (
            <button
              type="button"
              className="campo-mapa-dispositivos-modal-btn campo-mapa-dispositivos-modal-btn--primary"
              onClick={() => void onSave()}
              disabled={saving || !apiOnline}
            >
              {saving ? "Guardando…" : "Guardar asignación"}
            </button>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
