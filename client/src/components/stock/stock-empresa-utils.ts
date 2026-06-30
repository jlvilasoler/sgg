import type { EmpresaOperativaStock } from "../../api";

/** Muestra el nombre de la empresa operativa; `codigo` en BD es E00001, etc. */
export function fmtEmpresaOperativa(
  codigo: string | null | undefined,
  empresas: EmpresaOperativaStock[]
): string {
  const c = (codigo ?? "").trim();
  if (!c) return "—";
  const up = c.toUpperCase();
  const match = empresas.find(
    (e) =>
      e.codigo.trim().toUpperCase() === up ||
      e.nombre.trim().toUpperCase() === up
  );
  return match?.nombre ?? c;
}
