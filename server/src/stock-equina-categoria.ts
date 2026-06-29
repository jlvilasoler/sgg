type DispositivoSexo = "" | "MACHO" | "HEMBRA";
type DispositivoEstado = "VIVO" | "MUERTO" | "VENDIDO" | "FRIGORIFICO" | "PERDIDO";

const MACHO_FRONTERA_POTRO = 24;
const MACHO_FRONTERA_JOVEN = 48;
const HEMBRA_FRONTERA_POTRA = 24;
const HEMBRA_FRONTERA_YEGUA_JOVEN = 48;

const CATEGORIA_LABELS: Record<string, string> = {
  POTRA: "Potra",
  YEGUA_JOVEN: "Yegua joven",
  YEGUA: "Yegua",
  POTRO: "Potro",
  CABALLO_JOVEN: "Caballo joven",
  CABALLO: "Caballo",
  SEMENTAL: "Semental",
  SIN_SEXO: "Sin sexo definido",
};

function esEstadoConBaja(estado: DispositivoEstado): boolean {
  return estado === "MUERTO" || estado === "VENDIDO" || estado === "FRIGORIFICO" || estado === "PERDIDO";
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
    const mesesBaja = calcularMesesEntreFechas(nacimientoMes, nacimientoAnio, bajaMes, bajaAnio);
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
    if (meses < HEMBRA_FRONTERA_POTRA) return ["POTRA"];
    if (meses < HEMBRA_FRONTERA_YEGUA_JOVEN) return ["YEGUA_JOVEN"];
    return ["YEGUA"];
  }

  if (d.sexo === "MACHO") {
    if (meses < MACHO_FRONTERA_POTRO) return ["POTRO"];
    if (meses < MACHO_FRONTERA_JOVEN) return ["CABALLO_JOVEN"];
    return ["CABALLO", "SEMENTAL"];
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
}): string {
  const keys = categoriasDispositivo(d);
  if (!keys.length) return "Sin categoría";
  return keys.map((k) => CATEGORIA_LABELS[k] ?? k).join(" / ");
}
