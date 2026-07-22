/**
 * Pedigree equino (consulta pública de registros genealógicos).
 * La obtención remota queda solo en servidor; el cliente no recibe URLs externas.
 */

const ARU_BASE = "https://aru.org.uy/rrgg";
const ARU_FORM = `${ARU_BASE}/formulario.php`;
const ARU_DATOS = `${ARU_BASE}/datos.php`;

/** Prefijo same-origin para recursos del árbol (evita aru.org.uy en el navegador). */
export const PEDIGREE_ASSET_API = "/api/stock-equino/aru/asset";

export const ARU_FETCH_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-UY,es;q=0.9,en;q=0.8",
  Referer: ARU_FORM,
};

/** Mensajes de error neutros hacia el cliente (sin nombrar la fuente externa). */
export function mensajePedigreeCliente(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const lower = raw.toLowerCase();
  if (lower.includes("timeout") || lower.includes("agotado") || lower.includes("abort")) {
    return "El registro genealógico tardó demasiado. Probá de nuevo.";
  }
  if (lower.includes("inválida") || lower.includes("invalida")) {
    return "No se pudo armar el árbol genealógico.";
  }
  if (lower.includes("no se encontró") || lower.includes("no se encontraron")) {
    return "No se encontró el animal en el registro genealógico.";
  }
  if (lower.includes("respondió") || lower.includes("consultar") || lower.includes("aru")) {
    return "No se pudo consultar el registro genealógico. Intentá de nuevo.";
  }
  return raw.replace(/\bARU\b/gi, "registro").replace(/aru\.org\.uy/gi, "servicio");
}

export function pedigreeAssetProxyUrl(relPath: string): string {
  const limpio = String(relPath ?? "")
    .trim()
    .replace(/^\.\//, "")
    .replace(/^\/+/, "");
  return `${PEDIGREE_ASSET_API}?p=${encodeURIComponent(limpio)}`;
}

/** Valida path relativo permitido bajo rrgg (images|estilos|js). */
export function assertPedigreeAssetPath(raw: string): string {
  const limpio = decodeURIComponent(String(raw ?? ""))
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^\.\//, "");
  if (!limpio || limpio.includes("..") || /[:?#]/.test(limpio) || limpio.startsWith("//")) {
    throw new Error("Recurso no permitido.");
  }
  if (!/^(images|estilos|js)(\/|$)/i.test(limpio)) {
    throw new Error("Recurso no permitido.");
  }
  return limpio;
}

export async function fetchPedigreeAsset(
  relPath: string
): Promise<{ body: Buffer; contentType: string }> {
  const limpio = assertPedigreeAssetPath(relPath);
  const url = `${ARU_BASE}/${limpio}`;
  const res = await fetch(url, {
    headers: { ...ARU_FETCH_HEADERS, Accept: "*/*" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    throw new Error("No se pudo cargar el recurso.");
  }
  let buf = Buffer.from(await res.arrayBuffer());
  let ct =
    res.headers.get("content-type") ||
    (limpio.endsWith(".css")
      ? "text/css; charset=utf-8"
      : limpio.endsWith(".js")
        ? "application/javascript; charset=utf-8"
        : limpio.endsWith(".svg")
          ? "image/svg+xml"
          : "application/octet-stream");

  if (/\.css$/i.test(limpio)) {
    const baseDir = limpio.includes("/") ? limpio.replace(/\/[^/]+$/, "/") : "";
    const css = buf.toString("utf8").replace(
      /url\((['"]?)(?!https?:|data:|\/\/)([^'")]+)\1\)/gi,
      (_m, q, path) => {
        const joined = `${baseDir}${String(path).replace(/^\.\//, "")}`;
        const parts = joined.split("/");
        const stack: string[] = [];
        for (const part of parts) {
          if (!part || part === ".") continue;
          if (part === "..") stack.pop();
          else stack.push(part);
        }
        return `url(${q}${pedigreeAssetProxyUrl(stack.join("/"))}${q})`;
      }
    );
    buf = Buffer.from(css, "utf8");
    ct = "text/css; charset=utf-8";
  }

  return { body: buf, contentType: ct };
}

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
      throw new Error(`No se pudo consultar el registro genealógico (${res.status}).`);
    }
    return await res.text();
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Tiempo de espera agotado al consultar el registro genealógico.");
    }
    throw e instanceof Error ? e : new Error("No se pudo consultar el registro genealógico.");
  } finally {
    clearTimeout(timer);
  }
}

function razaIdValida(razaId: string): string {
  const id = String(razaId ?? "").trim();
  if (!ARU_RAZAS_EQUINAS.some((r) => r.id === id)) {
    throw new Error("Seleccioná una raza equina válida.");
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
    throw new Error("Indicá un valor para buscar.");
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
  if (!id) throw new Error("Falta el identificador del animal.");

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
    throw new Error("No se encontraron datos del animal.");
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
  :root {
    --scg-tree-bg: #f3f2ed;
    --scg-tree-surface: #ffffff;
    --scg-tree-ink: #1a211a;
    --scg-tree-accent: #7cb342;
    --scg-tree-accent-deep: #5a8f2a;
    --scg-tree-border: #e2e8e0;
    --scg-tree-sidebar: #2d3a2d;
  }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
    min-height: 100% !important;
    height: 100% !important;
    overflow-x: hidden !important;
    overflow-y: auto !important;
    overscroll-behavior: contain !important;
    scrollbar-width: thin !important;
    scrollbar-color: #9ccc65 transparent !important;
    background: var(--scg-tree-bg) !important;
    font-family: "Segoe UI", "Trebuchet MS", system-ui, sans-serif !important;
    color: var(--scg-tree-ink) !important;
  }
  html::-webkit-scrollbar,
  body::-webkit-scrollbar {
    width: 10px !important;
    height: 0 !important;
  }
  html::-webkit-scrollbar-thumb,
  body::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, var(--scg-tree-accent) 55%, #c5d6b8) !important;
    border-radius: 999px !important;
    border: 2px solid transparent !important;
    background-clip: content-box !important;
  }
  html::-webkit-scrollbar-track,
  body::-webkit-scrollbar-track {
    background: transparent !important;
  }
  #logo,
  span.logo,
  img[src*="logo_print_arbol"],
  img[src*="logo_print"],
  #title,
  #botonera,
  #inicio,
  .imprimir,
  .submit_inicio,
  .submit_info,
  .btn_volver {
    display: none !important;
    visibility: hidden !important;
    width: 0 !important;
    height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  #content {
    border: none !important;
    background: transparent !important;
    min-height: 0 !important;
    height: auto !important;
    width: 100% !important;
    max-width: 100% !important;
    text-align: center !important;
    padding: 0.35rem 0.35rem 0.35rem !important;
    box-sizing: border-box !important;
    overflow-x: hidden !important;
  }
  #content > table {
    width: auto !important;
    max-width: 100% !important;
    margin: 0 auto !important;
    border: 0 !important;
  }
  #container {
    margin: 0 auto !important;
    width: 100% !important;
    max-width: 100% !important;
    height: auto !important;
    overflow-x: hidden !important;
  }
  #back_arbol {
    float: none !important;
    display: block !important;
    width: 900px !important;
    max-width: none !important;
    /* Alto alineado al gráfico (842) — sin franja blanca debajo */
    height: 850px !important;
    min-height: 850px !important;
    max-height: 850px !important;
    margin: 0.15rem auto 0.35rem !important;
    padding: 8px 0 0 !important;
    box-sizing: border-box !important;
    border-radius: 16px !important;
    border: 1px solid color-mix(in srgb, var(--scg-tree-accent) 18%, var(--scg-tree-border)) !important;
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.55) inset,
      0 14px 32px rgba(26, 33, 26, 0.08) !important;
    background-color: #d8e3d0 !important;
    background-image:
      linear-gradient(
        180deg,
        rgba(247, 250, 246, 0.55) 0%,
        rgba(247, 250, 246, 0.12) 38%,
        rgba(216, 227, 208, 0.35) 100%
      ),
      url(${pedigreeAssetProxyUrl("images/back_body_arbol.jpg")}) !important;
    background-blend-mode: soft-light, normal !important;
    background-position: center top, center top !important;
    background-repeat: no-repeat, no-repeat !important;
    background-size: 100% 100%, 900px 842px !important;
    overflow: hidden !important;
    transform-origin: top center !important;
  }
  #formulario {
    font-size: 12px !important;
    font-weight: 600 !important;
  }
  #formulario span {
    color: var(--scg-tree-accent-deep) !important;
  }
  .td_big,
  #animal td,
  #animal1 td,
  #nombre,
  #sexo {
    background-image: none !important;
    background: var(--scg-tree-surface) !important;
    border: 1px solid var(--scg-tree-border) !important;
    border-radius: 11px !important;
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.8) inset,
      0 3px 10px rgba(26, 33, 26, 0.06) !important;
    color: var(--scg-tree-ink) !important;
    font-family: "Segoe UI", "Trebuchet MS", system-ui, sans-serif !important;
    font-size: 11px !important;
    font-weight: 650 !important;
    letter-spacing: 0.01em !important;
    line-height: 1.25 !important;
    height: 40px !important;
    padding: 0.28rem 0.45rem !important;
    vertical-align: middle !important;
    transition:
      transform 0.14s ease,
      box-shadow 0.16s ease,
      border-color 0.16s ease,
      background-color 0.16s ease,
      color 0.16s ease !important;
  }
  .td_big[onclick*="CargarMisAncestros"] {
    cursor: pointer !important;
  }
  .td_big:hover {
    transform: translateY(-1px) !important;
    border-color: color-mix(in srgb, var(--scg-tree-accent) 55%, var(--scg-tree-border)) !important;
    background: color-mix(in srgb, var(--scg-tree-accent) 8%, #fff) !important;
    color: var(--scg-tree-accent-deep) !important;
    box-shadow:
      0 0 0 2px color-mix(in srgb, var(--scg-tree-accent) 22%, transparent),
      0 8px 18px rgba(90, 143, 42, 0.16) !important;
  }
  .td_big[onclick*="CargarMisAncestros('','','','')"],
  .td_big[onclick*='CargarMisAncestros("","","","")'],
  .td_big.scg-tree-node--empty {
    opacity: 0.28 !important;
    border-style: dashed !important;
    background: transparent !important;
    box-shadow: none !important;
    pointer-events: none !important;
    transform: none !important;
  }
  #animal td,
  #animal1 td,
  #nombre,
  .td_big.scg-tree-node--root {
    border-color: color-mix(in srgb, var(--scg-tree-accent) 42%, var(--scg-tree-border)) !important;
    background: linear-gradient(
      180deg,
      #fff 0%,
      color-mix(in srgb, var(--scg-tree-accent) 10%, #fff) 100%
    ) !important;
    color: var(--scg-tree-sidebar) !important;
    font-weight: 700 !important;
    font-size: 12px !important;
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--scg-tree-accent) 18%, transparent),
      0 6px 16px rgba(90, 143, 42, 0.14) !important;
  }
  #imagen_animal img {
    border-radius: 12px !important;
    border: 1px solid var(--scg-tree-border) !important;
    background: #eef3ea !important;
    box-shadow: 0 4px 14px rgba(26, 33, 26, 0.1) !important;
    object-fit: cover !important;
  }
  .titulos,
  label {
    color: var(--scg-tree-accent-deep) !important;
  }
</style>
`;

const ARBOL_EMBED_SCRIPT = `
<script id="scg-aru-embed-nav">
(function () {
  function trimLocal(v) {
    return String(v == null ? "" : v).replace(/^\\s+|\\s+$/g, "");
  }
  function arbolEmbedUrl(_aruUrl) {
    return "/api/stock-equino/aru/arbol-embed";
  }
  window.Inicio = function () {};
  window.VerInfo = function () {};
  window.Volver = function () {
    if (window.history.length > 1) window.history.back();
  };
  window.CargarMisAncestros = function (id, nom, raza, ver) {
    if (!trimLocal(nom)) return false;
    if (ver === "N") return false;
    var qs =
      "id=" +
      encodeURIComponent(id) +
      "&raza=" +
      encodeURIComponent(raza) +
      "&name=" +
      encodeURIComponent(nom);
    window.location.replace("/api/stock-equino/aru/arbol-embed?" + qs);
    return false;
  };
  function avisarTitulo() {
    try {
      var el = document.querySelector("#title span");
      var texto = el ? trimLocal(el.textContent || "") : "";
      var nombre = texto.replace(/^Datos\\s+de\\s+los\\s+Ancestros\\s+de\\s+/i, "").trim();
      if (nombre && window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "scg-aru-arbol", animalNombre: nombre }, "*");
      }
    } catch (e) {}
  }
  function encajarArbol() {
    var arbol = document.getElementById("back_arbol");
    if (!arbol) return;
    var disponible = Math.max(280, (document.documentElement.clientWidth || window.innerWidth || 900) - 16);
    var base = 900;
    var escala = Math.min(1, disponible / base);
    arbol.style.transform = escala < 0.999 ? "scale(" + escala + ")" : "";
    arbol.style.marginBottom = escala < 0.999 ? Math.round(850 * (1 - escala) * -0.12) + "px" : "0.35rem";
    var wrap = arbol.parentElement;
    if (wrap) {
      wrap.style.minHeight = Math.round(858 * escala) + "px";
    }
  }
  function estilizarNodos() {
    try {
      var celdas = document.querySelectorAll(".td_big");
      for (var i = 0; i < celdas.length; i++) {
        var td = celdas[i];
        var txt = trimLocal(td.textContent || "");
        td.classList.add("scg-tree-node");
        if (!txt) {
          td.classList.add("scg-tree-node--empty");
        } else {
          td.setAttribute("title", "Ver árbol de " + txt);
        }
      }
      var root = document.querySelector("#animal td, #animal1 td, #nombre");
      if (root) root.classList.add("scg-tree-node--root");
    } catch (e) {}
  }
  function init() {
    avisarTitulo();
    estilizarNodos();
    encajarArbol();
    window.addEventListener("resize", encajarArbol);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
</script>
`;

function reescribirUrlsRelativasAru(html: string): string {
  const toProxy = (path: string) => {
    const limpioPath = String(path).replace(/^\.\//, "").replace(/^\/+/, "");
    return pedigreeAssetProxyUrl(limpioPath);
  };
  return html
    .replace(/(href|src)=(["'])(?!https?:|data:|mailto:|#|\/\/)([^"']+)\2/gi, (_m, attr, q, path) => {
      const p = String(path);
      // Scripts/estilos/imágenes → proxy; form actions a arbol.php se neutralizan.
      if (/^arbol\.php/i.test(p)) {
        return `${attr}=${q}#${q}`;
      }
      return `${attr}=${q}${toProxy(p)}${q}`;
    })
    .replace(/url\((['"]?)(?!https?:|data:|\/\/)([^'")]+)\1\)/gi, (_m, q, path) => {
      return `url(${q}${toProxy(String(path))}${q})`;
    })
    .replace(
      /(href|src)=(["'])https?:\/\/aru\.org\.uy\/rrgg\/([^"']+)\2/gi,
      (_m, attr, q, path) => `${attr}=${q}${toProxy(path)}${q}`
    )
    .replace(
      /url\((['"]?)https?:\/\/aru\.org\.uy\/rrgg\/([^'")]+)\1\)/gi,
      (_m, q, path) => `url(${q}${toProxy(path)}${q})`
    );
}

function ocultarBrandingAruEnHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<title>[^<]*<\/title>/gi, "<title>Árbol genealógico</title>")
    .replace(/aru\.org\.uy/gi, "")
    .replace(/Asociaci[oó]n\s+Rural\s+del\s+Uruguay/gi, "")
    .replace(/<span[^>]*\bid=["']logo["'][^>]*>[\s\S]*?<\/span>/gi, "")
    .replace(/<img[^>]*logo_print_arbol[^>]*>/gi, "")
    .replace(/<div[^>]*\bid=["']botonera["'][^>]*>[\s\S]*?<\/div>/gi, "")
    .replace(/<span[^>]*\bclass=["'][^"']*submit_inicio[^"']*["'][^>]*>[\s\S]*?<\/span>/gi, "")
    .replace(/<span[^>]*\bclass=["'][^"']*submit_info[^"']*["'][^>]*>[\s\S]*?<\/span>/gi, "")
    .replace(/<span[^>]*\bclass=["'][^"']*btn_volver[^"']*["'][^>]*>[\s\S]*?<\/span>/gi, "")
    .replace(/<span[^>]*\bclass=["'][^"']*imprimir[^"']*["'][^>]*>[\s\S]*?<\/span>/gi, "")
    .replace(/<input[^>]*\bid=["']btninicio["'][^>]*>/gi, "")
    .replace(/<input[^>]*\bid=["']btnverinfo["'][^>]*>/gi, "");
}

/** Construye la URL remota interna (solo servidor). */
export function arbolUrlDesdeParams(input: {
  id: string;
  raza?: string;
  name?: string;
}): string {
  const id = limpio(input.id);
  if (!id) throw new Error("Falta el identificador para el árbol genealógico.");
  const qs = new URLSearchParams({
    IdSesion: "",
    idFiltro: "R",
    id,
    idE: "3",
    idR: limpio(input.raza ?? "") || "27",
  });
  const name = limpio(input.name ?? "");
  if (name) qs.set("name", name);
  return `${ARU_BASE}/arbol.php?${qs.toString()}`;
}

/** HTML del árbol para embeber (same-origin, sin URLs externas en el documento). */
export async function htmlArbolAruParaEmbed(arbolUrl: string): Promise<string> {
  const raw = String(arbolUrl ?? "").trim();
  if (!raw.startsWith(`${ARU_BASE}/arbol.php`)) {
    throw new Error("No se pudo armar el árbol genealógico.");
  }
  const html = await fetchAru(raw);
  const conBase = ocultarBrandingAruEnHtml(reescribirUrlsRelativasAru(html));
  let out = conBase;
  if (/<\/head>/i.test(out)) {
    out = out.replace(/<\/head>/i, `${ARBOL_EMBED_STYLE}</head>`);
  } else {
    out = `${ARBOL_EMBED_STYLE}${out}`;
  }
  if (/<\/body>/i.test(out)) {
    out = out.replace(/<\/body>/i, `${ARBOL_EMBED_SCRIPT}</body>`);
  } else {
    out = `${out}${ARBOL_EMBED_SCRIPT}`;
  }
  // Cierre de seguridad: no dejar dominios externos en el HTML servido al iframe.
  out = out.replace(/https?:\/\/aru\.org\.uy[^"'\\\s)>]*/gi, "#");
  return out;
}

export async function htmlArbolEmbedDesdeQuery(q: {
  url?: string;
  id?: string;
  registro?: string;
  raza?: string;
  name?: string;
}): Promise<string> {
  // No aceptar URL externa por query: el navegador solo envía id/registro.
  const id = limpio(q.id ?? "") || limpio(q.registro ?? "");
  return htmlArbolAruParaEmbed(
    arbolUrlDesdeParams({
      id,
      raza: limpio(q.raza ?? "") || "27",
      name: limpio(q.name ?? ""),
    })
  );
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
  if (!id) throw new Error("Falta el registro para armar el árbol genealógico.");
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
    throw new Error("Necesitás RP, registro o nombre para abrir el árbol genealógico.");
  }

  const razaPreferida = limpio(input.raza_id ?? "") || "27";

  // Camino rápido: con registro el árbol usa ese id (sin consultar el listado).
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
      "No se encontró el animal en el registro genealógico. Indicá el registro o un nombre válido."
    );
  }

  return {
    arbol_url: arbolUrlDesdeResultado(encontrado),
    detalle_url: encontrado.detalle_url,
    animal: encontrado,
  };
}
