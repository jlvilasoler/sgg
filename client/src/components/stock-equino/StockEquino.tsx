import { useCallback, useEffect, useState } from "react";
import { fetchStockEquinoResumen } from "../../api";
import { useHeaderBackStep } from "../../header-back";
import type { AuthUser } from "../../types";
import { HubMenuCard } from "../HubMenuCard";
import type { HubIconId } from "../icons/HubMenuIcons";
import { HUB_ICON_THEMES, HubMenuIcon } from "../icons/HubMenuIcons";
import StockEquina from "./StockEquina";
import StockEquinaSalidas from "./StockEquinaSalidas";
import StockEquinoHistorial from "./StockEquinoHistorial";
import StockEquinoImportar from "./StockEquinoImportar";
import StockEquinoImportarBaja from "./StockEquinoImportarBaja";
import StockEquinoListado from "./StockEquinoListado";
import { clearStockEquinaPageCache } from "./stock-equina-page-cache";
import UnderConstructionModal from "../UnderConstructionModal";

/** Desactivar cuando el módulo esté listo para producción. */
const STOCK_EQUINO_EN_CONSTRUCCION = true;

type VistaStock =
  | "menu"
  | "importar"
  | "importar_baja"
  | "listado"
  | "historial"
  | "equina"
  | "salidas";

interface Props {
  apiOnline: boolean;
  currentUser?: AuthUser | null;
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
    id: "equina",
    label: "Stock Equino",
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

export default function StockEquino(props: Props) {
  if (STOCK_EQUINO_EN_CONSTRUCCION) {
    return (
      <UnderConstructionModal sectionName="Stock Equino" onClose={props.onVolver} />
    );
  }
  return <StockEquinoPanel {...props} />;
}

function StockEquinoPanel({
  apiOnline,
  currentUser,
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
    fetchStockEquinoResumen()
      .then(setResumen)
      .catch(() => setResumen({ lotes: 0, registros: 0, dispositivos: 0 }));
  }, [apiOnline, listRefresh]);

  const volverMenu = useCallback(() => setVista("menu"), []);
  useHeaderBackStep(vista !== "menu", volverMenu, "Stock Equino");

  if (vista === "importar") {
    return (
      <StockEquinoImportar
        apiOnline={apiOnline}
        currentUser={currentUser}
        onImported={() => {
          clearStockEquinaPageCache();
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
      <StockEquinoImportarBaja
        apiOnline={apiOnline}
        onImported={() => {
          clearStockEquinaPageCache();
          setListRefresh((k) => k + 1);
          setVista("equina");
        }}
        onError={onError}
        onSuccess={onSuccess}
        onVolver={volverMenu}
      />
    );
  }

  if (vista === "historial") {
    return (
      <StockEquinoHistorial
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

  if (vista === "equina") {
    return (
      <StockEquina
        apiOnline={apiOnline}
        currentUser={currentUser}
        refreshKey={listRefresh}
        onError={onError}
        onSuccess={onSuccess}
        onVolver={volverMenu}
      />
    );
  }

  if (vista === "salidas") {
    return (
      <StockEquinaSalidas
        apiOnline={apiOnline}
        refreshKey={listRefresh}
        onError={onError}
        onVolver={volverMenu}
      />
    );
  }

  if (vista === "listado") {
    return (
      <StockEquinoListado
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
          <h2>Stock Equino</h2>
          <p className="muted">
            Importá lecturas electrónicas (EID) desde archivos .txt del lector.
            {apiOnline && resumen.registros > 0 && (
              <>
                {" "}
                Actualmente: <strong>{resumen.dispositivos}</strong> dispositivo(s) activo(s),{" "}
                <strong>{resumen.registros}</strong> lectura(s) en{" "}
                <strong>{resumen.lotes}</strong> importación(es).
              </>
            )}
          </p>
        </div>
        <nav className="app-grid" aria-label="Stock Equino">
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
