import { useState } from "react";
import FuncionarioForm from "./rrhh/FuncionarioForm";
import FuncionarioListado from "./rrhh/FuncionarioListado";
import SueldosJornales from "./rrhh/SueldosJornales";
import type { Funcionario } from "../types";

type VistaRRHH = "menu" | "funcionarios" | "funcionario-form" | "sueldos";

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onCatalogosChanged: () => void;
  onVolver: () => void;
  onEditGasto?: (id: number) => void;
}

const SUBMENU = [
  {
    id: "funcionarios" as const,
    label: "Funcionarios",
    subtitle: "Datos personales y cuenta bancaria",
    icon: "👤",
    color: "#5b4b8a",
  },
  {
    id: "sueldos" as const,
    label: "Sueldos y Jornales",
    subtitle: "Pagos por cédula y resumen de gastos",
    icon: "💵",
    color: "#2d6a4f",
  },
];

export default function RecursosHumanos({
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

  const volverMenu = () => {
    setVista("menu");
    setEditFuncionario(null);
  };

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
            <button
              key={item.id}
              type="button"
              className="app-card-btn"
              onClick={() => {
                if (item.id === "funcionarios") {
                  setEditFuncionario(null);
                  setVista("funcionarios");
                } else {
                  setCedulaSueldos("");
                  setVista("sueldos");
                }
              }}
            >
              <span
                className="app-card-icon"
                style={{
                  background: `linear-gradient(145deg, ${item.color}, ${item.color}bb)`,
                }}
              >
                <span className="app-icon-emoji" aria-hidden>
                  {item.icon}
                </span>
              </span>
              <span className="app-card-text">
                <span className="app-card-label">{item.label}</span>
                <span className="app-card-sub">{item.subtitle}</span>
              </span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
