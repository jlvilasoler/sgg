export interface ResumenEmpresaScope {
  empresa?: string;
  empresas?: string[];
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
