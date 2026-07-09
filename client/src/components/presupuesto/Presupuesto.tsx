import { useCallback, useEffect, useState } from "react";
import { useHeaderBackStep } from "../../header-back";
import type { TabId } from "../Header";
import type { Catalogos, AuthUser, Presupuesto as PresupuestoRow } from "../../types";
import FormGasto from "../FormGasto";
import FormNotaCredito from "../FormNotaCredito";
import Listado from "../Listado";
import Resumen from "../Resumen";
import PresupuestoHub from "./PresupuestoHub";
import PresupuestoHubDashboard from "./PresupuestoHubDashboard";
import AutomatizacionGastos from "./AutomatizacionGastos";
import { PRESUPUESTO_HUB_META, type PresupuestoVista } from "./presupuesto-hub-items";

type VistaPresupuesto = "menu" | PresupuestoVista;

interface Props {
  screen: TabId;
  catalogos: Catalogos;
  currentUser: AuthUser;
  editRow: PresupuestoRow | null;
  listKey: number;
  apiOnline: boolean;
  vistaInicial?: PresupuestoVista | null;
  onVistaInicialConsumida?: () => void;
  onScreenChange: (id: TabId) => void;
  onVolver: () => void;
  onSaved: () => void;
  onCancelEdit: () => void;
  onEdit: (row: PresupuestoRow) => void;
  onDeleted: () => void;
  onCatalogosChanged: () => void | Promise<void>;
  onError: (msg: string) => void;
  onSuccess: (msg: string, title?: string) => void;
}

function vistaDesdeScreen(screen: TabId): VistaPresupuesto {
  if (screen === "listado") return "listado";
  if (screen === "resumen") return "resumen";
  return "menu";
}

export default function Presupuesto({
  screen,
  catalogos,
  currentUser,
  editRow,
  listKey,
  apiOnline,
  vistaInicial,
  onVistaInicialConsumida,
  onScreenChange,
  onVolver,
  onSaved,
  onCancelEdit,
  onEdit,
  onDeleted,
  onCatalogosChanged,
  onError,
  onSuccess,
}: Props) {
  const [vista, setVista] = useState<VistaPresupuesto>(() =>
    editRow ? "registro" : vistaDesdeScreen(screen)
  );

  useEffect(() => {
    if (editRow) {
      setVista("registro");
      return;
    }
    if (vistaInicial) {
      setVista(vistaInicial);
      onVistaInicialConsumida?.();
      return;
    }
    if (screen === "listado" || screen === "resumen") {
      setVista(screen);
      return;
    }
    if (screen === "registro" && vista === "registro") {
      return;
    }
    if (screen === "registro") {
      setVista("menu");
    }
  }, [screen, editRow, vistaInicial, onVistaInicialConsumida]); // eslint-disable-line react-hooks/exhaustive-deps -- vista registro se mantiene hasta salir

  const volverMenu = useCallback(() => {
    onCancelEdit();
    setVista("menu");
    if (screen !== "registro") onScreenChange("registro");
  }, [onCancelEdit, onScreenChange, screen]);

  const irA = useCallback(
    (id: PresupuestoVista) => {
      onCancelEdit();
      setVista(id);
      if (id === "listado" || id === "resumen") {
        onScreenChange(id as TabId);
      } else if (id === "registro" || id === "nota_credito" || id === "automatizacion") {
        onScreenChange("registro");
      }
    },
    [onCancelEdit, onScreenChange]
  );

  const shellActiveId = vista === "menu" ? "menu" : vista;

  const meta =
    vista === "menu"
      ? {
          title: "Dashboard",
          subtitle: "Registro de gastos, consulta del presupuesto y control de gestión.",
        }
      : PRESUPUESTO_HUB_META[vista];

  useHeaderBackStep(
    vista !== "menu",
    () => {
      if (vista === "registro" && editRow) {
        onCancelEdit();
        setVista("listado");
        onScreenChange("listado");
        return;
      }
      volverMenu();
    },
    vista === "registro"
      ? "Ingresar gasto"
      : vista === "nota_credito"
        ? "Notas de crédito"
        : vista === "automatizacion"
          ? "Automatización"
          : "Presupuesto y gastos"
  );

  return (
    <PresupuestoHub
      vista={shellActiveId}
      onNavigate={(id) => irA(id as PresupuestoVista)}
      onVolverDashboard={volverMenu}
      onVolver={onVolver}
      apiOnline={apiOnline}
      title={meta.title}
      subtitle={meta.subtitle}
      embedded={vista !== "menu"}
    >
      {vista === "menu" ? (
        <PresupuestoHubDashboard
          currentUser={currentUser}
          apiOnline={apiOnline}
          onNavigate={irA}
          onEdit={onEdit}
        />
      ) : vista === "registro" ? (
        <FormGasto
          catalogos={catalogos}
          currentUser={currentUser}
          editRow={editRow}
          apiOnline={apiOnline}
          onSaved={onSaved}
          onCancelEdit={onCancelEdit}
          onEdit={onEdit}
          onCatalogosChanged={onCatalogosChanged}
          onError={onError}
          onSuccess={onSuccess}
        />
      ) : vista === "nota_credito" ? (
        <FormNotaCredito
          catalogos={catalogos}
          currentUser={currentUser}
          apiOnline={apiOnline}
          onSaved={onSaved}
          onError={onError}
          onSuccess={onSuccess}
        />
      ) : vista === "listado" ? (
        <Listado
          key={listKey}
          catalogos={catalogos}
          apiOnline={apiOnline}
          onEdit={onEdit}
          onDeleted={onDeleted}
          onError={onError}
          onSuccess={(m) => onSuccess(m)}
          currentUser={currentUser}
        />
      ) : vista === "automatizacion" ? (
        <AutomatizacionGastos
          currentUser={currentUser}
          catalogos={catalogos}
          apiOnline={apiOnline}
          onError={onError}
          onSuccess={onSuccess}
        />
      ) : (
        <Resumen
          catalogos={catalogos}
          currentUser={currentUser}
          apiOnline={apiOnline}
          onError={onError}
        />
      )}
    </PresupuestoHub>
  );
}
