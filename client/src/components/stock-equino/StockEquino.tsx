import { useCallback, useEffect, useState, type ReactNode } from "react";
import { fetchStockEquinoResumen } from "../../api";
import { useHeaderBackStep } from "../../header-back";
import type { AuthUser } from "../../types";
import SgHubModuleGrid from "../hub/SgHubModuleGrid";
import { SgHubKpi, SgMiniBars } from "../stock/SgHubUi";
import StockEquina from "./StockEquina";
import StockEquinaSalidas from "./StockEquinaSalidas";
import StockEquinoHistorial from "./StockEquinoHistorial";
import StockEquinoImportar from "./StockEquinoImportar";
import StockEquinoImportarBaja from "./StockEquinoImportarBaja";
import StockEquinoListado from "./StockEquinoListado";
import StockEquinoSanidad from "./StockEquinoSanidad";
import StockEquinoHubShell from "./StockEquinoHubShell";
import type { StockEquinoHubItem } from "./StockEquinoHub";
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
    label: "Alta de Equinos",
    subtitle: "Genérica · RFID archivo / caravana",
    icon: "stock_alta",
  },
  {
    id: "importar_baja",
    label: "Baja de Dispositivo",
    subtitle: "Archivo TXT · baja manual",
    icon: "stock_baja",
  },
  {
    id: "listado",
    label: "Lecturas importadas",
    subtitle: "Consultar · filtrar · gestionar",
    icon: "stock_lecturas",
  },
  {
    id: "equina",
    label: "Stock Equino",
    subtitle: "Dispositivos EID · detalle por caravana",
    icon: "stock_dispositivos",
  },
  {
    id: "salidas",
    label: "Salidas del sistema",
    subtitle: "Muertes · ventas · frigorífico",
    icon: "stock_salidas",
  },
  {
    id: "sanidad",
    label: "Sanidad",
    subtitle: "Controles sanitarios equinos",
    icon: "stock_sanidad",
  },
];

const MODULE_META: Record<
  Exclude<VistaStock, "menu">,
  { title: string; subtitle: string; navId?: string }
> = {
  importar: {
    title: "Alta de Equinos",
    subtitle:
      "Alta genérica por cantidad, potrero y categoría, o importá lecturas RFID desde archivo o caravana manual.",
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
    if (id === "menu") {
      volverMenu();
      return;
    }
    setVista(id as Exclude<VistaStock, "menu" | "historial">);
  }, [volverMenu]);

  const bumpRefresh = useCallback(() => {
    clearStockEquinaPageCache();
    setListRefresh((k) => k + 1);
  }, []);

  const hubNavProps = {
    items: STOCK_EQUINO_SUBMENU,
    onNavigate: navegarModulo,
    onVolverDashboard: volverMenu,
    onVolverInicio: onVolver,
  };

  if (vista === "equina") {
    return (
      <div className="sg-module-page stock-equino-module-page stock-equino-devices-page">
        <StockEquina
          apiOnline={apiOnline}
          currentUser={currentUser}
          refreshKey={listRefresh}
          onError={onError}
          onSuccess={onSuccess}
          onVolver={volverMenu}
          hubNav={{
            ...hubNavProps,
            activeId: "equina",
          }}
        />
      </div>
    );
  }

  const shellActiveId = vista === "menu" ? "menu" : MODULE_META[vista].navId ?? vista;
  const meta =
    vista === "menu"
      ? {
          title: "Dashboard",
          subtitle:
            "Identificación electrónica equina, stock activo, salidas y sanidad en un solo lugar.",
        }
      : MODULE_META[vista];

  let body: ReactNode;
  let headerActions: ReactNode | undefined;

  if (vista === "menu") {
    body = (
      <>
        <section className="sg-hub-kpi-strip stock-equino-dash-kpi" aria-label="Indicadores">
          <SgHubKpi
            variant="dark"
            kicker="Dispositivos activos"
            value={apiOnline ? resumen.dispositivos : "—"}
            trend={apiOnline && resumen.dispositivos > 0 ? "En stock hoy" : undefined}
            hint="Caravanas electrónicas equinas únicas registradas."
            bars={<SgMiniBars highlight="last" />}
          />
          <SgHubKpi
            kicker="Lecturas importadas"
            value={apiOnline ? resumen.registros : "—"}
            hint="Registros acumulados desde el lector RFID."
            bars={<SgMiniBars highlight="mid" />}
          />
          <SgHubKpi
            kicker="Lotes de importación"
            value={apiOnline ? resumen.lotes : "—"}
            hint="Archivos .txt procesados en el sistema."
            bars={<SgMiniBars />}
          />
        </section>
        <div className="sg-hub-panels">
          <SgHubModuleGrid
            items={STOCK_EQUINO_SUBMENU}
            onSelect={navegarModulo}
            title="Módulos"
            kicker="Stock Equino"
          />
        </div>
      </>
    );
  } else if (vista === "importar") {
    body = (
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
      />
    );
  } else if (vista === "importar_baja") {
    body = (
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
      />
    );
  } else if (vista === "historial") {
    headerActions = (
      <button
        type="button"
        className="sg-hub-cta sg-hub-cta--ghost"
        onClick={() => setVista("listado")}
      >
        ‹ Lecturas importadas
      </button>
    );
    body = (
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
      />
    );
  } else if (vista === "salidas") {
    body = (
      <StockEquinaSalidas
        embedded
        apiOnline={apiOnline}
        refreshKey={listRefresh}
        onError={onError}
        onVolver={volverMenu}
      />
    );
  } else if (vista === "sanidad") {
    body = (
      <StockEquinoSanidad
        embedded
        apiOnline={apiOnline}
        currentUser={currentUser}
        onError={onError}
        onSuccess={onSuccess}
        onVolver={volverMenu}
      />
    );
  } else if (vista === "listado") {
    body = (
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
      />
    );
  }

  return (
    <div className="sg-module-page stock-equino-module-page">
      <StockEquinoHubShell
        activeId={shellActiveId}
        items={STOCK_EQUINO_SUBMENU}
        onNavigate={navegarModulo}
        onVolverDashboard={volverMenu}
        onVolverInicio={onVolver}
        apiOnline={apiOnline}
        title={meta.title}
        subtitle={meta.subtitle}
        headerActions={headerActions}
        asideKicker="SAG"
      >
        {vista === "menu" ? body : <div className="sg-hub-embedded">{body}</div>}
      </StockEquinoHubShell>
    </div>
  );
}
