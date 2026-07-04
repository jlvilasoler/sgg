import { useCallback, useEffect, useState } from "react";
import { fetchStockGanaderoResumen } from "../../api";
import { useHeaderBackStep } from "../../header-back";
import type { AuthUser } from "../../types";
import StockGanadera from "./StockGanadera";
import StockGanaderaSalidas from "./StockGanaderaSalidas";
import StockGanaderoHistorial from "./StockGanaderoHistorial";
import StockGanaderoImportar from "./StockGanaderoImportar";
import StockGanaderoImportarBaja from "./StockGanaderoImportarBaja";
import StockGanaderoListado from "./StockGanaderoListado";
import StockGanaderoCabanaSeleccion from "./StockGanaderoCabanaSeleccion";
import StockGanaderoSanidad from "./StockGanaderoSanidad";
import StockGanaderoHub, { type StockGanaderoHubItem } from "./StockGanaderoHub";

type VistaStock =
  | "menu"
  | "importar"
  | "importar_baja"
  | "listado"
  | "historial"
  | "ganadera"
  | "salidas"
  | "cabana"
  | "sanidad";

interface Props {
  apiOnline: boolean;
  currentUser?: AuthUser | null;
  onError: (msg: string) => void;
  onSuccess: (msg: string, title?: string) => void;
  onVolver: () => void;
}

const SUBMENU: StockGanaderoHubItem[] = [
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
  {
    id: "cabana",
    label: "Selección Animales de Cabaña",
    subtitle: "Marcar animales del stock con nombre de selección",
    icon: "stock_cabana",
  },
  {
    id: "sanidad",
    label: "Sanidad",
    subtitle: "Controles sanitarios por grupos, categorías o selección múltiple",
    icon: "stock_sanidad",
  },
];

export default function StockGanadero({
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
        currentUser={currentUser}
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
      <StockGanaderaSalidas
        apiOnline={apiOnline}
        refreshKey={listRefresh}
        onError={onError}
        onVolver={volverMenu}
      />
    );
  }

  if (vista === "cabana") {
    return (
      <StockGanaderoCabanaSeleccion
        apiOnline={apiOnline}
        currentUser={currentUser}
        onError={onError}
        onSuccess={onSuccess}
        onVolver={volverMenu}
      />
    );
  }

  if (vista === "sanidad") {
    return (
      <StockGanaderoSanidad
        apiOnline={apiOnline}
        currentUser={currentUser}
        onError={onError}
        onSuccess={onSuccess}
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
    <div className="stock-ganadero-hub-page">
      <StockGanaderoHub
        apiOnline={apiOnline}
        resumen={resumen}
        items={SUBMENU}
        onNavigate={(id) => setVista(id as Exclude<VistaStock, "menu" | "historial">)}
        onVolverInicio={onVolver}
      />
    </div>
  );
}
