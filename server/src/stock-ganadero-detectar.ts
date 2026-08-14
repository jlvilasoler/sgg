import type { StockGanaderaDispositivo } from "./stock-ganadero-db.js";
import { dispositivoClave } from "./stock-ganadero-id.js";
import type { StockGanaderoRowInput } from "./parse-stock-ganadero-txt.js";

const MESES = [
  "",
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

export interface EmpresaNombreRef {
  codigo: string;
  nombre: string;
}

export interface DetectarDispositivoEnriquecido {
  eid: string;
  vid: string;
  fecha_archivo: string;
  hora_archivo: string;
  condicion_archivo: string;
  encontrado: boolean;
  empresa: string;
  establecimiento: string;
  sexo: string;
  fecha_nacimiento: string;
  potrero: string;
  ultima_lectura: string;
  edad: string;
}

function fmtEmpresa(
  codigo: string | null | undefined,
  empresas: EmpresaNombreRef[]
): string {
  const c = (codigo ?? "").trim();
  if (!c) return "";
  const up = c.toUpperCase();
  const match = empresas.find(
    (e) =>
      e.codigo.trim().toUpperCase() === up ||
      e.nombre.trim().toUpperCase() === up
  );
  return match?.nombre ?? c;
}

function fmtNacimiento(mes: number | null, anio: number | null): string {
  if (!mes || !anio) return "";
  const nombre = MESES[mes];
  return nombre ? `${nombre} ${anio}` : "";
}

function calcularEdadMeses(mes: number | null, anio: number | null): number | null {
  if (!mes || !anio) return null;
  const now = new Date();
  const mesActual = now.getMonth() + 1;
  const anioActual = now.getFullYear();
  return Math.max(0, (anioActual - anio) * 12 + (mesActual - mes));
}

function fmtEdad(mes: number | null, anio: number | null): string {
  const meses = calcularEdadMeses(mes, anio);
  if (meses === null) return "";
  const anios = meses / 12;
  const aniosTxt = anios.toLocaleString("es-UY", {
    minimumFractionDigits: meses % 12 !== 0 ? 1 : 0,
    maximumFractionDigits: meses % 12 !== 0 ? 1 : 0,
  });
  return `${meses} meses (${aniosTxt} años)`;
}

function fmtUltimaLectura(fecha: string, hora: string): string {
  const f = (fecha ?? "").trim();
  const h = (hora ?? "").trim();
  if (!f && !h) return "";
  if (f && h) return `${f} ${h}`;
  return f || h;
}

function fmtSexo(sexo: string | null | undefined): string {
  const s = (sexo ?? "").trim().toUpperCase();
  if (s === "MACHO") return "Macho";
  if (s === "HEMBRA") return "Hembra";
  return "";
}

/** Cruza filas del archivo con dispositivos de la misma cuenta (nunca de otras). */
export function enriquecerDetectarDispositivos(
  filasArchivo: StockGanaderoRowInput[],
  dispositivosCuenta: StockGanaderaDispositivo[],
  empresas: EmpresaNombreRef[],
  establecimientoCuenta: string
): DetectarDispositivoEnriquecido[] {
  const porClave = new Map<string, StockGanaderaDispositivo>();
  for (const d of dispositivosCuenta) {
    const clave = (d.clave || dispositivoClave(d.eid, d.vid)).replace(/\D/g, "");
    if (clave) porClave.set(clave, d);
  }

  const establecimientoFallback = establecimientoCuenta.trim() || "";

  return filasArchivo.map((row) => {
    const clave = dispositivoClave(row.eid, row.vid);
    const d = clave ? porClave.get(clave) : undefined;
    if (!d) {
      return {
        eid: row.eid,
        vid: row.vid,
        fecha_archivo: row.fecha ?? "",
        hora_archivo: row.hora ?? "",
        condicion_archivo: row.condicion ?? "",
        encontrado: false,
        empresa: "",
        establecimiento: "",
        sexo: "",
        fecha_nacimiento: "",
        potrero: "",
        ultima_lectura: "",
        edad: "",
      };
    }

    const empresaNombre = fmtEmpresa(d.empresa, empresas);
    return {
      eid: d.eid || row.eid,
      vid: d.vid || row.vid,
      fecha_archivo: row.fecha ?? "",
      hora_archivo: row.hora ?? "",
      condicion_archivo: row.condicion ?? "",
      encontrado: true,
      empresa: empresaNombre,
      establecimiento: establecimientoFallback || empresaNombre,
      sexo: fmtSexo(d.sexo),
      fecha_nacimiento: fmtNacimiento(d.nacimiento_mes, d.nacimiento_anio),
      potrero: (d.potrero ?? "").trim(),
      ultima_lectura: fmtUltimaLectura(d.ultima_fecha, d.ultima_hora),
      edad: fmtEdad(d.nacimiento_mes, d.nacimiento_anio),
    };
  });
}

/** Texto TSV listo para descargar (.txt / .csv). */
export function detectarDispositivosToTsv(rows: DetectarDispositivoEnriquecido[]): string {
  const headers = [
    "EID",
    "VID",
    "Date",
    "Time",
    "Condición",
    "Empresa",
    "Establecimiento",
    "Sexo",
    "Fecha nacimiento",
    "Potrero",
    "Ultima lectura",
    "Edad",
    "Encontrado",
  ];
  const lines = [headers.join("\t")];
  for (const r of rows) {
    lines.push(
      [
        r.eid,
        r.vid,
        r.fecha_archivo,
        r.hora_archivo,
        r.condicion_archivo,
        r.empresa,
        r.establecimiento,
        r.sexo,
        r.fecha_nacimiento,
        r.potrero,
        r.ultima_lectura,
        r.edad,
        r.encontrado ? "SI" : "NO",
      ].join("\t")
    );
  }
  return lines.join("\r\n") + "\r\n";
}
