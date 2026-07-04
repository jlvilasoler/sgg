import { useCallback, useEffect, useState, type ReactNode } from "react";
import { fetchStockEquinoResumen } from "../../api";
import { useHeaderBackStep } from "../../header-back";
import type { AuthUser } from "../../types";
import StockEquina from "./StockEquina";
import StockEquinaSalidas from "./StockEquinaSalidas";
import StockEquinoHistorial from "./StockEquinoHistorial";
import StockEquinoImportar from "./StockEquinoImportar";
import StockEquinoImportarBaja from "./StockEquinoImportarBaja";
import StockEquinoListado from "./StockEquinoListado";
import StockEquinoSanidad from "./StockEquinoSanidad";
import StockEquinoHub, { type StockEquinoHubItem } from "./StockEquinoHub";
import StockEquinoHubShell from "./StockEquinoHubShell";
import { clearStockEquinaPageCache } from "./stock-equina-page-cache";

type VistaStock =
  | "menu"
  | "importar"
  | "importar_baja"
  | "listado"
  | "historial"
  | "equina"
  | "salidas"
  | "sanidad";

interface Props {
  apiOnline: boolean;
  currentUser?: AuthUser | null;
  onError: (msg: string) => void;
  onSuccess: (msg: string, title?: string) => void;
  onVolver: () => void;
}

export const STOCK_EQUINO_SUBMENU: StockEquinoHubItem[] = [
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
      "Cargá el export del bastón o lector RFID, o ingresá lecturas una a una. Cada registro guarda fecha, hora y condición del equino.",
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
  equina: {
    title: "Dispositivos EID",
    subtitle: "Stock equino activo, filtros por estado y detalle de cada caravana.",
  },
  salidas: {
    title: "Salidas del sistema",
    subtitle: "Muertes, ventas, frigorífico y extraviados fuera del stock activo.",
  },
  sanidad: {
    title: "Sanidad",
    subtitle: "Seleccioná equinos por grupo y registrá el mismo control sanitario en todos a la vez.",
  },
};

export default function StockEquino({
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

  const navegarModulo = useCallback((id: string) => {
    setVista(id as Exclude<VistaStock, "menu" | "historial">);
  }, []);

  const bumpRefresh = useCallback(() => {
    clearStockEquinaPageCache();
    setListRefresh((k) => k + 1);
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
        <div className="sg-module-page stock-equino-module-page">
          <StockEquinoHubShell
            activeId={activeNavId}
            items={STOCK_EQUINO_SUBMENU}
            onNavigate={navegarModulo}
            onVolverDashboard={volverMenu}
            onVolverInicio={onVolver}
            apiOnline={apiOnline}
            title={meta.title}
            subtitle={meta.subtitle}
            headerActions={options?.headerActions}
          >
            {content}
          </StockEquinoHubShell>
        </div>
      );
    },
    [apiOnline, navegarModulo, onVolver, volverMenu],
  );

  if (vista === "importar") {
    return wrapModule(
      "importar",
      <StockEquinoImportar
        embedded
        apiOnline={apiOnline}
        currentUser={currentUser}
        onImported={() => {
          bumpRefresh();
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
      <StockEquinoImportarBaja
        embedded
        apiOnline={apiOnline}
        onImported={() => {
          bumpRefresh();
          setVista("equina");
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
      <StockEquinoHistorial
        embedded
        apiOnline={apiOnline}
        refreshKey={listRefresh}
        onError={onError}
        onSuccess={(m) => {
          onSuccess(m);
          bumpRefresh();
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

  if (vista === "equina") {
    return (
      <StockEquina
        apiOnline={apiOnline}
        currentUser={currentUser}
        refreshKey={listRefresh}
        onError={onError}
        onSuccess={onSuccess}
        onVolver={volverMenu}
        hubNav={{
          items: STOCK_EQUINO_SUBMENU,
          activeId: "equina",
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
      <StockEquinaSalidas
        embedded
        apiOnline={apiOnline}
        refreshKey={listRefresh}
        onError={onError}
        onVolver={volverMenu}
      />,
    );
  }

  if (vista === "sanidad") {
    return wrapModule(
      "sanidad",
      <StockEquinoSanidad
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
      <StockEquinoListado
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
    <div className="sg-module-page stock-equino-hub-page">
      <StockEquinoHub
        apiOnline={apiOnline}
        resumen={resumen}
        items={STOCK_EQUINO_SUBMENU}
        onNavigate={navegarModulo}
        onVolverInicio={onVolver}
      />
    </div>
  );
}
