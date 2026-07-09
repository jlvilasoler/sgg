export interface ResumenEmpresaScope {
  empresa?: string;
  empresas?: string[];
  /** Aislamiento multi-tenant: restringe gastos a una cuenta madre. */
  cuenta_id?: number;
}

export function assertEmpresaEnScope(
  empresa: string,
  scope?: ResumenEmpresaScope
): void {
  const nombre = empresa.trim();
  if (!nombre) throw new Error("La empresa es obligatoria.");
  if (!scope || (!scope.empresa && !scope.empresas?.length)) return;
  if (scope.empresa) {
    if (scope.empresa !== nombre) {
      throw new Error("Empresa inválida o no pertenece a su cuenta.");
    }
    return;
  }
  if (scope.empresas?.length && !scope.empresas.includes(nombre)) {
    throw new Error("Empresa inválida o no pertenece a su cuenta.");
  }
}

export function appendEmpresaScope(
  query: string,
  params: Record<string, string>,
  scope?: ResumenEmpresaScope,
  column = "empresa"
): string {
  if (scope?.empresas?.length) {
    const placeholders = scope.empresas.map((_, i) => `@empresa_${i}`);
    scope.empresas.forEach((nombre, i) => {
      params[`empresa_${i}`] = nombre;
    });
    return `${query} AND ${column} IN (${placeholders.join(", ")})`;
  }
  if (scope?.empresa) {
    params.empresa = scope.empresa;
    return `${query} AND ${column} = @empresa`;
  }
  return query;
}

export function appendCuentaScope(
  query: string,
  params: Record<string, string | number>,
  cuentaId?: number,
  column = "cuenta_id"
): string {
  if (cuentaId == null || cuentaId <= 0) return query;
  params.cuenta_id = cuentaId;
  return `${query} AND ${column} = @cuenta_id`;
}

/** Filtro de gastos por empresa operativa y cuenta madre (multi-tenant). */
export function appendPresupuestoScope(
  query: string,
  params: Record<string, string | number>,
  scope?: ResumenEmpresaScope,
  empresaColumn = "empresa"
): string {
  const empresaParams = params as Record<string, string>;
  let next = appendEmpresaScope(query, empresaParams, scope, empresaColumn);
  next = appendCuentaScope(next, params, scope?.cuenta_id);
  return next;
}
