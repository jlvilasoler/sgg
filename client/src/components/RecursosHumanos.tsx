import { useCallback, useState } from "react";
import { useHeaderBackStep } from "../header-back";
import type { AuthUser, Catalogos, Funcionario } from "../types";
import RrhhDashboard from "./rrhh/RrhhDashboard";
import SgHubShell from "./hub/SgHubShell";
import { MenuAppIcon } from "./icons/MenuAppIcons";
import FuncionarioForm from "./rrhh/FuncionarioForm";
import FuncionarioListado from "./rrhh/FuncionarioListado";
import SueldosJornales from "./rrhh/SueldosJornales";
import { RRHH_HUB_ITEMS, RRHH_HUB_META } from "./rrhh/rrhh-hub-items";

type VistaRRHH = "menu" | "funcionarios" | "funcionario-form" | "sueldos";

interface Props {
  catalogos: Catalogos;
  currentUser?: AuthUser | null;
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onCatalogosChanged: () => void;
  onVolver: () => void;
  onEditGasto?: (id: number) => void;
}

export default function RecursosHumanos({
  catalogos,
  currentUser,
  apiOnline,
  onError,
  onSuccess,
  onCatalogosChanged,
  onVolver,
  onEditGasto,
}: Props) {
  const [vista, setVista] = useState<VistaRRHH>("menu");
  const [editFuncionario, setEditFuncionario] = useState<Funcionario | null>(null);
  const [listRefresh, setListRefresh] = useState(0);
  const [cedulaSueldos, setCedulaSueldos] = useState("");

  const volverMenu = useCallback(() => {
    setVista("menu");
    setEditFuncionario(null);
  }, []);

  const volverFuncionarios = useCallback(() => {
    setEditFuncionario(null);
    setVista("funcionarios");
  }, []);

  const shellActiveId =
    vista === "funcionario-form" ? "funcionarios" : vista === "menu" ? "menu" : vista;

  const meta =
    vista === "menu"
      ? {
          title: "Dashboard",
          subtitle:
            "Base de funcionarios y colaboradores, vinculada a los gastos del sistema por cédula.",
        }
      : vista === "funcionario-form"
        ? RRHH_HUB_META["funcionario-form"]
        : RRHH_HUB_META[vista as "funcionarios" | "sueldos"];

  useHeaderBackStep(
    vista !== "menu",
    vista === "funcionario-form" ? volverFuncionarios : volverMenu,
    vista === "funcionario-form" ? "Funcionarios" : "Recursos Humanos"
  );

  return (
    <div className="sg-module-page rrhh-module-page">
      <SgHubShell
        activeId={shellActiveId}
        items={RRHH_HUB_ITEMS}
        onNavigate={(id: string) => {
          if (id === "funcionarios") {
            setEditFuncionario(null);
            setVista("funcionarios");
          } else if (id === "sueldos") {
            setCedulaSueldos("");
            setVista("sueldos");
          }
        }}
        onVolverDashboard={volverMenu}
        onVolverInicio={onVolver}
        apiOnline={apiOnline}
        title={meta.title}
        subtitle={meta.subtitle}
        asideKicker="SAG"
        asideTitle="Recursos Humanos"
        asideLogo={<MenuAppIcon id="recursos_humanos" />}
        navAriaLabel="Módulos de Recursos Humanos"
        hubClassName="rrhh--hub"
      >
        <div className="sg-hub-embedded">
        {vista === "menu" ? (
          <RrhhDashboard
            apiOnline={apiOnline}
            currentUser={currentUser}
            onError={onError}
            onNavigate={(id) => {
              if (id === "funcionarios") {
                setEditFuncionario(null);
                setVista("funcionarios");
              } else if (id === "sueldos") {
                setCedulaSueldos("");
                setVista("sueldos");
              }
            }}
            onVerPago={(cedula) => {
              setCedulaSueldos(cedula);
              setVista("sueldos");
            }}
            onEditGasto={onEditGasto}
          />
        ) : vista === "funcionario-form" ? (
          <FuncionarioForm
            key={editFuncionario?.id ?? "nuevo"}
            embedded
            apiOnline={apiOnline}
            editFuncionario={editFuncionario}
            onSaved={() => {
              setListRefresh((k) => k + 1);
              onCatalogosChanged();
              volverFuncionarios();
            }}
            onCancel={volverFuncionarios}
            onError={onError}
            onSuccess={onSuccess}
            onVolver={volverFuncionarios}
          />
        ) : vista === "funcionarios" ? (
          <FuncionarioListado
            key={listRefresh}
            embedded
            apiOnline={apiOnline}
            onNuevo={() => {
              setEditFuncionario(null);
              setVista("funcionario-form");
            }}
            onEdit={(f) => {
              setEditFuncionario(f);
              setVista("funcionario-form");
            }}
            onVerPagos={(cedula) => {
              setCedulaSueldos(cedula);
              setVista("sueldos");
            }}
            onError={onError}
            onSuccess={(m) => {
              onSuccess(m);
              onCatalogosChanged();
            }}
            onVolver={volverMenu}
          />
        ) : (
          <SueldosJornales
            embedded
            catalogos={catalogos}
            apiOnline={apiOnline}
            cedulaInicial={cedulaSueldos}
            onError={onError}
            onEditGasto={onEditGasto}
            onVolver={volverMenu}
          />
        )}
        </div>
      </SgHubShell>
    </div>
  );
}
