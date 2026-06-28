import { useCallback, useEffect, useState } from "react";
import { HubMenuCard } from "./HubMenuCard";
import { useHeaderBackContext } from "../header-back";
import type { HubIconId } from "./icons/HubMenuIcons";
import { HUB_ICON_THEMES, HubMenuIcon } from "./icons/HubMenuIcons";
import FuncionarioForm from "./rrhh/FuncionarioForm";
import FuncionarioListado from "./rrhh/FuncionarioListado";
import SueldosJornales from "./rrhh/SueldosJornales";
import type { Catalogos, Funcionario } from "../types";

type VistaRRHH = "menu" | "funcionarios" | "funcionario-form" | "sueldos";

interface Props {
  catalogos: Catalogos;
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onCatalogosChanged: () => void;
  onVolver: () => void;
  onEditGasto?: (id: number) => void;
}

const SUBMENU: {
  id: "funcionarios" | "sueldos";
  label: string;
  subtitle: string;
  icon: HubIconId;
}[] = [
  {
    id: "funcionarios",
    label: "Funcionarios",
    subtitle: "Datos personales y cuenta bancaria",
    icon: "rrhh_funcionarios",
  },
  {
    id: "sueldos",
    label: "Sueldos y Jornales",
    subtitle: "Pagos por cédula y resumen de gastos",
    icon: "rrhh_sueldos",
  },
];

export default function RecursosHumanos({
  catalogos,
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

  const headerBack = useHeaderBackContext();
  useEffect(() => {
    if (!headerBack) return;
    if (vista === "menu") {
      headerBack.setStep(null);
      return;
    }
    if (vista === "funcionario-form") {
      headerBack.setStep({
        onBack: () => {
          setEditFuncionario(null);
          setVista("funcionarios");
        },
        destinationLabel: "Funcionarios",
      });
      return () => headerBack.setStep(null);
    }
    headerBack.setStep({
      onBack: volverMenu,
      destinationLabel: "Recursos Humanos",
    });
    return () => headerBack.setStep(null);
  }, [vista, volverMenu, headerBack]);

  if (vista === "funcionario-form") {
    return (
      <FuncionarioForm
        key={editFuncionario?.id ?? "nuevo"}
        apiOnline={apiOnline}
        editFuncionario={editFuncionario}
        onSaved={() => {
          setListRefresh((k) => k + 1);
          onCatalogosChanged();
          setVista("funcionarios");
          setEditFuncionario(null);
        }}
        onCancel={() => {
          setEditFuncionario(null);
          setVista("funcionarios");
        }}
        onError={onError}
        onSuccess={onSuccess}
        onVolver={() => {
          setEditFuncionario(null);
          setVista("funcionarios");
        }}
      />
    );
  }

  if (vista === "funcionarios") {
    return (
      <FuncionarioListado
        key={listRefresh}
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
    );
  }

  if (vista === "sueldos") {
    return (
      <SueldosJornales
        catalogos={catalogos}
        apiOnline={apiOnline}
        cedulaInicial={cedulaSueldos}
        onError={onError}
        onEditGasto={onEditGasto}
        onVolver={volverMenu}
      />
    );
  }

  return (
    <div className="subseccion-panel rrhh-hub">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver al inicio
      </button>
      <div className="card rrhh-hub-card">
        <div className="form-header">
          <h2>Recursos Humanos</h2>
          <p className="muted">
            Base de <strong>funcionarios y colaboradores</strong>, vinculada a los{" "}
            <strong>gastos</strong> del sistema por cédula de identidad.
          </p>
        </div>
        <nav className="app-grid app-grid-2" aria-label="Recursos Humanos">
          {SUBMENU.map((item) => (
            <HubMenuCard
              key={item.id}
              label={item.label}
              subtitle={item.subtitle}
              theme={HUB_ICON_THEMES[item.icon]}
              icon={<HubMenuIcon id={item.icon} />}
              onClick={() => {
                if (item.id === "funcionarios") {
                  setEditFuncionario(null);
                  setVista("funcionarios");
                } else {
                  setCedulaSueldos("");
                  setVista("sueldos");
                }
              }}
            />
          ))}
        </nav>
      </div>
    </div>
  );
}
