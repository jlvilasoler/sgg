import type { DispositivoEmpresa } from "../../types";
import type { EmpresaOperativaStock } from "../../api";
import { hexColorCaravana, normalizarColorCaravana } from "./stock-dispositivo-color";
import { colorEmpresaOperativa } from "./stock-empresa-utils";

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
  /** Muestra el color de la empresa a la izquierda del selector. */
  mostrarColorSwatch?: boolean;
}

export default function SelectEmpresaDispositivo({
  empresas,
  value,
  onChange,
  disabled = false,
  id,
  requiereSeleccion = false,
  mostrarColorSwatch = false,
}: Props) {
  const empresaCodigo = value === EMPRESA_PENDIENTE ? "" : value;
  const colorId = normalizarColorCaravana(
    colorEmpresaOperativa(empresaCodigo, empresas)
  );
  const colorHex = hexColorCaravana(colorId);

  const select = (
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

  if (!mostrarColorSwatch) return select;

  return (
    <div className="stock-empresa-select-wrap">
      <span
        className={`stock-color-caravana-swatch stock-empresa-select-swatch${
          colorHex ? "" : " stock-color-caravana-swatch--empty"
        }`}
        style={colorHex ? { backgroundColor: colorHex } : undefined}
        aria-hidden
      />
      {select}
    </div>
  );
}
