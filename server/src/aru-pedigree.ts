/**
 * Consulta pública de pedigree ARU (equinos) — https://aru.org.uy/rrgg/formulario.php
 * Solo lectura; no persiste datos. El HTML externo puede cambiar.
 */

const ARU_BASE = "https://aru.org.uy/rrgg";
const ARU_FORM = `${ARU_BASE}/formulario.php`;
const ARU_DATOS = `${ARU_BASE}/datos.php`;

export const ARU_FETCH_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-UY,es;q=0.9,en;q=0.8",
  Referer: ARU_FORM,
};

/** Razas equinas ARU (id → nombre), alineadas al combo del sitio. */
export const ARU_RAZAS_EQUINAS: { id: string; nombre: string }[] = [
  { id: "3", nombre: "AKHAL-TEKE" },
  { id: "51", nombre: "ANGLO ARABE" },
  { id: "22", nombre: "APENDICE CUARTO DE MILLA" },
  { id: "45", nombre: "APPALOOSA" },
  { id: "47", nombre: "ARABE" },
  { id: "27", nombre: "CRIOLLA" },
  { id: "53", nombre: "CRUZA TEKE" },
  { id: "44", nombre: "CRUZARABE" },
  { id: "36", nombre: "CUARTO DE MILLA (CRUZA)" },
  { id: "35", nombre: "CUARTO DE MILLA DEFINITIVO" },
  { id: "5", nombre: "LUSITANO" },
  { id: "10", nombre: "LUSITANO PREPARATORIO" },
  { id: "20", nombre: "PAINT" },
  { id: "18", nombre: "PERUANO DE PASO" },
  { id: "6", nombre: "PURA RAZA ESPAÑOLA" },
  { id: "29", nombre: "SHETLAND PONY" },
];

export type AruBuscarPor = "registro" | "criador" | "nombre";

export interface AruBuscarInput {
  raza_id: string;
  sexo?: "I" | "M" | "H";
  buscar_por: AruBuscarPor;
  /** Registro (BU), código criador o nombre según buscar_por. */
  consulta: string;
  /** RP exacto o desde (modo criador). */
  rp?: string;
  /** RP hasta (modo criador); si falta y hay rp, se usa el mismo. */
  rp_hasta?: string;
}

export interface AruResultadoBusqueda {
  rp: string;
  criador: string;
  registro: string;
  nombre: string;
  publico: boolean;
  id_sesion: string;
  id_filtro: string;
  id: string;
  id_especie: string;
  id_raza: string;
  detalle_url: string;
}

export interface AruDetalleAnimal {
  raza: string;
  nombre: string;
  sexo: "MACHO" | "HEMBRA" | "";
  fecha_nacimiento: string;
  rp: string;
  registro: string;
  premios: string;
  criador_codigo: string;
  criador_nombre: string;
  cabana: string;
  pelo: string;
  fuente_url: string;
}

function decodeHtmlEntities(raw: string): string {
  return raw
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function limpio(s: string): string {
  return decodeHtmlEntities(s)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchAru(url: string, init?: RequestInit): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        ...ARU_FETCH_HEADERS,
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`ARU respondió ${res.status}. Intentá de nuevo en unos minutos.`);
    }
    return await res.text();
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Tiempo de espera agotado al consultar ARU.");
    }
    throw e instanceof Error ? e : new Error("No se pudo consultar el pedigree de ARU.");
  } finally {
    clearTimeout(timer);
  }
}

function razaIdValida(razaId: string): string {
  const id = String(razaId ?? "").trim();
  if (!ARU_RAZAS_EQUINAS.some((r) => r.id === id)) {
    throw new Error("Seleccioná una raza equina válida de ARU.");
  }
  return id;
}

function parseHdndata(html: string): AruResultadoBusqueda[] {
  const m = /id=["']hdndata["'][^>]*value=["']([^"']*)["']/i.exec(html);
  if (!m) return [];
  const raw = decodeHtmlEntities(m[1] ?? "");
  if (!raw.trim()) return [];

  const out: AruResultadoBusqueda[] = [];
  for (const item of raw.split("¬")) {
    const parts = item.split(";");
    if (parts.length < 10) continue;
    const [
      rp,
      criador,
      registro,
      nombre,
      publico,
      idSesion,
      idFiltro,
      id,
      idE,
      idR,
    ] = parts.map((p) => limpio(p ?? ""));
    if (!registro && !nombre && !rp) continue;
    const qs = new URLSearchParams({
      IdSesion: idSesion,
      idFiltro: idFiltro || "N",
      id,
      idE: idE || "3",
      idR: idR || "",
    });
    out.push({
      rp,
      criador,
      registro,
      nombre,
      publico: publico.toUpperCase() === "S",
      id_sesion: idSesion,
      id_filtro: idFiltro || "N",
      id,
      id_especie: idE || "3",
      id_raza: idR,
      detalle_url: `${ARU_DATOS}?${qs.toString()}`,
    });
  }
  return out;
}

export async function buscarPedigreeAruEquino(
  input: AruBuscarInput
): Promise<AruResultadoBusqueda[]> {
  const raza_id = razaIdValida(input.raza_id);
  const sexo =
    input.sexo === "M" || input.sexo === "H" || input.sexo === "I" ? input.sexo : "I";
  const consulta = limpio(input.consulta);
  if (!consulta) {
    throw new Error("Indicá un valor para buscar en ARU.");
  }
  if (consulta.length < 2 && input.buscar_por === "nombre") {
    throw new Error("El nombre debe tener al menos 2 caracteres.");
  }

  let cboPor = "N";
  let dato1 = consulta;
  let dato2 = "";
  let dato3 = "";
  let nombre = "";
  let bu = "";
  let criador = "";
  let rpdesde = "";
  let rphasta = "";

  if (input.buscar_por === "registro") {
    cboPor = "R";
    bu = consulta;
    dato1 = consulta;
  } else if (input.buscar_por === "criador") {
    cboPor = "CR";
    criador = consulta;
    dato1 = consulta;
    const rp = limpio(input.rp ?? "");
    const rpHasta = limpio(input.rp_hasta ?? "") || rp;
    rpdesde = rp;
    rphasta = rpHasta;
    dato2 = rp;
    dato3 = rpHasta;
  } else {
    cboPor = "N";
    nombre = consulta;
    dato1 = consulta;
  }

  const body = new URLSearchParams({
    IdSesion: "",
    IdFiltro: cboPor,
    especie: "",
    listado: "",
    modo: "",
    orderby: "3",
    order: "0",
    sentido: "desc",
    accion: "1",
    dato1,
    dato2,
    dato3,
    cboEspecies: "3|EQUINA",
    cboRazas: raza_id,
    optSexo: sexo,
    cboPor,
    nombre,
    bu,
    criador,
    propietario: "",
    rpdesde,
    rphasta,
    inputfechadesde: "",
    diadesde: "",
    mesdesde: "",
    aniodesde: "",
    inputfechahasta: "",
    diahasta: "",
    meshasta: "",
    aniohasta: "",
  });

  const html = await fetchAru(ARU_FORM, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  return parseHdndata(html).slice(0, 80);
}

function attrValue(html: string, id: string): string {
  const re = new RegExp(
    `id=["']${id}["'][^>]*value=(["'])([\\s\\S]*?)\\1`,
    "i"
  );
  const m = re.exec(html);
  if (m) return limpio(m[2] ?? "");
  // value before id
  const re2 = new RegExp(
    `value=(["'])([\\s\\S]*?)\\1[^>]*id=["']${id}["']`,
    "i"
  );
  const m2 = re2.exec(html);
  return m2 ? limpio(m2[2] ?? "") : "";
}

function textareaValue(html: string, id: string): string {
  const re = new RegExp(
    `<textarea[^>]*id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/textarea>`,
    "i"
  );
  const m = re.exec(html);
  return m ? limpio(m[1] ?? "") : "";
}

/** dd/mm/yyyy → yyyy-mm-dd; vacío si no parsea. */
export function fechaAruAIso(raw: string): string {
  const t = limpio(raw);
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (!m) return "";
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || yyyy < 1900 || yyyy > 2100) {
    return "";
  }
  return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

function sexoAruAApp(raw: string): "MACHO" | "HEMBRA" | "" {
  const s = limpio(raw).toUpperCase();
  if (s === "M" || s === "MACHO") return "MACHO";
  if (s === "H" || s === "HEMBRA" || s === "F") return "HEMBRA";
  return "";
}

export async function detallePedigreeAruEquino(params: {
  id: string;
  id_raza: string;
  id_filtro?: string;
  id_sesion?: string;
  id_especie?: string;
}): Promise<AruDetalleAnimal> {
  const id = limpio(params.id);
  const idRaza = razaIdValida(params.id_raza);
  if (!id) throw new Error("Falta el identificador del animal en ARU.");

  const qs = new URLSearchParams({
    IdSesion: limpio(params.id_sesion ?? ""),
    idFiltro: limpio(params.id_filtro ?? "N") || "N",
    id,
    idE: limpio(params.id_especie ?? "3") || "3",
    idR: idRaza,
  });
  const fuente_url = `${ARU_DATOS}?${qs.toString()}`;
  const html = await fetchAru(fuente_url);

  const nombre = attrValue(html, "nombre");
  const rp = attrValue(html, "rp");
  const registro = attrValue(html, "registro");
  if (!nombre && !rp && !registro) {
    throw new Error("No se encontraron datos del animal en ARU.");
  }

  return {
    raza: attrValue(html, "raza"),
    nombre,
    sexo: sexoAruAApp(attrValue(html, "sexo")),
    fecha_nacimiento: fechaAruAIso(attrValue(html, "nacimiento")),
    rp,
    registro,
    premios: textareaValue(html, "nota"),
    criador_codigo: attrValue(html, "codigo"),
    criador_nombre: attrValue(html, "nomcriador"),
    cabana: attrValue(html, "cabana"),
    pelo: attrValue(html, "pelo"),
    fuente_url,
  };
}

export function arbolUrlDesdeResultado(row: AruResultadoBusqueda): string {
  const qs = new URLSearchParams({
    IdSesion: row.id_sesion || "",
    idFiltro: row.id_filtro || "N",
    id: row.id,
    idE: row.id_especie || "3",
    idR: row.id_raza,
  });
  return `${ARU_BASE}/arbol.php?${qs.toString()}`;
}

const ARBOL_EMBED_STYLE = `
<style id="scg-aru-embed">
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
    height: 100% !important;
    overflow: auto !important;
    overscroll-behavior: none !important;
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
  }
  html::-webkit-scrollbar,
  body::-webkit-scrollbar,
  *::-webkit-scrollbar {
    width: 0 !important;
    height: 0 !important;
    display: none !important;
  }
  * {
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
  }
</style>
`;

function reescribirUrlsRelativasAru(html: string): string {
  return html
    .replace(/(href|src)=(["'])(?!https?:|data:|mailto:|#|\/\/)([^"']+)\2/gi, (_m, attr, q, path) => {
      const limpioPath = String(path).replace(/^\.\//, "");
      return `${attr}=${q}${ARU_BASE}/${limpioPath}${q}`;
    })
    .replace(/url\((['"]?)(?!https?:|data:|\/\/)([^'")]+)\1\)/gi, (_m, q, path) => {
      const limpioPath = String(path).replace(/^\.\//, "");
      return `url(${q}${ARU_BASE}/${limpioPath}${q})`;
    });
}

/** HTML del árbol ARU para embeber sin barras de scroll visibles. */
export async function htmlArbolAruParaEmbed(arbolUrl: string): Promise<string> {
  const raw = String(arbolUrl ?? "").trim();
  if (!raw.startsWith(`${ARU_BASE}/arbol.php`)) {
    throw new Error("URL de árbol ARU inválida.");
  }
  const html = await fetchAru(raw);
  const conBase = reescribirUrlsRelativasAru(html);
  if (/<\/head>/i.test(conBase)) {
    return conBase.replace(/<\/head>/i, `${ARBOL_EMBED_STYLE}</head>`);
  }
  return `${ARBOL_EMBED_STYLE}${conBase}`;
}

function normalizarClaveMatch(s: string): string {
  return limpio(s)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[´`'"]/g, "");
}

function elegirMejorResultado(
  rows: AruResultadoBusqueda[],
  hints: { registro?: string; rp?: string; nombre?: string }
): AruResultadoBusqueda | null {
  if (rows.length === 0) return null;
  const reg = normalizarClaveMatch(hints.registro ?? "");
  const rp = normalizarClaveMatch(hints.rp ?? "");
  const nombre = normalizarClaveMatch(hints.nombre ?? "");

  const scored = rows
    .filter((r) => r.publico && r.id)
    .map((r) => {
      let score = 0;
      const rReg = normalizarClaveMatch(r.registro);
      const rRp = normalizarClaveMatch(r.rp);
      const rNom = normalizarClaveMatch(r.nombre);
      if (reg && rReg === reg) score += 100;
      if (rp && rRp === rp) score += 40;
      if (nombre && (rNom === nombre || rNom.includes(nombre) || nombre.includes(rNom))) {
        score += 25;
      }
      return { r, score };
    })
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return null;
  if (reg || rp || nombre) {
    return scored[0]!.score > 0 ? scored[0]!.r : null;
  }
  return scored[0]!.r;
}

/** URL directa del árbol cuando ya tenemos el registro (id ARU = registro). */
export function arbolUrlDesdeRegistro(
  registro: string,
  opts?: { id_raza?: string; id_filtro?: string; id_especie?: string }
): string {
  const id = limpio(registro);
  if (!id) throw new Error("Falta el registro para armar el árbol ARU.");
  const qs = new URLSearchParams({
    IdSesion: "",
    idFiltro: limpio(opts?.id_filtro ?? "R") || "R",
    id,
    idE: limpio(opts?.id_especie ?? "3") || "3",
    idR: limpio(opts?.id_raza ?? "27") || "27",
  });
  return `${ARU_BASE}/arbol.php?${qs.toString()}`;
}

export interface AruArbolResolucion {
  arbol_url: string;
  detalle_url: string;
  animal: AruResultadoBusqueda;
}

/** Resuelve el árbol genealógico ARU a partir de registro / RP / nombre. */
export async function resolverArbolAruEquino(input: {
  registro?: string;
  rp?: string;
  nombre?: string;
  raza_id?: string;
  sexo?: "I" | "M" | "H";
}): Promise<AruArbolResolucion> {
  const registro = limpio(input.registro ?? "");
  const rp = limpio(input.rp ?? "");
  const nombre = limpio(input.nombre ?? "");
  if (!registro && !rp && !nombre) {
    throw new Error("Necesitás RP, registro o nombre para abrir el árbol en ARU.");
  }

  const razaPreferida = limpio(input.raza_id ?? "") || "27";

  // Camino rápido: con registro el árbol ARU usa ese id (sin consultar el listado).
  if (registro) {
    const arbol_url = arbolUrlDesdeRegistro(registro, { id_raza: razaPreferida });
    const qs = new URLSearchParams({
      IdSesion: "",
      idFiltro: "R",
      id: registro,
      idE: "3",
      idR: razaPreferida,
    });
    return {
      arbol_url,
      detalle_url: `${ARU_BASE}/datos.php?${qs.toString()}`,
      animal: {
        rp,
        criador: "",
        registro,
        nombre,
        publico: true,
        id_sesion: "",
        id_filtro: "R",
        id: registro,
        id_especie: "3",
        id_raza: razaPreferida,
        detalle_url: `${ARU_BASE}/datos.php?${qs.toString()}`,
      },
    };
  }

  const sexo =
    input.sexo === "M" || input.sexo === "H" || input.sexo === "I" ? input.sexo : "I";

  let encontrado: AruResultadoBusqueda | null = null;

  if (nombre && nombre.length >= 2) {
    const rows = await buscarPedigreeAruEquino({
      raza_id: razaPreferida,
      sexo,
      buscar_por: "nombre",
      consulta: nombre,
    });
    encontrado = elegirMejorResultado(rows, { registro, rp, nombre });
  }

  if (!encontrado) {
    throw new Error(
      "No se encontró el animal en ARU. Indicá el registro (más rápido) o un nombre válido."
    );
  }

  return {
    arbol_url: arbolUrlDesdeResultado(encontrado),
    detalle_url: encontrado.detalle_url,
    animal: encontrado,
  };
}
