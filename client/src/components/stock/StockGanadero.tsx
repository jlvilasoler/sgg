import { useCallback, useEffect, useState, type ReactNode } from "react";
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
import StockGanaderoHubShell from "./StockGanaderoHubShell";

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

export const STOCK_GANADERO_SUBMENU: StockGanaderoHubItem[] = [
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

const MODULE_META: Record<
  Exclude<VistaStock, "menu">,
  { title: string; subtitle: string; navId?: string }
> = {
  importar: {
    title: "Alta de Dispositivo",
    subtitle:
      "Cargá el export del bastón o lector RFID, o ingresá lecturas una a una. Cada registro guarda fecha, hora y condición del animal.",
  },
  importar_baja: {
    title: "Baja de Dispositivo",
    subtitle: "Importá un archivo TXT de bajas o registrá salidas manualmente por caravana.",
  },
  listado: {
    title: "Lecturas importadas",
    subtitle: "Consultá, filtrá y gestioná las importaciones EID de la cuenta.",
  },
  historial: {
    title: "Historial de importaciones",
    subtitle: "Lotes importados, filas procesadas y acciones sobre cada archivo.",
    navId: "listado",
  },
  ganadera: {
    title: "Dispositivos EID",
    subtitle: "Stock activo, filtros por estado y detalle de cada caravana.",
  },
  salidas: {
    title: "Salidas del sistema",
    subtitle: "Muertes, ventas, frigorífico y extraviados fuera del stock activo.",
  },
  cabana: {
    title: "Selección Animales de Cabaña",
    subtitle: "Marcá animales activos con un nombre de identificación para la selección de cabaña.",
  },
  sanidad: {
    title: "Sanidad",
    subtitle: "Seleccioná animales por grupo y registrá el mismo control sanitario en todos a la vez.",
  },
};

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

  const navegarModulo = useCallback((id: string) => {
    setVista(id as Exclude<VistaStock, "menu" | "historial">);
  }, []);

  const wrapModule = useCallback(
    (
      vistaId: Exclude<VistaStock, "menu">,
      content: ReactNode,
      options?: { headerActions?: ReactNode },
    ) => {
      const meta = MODULE_META[vistaId];
      const activeNavId = meta.navId ?? vistaId;
      return (
        <div className="sg-module-page stock-ganadero-module-page">
          <StockGanaderoHubShell
            activeId={activeNavId}
            items={STOCK_GANADERO_SUBMENU}
            onNavigate={navegarModulo}
            onVolverDashboard={volverMenu}
            onVolverInicio={onVolver}
            apiOnline={apiOnline}
            title={meta.title}
            subtitle={meta.subtitle}
            headerActions={options?.headerActions}
          >
            {content}
          </StockGanaderoHubShell>
        </div>
      );
    },
    [apiOnline, navegarModulo, onVolver, volverMenu],
  );

  if (vista === "importar") {
    return wrapModule(
      "importar",
      <StockGanaderoImportar
        embedded
        apiOnline={apiOnline}
        currentUser={currentUser}
        onImported={() => {
          setListRefresh((k) => k + 1);
          setVista("listado");
        }}
        onError={onError}
        onSuccess={onSuccess}
        onVolver={volverMenu}
      />,
    );
  }

  if (vista === "importar_baja") {
    return wrapModule(
      "importar_baja",
      <StockGanaderoImportarBaja
        embedded
        apiOnline={apiOnline}
        onImported={() => {
          setListRefresh((k) => k + 1);
          setVista("ganadera");
        }}
        onError={onError}
        onSuccess={onSuccess}
        onVolver={volverMenu}
      />,
    );
  }

  if (vista === "historial") {
    return wrapModule(
      "historial",
      <StockGanaderoHistorial
        embedded
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
      />,
      {
        headerActions: (
          <button type="button" className="sg-hub-cta sg-hub-cta--ghost" onClick={() => setVista("listado")}>
            ‹ Lecturas importadas
          </button>
        ),
      },
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
        hubNav={{
          items: STOCK_GANADERO_SUBMENU,
          activeId: "ganadera",
          onNavigate: navegarModulo,
          onVolverDashboard: volverMenu,
          onVolverInicio: onVolver,
        }}
      />
    );
  }

  if (vista === "salidas") {
    return wrapModule(
      "salidas",
      <StockGanaderaSalidas
        embedded
        apiOnline={apiOnline}
        refreshKey={listRefresh}
        onError={onError}
        onVolver={volverMenu}
      />,
    );
  }

  if (vista === "cabana") {
    return wrapModule(
      "cabana",
      <StockGanaderoCabanaSeleccion
        embedded
        apiOnline={apiOnline}
        currentUser={currentUser}
        onError={onError}
        onSuccess={onSuccess}
        onVolver={volverMenu}
      />,
    );
  }

  if (vista === "sanidad") {
    return wrapModule(
      "sanidad",
      <StockGanaderoSanidad
        embedded
        apiOnline={apiOnline}
        currentUser={currentUser}
        onError={onError}
        onSuccess={onSuccess}
        onVolver={volverMenu}
      />,
    );
  }

  if (vista === "listado") {
    return wrapModule(
      "listado",
      <StockGanaderoListado
        embedded
        key={listRefresh}
        apiOnline={apiOnline}
        refreshKey={listRefresh}
        initialLoteId={listLoteFilter}
        onError={onError}
        onSuccess={(m) => onSuccess(m)}
        onVolver={volverMenu}
        onVerHistorial={() => setVista("historial")}
      />,
    );
  }

  return (
    <div className="sg-module-page stock-ganadero-hub-page">
      <StockGanaderoHub
        apiOnline={apiOnline}
        resumen={resumen}
        items={STOCK_GANADERO_SUBMENU}
        onNavigate={navegarModulo}
        onVolverInicio={onVolver}
      />
    </div>
  );
}
