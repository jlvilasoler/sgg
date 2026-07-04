const MODULO_AREA_LABELS: Record<string, string> = {
  auth: "cuenta y acceso",
  presupuesto: "gastos y presupuesto",
  proveedores: "proveedores",
  rubros: "rubros de gastos",
  "sub-rubros": "sub-rubros de gastos",
  divisas: "divisas",
  rrhh: "recursos humanos",
  funcionarios: "recursos humanos",
  "ingresos-ventas": "ingresos por ventas",
  "venta-sub-rubros": "rubros de ventas",
  "venta-sub-rubro-items": "ítems de ventas",
  "venta-grupo-iconos": "iconos de ventas",
  "stock-ganadero": "stock ganadero",
  "stock-equino": "stock equino",
  "stock-movimientos": "movimientos de dispositivos",
  notas: "notas",
  chat: "chat interno",
  "vencimientos-impuestos": "vencimientos de impuestos",
  "contribucion-rural": "contribución rural",
  "patente-sucive": "patente SUCIVE",
  "bps-caja-rural": "BPS caja rural",
  "primaria-rural": "primaria rural",
  documentos: "documentos digitales",
  "documentos-digitales": "documentos digitales",
  "empresas-cuenta": "cuentas de actividad",
  empresas: "empresas",
  usuarios: "usuarios",
  "simulaciones-venta-ganado": "simulador de venta de ganado",
  "precios-ganado": "precios de ganado",
  configuracion: "configuración",
  health: "sistema",
};

const VERB_BY_METHOD: Record<string, string> = {
  POST: "Registró un cambio en",
  PUT: "Actualizó datos en",
  PATCH: "Modificó datos en",
  DELETE: "Eliminó un registro en",
};

function humanizeApiPath(method: string, path: string): string | null {
  const m = method.toUpperCase();
  const p = path.toLowerCase().replace(/^\/api\//, "");

  if (p === "auth/presencia") return null;

  if (p.startsWith("presupuesto")) {
    if (m === "POST") return "Ingresó un gasto";
    if (m === "PUT" || m === "PATCH") return "Editó un gasto";
    if (m === "DELETE") return "Eliminó un gasto";
  }
  if (p.startsWith("proveedores")) {
    if (m === "POST") return "Agregó un proveedor";
    if (m === "PUT" || m === "PATCH") return "Actualizó un proveedor";
    if (m === "DELETE") return "Eliminó un proveedor";
  }
  if (p.startsWith("rubros") || p.startsWith("sub-rubros")) {
    if (m === "POST") return "Creó un rubro o sub-rubro de gastos";
    if (m === "PUT" || m === "PATCH") return "Actualizó rubros o sub-rubros de gastos";
    if (m === "DELETE") return "Eliminó un rubro o sub-rubro de gastos";
  }
  if (p.startsWith("divisas")) {
    if (m === "POST") return "Cargó o importó tipos de cambio";
    if (m === "DELETE") return "Eliminó un registro de divisas";
  }
  if (p.startsWith("rrhh") || p.startsWith("funcionarios")) {
    if (m === "POST") return "Registró un funcionario";
    if (m === "PUT" || m === "PATCH") return "Actualizó datos de un funcionario";
    if (m === "DELETE") return "Eliminó un funcionario";
  }
  if (p.startsWith("ingresos-ventas")) {
    if (p.includes("agricultura")) {
      if (m === "POST") return "Registró una venta de agricultura";
      if (m === "PUT" || m === "PATCH") return "Actualizó una venta de agricultura";
      if (m === "DELETE") return "Eliminó una venta de agricultura";
    }
    if (p.includes("arrendamientos")) {
      if (m === "POST") return "Registró un arrendamiento";
      if (m === "PUT" || m === "PATCH") return "Actualizó un arrendamiento";
      if (m === "DELETE") return "Eliminó un arrendamiento";
    }
    if (p.includes("ganado-cerradas")) {
      if (m === "PATCH") return "Actualizó una venta de ganado cerrada";
    }
    if (m === "POST") return "Registró un ingreso por venta";
    if (m === "PUT" || m === "PATCH") return "Actualizó un ingreso por venta";
    if (m === "DELETE") return "Eliminó un ingreso por venta";
  }
  if (p.startsWith("venta-sub-rubros") || p.startsWith("venta-sub-rubro-items") || p.startsWith("venta-grupo-iconos")) {
    if (m === "POST") return "Configuró rubros o ítems de ventas";
    if (m === "PUT" || m === "PATCH") return "Actualizó la configuración de ventas";
    if (m === "DELETE") return "Eliminó datos de la configuración de ventas";
  }
  if (p.startsWith("stock-ganadero") || p.startsWith("stock-equino")) {
    const modulo = p.startsWith("stock-equino") ? "stock equino" : "stock ganadero";
    if (p.includes("/baja")) return `Registró una baja en ${modulo}`;
    if (p.includes("/import") || p.includes("/file") || p.includes("/text") || p.includes("/rows")) {
      return `Importó movimientos en ${modulo}`;
    }
    if (p.includes("bulk-delete") || p.includes("wipe-all")) return `Eliminó registros de ${modulo}`;
    if (p.includes("backup/restore")) return `Restauró un respaldo de ${modulo}`;
    if (p.includes("control-sanitario")) {
      if (p.includes("producto-ficha")) {
        if (m === "PUT") return `Actualizó una ficha sanitaria en ${modulo}`;
        if (m === "DELETE") return `Eliminó una ficha sanitaria en ${modulo}`;
      }
      if (p.includes("dispositivos")) return `Registró un tratamiento sanitario en ${modulo}`;
      return null;
    }
    if (p.includes("/foto")) return `Actualizó fotos de un animal en ${modulo}`;
    if (p.includes("/potreros")) return m === "POST" ? `Creó un potrero en ${modulo}` : `Modificó potreros en ${modulo}`;
    if (p.includes("/grupos")) return `Organizó grupos en ${modulo}`;
    if (p.includes("/razas")) return `Actualizó razas en ${modulo}`;
    if (p.includes("/cabana")) return `Actualizó la cabaña en ${modulo}`;
    if (m === "POST") return `Registró un movimiento en ${modulo}`;
    if (m === "PUT" || m === "PATCH") return `Modificó un animal en ${modulo}`;
    if (m === "DELETE") return `Eliminó un registro de ${modulo}`;
  }
  if (p.startsWith("notas")) {
    return null;
  }
  if (p.startsWith("chat/")) {
    if (p.includes("/messages")) return m === "POST" ? "Envió un mensaje en el chat" : null;
    if (p.includes("/read")) return null;
    if (p.includes("/channels")) return m === "POST" ? "Creó un canal de chat" : null;
    if (p.includes("/contacts/external")) return "Gestionó contactos del chat";
  }
  if (
    p.startsWith("vencimientos-impuestos") ||
    p.startsWith("contribucion-rural") ||
    p.startsWith("patente-sucive") ||
    p.startsWith("bps-caja-rural") ||
    p.startsWith("primaria-rural")
  ) {
    if (p.includes("calendarios") || p.includes("preferencias")) {
      return "Actualizó la configuración de vencimientos de impuestos";
    }
  }
  if (p.startsWith("auth/users")) {
    if (m === "POST") return "Creó un usuario";
    if (m === "PATCH") return "Actualizó un usuario";
  }
  if (p.startsWith("auth/role-permissions") && m === "PATCH") {
    return "Actualizó permisos de un rol";
  }
  if (p.startsWith("auth/cambiar-password")) return "Cambió su contraseña";
  if (p.startsWith("empresas-cuenta")) {
    if (m === "POST") return "Creó o actualizó una cuenta de actividad";
    if (m === "PUT" || m === "PATCH") return "Modificó una cuenta de actividad";
    if (m === "DELETE") return "Eliminó una cuenta de actividad";
  }
  if (p.startsWith("documentos")) {
    if (m === "POST") return "Subió o registró un documento digital";
    if (m === "PUT" || m === "PATCH") return "Actualizó un documento digital";
    if (m === "DELETE") return "Eliminó un documento digital";
  }

  const areaKey = p.split("/")[0] ?? p;
  const area = MODULO_AREA_LABELS[areaKey] ?? areaKey.replace(/-/g, " ");
  const verb = VERB_BY_METHOD[m];
  if (!verb) return null;
  return `${verb} ${area}`;
}

function fixLegacyEncoding(text: string): string {
  return text
    .replace(/Cre\?/g, "Creó")
    .replace(/Modific\?/g, "Modificó")
    .replace(/Elimin\?/g, "Eliminó")
    .replace(/Actualiz\?/g, "Actualizó")
    .replace(/Import\?/g, "Importó")
    .replace(/Registr\?/g, "Registró")
    .replace(/Cambi\?/g, "Cambió")
    .replace(/Contrase\?a/g, "Contraseña")
    .replace(/sesi\?n/g, "sesión")
    .replace(/Navegaci\?n/g, "Navegación")
    .replace(/Acci\?n/g, "Acción");
}

/** Texto legible para la columna Actividad del historial. */
export function formatActividadDetalle(
  detalle: string | null | undefined,
  evento?: string
): string {
  const raw = fixLegacyEncoding(detalle?.trim() ?? "");
  if (!raw) {
    if (evento === "navegacion") return "Navegó por la aplicación";
    if (evento === "login_ok") return "Inició sesión correctamente";
    if (evento === "logout") return "Cerró sesión";
    return "Acción en el sistema";
  }

  const navLegacy = raw.match(/^Accedió a:\s*(.+)$/i);
  if (navLegacy) return `Abrió la pantalla «${navLegacy[1]}»`;

  const navNew = raw.match(/^Visitó el módulo «(.+)»$/i);
  if (navNew) return `Abrió la pantalla «${navNew[1]}»`;

  if (/^operaci[oó]n\s+post\s+en\s+auth\/presencia$/i.test(raw)) {
    return "Siguió conectado a la aplicación";
  }

  const opMatch = raw.match(/^Operaci[oó]n\s+(POST|PUT|PATCH|DELETE)\s+en\s+(.+)$/i);
  if (opMatch) {
    const human = humanizeApiPath(opMatch[1]!, `/api/${opMatch[2]!}`);
    if (human) return human;
  }

  if (/^actualizó usuario:/i.test(raw)) {
    return raw.replace(/^actualizó usuario:/i, "Actualizó el usuario");
  }

  return raw;
}

export { humanizeApiPath };
