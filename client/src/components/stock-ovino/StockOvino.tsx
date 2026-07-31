import { useCallback, useEffect, useState, type ReactNode } from "react";
import { fetchStockOvinoResumen } from "../../api";
import { useHeaderBackStep } from "../../header-back";
import type { AuthUser } from "../../types";
import SgHubModuleGrid from "../hub/SgHubModuleGrid";
import { SgHubKpi, SgMiniBars } from "../stock/SgHubUi";
import { StockOvina } from "./StockOvina";
import StockOvinaSalidas from "./StockOvinaSalidas";
import StockOvinoHistorial from "./StockOvinoHistorial";
import StockOvinoImportar from "./StockOvinoImportar";
import StockOvinoImportarBaja from "./StockOvinoImportarBaja";
import StockOvinoListado from "./StockOvinoListado";
import StockOvinoSanidad from "./StockOvinoSanidad";
import StockOvinoHubShell from "./StockOvinoHubShell";
import type { StockOvinoHubItem } from "./StockOvinoHub";
import { clearStockOvinaPageCache } from "./stock-ovina-page-cache";

type VistaStock =
  | "menu"
  | "importar"
  | "importar_baja"
  | "listado"
  | "historial"
  | "ovina"
  | "salidas"
  | "sanidad";

interface Props {
  apiOnline: boolean;
  currentUser?: AuthUser | null;
  onError: (msg: string) => void;
  onSuccess: (msg: string, title?: string) => void;
  onVolver: () => void;
}

export const STOCK_OVINO_SUBMENU: StockOvinoHubItem[] = [
  {
    id: "importar",
    label: "Alta de Ovinos",
    subtitle: "Genérica · Cabaña",
    icon: "stock_alta",
  },
  {
    id: "importar_baja",
    label: "Baja de Ovinos",
    subtitle: "Solo números · REG · cabaña",
    icon: "stock_baja",
  },
  {
    id: "listado",
    label: "Lecturas importadas",
    subtitle: "Consultar · filtrar · gestionar",
    icon: "stock_lecturas",
  },
  {
    id: "ovina",
    label: "Stock Ovino",
    subtitle: "Dispositivos REG · detalle por ovino",
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
    subtitle: "Controles sanitarios ovinos",
    icon: "stock_sanidad",
  },
];

const MODULE_META: Record<
  Exclude<VistaStock, "menu">,
  { title: string; subtitle: string; navId?: string }
> = {
  importar: {
    title: "Alta de Ovinos",
    subtitle:
      "Alta genérica por cantidad, potrero y categoría, o alta individual de cabaña (RP, nombre, registro y premios). Misma secuencia de IDs.",
  },
  importar_baja: {
    title: "Baja de Ovinos",
    subtitle:
      "Registrá salidas solo por número: REG (genéricos) o RP, nombre y registro (cabaña).",
  },
  listado: {
    title: "Lecturas importadas",
    subtitle: "Altas ovinas de la cuenta: ID, categoría, origen, RP y ficha.",
  },
  historial: {
    title: "Historial de importaciones",
    subtitle: "Lotes importados, filas procesadas y acciones sobre cada archivo.",
    navId: "listado",
  },
  ovina: {
    title: "Dispositivos REG",
    subtitle: "Stock ovino activo, filtros por estado y detalle de cada ovino.",
  },
  salidas: {
    title: "Salidas del sistema",
    subtitle: "Muertes, ventas, frigorífico y extraviados fuera del stock activo.",
  },
  sanidad: {
    title: "Sanidad",
    subtitle: "Seleccioná ovinos por grupo y registrá el mismo control sanitario en todos a la vez.",
  },
};

export default function StockOvino({
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
    fetchStockOvinoResumen()
      .then(setResumen)
      .catch(() => setResumen({ lotes: 0, registros: 0, dispositivos: 0 }));
  }, [apiOnline, listRefresh]);

  const volverMenu = useCallback(() => setVista("menu"), []);
  useHeaderBackStep(vista !== "menu", volverMenu, "Stock Ovino");

  const navegarModulo = useCallback((id: string) => {
    if (id === "menu") {
      volverMenu();
      return;
    }
    setVista(id as Exclude<VistaStock, "menu" | "historial">);
  }, [volverMenu]);

  const bumpRefresh = useCallback(() => {
    clearStockOvinaPageCache();
    setListRefresh((k) => k + 1);
  }, []);

  const hubNavProps = {
    items: STOCK_OVINO_SUBMENU,
    onNavigate: navegarModulo,
    onVolverDashboard: volverMenu,
    onVolverInicio: onVolver,
  };

  if (vista === "ovina") {
    return (
      <div className="sg-module-page stock-ovino-module-page stock-ovino-devices-page">
        <StockOvina
          apiOnline={apiOnline}
          currentUser={currentUser}
          refreshKey={listRefresh}
          onError={onError}
          onSuccess={onSuccess}
          onVolver={volverMenu}
          hubNav={{
            ...hubNavProps,
            activeId: "ovina",
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
            "Identificación electrónica ovina, stock activo, salidas y sanidad en un solo lugar.",
        }
      : MODULE_META[vista];

  let body: ReactNode;
  let headerActions: ReactNode | undefined;

  if (vista === "menu") {
    body = (
      <>
        <section className="sg-hub-kpi-strip stock-ovino-dash-kpi" aria-label="Indicadores">
          <SgHubKpi
            variant="dark"
            kicker="Dispositivos activos"
            value={apiOnline ? resumen.dispositivos : "—"}
            trend={apiOnline && resumen.dispositivos > 0 ? "En stock hoy" : undefined}
            hint="Caravanas electrónicas ovinas únicas registradas."
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
            items={STOCK_OVINO_SUBMENU}
            onSelect={navegarModulo}
            title="Módulos"
            kicker="Stock Ovino"
          />
        </div>
      </>
    );
  } else if (vista === "importar") {
    body = (
      <StockOvinoImportar
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
      <StockOvinoImportarBaja
        embedded
        apiOnline={apiOnline}
        onImported={() => {
          bumpRefresh();
          setVista("ovina");
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
      <StockOvinoHistorial
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
      <StockOvinaSalidas
        embedded
        apiOnline={apiOnline}
        refreshKey={listRefresh}
        onError={onError}
        onVolver={volverMenu}
      />
    );
  } else if (vista === "sanidad") {
    body = (
      <StockOvinoSanidad
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
      <StockOvinoListado
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
    <div className="sg-module-page stock-ovino-module-page">
      <StockOvinoHubShell
        activeId={shellActiveId}
        items={STOCK_OVINO_SUBMENU}
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
      </StockOvinoHubShell>
    </div>
  );
}
