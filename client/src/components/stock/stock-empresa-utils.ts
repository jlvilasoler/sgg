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

export function colorEmpresaOperativa(
  codigo: string | null | undefined,
  empresas: EmpresaOperativaStock[]
): string {
  const c = (codigo ?? "").trim();
  if (!c) return "";
  const up = c.toUpperCase();
  const match = empresas.find(
    (e) =>
      e.codigo.trim().toUpperCase() === up ||
      e.nombre.trim().toUpperCase() === up
  );
  return match?.color ?? "";
}

export const SIN_DICOSE_LABEL = "—";

/** Clave de filtro para animales cuya empresa no tiene DICOSE configurado. */
export const SIN_DICOSE_FILTRO_KEY = "__sin_dicose__";

function matchEmpresaOperativa(
  codigo: string | null | undefined,
  empresas: EmpresaOperativaStock[]
): EmpresaOperativaStock | undefined {
  const c = (codigo ?? "").trim();
  if (!c) return undefined;
  const up = c.toUpperCase();
  return empresas.find(
    (e) =>
      e.codigo.trim().toUpperCase() === up ||
      e.nombre.trim().toUpperCase() === up
  );
}

/** Número DICOSE de la empresa del dispositivo (vacío si no está cargado). */
export function dicoseEmpresaOperativa(
  codigo: string | null | undefined,
  empresas: EmpresaOperativaStock[]
): string {
  const match = matchEmpresaOperativa(codigo, empresas);
  return (match?.dicose ?? "").trim();
}

/** Texto para tabla/ficha: número o «—» si no hay DICOSE. */
export function fmtDicoseEmpresa(
  codigo: string | null | undefined,
  empresas: EmpresaOperativaStock[]
): string {
  const n = dicoseEmpresaOperativa(codigo, empresas);
  return n || SIN_DICOSE_LABEL;
}

/** Clave de faceta DICOSE (número o SIN_DICOSE_FILTRO_KEY). */
export function dicoseFiltroKey(
  codigoEmpresa: string | null | undefined,
  empresas: EmpresaOperativaStock[]
): string {
  const n = dicoseEmpresaOperativa(codigoEmpresa, empresas);
  return n || SIN_DICOSE_FILTRO_KEY;
}

export function labelDicoseFiltro(key: string): string {
  if (key === SIN_DICOSE_FILTRO_KEY || !key) return SIN_DICOSE_LABEL;
  return key;
}
