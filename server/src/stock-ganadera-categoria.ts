type DispositivoSexo = "" | "MACHO" | "HEMBRA";
type DispositivoEstado = "VIVO" | "MUERTO" | "VENDIDO" | "FRIGORIFICO" | "PERDIDO";

const MACHO_FRONTERA_TERNERO = 12;
const MACHO_FRONTERA_NOVILLO = 24;
const HEMBRA_FRONTERA_TERNERA = 12;
const HEMBRA_FRONTERA_VAQUILLONA = 24;
const HEMBRA_FRONTERA_VAQUILLONA_MAS_2 = 36;

const CATEGORIA_LABELS: Record<string, string> = {
  TERNERA: "Ternera",
  VAQUILLONA_1_2: "Vaquillona 1–2",
  VAQUILLONA_MAS_2: "Vaquillona +2",
  VACA: "Vaca",
  TERNERO: "Ternero",
  NOVILLO_1_2: "Novillo 1–2",
  TORO_1_2: "Toro 1–2",
  NOVILLO_MAS_2: "Novillo +2",
  TORO_MAS_2: "Toro +2",
  SIN_SEXO: "Sin sexo definido",
};

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

function etapaHembraDesdeMeses(meses: number): "TERNERA" | "VAQUILLONA" | "VAQUILLONA_MAS_2" | "VACA" {
  if (meses < HEMBRA_FRONTERA_TERNERA) return "TERNERA";
  if (meses < HEMBRA_FRONTERA_VAQUILLONA) return "VAQUILLONA";
  if (meses < HEMBRA_FRONTERA_VAQUILLONA_MAS_2) return "VAQUILLONA_MAS_2";
  return "VACA";
}

function etapaMachoDesdeMeses(meses: number): "TERNERO" | "JOVEN_1_2" | "MAS_2" {
  if (meses < MACHO_FRONTERA_TERNERO) return "TERNERO";
  if (meses < MACHO_FRONTERA_NOVILLO) return "JOVEN_1_2";
  return "MAS_2";
}

function categoriasDispositivo(d: {
  sexo: DispositivoSexo;
  edad: number | null;
  nacimiento_mes: number | null;
  nacimiento_anio: number | null;
  estado: DispositivoEstado;
  baja_mes: number | null;
  baja_anio: number | null;
}): string[] {
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
    const etapa = etapaHembraDesdeMeses(meses);
    const map = {
      TERNERA: "TERNERA",
      VAQUILLONA: "VAQUILLONA_1_2",
      VAQUILLONA_MAS_2: "VAQUILLONA_MAS_2",
      VACA: "VACA",
    } as const;
    return [map[etapa]];
  }

  if (d.sexo === "MACHO") {
    const etapa = etapaMachoDesdeMeses(meses);
    if (etapa === "TERNERO") return ["TERNERO"];
    if (etapa === "JOVEN_1_2") return ["NOVILLO_1_2", "TORO_1_2"];
    return ["NOVILLO_MAS_2", "TORO_MAS_2"];
  }

  return ["SIN_SEXO"];
}

/** Etiqueta legible de categoría al momento de la baja. */
export function labelCategoriaSalidaDispositivo(d: {
  sexo: DispositivoSexo;
  edad: number | null;
  nacimiento_mes: number | null;
  nacimiento_anio: number | null;
  estado: DispositivoEstado;
  baja_mes: number | null;
  baja_anio: number | null;
}): string {
  const keys = categoriasDispositivo(d);
  if (!keys.length) return "Sin categoría";
  return keys.map((k) => CATEGORIA_LABELS[k] ?? k).join(" / ");
}
