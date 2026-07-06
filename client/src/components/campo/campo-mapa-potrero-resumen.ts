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

export interface PotreroDispositivoResumen {
  potreroId: number;
  potreroNombre: string;
  total: number;
  porEmpresa: PotreroResumenFila[];
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

function sexoLabel(sexo: string): string {
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

export function buildPotreroDispositivoResumen(
  potrero: CampoPotreroMapa,
  ganadero: StockGanaderaDispositivo[],
  equino: StockGanaderaDispositivo[],
  empresas: EmpresaOperativaStock[],
): PotreroDispositivoResumen {
  const devices = collectCampoMapaFeatureDevices(
    potrero.nombre,
    potrero.metadata,
    ganadero,
    equino,
  );

  const porEmpresa = countRows(
    devices.map(({ device }) => {
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
    devices.map(({ device }) => {
      const empresa = fmtEmpresaOperativa(device.empresa, empresas);
      const sexoKey = device.sexo || "sin-sexo";
      const colorId = normalizarColorCaravana(
        device.color_caravana || colorEmpresaOperativa(device.empresa, empresas),
      );
      return {
        key: `${empresa}::${sexoKey}`,
        label: `${empresa} · ${sexoLabel(device.sexo)}`,
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

  return {
    potreroId: potrero.id,
    potreroNombre: potrero.nombre,
    total: devices.length,
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

function renderResumenFoot(total: number): string {
  return `<footer class="campo-mapa-potrero-resumen-foot">
    <span>Total de animales</span>
    <strong>${total}</strong>
  </footer>`;
}

export function potreroResumenPanelHtml(
  resumen: PotreroDispositivoResumen,
  modos: ReadonlySet<PotreroResumenModo>,
): string {
  const parts: string[] = [];

  if (modos.has("totales")) {
    parts.push(
      `<p class="campo-mapa-potrero-resumen-total-only">${resumen.potreroNombre}</p>`,
    );
  }
  if (modos.has("empresa")) {
    parts.push(renderResumenRows("Empresa", resumen.porEmpresa, true));
  }
  if (modos.has("sexo")) {
    parts.push(renderResumenRows("Sexo", resumen.porSexo, true));
  }

  const onlyTotales = modos.has("totales") && modos.size === 1;
  const panelClass = onlyTotales ? " campo-mapa-potrero-resumen-panel--totales" : "";

  return `<div class="campo-mapa-potrero-resumen-panel${panelClass}" role="status" aria-label="Resumen de ${resumen.potreroNombre}">
    ${parts.join("")}
    ${renderResumenFoot(resumen.total)}
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
