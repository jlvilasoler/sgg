export interface ResumenEmpresaScope {
  empresa?: string;
  empresas?: string[];
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
