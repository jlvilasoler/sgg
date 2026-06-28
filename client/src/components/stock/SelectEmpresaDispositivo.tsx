import type { DispositivoEmpresa } from "../../types";
import type { EmpresaOperativaStock } from "../../api";

export const EMPRESA_PENDIENTE = "__pendiente__" as const;
export type EmpresaSelectValue = DispositivoEmpresa | typeof EMPRESA_PENDIENTE;

interface Props {
  empresas: EmpresaOperativaStock[];
  value: EmpresaSelectValue;
  onChange: (empresa: EmpresaSelectValue) => void;
  disabled?: boolean;
  id?: string;
  /** Si true, exige elegir una empresa operativa o SIN EMPRESA (no queda en placeholder). */
  requiereSeleccion?: boolean;
}

export default function SelectEmpresaDispositivo({
  empresas,
  value,
  onChange,
  disabled = false,
  id,
  requiereSeleccion = false,
}: Props) {
  return (
    <select
      id={id}
      className="stock-empresa-select stock-edit-select"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as EmpresaSelectValue)}
    >
      {requiereSeleccion ? (
        <option value={EMPRESA_PENDIENTE} disabled>
          Seleccionar empresa
        </option>
      ) : null}
      {empresas.map((e) => (
        <option key={e.codigo} value={e.codigo}>
          {e.nombre}
        </option>
      ))}
      <option value="">SIN EMPRESA</option>
    </select>
  );
}
