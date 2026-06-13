import type { SubRubro, SubRubroForm, SubRubroItem } from "../../types";
import type { DeleteSubRubrosGrupoResult, GrupoIconoInfo } from "../../api";
import {
  clearGrupoIcono,
  createSubRubro,
  createSubRubroItem,
  deleteSubRubro,
  deleteSubRubroItem,
  deleteSubRubrosGrupo,
  fetchGrupoIconos,
  fetchSubRubroItemsBatch,
  fetchSubRubros,
  renameSubRubroGrupo,
  resolveGrupoIcono,
  setGrupoIconoEmoji,
  updateSubRubro,
  uploadGrupoIcono,
  clearVentaGrupoIcono,
  createVentaSubRubro,
  createVentaSubRubroItem,
  deleteVentaSubRubro,
  deleteVentaSubRubroItem,
  deleteVentaSubRubrosGrupo,
  fetchVentaGrupoIconos,
  fetchVentaSubRubroItemsBatch,
  fetchVentaSubRubros,
  renameVentaSubRubroGrupo,
  resolveVentaGrupoIcono,
  setVentaGrupoIconoEmoji,
  updateVentaSubRubro,
  uploadVentaGrupoIcono,
} from "../../api";

export interface RubrosListadoCopy {
  title: string;
  subtitleLoading: string;
  subtitleLoaded: (filtrados: number, grupos: number) => string;
  deleteSubRubroMessage: string;
  deleteGrupoBlockedSuffix: string;
}

export interface RubrosListadoApi {
  fetchSubRubros: (soloActivos?: boolean) => Promise<SubRubro[]>;
  createSubRubro: (data: SubRubroForm) => Promise<SubRubro>;
  updateSubRubro: (id: number, data: SubRubroForm) => Promise<SubRubro>;
  deleteSubRubro: (id: number) => Promise<void>;
  renameSubRubroGrupo: (
    anterior: string,
    nuevo: string
  ) => Promise<{ updated: number; nombre: string }>;
  deleteSubRubrosGrupo: (grupo: string) => Promise<DeleteSubRubrosGrupoResult>;
  fetchGrupoIconos: () => Promise<Record<string, GrupoIconoInfo>>;
  fetchSubRubroItemsBatch: (
    ids: number[]
  ) => Promise<Record<number, SubRubroItem[]>>;
  uploadGrupoIcono: (grupo: string, file: File) => Promise<GrupoIconoInfo>;
  setGrupoIconoEmoji: (grupo: string, emoji: string) => Promise<GrupoIconoInfo>;
  clearGrupoIcono: (grupo: string) => Promise<void>;
  resolveGrupoIcono: (
    map: Record<string, GrupoIconoInfo>,
    grupo: string
  ) => GrupoIconoInfo | undefined;
  createSubRubroItem: (subRubroId: number, nombre: string) => Promise<SubRubroItem>;
  deleteSubRubroItem: (id: number) => Promise<void>;
}

export const GASTOS_RUBROS_COPY: RubrosListadoCopy = {
  title: "Rubros",
  subtitleLoading: "Cargando catálogo…",
  subtitleLoaded: (filtrados, grupos) =>
    `${filtrados} sub-rubro(s) en ${grupos} grupo(s). Columna Ítems: conceptos para gastos. Clic en el icono del grupo para cambiarlo.`,
  deleteSubRubroMessage:
    "¿Eliminar este sub-rubro? Solo es posible si no tiene gastos asociados.",
  deleteGrupoBlockedSuffix: "tienen gastos",
};

export const VENTAS_RUBROS_COPY: RubrosListadoCopy = {
  title: "Rubros ingresos por ventas",
  subtitleLoading: "Cargando catálogo de ventas…",
  subtitleLoaded: (filtrados, grupos) =>
    `${filtrados} sub-rubro(s) en ${grupos} grupo(s). Columna Ítems: conceptos para ingresos por ventas. Clic en el icono del grupo para cambiarlo.`,
  deleteSubRubroMessage:
    "¿Eliminar este sub-rubro? Solo es posible si no tiene ingresos asociados.",
  deleteGrupoBlockedSuffix: "tienen ingresos",
};

export const GASTOS_RUBROS_API: RubrosListadoApi = {
  fetchSubRubros,
  createSubRubro,
  updateSubRubro,
  deleteSubRubro,
  renameSubRubroGrupo,
  deleteSubRubrosGrupo,
  fetchGrupoIconos,
  fetchSubRubroItemsBatch,
  uploadGrupoIcono,
  setGrupoIconoEmoji,
  clearGrupoIcono,
  resolveGrupoIcono,
  createSubRubroItem,
  deleteSubRubroItem,
};

export const VENTAS_RUBROS_API: RubrosListadoApi = {
  fetchSubRubros: fetchVentaSubRubros,
  createSubRubro: createVentaSubRubro,
  updateSubRubro: updateVentaSubRubro,
  deleteSubRubro: deleteVentaSubRubro,
  renameSubRubroGrupo: renameVentaSubRubroGrupo,
  deleteSubRubrosGrupo: deleteVentaSubRubrosGrupo,
  fetchGrupoIconos: fetchVentaGrupoIconos,
  fetchSubRubroItemsBatch: fetchVentaSubRubroItemsBatch,
  uploadGrupoIcono: uploadVentaGrupoIcono,
  setGrupoIconoEmoji: setVentaGrupoIconoEmoji,
  clearGrupoIcono: clearVentaGrupoIcono,
  resolveGrupoIcono: resolveVentaGrupoIcono,
  createSubRubroItem: createVentaSubRubroItem,
  deleteSubRubroItem: deleteVentaSubRubroItem,
};
