import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  fetchVentasAgricultura,
  fetchVentasArrendamientos,
  fetchVentasGanadoCerradas,
} from "../../api";
import type { AuthUser, Catalogos } from "../../types";
import {
  canAccessIngresosVentasModulo,
  canAccessSimuladorVentaGanado,
  canWriteIngresosVentas,
} from "../../utils/auth-permissions";
import { useHeaderBackStep } from "../../header-back";
import { MenuAppIcon } from "../icons/MenuAppIcons";
import SimuladorVentas, { type SimuladorSeccionId } from "../simulador-venta/SimuladorVentas";
import VentasGanadoCerradas from "./VentasGanadoCerradas";
import VentasAgricultura from "./VentasAgricultura";
import VentasArrendamientos from "./VentasArrendamientos";
import VentasHubShell from "./VentasHubShell";
import VentasIngresosHub, { type VentasIngresosResumen } from "./VentasIngresosHub";
import { findVentasHubItem } from "./VentasHubTypes";
import {
  buildIngresosVentasSubmenu,
  dashboardVentasHubItems,
  isSimuladorVistaId,
  SIMULADOR_VISTA_DEFAULT,
  type SimuladorVistaId,
} from "./ventas-hub-items";

export type VistaIngresosVentas =
  | "menu"
  | SimuladorVistaId
  | "ventas_ganado"
  | "ventas_agricultura"
  | "ventas_arrendamientos";

interface Props {
  user: AuthUser;
  catalogos: Catalogos;
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string, title?: string) => void;
  onVolver: () => void;
  initialVista?: VistaIngresosVentas | "simulador";
}

const SIMULADOR_SECCION: Record<SimuladorVistaId, SimuladorSeccionId> = {
  simulador_en_pie: "en_pie",
  simulador_cuarta_balanza: "cuarta_balanza",
  simulador_agricultura: "agricultura",
  simulador_arrendamientos: "arrendamientos",
};

const MODULE_META: Record<
  Exclude<VistaIngresosVentas, "menu">,
  { title: string; subtitle: string }
> = {
  simulador_en_pie: {
    title: "Venta en pie",
    subtitle: "Simulá ingresos por kg en pie con el último precio de reposición (ACG).",
  },
  simulador_cuarta_balanza: {
    title: "Venta en cuarta balanza",
    subtitle: "Simulá ingresos a frigorífico: precio gordo × kg × rendimiento estimado (ACG).",
  },
  simulador_agricultura: {
    title: "Ventas Agrícolas",
    subtitle: "Cultivos, has y rendimiento estimado.",
  },
  simulador_arrendamientos: {
    title: "Ingresos por Arrendamientos",
    subtitle: "Arrendamientos, medianería y acuerdos de uso de campos.",
  },
  ventas_ganado: {
    title: "Ventas de ganado cerradas",
    subtitle: "Operaciones cerradas desde el simulador con totales por cabezas, kg y USD.",
  },
  ventas_agricultura: {
    title: "Ventas agrícolas cerradas",
    subtitle: "Ingresos registrados al cerrar ventas en el simulador agrícola.",
  },
  ventas_arrendamientos: {
    title: "Ingresos por arrendamientos",
    subtitle: "Arrendamientos, medianería y acuerdos de uso de campos.",
  },
};

function vistaInicialPermitida(
  user: AuthUser,
  initial?: VistaIngresosVentas | "simulador"
): VistaIngresosVentas {
  if (!initial || initial === "menu") return "menu";
  if (initial === "simulador") {
    return canAccessSimuladorVentaGanado(user) ? SIMULADOR_VISTA_DEFAULT : "menu";
  }
  if (isSimuladorVistaId(initial) && canAccessSimuladorVentaGanado(user)) return initial;
  if (!isSimuladorVistaId(initial) && canAccessIngresosVentasModulo(user)) return initial;
  return "menu";
}

function shellActiveId(vista: VistaIngresosVentas): string {
  if (isSimuladorVistaId(vista)) return vista;
  return vista;
}

export default function IngresosVentas({
  user,
  catalogos,
  apiOnline,
  onError,
  onSuccess,
  onVolver,
  initialVista,
}: Props) {
  const submenuItems = useMemo(() => buildIngresosVentasSubmenu(user), [user]);
  const dashboardItems = useMemo(() => dashboardVentasHubItems(user), [user]);
  const puedeSimular = canAccessSimuladorVentaGanado(user);
  const puedeVerRegistros = canAccessIngresosVentasModulo(user);
  const puedeEditar = canWriteIngresosVentas(user);
  const [vista, setVista] = useState<VistaIngresosVentas>(() =>
    vistaInicialPermitida(user, initialVista)
  );
  const [resumen, setResumen] = useState<VentasIngresosResumen>({
    ganado: 0,
    agricultura: 0,
    arrendamientos: 0,
  });

  const volverMenu = useCallback(() => setVista("menu"), []);
  useHeaderBackStep(vista !== "menu", volverMenu, "Ingresos por ventas");

  useEffect(() => {
    if (!apiOnline || !puedeVerRegistros) {
      setResumen({ ganado: 0, agricultura: 0, arrendamientos: 0 });
      return;
    }
    Promise.all([
      fetchVentasGanadoCerradas().then((r) => r.length).catch(() => 0),
      fetchVentasAgricultura().then((r) => r.length).catch(() => 0),
      fetchVentasArrendamientos().then((r) => r.length).catch(() => 0),
    ]).then(([ganado, agricultura, arrendamientos]) => {
      setResumen({ ganado, agricultura, arrendamientos });
    });
  }, [apiOnline, vista, puedeVerRegistros]);

  const navegarModulo = useCallback(
    (id: string) => {
      if (isSimuladorVistaId(id)) {
        if (!puedeSimular) return;
        setVista(id);
        return;
      }
      if (id === "simulador" && puedeSimular) {
        setVista(SIMULADOR_VISTA_DEFAULT);
        return;
      }
      if (!puedeVerRegistros) return;
      setVista(id as Exclude<VistaIngresosVentas, "menu">);
    },
    [puedeSimular, puedeVerRegistros]
  );

  const wrapModule = useCallback(
    (vistaId: Exclude<VistaIngresosVentas, "menu">, content: ReactNode) => {
      const meta = MODULE_META[vistaId];
      const navItem = findVentasHubItem(submenuItems, vistaId);
      return (
        <div className="sg-module-page ventas-module-page">
          <VentasHubShell
            activeId={shellActiveId(vistaId)}
            items={submenuItems}
            onNavigate={navegarModulo}
            onVolverDashboard={volverMenu}
            onVolverInicio={onVolver}
            apiOnline={apiOnline}
            title={navItem?.label ?? meta.title}
            subtitle={navItem?.subtitle ?? meta.subtitle}
            asideLogo={<MenuAppIcon id="ingresos_ventas" />}
            navAriaLabel="Módulos de ingresos por ventas"
          >
            {content}
          </VentasHubShell>
        </div>
      );
    },
    [apiOnline, navegarModulo, onVolver, submenuItems, volverMenu]
  );

  if (isSimuladorVistaId(vista) && puedeSimular) {
    return wrapModule(
      vista,
      <SimuladorVentas
        embedded
        seccion={SIMULADOR_SECCION[vista]}
        user={user}
        catalogos={catalogos}
        apiOnline={apiOnline}
        onError={onError}
        onSuccess={onSuccess}
        onVolverDashboard={volverMenu}
      />
    );
  }

  if (vista === "ventas_ganado" && puedeVerRegistros) {
    return wrapModule(
      "ventas_ganado",
      <VentasGanadoCerradas
        embedded
        puedeEditar={puedeEditar}
        apiOnline={apiOnline}
        onError={onError}
        onSuccess={(m) => onSuccess(m)}
        onVolver={volverMenu}
      />
    );
  }

  if (vista === "ventas_agricultura" && puedeVerRegistros) {
    return wrapModule(
      "ventas_agricultura",
      <VentasAgricultura
        embedded
        catalogos={catalogos}
        user={user}
        apiOnline={apiOnline}
        onError={onError}
        onSuccess={(m) => onSuccess(m)}
        onVolver={volverMenu}
      />
    );
  }

  if (vista === "ventas_arrendamientos" && puedeVerRegistros) {
    return wrapModule(
      "ventas_arrendamientos",
      <VentasArrendamientos
        embedded
        catalogos={catalogos}
        modo="ingresos"
        user={user}
        apiOnline={apiOnline}
        onError={onError}
        onSuccess={(m) => onSuccess(m)}
        onVolver={volverMenu}
      />
    );
  }

  return (
    <div className="sg-module-page ventas-module-page ventas-ingresos-hub-page">
      <VentasIngresosHub
        apiOnline={apiOnline}
        resumen={resumen}
        items={dashboardItems}
        puedeSimular={puedeSimular}
        onNavigate={navegarModulo}
        onVolverInicio={onVolver}
      />
    </div>
  );
}
