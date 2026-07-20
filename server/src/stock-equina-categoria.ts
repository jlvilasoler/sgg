type DispositivoSexo = "" | "MACHO" | "HEMBRA";
type DispositivoEstado = "VIVO" | "MUERTO" | "VENDIDO" | "FRIGORIFICO" | "PERDIDO";

/** Prefijo EID de IDs internos genéricos (distinto del RFID 858). */
export const EQUINO_ID_PREFIJO = "600";
/** Primer ID asignado en alta genérica (global, todas las cuentas). */
export const EQUINO_ID_PRIMERO = "6000000000000000010";
/** Valor inicial de la secuencia: el próximo emitido es EQUINO_ID_PRIMERO. */
export const EQUINO_ID_SEED_ULTIMO = "6000000000000000009";

export type CategoriaEquino =
  | "POTRANCA"
  | "POTRA"
  | "YEGUA"
  | "POTRILLO"
  | "POTRO"
  | "CABALLO"
  | "PADRILLO";

export const CATEGORIAS_EQUINO_HEMBRA: readonly CategoriaEquino[] = [
  "POTRANCA",
  "POTRA",
  "YEGUA",
];

export const CATEGORIAS_EQUINO_MACHO: readonly CategoriaEquino[] = [
  "POTRILLO",
  "POTRO",
  "CABALLO",
  "PADRILLO",
];

const CATEGORIAS_HEMBRA_SET = new Set<string>(CATEGORIAS_EQUINO_HEMBRA);
const CATEGORIAS_MACHO_SET = new Set<string>(CATEGORIAS_EQUINO_MACHO);

export const CATEGORIA_EQUINO_LABELS: Record<CategoriaEquino, string> = {
  POTRANCA: "Potranca",
  POTRA: "Potra",
  YEGUA: "Yegua",
  POTRILLO: "Potrillo",
  POTRO: "Potro",
  CABALLO: "Caballo",
  PADRILLO: "Padrillo",
};

/** Fronteras de edad en meses (plan: 0–12 / 12–36 / 36+). */
export const EQUINO_FRONTERA_JOVEN = 12;
export const EQUINO_FRONTERA_ADULTO = 36;

const CATEGORIA_LABELS: Record<string, string> = {
  ...CATEGORIA_EQUINO_LABELS,
  SIN_SEXO: "Sin sexo definido",
};

export function esCategoriaEquino(raw: string): raw is CategoriaEquino {
  return CATEGORIAS_HEMBRA_SET.has(raw) || CATEGORIAS_MACHO_SET.has(raw);
}

export function validarSexoCategoria(
  sexo: DispositivoSexo,
  categoria: string
): CategoriaEquino {
  if (!esCategoriaEquino(categoria)) {
    throw new Error("Categoría equina inválida.");
  }
  if (sexo === "HEMBRA" && !CATEGORIAS_HEMBRA_SET.has(categoria)) {
    throw new Error("Para hembras usá Potranca, Potra o Yegua.");
  }
  if (sexo === "MACHO" && !CATEGORIAS_MACHO_SET.has(categoria)) {
    throw new Error("Para machos usá Potrillo, Potro, Caballo o Padrillo.");
  }
  if (sexo !== "MACHO" && sexo !== "HEMBRA") {
    throw new Error("Sexo inválido. Use MACHO o HEMBRA.");
  }
  return categoria;
}

/** Meses estimados al alta genérica (mitad del rango). */
export function mesesEstimadosCategoria(categoria: CategoriaEquino): number {
  switch (categoria) {
    case "POTRANCA":
    case "POTRILLO":
      return 6;
    case "POTRA":
    case "POTRO":
      return 24;
    case "YEGUA":
    case "CABALLO":
    case "PADRILLO":
      return 48;
  }
}

/** Categoría por sexo y edad en meses. Macho adulto requiere castrado. */
export function categoriaDesdeSexoYEdad(
  sexo: DispositivoSexo,
  edadMeses: number,
  castrado?: boolean | null
): CategoriaEquino {
  if (sexo !== "MACHO" && sexo !== "HEMBRA") {
    throw new Error("Sexo inválido. Use MACHO o HEMBRA.");
  }
  if (!Number.isFinite(edadMeses) || edadMeses < 0) {
    throw new Error("Edad inválida.");
  }

  if (sexo === "HEMBRA") {
    if (edadMeses < EQUINO_FRONTERA_JOVEN) return "POTRANCA";
    if (edadMeses < EQUINO_FRONTERA_ADULTO) return "POTRA";
    return "YEGUA";
  }

  if (edadMeses < EQUINO_FRONTERA_JOVEN) return "POTRILLO";
  if (edadMeses < EQUINO_FRONTERA_ADULTO) return "POTRO";
  if (castrado === true) return "CABALLO";
  if (castrado === false) return "PADRILLO";
  throw new Error(
    "Para machos de 36 meses o más indicá si es Caballo (castrado) o Padrillo."
  );
}

/** null = no aplica (jóvenes); true = Caballo; false = Padrillo. */
export function castradoDesdeCategoria(categoria: CategoriaEquino): boolean | null {
  if (categoria === "CABALLO") return true;
  if (categoria === "PADRILLO") return false;
  return null;
}

export function nacimientoDesdeMesesAtras(mesesAtras: number): {
  nacimiento_mes: number;
  nacimiento_anio: number;
} {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - mesesAtras, 1);
  return {
    nacimiento_mes: d.getMonth() + 1,
    nacimiento_anio: d.getFullYear(),
  };
}

export function formatEquinoIdDisplay(clave: string): string {
  const digits = clave.replace(/\D/g, "");
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)} ${digits.slice(3)}`;
}

export function splitEquinoIdInterno(claveCompleta: string): { eid: string; vid: string } {
  const digits = claveCompleta.replace(/\D/g, "");
  if (digits.startsWith(EQUINO_ID_PREFIJO) && digits.length > EQUINO_ID_PREFIJO.length) {
    return {
      eid: EQUINO_ID_PREFIJO,
      vid: digits.slice(EQUINO_ID_PREFIJO.length),
    };
  }
  return { eid: digits.slice(0, 3) || EQUINO_ID_PREFIJO, vid: digits.slice(3) };
}

function esEstadoConBaja(estado: DispositivoEstado): boolean {
  return (
    estado === "MUERTO" ||
    estado === "VENDIDO" ||
    estado === "FRIGORIFICO" ||
    estado === "PERDIDO"
  );
}

function calcularMesesEntreFechas(
  desdeMes: number | null,
  desdeAnio: number | null,
  hastaMes: number | null,
  hastaAnio: number | null
): number | null {
  if (!desdeMes || !desdeAnio || !hastaMes || !hastaAnio) return null;
  return Math.max(0, (hastaAnio - desdeAnio) * 12 + (hastaMes - desdeMes));
}

function mesesReferenciaTimeline(
  estado: DispositivoEstado,
  edadMeses: number | null,
  nacimientoMes: number | null,
  nacimientoAnio: number | null,
  bajaMes: number | null,
  bajaAnio: number | null
): number | null {
  if (edadMeses === null) return null;
  if (esEstadoConBaja(estado) && bajaMes && bajaAnio) {
    const mesesBaja = calcularMesesEntreFechas(
      nacimientoMes,
      nacimientoAnio,
      bajaMes,
      bajaAnio
    );
    if (mesesBaja !== null) return mesesBaja;
  }
  return edadMeses;
}

function categoriasDispositivo(d: {
  sexo: DispositivoSexo;
  edad: number | null;
  nacimiento_mes: number | null;
  nacimiento_anio: number | null;
  estado: DispositivoEstado;
  baja_mes: number | null;
  baja_anio: number | null;
  categoria?: string | null;
  castrado?: boolean | null;
}): string[] {
  const catGuardada = String(d.categoria ?? "").trim().toUpperCase();
  if (esCategoriaEquino(catGuardada)) {
    return [catGuardada];
  }

  if (!d.sexo) return ["SIN_SEXO"];
  if (!d.nacimiento_mes || !d.nacimiento_anio) return [];
  const edadMeses = d.edad;
  if (edadMeses === null) return [];
  const meses = mesesReferenciaTimeline(
    d.estado,
    edadMeses,
    d.nacimiento_mes,
    d.nacimiento_anio,
    d.baja_mes,
    d.baja_anio
  );
  if (meses === null) return [];

  if (d.sexo === "HEMBRA") {
    if (meses < EQUINO_FRONTERA_JOVEN) return ["POTRANCA"];
    if (meses < EQUINO_FRONTERA_ADULTO) return ["POTRA"];
    return ["YEGUA"];
  }

  if (d.sexo === "MACHO") {
    if (meses < EQUINO_FRONTERA_JOVEN) return ["POTRILLO"];
    if (meses < EQUINO_FRONTERA_ADULTO) return ["POTRO"];
    if (d.castrado === true) return ["CABALLO"];
    if (d.castrado === false) return ["PADRILLO"];
    return ["CABALLO", "PADRILLO"];
  }

  return ["SIN_SEXO"];
}

export function labelCategoriaSalidaDispositivo(d: {
  sexo: DispositivoSexo;
  edad: number | null;
  nacimiento_mes: number | null;
  nacimiento_anio: number | null;
  estado: DispositivoEstado;
  baja_mes: number | null;
  baja_anio: number | null;
  categoria?: string | null;
  castrado?: boolean | null;
}): string {
  const keys = categoriasDispositivo(d);
  if (!keys.length) return "Sin categoría";
  return keys.map((k) => CATEGORIA_LABELS[k] ?? k).join(" / ");
}
