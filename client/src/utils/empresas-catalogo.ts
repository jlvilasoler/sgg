import type { Empresa } from "../types";

export function empresasSelectOptions(
  empresas: string[]
): { value: Empresa; label: string }[] {
  return empresas.map((nombre) => ({ value: nombre, label: nombre }));
}
