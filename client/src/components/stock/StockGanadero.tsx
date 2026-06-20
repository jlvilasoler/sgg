import { useCallback, useEffect, useState } from "react";
import { fetchStockGanaderoResumen } from "../../api";
import { useHeaderBackStep } from "../../header-back";
import { HubMenuCard } from "../HubMenuCard";
import type { HubIconId } from "../icons/HubMenuIcons";
import { HUB_ICON_THEMES, HubMenuIcon } from "../icons/HubMenuIcons";
import StockGanadera from "./StockGanadera";
import StockGanaderaSalidas from "./StockGanaderaSalidas";
import StockGanaderoHistorial from "./StockGanaderoHistorial";
import StockGanaderoImportar from "./StockGanaderoImportar";
import StockGanaderoImportarBaja from "./StockGanaderoImportarBaja";
import StockGanaderoListado from "./StockGanaderoListado";

type VistaStock =
  | "menu"
  | "importar"
  | "importar_baja"
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

const SUBMENU: {
  id: Exclude<VistaStock, "menu" | "historial">;
  label: string;
  subtitle: string;
  icon: HubIconId;
}[] = [
  {
    id: "importar",
    label: "Alta de Dispositivo",
    subtitle: "Lecturas EID del bastón / lector RFID",
    icon: "stock_alta",
  },
  {
    id: "importar_baja",
    label: "Baja de Dispositivo",
    subtitle: "Archivo TXT o baja manual por caravana",
    icon: "stock_baja",
  },
  {
    id: "listado",
    label: "Lecturas importadas",
    subtitle: "Ver, filtrar y gestionar importaciones",
    icon: "stock_lecturas",
  },
  {
    id: "ganadera",
    label: "Stock Ganadero",
    subtitle: "Dispositivos EID y detalle de cada caravana",
    icon: "stock_dispositivos",
  },
  {
    id: "salidas",
    label: "Salidas del sistema",
    subtitle: "Muertes, ventas y frigorífico registradas",
    icon: "stock_salidas",
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

  const volverMenu = useCallback(() => setVista("menu"), []);
  useHeaderBackStep(vista !== "menu", volverMenu, "Stock Ganadero");

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
        onVolver={volverMenu}
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
            <HubMenuCard
              key={item.id}
              label={item.label}
              subtitle={item.subtitle}
              theme={HUB_ICON_THEMES[item.icon]}
              icon={<HubMenuIcon id={item.icon} />}
              onClick={() => setVista(item.id)}
            />
          ))}
        </nav>
      </div>
    </div>
  );
}
