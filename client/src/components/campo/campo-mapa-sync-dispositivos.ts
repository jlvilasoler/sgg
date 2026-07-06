import {
  fetchStockEquinaDispositivo,
  fetchStockGanaderaDispositivo,
  saveStockEquinaDispositivo,
  saveStockGanaderaDispositivo,
} from "../../api";
import type { CampoMapaDispositivosMetadata } from "./campo-mapa-metadata";

async function syncGanaderoPotrero(
  claves: string[],
  potreroNombre: string,
  previousClaves: string[],
  previousPotreroNombre: string,
): Promise<void> {
  const toAssign = new Set(claves);
  const toMaybeClear = previousClaves.filter((c) => !toAssign.has(c));

  for (const clave of claves) {
    const detalle = await fetchStockGanaderaDispositivo(clave);
    await saveStockGanaderaDispositivo(
      clave,
      {
        sexo: detalle.sexo,
        empresa: detalle.empresa,
        grupo: detalle.grupo,
        grupo_libre: detalle.grupo_libre,
        potrero: potreroNombre,
        raza: detalle.raza,
        color_caravana: detalle.color_caravana ?? "",
        nacimiento_mes: detalle.nacimiento_mes,
        nacimiento_anio: detalle.nacimiento_anio,
        observaciones: detalle.observaciones,
        estado: detalle.estado,
        tipo_baja: detalle.tipo_baja,
        numero_guia: detalle.numero_guia,
        baja_mes: detalle.baja_mes,
        baja_anio: detalle.baja_anio,
      },
      detalle.eid,
    );
  }

  for (const clave of toMaybeClear) {
    const detalle = await fetchStockGanaderaDispositivo(clave);
    if (detalle.potrero.trim() !== previousPotreroNombre.trim()) continue;
    await saveStockGanaderaDispositivo(
      clave,
      {
        sexo: detalle.sexo,
        empresa: detalle.empresa,
        grupo: detalle.grupo,
        grupo_libre: detalle.grupo_libre,
        potrero: "",
        raza: detalle.raza,
        color_caravana: detalle.color_caravana ?? "",
        nacimiento_mes: detalle.nacimiento_mes,
        nacimiento_anio: detalle.nacimiento_anio,
        observaciones: detalle.observaciones,
        estado: detalle.estado,
        tipo_baja: detalle.tipo_baja,
        numero_guia: detalle.numero_guia,
        baja_mes: detalle.baja_mes,
        baja_anio: detalle.baja_anio,
      },
      detalle.eid,
    );
  }
}

async function syncEquinoPotrero(
  claves: string[],
  potreroNombre: string,
  previousClaves: string[],
  previousPotreroNombre: string,
): Promise<void> {
  const toAssign = new Set(claves);
  const toMaybeClear = previousClaves.filter((c) => !toAssign.has(c));

  for (const clave of claves) {
    const detalle = await fetchStockEquinaDispositivo(clave);
    await saveStockEquinaDispositivo(
      clave,
      {
        sexo: detalle.sexo,
        empresa: detalle.empresa,
        grupo: detalle.grupo,
        grupo_libre: detalle.grupo_libre,
        potrero: potreroNombre,
        raza: detalle.raza,
        nacimiento_mes: detalle.nacimiento_mes,
        nacimiento_anio: detalle.nacimiento_anio,
        observaciones: detalle.observaciones,
        estado: detalle.estado,
        tipo_baja: detalle.tipo_baja,
        numero_guia: detalle.numero_guia,
        baja_mes: detalle.baja_mes,
        baja_anio: detalle.baja_anio,
      },
      detalle.eid,
    );
  }

  for (const clave of toMaybeClear) {
    const detalle = await fetchStockEquinaDispositivo(clave);
    if (detalle.potrero.trim() !== previousPotreroNombre.trim()) continue;
    await saveStockEquinaDispositivo(
      clave,
      {
        sexo: detalle.sexo,
        empresa: detalle.empresa,
        grupo: detalle.grupo,
        grupo_libre: detalle.grupo_libre,
        potrero: "",
        raza: detalle.raza,
        nacimiento_mes: detalle.nacimiento_mes,
        nacimiento_anio: detalle.nacimiento_anio,
        observaciones: detalle.observaciones,
        estado: detalle.estado,
        tipo_baja: detalle.tipo_baja,
        numero_guia: detalle.numero_guia,
        baja_mes: detalle.baja_mes,
        baja_anio: detalle.baja_anio,
      },
      detalle.eid,
    );
  }
}

export async function clearCampoMapaDispositivosPotrero(
  previous: CampoMapaDispositivosMetadata,
  previousPotreroNombre: string,
): Promise<void> {
  const prevName = previousPotreroNombre.trim();
  if (!prevName) return;
  await Promise.all([
    syncGanaderoPotrero([], "", previous.dispositivos_ganadero, prevName),
    syncEquinoPotrero([], "", previous.dispositivos_equino, prevName),
  ]);
}

export async function syncCampoMapaDispositivosPotrero(
  potreroNombre: string,
  next: CampoMapaDispositivosMetadata,
  previous: CampoMapaDispositivosMetadata,
  previousPotreroNombre: string,
): Promise<void> {
  const nombre = potreroNombre.trim();
  if (!nombre) return;

  await Promise.all([
    syncGanaderoPotrero(
      next.dispositivos_ganadero,
      nombre,
      previous.dispositivos_ganadero,
      previousPotreroNombre,
    ),
    syncEquinoPotrero(
      next.dispositivos_equino,
      nombre,
      previous.dispositivos_equino,
      previousPotreroNombre,
    ),
  ]);
}
