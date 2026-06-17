import { useEffect, useState } from "react";
import { fetchStockGanaderoResumen } from "../../api";
import StockGanadera from "./StockGanadera";
import StockGanaderaSalidas from "./StockGanaderaSalidas";
import StockGanaderoHistorial from "./StockGanaderoHistorial";
import StockGanaderoImportar from "./StockGanaderoImportar";
import StockGanaderoBajaManual from "./StockGanaderoBajaManual";
import StockGanaderoImportarBaja from "./StockGanaderoImportarBaja";
import StockGanaderoListado from "./StockGanaderoListado";

type VistaStock =
  | "menu"
  | "bajas"
  | "importar"
  | "importar_baja"
  | "baja_manual"
  | "listado"
  | "historial"
  | "ganadera"
  | "salidas";

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string, title?: string) => void;
  onVolver: () => void;
}

const SUBMENU = [
  {
    id: "importar" as const,
    label: "Importar archivo TXT",
    subtitle: "Lecturas EID del bastón / lector RFID",
    icon: "📥",
    color: "#2d6a4f",
  },
  {
    id: "bajas" as const,
    label: "Bajas de Dispositivos",
    subtitle: "Archivo TXT y baja manual por caravana",
    icon: "📤",
    color: "#b45309",
  },
  {
    id: "listado" as const,
    label: "Lecturas importadas",
    subtitle: "Ver, filtrar y gestionar importaciones",
    icon: "📋",
    color: "#1d4e89",
  },
  {
    id: "ganadera" as const,
    label: "Stock Ganadero",
    subtitle: "Dispositivos EID y detalle de cada caravana",
    icon: "🐄",
    color: "#6b4c9a",
  },
  {
    id: "salidas" as const,
    label: "Salidas del sistema",
    subtitle: "Muertes, ventas y frigorífico registradas",
    icon: "🔻",
    color: "#9f1239",
  },
];

const BAJAS_SUBMENU = [
  {
    id: "importar_baja" as const,
    label: "Dar de baja archivo TXT",
    subtitle: "Venta o frigorífico — importar listado de bajas",
    icon: "📤",
    color: "#b45309",
  },
  {
    id: "baja_manual" as const,
    label: "Dar de baja manual",
    subtitle: "Cambiar estado por número de caravana",
    icon: "✏️",
    color: "#0d9488",
  },
];

export default function StockGanadero({
  apiOnline,
  onError,
  onSuccess,
  onVolver,
}: Props) {
  const [vista, setVista] = useState<VistaStock>("menu");
  const [listRefresh, setListRefresh] = useState(0);
  const [listLoteFilter, setListLoteFilter] = useState("");
  const [resumen, setResumen] = useState({
    lotes: 0,
    registros: 0,
    dispositivos: 0,
  });

  useEffect(() => {
    if (!apiOnline) {
      setResumen({ lotes: 0, registros: 0, dispositivos: 0 });
      return;
    }
    fetchStockGanaderoResumen()
      .then(setResumen)
      .catch(() => setResumen({ lotes: 0, registros: 0, dispositivos: 0 }));
  }, [apiOnline, listRefresh]);

  const volverMenu = () => setVista("menu");
  const volverBajas = () => setVista("bajas");

  if (vista === "importar") {
    return (
      <StockGanaderoImportar
        apiOnline={apiOnline}
        onImported={() => {
          setListRefresh((k) => k + 1);
          setVista("listado");
        }}
        onError={onError}
        onSuccess={onSuccess}
        onVolver={volverMenu}
      />
    );
  }

  if (vista === "importar_baja") {
    return (
      <StockGanaderoImportarBaja
        apiOnline={apiOnline}
        onImported={() => {
          setListRefresh((k) => k + 1);
          setVista("ganadera");
        }}
        onError={onError}
        onSuccess={onSuccess}
        onVolver={volverBajas}
      />
    );
  }

  if (vista === "baja_manual") {
    return (
      <StockGanaderoBajaManual
        apiOnline={apiOnline}
        onSaved={() => setListRefresh((k) => k + 1)}
        onError={onError}
        onSuccess={onSuccess}
        onVolver={volverBajas}
      />
    );
  }

  if (vista === "historial") {
    return (
      <StockGanaderoHistorial
        apiOnline={apiOnline}
        refreshKey={listRefresh}
        onError={onError}
        onSuccess={(m) => {
          onSuccess(m);
          setListRefresh((k) => k + 1);
        }}
        onVolver={() => setVista("listado")}
        onVerLecturas={(loteId) => {
          setListLoteFilter(String(loteId));
          setVista("listado");
        }}
      />
    );
  }

  if (vista === "ganadera") {
    return (
      <StockGanadera
        apiOnline={apiOnline}
        refreshKey={listRefresh}
        onError={onError}
        onSuccess={onSuccess}
        onVolver={volverMenu}
      />
    );
  }

  if (vista === "salidas") {
    return (
      <StockGanaderaSalidas
        apiOnline={apiOnline}
        refreshKey={listRefresh}
        onError={onError}
        onVolver={volverMenu}
      />
    );
  }

  if (vista === "listado") {
    return (
      <StockGanaderoListado
        key={listRefresh}
        apiOnline={apiOnline}
        refreshKey={listRefresh}
        initialLoteId={listLoteFilter}
        onError={onError}
        onSuccess={(m) => onSuccess(m)}
        onVolver={volverMenu}
        onVerHistorial={() => setVista("historial")}
      />
    );
  }

  if (vista === "bajas") {
    return (
      <div className="subseccion-panel configuracion-hub">
        <button type="button" className="subseccion-back" onClick={volverMenu}>
          ‹ Volver a Stock Ganadero
        </button>
        <div className="card configuracion-hub-card">
          <div className="form-header">
            <h2>Bajas de Dispositivos</h2>
            <p className="muted">
              Registrá salidas del stock por archivo TXT del lector o de forma
              manual por número de caravana.
            </p>
          </div>
          <nav className="app-grid app-grid-2" aria-label="Bajas de dispositivos">
            {BAJAS_SUBMENU.map((item) => (
              <button
                key={item.id}
                type="button"
                className="app-card-btn"
                onClick={() => setVista(item.id)}
              >
                <span
                  className="app-card-icon"
                  style={{
                    background: `linear-gradient(145deg, ${item.color}, ${item.color}bb)`,
                  }}
                >
                  <span className="app-icon-emoji" aria-hidden>
                    {item.icon}
                  </span>
                </span>
                <span className="app-card-text">
                  <span className="app-card-label">{item.label}</span>
                  <span className="app-card-sub">{item.subtitle}</span>
                </span>
              </button>
            ))}
          </nav>
        </div>
      </div>
    );
  }

  return (
    <div className="subseccion-panel configuracion-hub">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver al inicio
      </button>
      <div className="card configuracion-hub-card">
        <div className="form-header">
          <h2>Stock Ganadero</h2>
          <p className="muted">
            Importá lecturas electrónicas (EID) desde archivos .txt del lector.
            {apiOnline && resumen.registros > 0 && (
              <>
                {" "}
                Actualmente: <strong>{resumen.dispositivos}</strong> dispositivo(s),{" "}
                <strong>{resumen.registros}</strong> lectura(s) en{" "}
                <strong>{resumen.lotes}</strong> importación(es).
              </>
            )}
          </p>
        </div>
        <nav className="app-grid" aria-label="Stock Ganadero">
          {SUBMENU.map((item) => (
            <button
              key={item.id}
              type="button"
              className="app-card-btn"
              onClick={() => setVista(item.id)}
            >
              <span
                className="app-card-icon"
                style={{
                  background: `linear-gradient(145deg, ${item.color}, ${item.color}bb)`,
                }}
              >
                <span className="app-icon-emoji" aria-hidden>
                  {item.icon}
                </span>
              </span>
              <span className="app-card-text">
                <span className="app-card-label">{item.label}</span>
                <span className="app-card-sub">{item.subtitle}</span>
              </span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
