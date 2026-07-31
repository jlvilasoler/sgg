type DispositivoSexo = "" | "MACHO" | "HEMBRA";
type DispositivoEstado = "VIVO" | "MUERTO" | "VENDIDO" | "FRIGORIFICO" | "PERDIDO";

/** Prefijo EID de IDs internos genéricos (distinto del RFID 858 y equino 600). */
export const OVINO_ID_PREFIJO = "199";
/** Primer ID asignado en alta genérica (global, todas las cuentas). */
export const OVINO_ID_PRIMERO = "1990000000000000010";
/** Valor inicial de la secuencia: el próximo emitido es OVINO_ID_PRIMERO. */
export const OVINO_ID_SEED_ULTIMO = "1990000000000000009";

export type CategoriaOvino =
  | "CORDERA"
  | "BORREGA"
  | "OVEJA"
  | "CORDERO"
  | "BORREGO"
  | "CAPON"
  | "CARNERO";

export const CATEGORIAS_OVINO_HEMBRA: readonly CategoriaOvino[] = [
  "CORDERA",
  "BORREGA",
  "OVEJA",
];

export const CATEGORIAS_OVINO_MACHO: readonly CategoriaOvino[] = [
  "CORDERO",
  "BORREGO",
  "CAPON",
  "CARNERO",
];

const CATEGORIAS_HEMBRA_SET = new Set<string>(CATEGORIAS_OVINO_HEMBRA);
const CATEGORIAS_MACHO_SET = new Set<string>(CATEGORIAS_OVINO_MACHO);

export const CATEGORIA_OVINO_LABELS: Record<CategoriaOvino, string> = {
  CORDERA: "Cordera",
  BORREGA: "Borrega",
  OVEJA: "Oveja",
  CORDERO: "Cordero",
  BORREGO: "Borrego",
  CAPON: "Capón",
  CARNERO: "Carnero",
};

/** Fronteras de edad en meses (0–12 / 12–36 / 36+). */
export const OVINO_FRONTERA_JOVEN = 12;
export const OVINO_FRONTERA_ADULTO = 36;

const CATEGORIA_LABELS: Record<string, string> = {
  ...CATEGORIA_OVINO_LABELS,
  SIN_SEXO: "Sin sexo definido",
};

export function esCategoriaOvino(raw: string): raw is CategoriaOvino {
  return CATEGORIAS_HEMBRA_SET.has(raw) || CATEGORIAS_MACHO_SET.has(raw);
}

export function validarSexoCategoria(
  sexo: DispositivoSexo,
  categoria: string
): CategoriaOvino {
  if (!esCategoriaOvino(categoria)) {
    throw new Error("Categoría ovina inválida.");
  }
  if (sexo === "HEMBRA" && !CATEGORIAS_HEMBRA_SET.has(categoria)) {
    throw new Error("Para hembras usá Cordera, Borrega u Oveja.");
  }
  if (sexo === "MACHO" && !CATEGORIAS_MACHO_SET.has(categoria)) {
    throw new Error("Para machos usá Cordero, Borrego, Capón o Carnero.");
  }
  if (sexo !== "MACHO" && sexo !== "HEMBRA") {
    throw new Error("Sexo inválido. Use MACHO o HEMBRA.");
  }
  return categoria;
}

/** Meses estimados al alta genérica (mitad del rango). */
export function mesesEstimadosCategoria(categoria: CategoriaOvino): number {
  switch (categoria) {
    case "CORDERA":
    case "CORDERO":
      return 6;
    case "BORREGA":
    case "BORREGO":
      return 24;
    case "OVEJA":
    case "CAPON":
    case "CARNERO":
      return 48;
  }
}

/** Categoría por sexo y edad en meses. Macho adulto requiere castrado (capón vs carnero). */
export function categoriaDesdeSexoYEdad(
  sexo: DispositivoSexo,
  edadMeses: number,
  castrado?: boolean | null
): CategoriaOvino {
  if (sexo !== "MACHO" && sexo !== "HEMBRA") {
    throw new Error("Sexo inválido. Use MACHO o HEMBRA.");
  }
  if (!Number.isFinite(edadMeses) || edadMeses < 0) {
    throw new Error("Edad inválida.");
  }

  if (sexo === "HEMBRA") {
    if (edadMeses < OVINO_FRONTERA_JOVEN) return "CORDERA";
    if (edadMeses < OVINO_FRONTERA_ADULTO) return "BORREGA";
    return "OVEJA";
  }

  if (edadMeses < OVINO_FRONTERA_JOVEN) return "CORDERO";
  if (edadMeses < OVINO_FRONTERA_ADULTO) return "BORREGO";
  if (castrado === true) return "CAPON";
  if (castrado === false) return "CARNERO";
  throw new Error(
    "Para machos de 36 meses o más indicá si es Capón (castrado) o Carnero."
  );
}

/** null = no aplica (jóvenes); true = Capón; false = Carnero. */
export function castradoDesdeCategoria(categoria: CategoriaOvino): boolean | null {
  if (categoria === "CAPON") return true;
  if (categoria === "CARNERO") return false;
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

export function formatOvinoIdDisplay(clave: string): string {
  const digits = clave.replace(/\D/g, "");
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)} ${digits.slice(3)}`;
}

export function splitOvinoIdInterno(claveCompleta: string): { eid: string; vid: string } {
  const digits = claveCompleta.replace(/\D/g, "");
  if (digits.startsWith(OVINO_ID_PREFIJO) && digits.length > OVINO_ID_PREFIJO.length) {
    return {
      eid: OVINO_ID_PREFIJO,
      vid: digits.slice(OVINO_ID_PREFIJO.length),
    };
  }
  return { eid: digits.slice(0, 3) || OVINO_ID_PREFIJO, vid: digits.slice(3) };
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
  if (esCategoriaOvino(catGuardada)) {
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
    if (meses < OVINO_FRONTERA_JOVEN) return ["CORDERA"];
    if (meses < OVINO_FRONTERA_ADULTO) return ["BORREGA"];
    return ["OVEJA"];
  }

  if (d.sexo === "MACHO") {
    if (meses < OVINO_FRONTERA_JOVEN) return ["CORDERO"];
    if (meses < OVINO_FRONTERA_ADULTO) return ["BORREGO"];
    if (d.castrado === true) return ["CAPON"];
    if (d.castrado === false) return ["CARNERO"];
    return ["CAPON", "CARNERO"];
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
