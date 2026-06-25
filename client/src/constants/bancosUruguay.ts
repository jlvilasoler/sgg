/**
 * Catálogo de bancos en Uruguay (BCU) con dominio para favicon y color de respaldo.
 */
export interface BancoCatalogoEntry {
  nombre: string;
  domain: string;
  color: string;
  iniciales: string;
  /** Logo local o URL fija; tiene prioridad sobre el favicon del dominio. */
  logo?: string;
}

export const BANCOS_CATALOGO: readonly BancoCatalogoEntry[] = [
  {
    nombre: "BANCO REPÚBLICA (BROU)",
    domain: "brou.com.uy",
    color: "#00843d",
    iniciales: "BR",
    logo: "/logos-bancos/brou.svg",
  },
  {
    nombre: "BANCO SANTANDER URUGUAY",
    domain: "santander.com.uy",
    color: "#ec0000",
    iniciales: "SA",
  },
  {
    nombre: "BANCO ITAÚ URUGUAY",
    domain: "itau.com.uy",
    color: "#ff7500",
    iniciales: "IT",
    logo: "/logos-bancos/itau.svg",
  },
  {
    nombre: "BBVA URUGUAY",
    domain: "bbva.com.uy",
    color: "#004481",
    iniciales: "BB",
  },
  {
    nombre: "SCOTIABANK URUGUAY",
    domain: "scotiabank.com.uy",
    color: "#e41e26",
    iniciales: "SC",
  },
  {
    nombre: "BANCO HIPOTECARIO DEL URUGUAY (BHU)",
    domain: "bhu.com.uy",
    color: "#003d7a",
    iniciales: "BH",
  },
  {
    nombre: "PREX URUGUAY",
    domain: "prexcard.com",
    color: "#7b2cbf",
    iniciales: "PX",
  },
  {
    nombre: "MI DINERO",
    domain: "midinero.com.uy",
    color: "#00a651",
    iniciales: "MD",
  },
];

export const BANCO_OTRO = "OTRO (ESPECIFICAR)";

/** @deprecated Usar BANCOS_CATALOGO */
export const BANCOS_URUGUAY: readonly string[] = BANCOS_CATALOGO.map((b) => b.nombre);

export function faviconUrl(domain: string, size = 64): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
}

/** URL del logo a mostrar (local/URL fija o favicon por dominio). */
export function bancoLogoSrc(info: BancoCatalogoEntry, size = 64): string | null {
  if (info.logo?.trim()) return info.logo.trim();
  if (info.domain?.trim()) return faviconUrl(info.domain, size);
  return null;
}

function mismoNombreBanco(a: string, b: string): boolean {
  return (
    a.localeCompare(b, "es", { sensitivity: "accent" }) === 0 ||
    a.toLocaleUpperCase("es-UY") === b.toLocaleUpperCase("es-UY")
  );
}

export function getBancoInfo(nombre: string): BancoCatalogoEntry | null {
  const v = nombre.trim();
  if (!v || mismoNombreBanco(v, BANCO_OTRO) || v.toLocaleUpperCase("es-UY") === "OTRO (ESPECIFICAR)") {
    return null;
  }
  return BANCOS_CATALOGO.find((b) => mismoNombreBanco(b.nombre, v)) ?? null;
}

/** Catálogo estándar o entrada genérica para bancos guardados a mano. */
export function getBancoInfoOrCustom(nombre: string): BancoCatalogoEntry | null {
  const std = getBancoInfo(nombre);
  if (std) return std;
  const v = nombre.trim();
  if (!v || v === BANCO_OTRO) return null;
  return {
    nombre: v,
    domain: "",
    color: "#5c6b5f",
    iniciales: v.slice(0, 2).toUpperCase() || "??",
  };
}

/** Lista para el selector, incluyendo banco guardado si no está en catálogo. */
export function listarBancosCatalogo(valorActual = ""): BancoCatalogoEntry[] {
  const map = new Map<string, BancoCatalogoEntry>();
  for (const b of BANCOS_CATALOGO) {
    map.set(b.nombre, b);
  }
  const v = valorActual.trim();
  if (v && !esBancoOtro(v)) {
    const std = getBancoInfo(v);
    if (std) {
      map.set(std.nombre, std);
    } else {
      const clave = v.toLocaleUpperCase("es-UY");
      if (!map.has(clave)) {
        map.set(clave, {
          nombre: clave,
          domain: "",
          color: "#5c6b5f",
          iniciales: clave.slice(0, 2) || "??",
        });
      }
    }
  }
  return [...map.values()].sort((a, b) =>
    a.nombre.localeCompare(b.nombre, "es", { sensitivity: "accent" })
  );
}

export function opcionesBancoUruguay(valorActual = ""): string[] {
  return listarBancosCatalogo(valorActual).map((b) => b.nombre);
}

export function esBancoOtro(valor: string): boolean {
  const v = valor.trim();
  if (!v) return false;
  return (
    v === BANCO_OTRO ||
    v.toLocaleUpperCase("es-UY") === BANCO_OTRO ||
    v.toLocaleUpperCase("es-UY") === "OTRO (ESPECIFICAR)"
  );
}

export function isBancoSantander(nombre: string): boolean {
  const info = getBancoInfo(nombre);
  if (info?.domain === "santander.com.uy") return true;
  return nombre.trim().toLocaleUpperCase("es-UY").includes("SANTANDER");
}
