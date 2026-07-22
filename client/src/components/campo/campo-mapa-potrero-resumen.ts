import L from "leaflet";
import type { EmpresaOperativaStock } from "../../api";
import type { CampoPotreroMapa, StockGanaderaDispositivo } from "../../types";
import {
  hexColorCaravana,
  normalizarColorCaravana,
} from "../stock/stock-dispositivo-color";
import { colorEmpresaOperativa, fmtEmpresaOperativa } from "../stock/stock-empresa-utils";
import { collectCampoMapaFeatureDevices } from "./campo-mapa-dispositivos-map";
import { centroidOfPaths, openRingFromGeoJson } from "./campo-mapa-geo";

export interface PotreroResumenFila {
  key: string;
  label: string;
  count: number;
  hex?: string;
}

export interface PotreroResumenKindBlock {
  total: number;
  porEmpresa: PotreroResumenFila[];
  porSexo: PotreroResumenFila[];
}

export interface PotreroDispositivoResumen {
  potreroId: number;
  potreroNombre: string;
  total: number;
  ganadero: PotreroResumenKindBlock;
  equino: PotreroResumenKindBlock;
  /** @deprecated usar ganadero/equino; se mantiene para compat. */
  porEmpresa: PotreroResumenFila[];
  /** @deprecated usar ganadero/equino; se mantiene para compat. */
  porSexo: PotreroResumenFila[];
}

export type PotreroResumenModo = "empresa" | "sexo" | "totales";

export const POTRERO_RESUMEN_MODOS: {
  id: PotreroResumenModo;
  label: string;
}[] = [
  { id: "empresa", label: "Empresa" },
  { id: "sexo", label: "Sexo" },
  { id: "totales", label: "Totales" },
];

export function sexoLabelPotreroResumen(sexo: string): string {
  if (sexo === "MACHO") return "Machos";
  if (sexo === "HEMBRA") return "Hembras";
  return "Sin sexo";
}

function countRows(
  items: { key: string; label: string; hex?: string }[],
): PotreroResumenFila[] {
  const map = new Map<string, PotreroResumenFila>();
  for (const item of items) {
    const prev = map.get(item.key);
    if (prev) {
      prev.count += 1;
    } else {
      map.set(item.key, { ...item, count: 1 });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"));
}

export function buildDispositivoResumenFilas(
  devices: StockGanaderaDispositivo[],
  empresas: EmpresaOperativaStock[],
): Pick<PotreroResumenKindBlock, "porEmpresa" | "porSexo"> {
  const porEmpresa = countRows(
    devices.map((device) => {
      const nombre = fmtEmpresaOperativa(device.empresa, empresas);
      const colorId = normalizarColorCaravana(
        device.color_caravana || colorEmpresaOperativa(device.empresa, empresas),
      );
      return {
        key: nombre,
        label: nombre,
        hex: hexColorCaravana(colorId) ?? undefined,
      };
    }),
  );

  const porSexo = countRows(
    devices.map((device) => {
      const empresa = fmtEmpresaOperativa(device.empresa, empresas);
      const sexoKey = device.sexo || "sin-sexo";
      const colorId = normalizarColorCaravana(
        device.color_caravana || colorEmpresaOperativa(device.empresa, empresas),
      );
      return {
        key: `${empresa}::${sexoKey}`,
        label: `${empresa} · ${sexoLabelPotreroResumen(device.sexo ?? "")}`,
        hex: hexColorCaravana(colorId) ?? undefined,
      };
    }),
  ).sort((a, b) => {
    const [empA, sexA] = a.key.split("::");
    const [empB, sexB] = b.key.split("::");
    const byEmpresa = empA.localeCompare(empB, "es");
    if (byEmpresa !== 0) return byEmpresa;
    const sexOrder = (sex: string) =>
      sex === "HEMBRA" ? 0 : sex === "MACHO" ? 1 : 2;
    return sexOrder(sexA) - sexOrder(sexB);
  });

  return { porEmpresa, porSexo };
}

function emptyKindBlock(): PotreroResumenKindBlock {
  return { total: 0, porEmpresa: [], porSexo: [] };
}

function buildKindBlock(
  devices: StockGanaderaDispositivo[],
  empresas: EmpresaOperativaStock[],
): PotreroResumenKindBlock {
  if (devices.length === 0) return emptyKindBlock();
  const { porEmpresa, porSexo } = buildDispositivoResumenFilas(devices, empresas);
  return { total: devices.length, porEmpresa, porSexo };
}

export function buildPotreroDispositivoResumen(
  potrero: CampoPotreroMapa,
  ganadero: StockGanaderaDispositivo[],
  equino: StockGanaderaDispositivo[],
  empresas: EmpresaOperativaStock[],
): PotreroDispositivoResumen {
  const assigned = collectCampoMapaFeatureDevices(
    potrero.nombre,
    potrero.metadata,
    ganadero,
    equino,
  );

  const devicesGanadero = assigned
    .filter((item) => item.kind === "ganadero")
    .map((item) => item.device);
  const devicesEquino = assigned
    .filter((item) => item.kind === "equino")
    .map((item) => item.device);

  const ganaderoBlock = buildKindBlock(devicesGanadero, empresas);
  const equinoBlock = buildKindBlock(devicesEquino, empresas);
  const allDevices = [...devicesGanadero, ...devicesEquino];
  const { porEmpresa, porSexo } = buildDispositivoResumenFilas(allDevices, empresas);

  return {
    potreroId: potrero.id,
    potreroNombre: potrero.nombre,
    total: allDevices.length,
    ganadero: ganaderoBlock,
    equino: equinoBlock,
    porEmpresa,
    porSexo,
  };
}

export function buildAllPotreroResumenes(
  potreros: CampoPotreroMapa[],
  ganadero: StockGanaderaDispositivo[],
  equino: StockGanaderaDispositivo[],
  empresas: EmpresaOperativaStock[],
): PotreroDispositivoResumen[] {
  return potreros.map((potrero) =>
    buildPotreroDispositivoResumen(potrero, ganadero, equino, empresas),
  );
}

function renderResumenRows(
  title: string,
  rows: PotreroResumenFila[],
  withSwatch: boolean,
): string {
  if (rows.length === 0) {
    return `<section class="campo-mapa-potrero-resumen-section">
      <h4>${title}</h4>
      <p class="campo-mapa-potrero-resumen-empty">—</p>
    </section>`;
  }
  const items = rows
    .map((row) => {
      const swatch =
        withSwatch && row.hex
          ? `<span class="campo-mapa-potrero-resumen-swatch" style="background:${row.hex}" aria-hidden="true"></span>`
          : withSwatch
            ? `<span class="campo-mapa-potrero-resumen-swatch campo-mapa-potrero-resumen-swatch--empty" aria-hidden="true"></span>`
            : "";
      return `<li class="${withSwatch ? "" : "campo-mapa-potrero-resumen-row--no-swatch"}">${swatch}<span class="campo-mapa-potrero-resumen-row-label">${row.label}</span><strong>${row.count}</strong></li>`;
    })
    .join("");
  return `<section class="campo-mapa-potrero-resumen-section">
    <h4>${title}</h4>
    <ul>${items}</ul>
  </section>`;
}

function renderKindBlockHtml(
  kindLabel: string,
  block: PotreroResumenKindBlock,
  modos: ReadonlySet<PotreroResumenModo>,
  kindClass: "ganadero" | "equino",
): string {
  if (block.total === 0) return "";

  const parts: string[] = [
    `<header class="campo-mapa-potrero-resumen-kind-head">${kindLabel}</header>`,
  ];

  if (modos.has("empresa")) {
    parts.push(renderResumenRows("Empresa", block.porEmpresa, true));
  }
  if (modos.has("sexo")) {
    parts.push(renderResumenRows("Sexo", block.porSexo, true));
  }
  if (modos.has("totales") && !modos.has("empresa") && !modos.has("sexo")) {
    parts.push(
      `<p class="campo-mapa-potrero-resumen-kind-total">${block.total}</p>`,
    );
  } else {
    parts.push(`<footer class="campo-mapa-potrero-resumen-kind-foot">
      <span>Total ${kindLabel.toLowerCase()}</span>
      <strong>${block.total}</strong>
    </footer>`);
  }

  return `<div class="campo-mapa-potrero-resumen-kind campo-mapa-potrero-resumen-kind--${kindClass}">
    ${parts.join("")}
  </div>`;
}

function renderResumenFoot(resumen: PotreroDispositivoResumen): string {
  const hasGanadero = resumen.ganadero.total > 0;
  const hasEquino = resumen.equino.total > 0;

  if (!hasGanadero && !hasEquino) {
    return `<footer class="campo-mapa-potrero-resumen-foot">
      <span>Total</span>
      <strong>0</strong>
    </footer>`;
  }

  // Un solo tipo: el bloque ya muestra su total.
  if (hasGanadero !== hasEquino) {
    return "";
  }

  return `<footer class="campo-mapa-potrero-resumen-foot campo-mapa-potrero-resumen-foot--split">
    <span>Ganado <strong>${resumen.ganadero.total}</strong></span>
    <span>Equinos <strong>${resumen.equino.total}</strong></span>
    <span class="campo-mapa-potrero-resumen-foot-total">Total <strong>${resumen.total}</strong></span>
  </footer>`;
}

export function potreroResumenPanelHtml(
  resumen: PotreroDispositivoResumen,
  modos: ReadonlySet<PotreroResumenModo>,
): string {
  const parts: string[] = [
    `<p class="campo-mapa-potrero-resumen-title">${resumen.potreroNombre}</p>`,
  ];

  const ganaderoHtml = renderKindBlockHtml(
    "Ganado",
    resumen.ganadero,
    modos,
    "ganadero",
  );
  const equinoHtml = renderKindBlockHtml("Equinos", resumen.equino, modos, "equino");

  if (ganaderoHtml) parts.push(ganaderoHtml);
  if (equinoHtml) parts.push(equinoHtml);

  if (!ganaderoHtml && !equinoHtml) {
    parts.push(`<p class="campo-mapa-potrero-resumen-empty">Sin animales</p>`);
  }

  const onlyTotales = modos.has("totales") && modos.size === 1;
  const panelClass = onlyTotales ? " campo-mapa-potrero-resumen-panel--totales" : "";

  return `<div class="campo-mapa-potrero-resumen-panel${panelClass}" role="status" aria-label="Resumen de ${resumen.potreroNombre}">
    ${parts.join("")}
    ${renderResumenFoot(resumen)}
  </div>`;
}

export function renderPotreroResumenOverlays(
  map: L.Map,
  potreros: CampoPotreroMapa[],
  resumenes: PotreroDispositivoResumen[],
  modos: ReadonlySet<PotreroResumenModo>,
): L.LayerGroup {
  const group = L.layerGroup();
  const byId = new Map(resumenes.map((item) => [item.potreroId, item]));

  for (const potrero of potreros) {
    const resumen = byId.get(potrero.id);
    if (!resumen || resumen.total === 0) continue;

    let centroid;
    try {
      const ring = openRingFromGeoJson(potrero.geojson);
      if (ring.length < 3) continue;
      centroid = centroidOfPaths(ring);
    } catch {
      continue;
    }

    const icon = L.divIcon({
      className: "campo-mapa-potrero-resumen-leaflet",
      html: potreroResumenPanelHtml(resumen, modos),
    });

    L.marker([centroid.lat, centroid.lng], {
      icon,
      interactive: false,
      keyboard: false,
      zIndexOffset: 650,
    }).addTo(group);
  }

  group.addTo(map);
  return group;
}
