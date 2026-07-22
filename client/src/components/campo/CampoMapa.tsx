import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import L from "leaflet";
import type { LucideIcon } from "lucide-react";
import { Building2, Boxes, ChevronDown, ChevronRight, CircleDot, Cpu, Info, ListTree, Map, MapPin, Maximize2, MessageSquare, Minimize2, Pencil, Plus, Search, Sigma, Tag, Tags, Trash2, Undo2, VenusAndMars, X } from "lucide-react";
import SgHubShell from "../hub/SgHubShell";
import { MenuAppIcon } from "../icons/MenuAppIcons";
import { StockEquinoModuleIcon } from "../stock/StockControlSanitarioSectionTitle";
import {
  createCampoMapaElemento,
  createCampoPotreroMapa,
  deleteCampoMapaElemento,
  deleteCampoPotreroMapa,
  fetchCampoMapaElementos,
  fetchCampoPotrerosMapa,
  fetchEmpresasOperativasStock,
  fetchStockEquinaDispositivos,
  fetchStockGanaderaDispositivos,
  type EmpresaOperativaStock,
  updateCampoMapaElemento,
  updateCampoPotreroMapa,
} from "../../api";
import type { CampoMapaElemento, CampoMapaElementoTipo, CampoPotreroMapa, StockGanaderaDispositivo } from "../../types";
import { hubAsideKicker } from "../../brand";
import { normalizarPotrero } from "../stock/stock-ganadera-utils";
import {
  computeDistanceMeters,
  computeHectareas,
  formatDistance,
  formatHectareas,
  openRingFromGeoJson,
  pathsToGeoJson,
  pathsToLeafletLatLngs,
  pathsToLineGeoJson,
  pointToGeoJson,
  type MapLatLng,
} from "./campo-mapa-geo";
import { mountVertexHandles } from "./campo-mapa-vertex-handles";
import { buscarLugaresEnMapa, lugarBounds, lugarUsaBoundsAjustados, lugarZoomCercano, type CampoMapaLugarResult } from "./campo-mapa-geocode";
import {
  CAMPO_MAPA_MEASURE_COLOR,
  DEFAULT_CAMPO_MAPA_DRAW_COLOR,
  loadCampoMapaDrawColor,
  normalizePotreroMapaColor,
  potreroColorPickerOptions,
  saveCampoMapaDrawColor,
  type CampoMapaDrawColor,
} from "./campo-mapa-draw-colors";
import { flyToElemento, renderElementoLayer, renderPotreroLayer } from "./campo-mapa-render";
import { createCampoMapaPinIcon } from "./campo-mapa-pin-icon";
import { createCampoMapaNotaBubbleIcon } from "./campo-mapa-nota-bubble";
import {
  CAMPO_MAPA_DETAILS_TOGGLE_LABEL,
  createCampoMapaBasemapLayers,
  loadCampoMapaShowDetails,
  saveCampoMapaShowDetails,
} from "./campo-mapa-basemap";
import {
  applyCampoMapaInitialView,
  CAMPO_MAPA_DEFAULT_CENTER,
  CAMPO_MAPA_DEFAULT_ZOOM,
  cuentaTieneGeometriaEnMapa,
} from "./campo-mapa-view";
import {
  ELEMENTO_TIPO_LABELS,
  getToolDef,
  sketchShowsAsPolygon,
  toolSketchIsPoint,
  toolSketchIsPolygon,
  toolToElementoTipo,
  toolUsesSketch,
  type CampoMapaTool,
} from "./campo-mapa-tools";
import CampoMapaToolbar from "./CampoMapaToolbar";
import {
  DEFAULT_CAMPO_MAPA_BORDER_WEIGHT,
  type CampoMapaBorderWeight,
} from "./campo-mapa-border-weight";
import CampoMapaDispositivosModal from "./CampoMapaDispositivosModal";
import {
  buildCampoMapaDispositivoMarkers,
  renderCampoMapaDispositivoMarkers,
} from "./campo-mapa-dispositivos-map";
import {
  buildAllPotreroResumenes,
  POTRERO_RESUMEN_MODOS,
  renderPotreroResumenOverlays,
  type PotreroResumenModo,
} from "./campo-mapa-potrero-resumen";

const POTRERO_RESUMEN_ICONS: Record<PotreroResumenModo, LucideIcon> = {
  empresa: Building2,
  sexo: VenusAndMars,
  totales: Sigma,
};

type CampoMapaDeviceKind = "ganadero" | "equino";

const CAMPO_MAPA_DEVICE_KIND_OPTIONS: {
  id: CampoMapaDeviceKind;
  label: string;
}[] = [
  { id: "ganadero", label: "Ganado" },
  { id: "equino", label: "Equinos" },
];
import {
  availableSaveTargets,
  canChangeSaveTarget,
  draftGeometryFromDraft,
  draftNombrePlaceholder,
  draftSaveButton,
  draftTitle,
  elementoTipoFromSaveTarget,
  geoJsonForSaveTarget,
  geometryFromGeoJson,
  markerPointFromDraft,
  saveTargetFromElemento,
  saveTargetHint,
  saveTargetLabel,
  type DraftGeometry,
  type DraftSaveTarget,
} from "./campo-mapa-draft";
import {
  emptyCampoMapaDispositivosMetadata,
  enrichCampoMapaDispositivosFromStock,
  isCampoMapaAreaContorno,
  mergeCampoMapaMetadata,
  parseCampoMapaDispositivosMetadata,
  parseCampoMapaLineaEstilo,
  parseCampoMapaMarcadorId,
  withCampoMapaAreaContorno,
  withCampoMapaMarcadorId,
  type CampoMapaDispositivosMetadata,
} from "./campo-mapa-metadata";
import {
  clearCampoMapaDispositivosPotrero,
  syncCampoMapaDispositivosPotrero,
} from "./campo-mapa-sync-dispositivos";
import {
  getCampoMapaObjetoDef,
  parseCampoMapaObjetoTipo,
  withCampoMapaObjetoTipo,
  type CampoMapaObjetoTipo,
  createCampoMapaObjetoLeafletIcon,
} from "./campo-mapa-objetos";
import {
  dashArrayForLineStyle,
  DEFAULT_CAMPO_MAPA_LINE_STYLE,
  type CampoMapaLineStyle,
} from "./campo-mapa-line-style";
import type { AuthUser } from "../../types";
import { canWriteCampoMapa } from "../../utils/auth-permissions";

const DEFAULT_CENTER = CAMPO_MAPA_DEFAULT_CENTER;
const DEFAULT_ZOOM = CAMPO_MAPA_DEFAULT_ZOOM;

function supportsDispositivosEnMapa(
  potrero: CampoPotreroMapa | null,
  elemento: CampoMapaElemento | null,
): boolean {
  if (potrero) return true;
  if (!elemento) return false;
  return !["clip", "medicion_distancia", "medicion_area"].includes(elemento.tipo);
}

const ELEMENTO_TIPO_ORDER: CampoMapaElementoTipo[] = [
  "marcador",
  "nota",
  "linea",
  "area",
  "clip",
  "medicion_distancia",
  "medicion_area",
];

interface Props {
  apiOnline: boolean;
  currentUser: AuthUser;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onVolver: () => void;
}

type MapSelection = { kind: "potrero" | "elemento"; id: number };

type PendingDraft = {
  sourceTool: CampoMapaTool;
  point?: MapLatLng;
  paths?: MapLatLng[];
  hectareas?: number | null;
  distanceMeters?: number | null;
  metadata?: Record<string, unknown>;
  isMeasurement?: boolean;
};

function draftLabel(tool: CampoMapaTool, objetoTipo?: CampoMapaObjetoTipo): string {
  switch (tool) {
    case "dibujar":
      return "Nuevo trazo";
    case "contorno":
      return "Nuevo contorno";
    case "marcador":
      return "Nuevo marcador";
    case "nota":
      return "Nueva nota";
    case "objeto":
      return objetoTipo ? `Nuevo ${getCampoMapaObjetoDef(objetoTipo).label.toLowerCase()}` : "Nuevo objeto";
    case "linea":
      return "Nueva línea";
    case "area":
      return "Nueva área";
    case "clip":
      return "Nuevo clip de vista";
    case "medir_distancia":
      return "Medición de distancia";
    case "medir_area":
      return "Medición de área";
    default:
      return "Guardar en mapa";
  }
}

function saveSuccessMessage(tool: CampoMapaTool): string {
  if (tool === "dibujar") return "Trazo guardado en el mapa.";
  if (tool === "contorno") return "Contorno guardado en el mapa.";
  if (tool === "clip") return "Clip de vista guardado.";
  if (tool === "objeto") return "Objeto guardado en el mapa.";
  if (tool === "medir_distancia" || tool === "medir_area") return "Medición guardada en el mapa.";
  return "Elemento guardado en el mapa.";
}

export default function CampoMapa({
  apiOnline,
  currentUser,
  onError,
  onSuccess,
  onVolver,
}: Props) {
  const puedeEditar = canWriteCampoMapa(currentUser);
  const cuentaNombre =
    currentUser.cuenta_actividad_nombre?.trim() ||
    currentUser.empresa_nombre?.trim() ||
    "tu cuenta";
  const [activeTool, setActiveTool] = useState<CampoMapaTool>("navegar");
  const [objetoTipo, setObjetoTipo] = useState<CampoMapaObjetoTipo>("molino_agua");
  const [lineStyle, setLineStyle] = useState<CampoMapaLineStyle>(DEFAULT_CAMPO_MAPA_LINE_STYLE);
  const [selection, setSelection] = useState<MapSelection | null>(null);
  const [sketchVertices, setSketchVertices] = useState<MapLatLng[]>([]);
  const [sketchCursor, setSketchCursor] = useState<MapLatLng | null>(null);
  const [pendingDraft, setPendingDraft] = useState<PendingDraft | null>(null);
  const [formNombre, setFormNombre] = useState("");
  const [formNotas, setFormNotas] = useState("");
  const [formMarcadorId, setFormMarcadorId] = useState<number | null>(null);
  const [draftSaveTarget, setDraftSaveTarget] = useState<DraftSaveTarget>("area");
  const [editSaveTarget, setEditSaveTarget] = useState<DraftSaveTarget>("area");
  const [editDispositivos, setEditDispositivos] = useState<CampoMapaDispositivosMetadata>(
    emptyCampoMapaDispositivosMetadata(),
  );
  const editDispositivosPrevRef = useRef<CampoMapaDispositivosMetadata>(
    emptyCampoMapaDispositivosMetadata(),
  );
  const editNombrePrevRef = useRef("");
  const [potreros, setPotreros] = useState<CampoPotreroMapa[]>([]);
  const [elementos, setElementos] = useState<CampoMapaElemento[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [showMapDetails, setShowMapDetails] = useState(loadCampoMapaShowDetails);
  const [showFeatureNames, setShowFeatureNames] = useState(true);
  const [borderWeight, setBorderWeight] = useState<CampoMapaBorderWeight>(
    DEFAULT_CAMPO_MAPA_BORDER_WEIGHT,
  );
  const [drawColor, setDrawColor] = useState<CampoMapaDrawColor>(loadCampoMapaDrawColor);
  const [deviceKindsOnMap, setDeviceKindsOnMap] = useState<CampoMapaDeviceKind[]>([]);
  const [devicesMenuOpen, setDevicesMenuOpen] = useState(false);
  const devicesMenuRef = useRef<HTMLDivElement | null>(null);
  const showDevicesOnMap = deviceKindsOnMap.length > 0;
  const showGanaderoOnMap = deviceKindsOnMap.includes("ganadero");
  const showEquinoOnMap = deviceKindsOnMap.includes("equino");
  const [potreroResumenModos, setPotreroResumenModos] = useState<PotreroResumenModo[]>([]);
  const [potreroResumenMenuOpen, setPotreroResumenMenuOpen] = useState(false);
  const potreroResumenMenuRef = useRef<HTMLDivElement | null>(null);
  const potreroResumenModosSet = useMemo(
    () => new Set(potreroResumenModos),
    [potreroResumenModos],
  );
  const [stockGanadero, setStockGanadero] = useState<StockGanaderaDispositivo[]>([]);
  const [stockEquino, setStockEquino] = useState<StockGanaderaDispositivo[]>([]);
  const [empresasOperativas, setEmpresasOperativas] = useState<EmpresaOperativaStock[]>([]);
  const [dispositivosModalOpen, setDispositivosModalOpen] = useState(false);
  const [editingSelectionContent, setEditingSelectionContent] = useState(false);
  const [mapaInfoOpen, setMapaInfoOpen] = useState(false);
  const [ubicacionesExpandidas, setUbicacionesExpandidas] = useState<Record<string, boolean>>({});
  const mapaInfoRef = useRef<HTMLDivElement | null>(null);
  const [modalDispositivos, setModalDispositivos] = useState<CampoMapaDispositivosMetadata>(
    emptyCampoMapaDispositivosMetadata(),
  );
  const [saving, setSaving] = useState(false);
  const [editNombre, setEditNombre] = useState("");
  const [editNotas, setEditNotas] = useState("");
  const [editColor, setEditColor] = useState<string>(DEFAULT_CAMPO_MAPA_DRAW_COLOR);
  const [editMarcadorId, setEditMarcadorId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CampoMapaLugarResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedVertexIndex, setSelectedVertexIndex] = useState<number | null>(null);
  const [potreroShapeEdit, setPotreroShapeEdit] = useState<{
    potreroId: number;
    vertices: MapLatLng[];
  } | null>(null);

  const potreroShapeEditRef = useRef(potreroShapeEdit);
  potreroShapeEditRef.current = potreroShapeEdit;

  const mapShellRef = useRef<HTMLDivElement | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const detailsLayerRef = useRef<L.LayerGroup | null>(null);
  const searchMarkerRef = useRef<L.CircleMarker | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const potreroLayersRef = useRef<globalThis.Map<number, L.Layer>>(new globalThis.Map());
  const elementoLayersRef = useRef<globalThis.Map<number, L.Layer>>(new globalThis.Map());
  const draftLayerRef = useRef<L.Layer | null>(null);
  const sketchPolylineRef = useRef<L.Polyline | null>(null);
  const sketchPolygonRef = useRef<L.Polygon | null>(null);
  const sketchMarkersRef = useRef<L.CircleMarker[]>([]);
  const sketchPreviewLineRef = useRef<L.Layer | null>(null);
  const sketchMeasureLabelMarkersRef = useRef<L.Marker[]>([]);
  const dispositivoMarkersLayerRef = useRef<L.LayerGroup | null>(null);
  const potreroResumenLayerRef = useRef<L.LayerGroup | null>(null);
  const initialViewAppliedRef = useRef(false);

  const toggleFullscreen = useCallback(async () => {
    const shell = mapShellRef.current;
    if (!shell) return;
    try {
      if (document.fullscreenElement === shell) {
        await document.exitFullscreen();
      } else if (!document.fullscreenElement) {
        await shell.requestFullscreen();
      }
    } catch {
      onError("No se pudo activar pantalla completa en este navegador.");
    }
  }, [onError]);

  useEffect(() => {
    if (!mapaInfoOpen) return;
    const onDocClick = (event: MouseEvent) => {
      if (mapaInfoRef.current && !mapaInfoRef.current.contains(event.target as Node)) {
        setMapaInfoOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMapaInfoOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mapaInfoOpen]);

  useEffect(() => {
    const onFullscreenChange = () => {
      const active = document.fullscreenElement === mapShellRef.current;
      setIsFullscreen(active);
      window.setTimeout(() => mapRef.current?.invalidateSize(), 50);
      window.setTimeout(() => mapRef.current?.invalidateSize(), 250);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const selectedPotrero = useMemo(
    () =>
      selection?.kind === "potrero"
        ? (potreros.find((p) => p.id === selection.id) ?? null)
        : null,
    [potreros, selection],
  );

  const selectedElemento = useMemo(
    () =>
      selection?.kind === "elemento"
        ? (elementos.find((e) => e.id === selection.id) ?? null)
        : null,
    [elementos, selection],
  );

  const editGeometry = useMemo((): DraftGeometry | null => {
    const geojson = selectedPotrero?.geojson ?? selectedElemento?.geojson;
    if (!geojson) return null;
    return geometryFromGeoJson(geojson);
  }, [selectedElemento, selectedPotrero]);

  const elementosByTipo = useMemo(() => {
    const grouped = new globalThis.Map<CampoMapaElementoTipo, CampoMapaElemento[]>();
    for (const tipo of ELEMENTO_TIPO_ORDER) grouped.set(tipo, []);
    for (const item of elementos) {
      const list = grouped.get(item.tipo) ?? [];
      list.push(item);
      grouped.set(item.tipo, list);
    }
    for (const [, list] of grouped) {
      list.sort((a, b) => a.nombre.localeCompare(b.nombre));
    }
    return grouped;
  }, [elementos]);

  const marcadoresUbicacion = useMemo(
    () =>
      elementos
        .filter(
          (item) => item.tipo === "marcador" && parseCampoMapaObjetoTipo(item.metadata) == null,
        )
        .slice()
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [elementos],
  );

  const objetosEnMapa = useMemo(
    () =>
      elementos
        .filter((item) => parseCampoMapaObjetoTipo(item.metadata) != null)
        .slice()
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [elementos],
  );

  const marcadorNombreById = useMemo(() => {
    const map = new globalThis.Map<number, string>();
    for (const item of marcadoresUbicacion) map.set(item.id, item.nombre);
    return map;
  }, [marcadoresUbicacion]);

  const potrerosPorUbicacion = useMemo(() => {
    type Grupo = {
      key: string;
      marcador: CampoMapaElemento | null;
      label: string;
      items: CampoPotreroMapa[];
    };
    const grupos = new globalThis.Map<string, Grupo>();

    for (const marcador of marcadoresUbicacion) {
      grupos.set(`m-${marcador.id}`, {
        key: `m-${marcador.id}`,
        marcador,
        label: marcador.nombre,
        items: [],
      });
    }

    const sinUbicacion: Grupo = {
      key: "sin-ubicacion",
      marcador: null,
      label: "Sin ubicación",
      items: [],
    };

    for (const potrero of potreros) {
      const marcadorId = parseCampoMapaMarcadorId(potrero.metadata);
      const grupo =
        marcadorId != null && grupos.has(`m-${marcadorId}`)
          ? grupos.get(`m-${marcadorId}`)!
          : sinUbicacion;
      grupo.items.push(potrero);
    }

    const ordered: Grupo[] = [];
    for (const marcador of marcadoresUbicacion) {
      const grupo = grupos.get(`m-${marcador.id}`);
      if (grupo) ordered.push(grupo);
    }
    if (sinUbicacion.items.length > 0) ordered.push(sinUbicacion);

    for (const grupo of ordered) {
      grupo.items.sort((a, b) => a.nombre.localeCompare(b.nombre));
    }
    return ordered;
  }, [marcadoresUbicacion, potreros]);

  const elementosSinMarcadoresNiObjetos = useMemo(() => {
    const grouped = new globalThis.Map<CampoMapaElementoTipo, CampoMapaElemento[]>();
    for (const tipo of ELEMENTO_TIPO_ORDER) {
      if (tipo === "marcador") continue;
      const items = (elementosByTipo.get(tipo) ?? []).filter(
        (item) => parseCampoMapaObjetoTipo(item.metadata) == null,
      );
      grouped.set(tipo, items);
    }
    return grouped;
  }, [elementosByTipo]);

  useEffect(() => {
    setUbicacionesExpandidas((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const grupo of potrerosPorUbicacion) {
        if (next[grupo.key] === undefined) {
          next[grupo.key] = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [potrerosPorUbicacion]);

  useEffect(() => {
    if (!selection) return;
    if (selection.kind === "elemento") {
      const key = `m-${selection.id}`;
      if (potrerosPorUbicacion.some((g) => g.key === key)) {
        setUbicacionesExpandidas((prev) => ({ ...prev, [key]: true }));
      }
      return;
    }
    if (selection.kind === "potrero") {
      const potrero = potreros.find((p) => p.id === selection.id);
      if (!potrero) return;
      const marcadorId = parseCampoMapaMarcadorId(potrero.metadata);
      const key =
        marcadorId != null && marcadorNombreById.has(marcadorId)
          ? `m-${marcadorId}`
          : "sin-ubicacion";
      setUbicacionesExpandidas((prev) => ({ ...prev, [key]: true }));
    }
  }, [marcadorNombreById, potreros, potrerosPorUbicacion, selection]);

  const toggleUbicacionExpandida = useCallback((key: string) => {
    setUbicacionesExpandidas((prev) => ({
      ...prev,
      [key]: !(prev[key] ?? true),
    }));
  }, []);

  const resumenUbicacionPotreros = useCallback((items: CampoPotreroMapa[]) => {
    const countLabel =
      items.length === 1 ? "1 potrero" : `${items.length} potreros`;
    const totalHa = items.reduce((sum, item) => {
      const ha = item.hectareas;
      return typeof ha === "number" && Number.isFinite(ha) ? sum + ha : sum;
    }, 0);
    if (items.length === 0 || totalHa <= 0) return countLabel;
    return `${countLabel} · ${formatHectareas(totalHa)}`;
  }, []);

  const toolDef = getToolDef(activeTool);
  const isSketching =
    ((toolUsesSketch(activeTool) ||
      (activeTool === "objeto" && getCampoMapaObjetoDef(objetoTipo).geometry === "line")) &&
      sketchVertices.length > 0 &&
      !pendingDraft);
  const minSketchPoints =
    activeTool === "objeto" && getCampoMapaObjetoDef(objetoTipo).geometry === "line"
      ? 2
      : toolSketchIsPolygon(activeTool)
        ? 3
        : 2;

  const sketchStrokeColor = useMemo(() => {
    if (activeTool === "medir_distancia" || activeTool === "medir_area") {
      return CAMPO_MAPA_MEASURE_COLOR;
    }
    if (activeTool === "objeto") {
      return getCampoMapaObjetoDef(objetoTipo).color;
    }
    if (potreroShapeEdit) {
      const potrero = potreros.find((item) => item.id === potreroShapeEdit.potreroId);
      return potrero?.color ?? drawColor;
    }
    return drawColor;
  }, [activeTool, drawColor, objetoTipo, potreroShapeEdit, potreros]);

  const handleDrawColorChange = useCallback((color: CampoMapaDrawColor) => {
    setDrawColor(color);
    saveCampoMapaDrawColor(color);
  }, []);

  const vertexEditSource = useMemo(() => {
    if (potreroShapeEdit) {
      return {
        kind: "potrero" as const,
        vertices: potreroShapeEdit.vertices,
        isPolygon: true,
        minPoints: 3,
      };
    }
    const objetoLine =
      activeTool === "objeto" && getCampoMapaObjetoDef(objetoTipo).geometry === "line";
    if (
      (toolUsesSketch(activeTool) || objetoLine) &&
      !pendingDraft &&
      sketchVertices.length > 0
    ) {
      return {
        kind: "sketch" as const,
        vertices: sketchVertices,
        isPolygon: objetoLine ? false : sketchShowsAsPolygon(activeTool, sketchVertices.length),
        minPoints: minSketchPoints,
        dashLine: activeTool === "medir_distancia" || objetoTipo === "camino",
      };
    }
    return null;
  }, [
    activeTool,
    minSketchPoints,
    objetoTipo,
    pendingDraft,
    potreroShapeEdit,
    sketchVertices,
  ]);

  const measureHint = useMemo(() => {
    const measurePath =
      sketchCursor && sketchVertices.length > 0
        ? [...sketchVertices, sketchCursor]
        : sketchVertices;

    if (activeTool === "medir_distancia" && measurePath.length >= 2) {
      const meters = computeDistanceMeters(measurePath);
      return meters != null ? `Distancia: ${formatDistance(meters)}` : null;
    }
    if (activeTool === "medir_area" && measurePath.length >= 3) {
      const ha = computeHectareas(measurePath);
      return ha != null ? `Área: ${formatHectareas(ha)}` : null;
    }
    if (activeTool === "dibujar" && sketchVertices.length >= 3) {
      const ha = computeHectareas(sketchVertices);
      return ha != null ? formatHectareas(ha) : null;
    }
    return null;
  }, [activeTool, sketchCursor, sketchVertices]);

  const refreshData = useCallback(async () => {
    if (!apiOnline) {
      setPotreros([]);
      setElementos([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [potreroData, elementoData] = await Promise.all([
        fetchCampoPotrerosMapa(),
        fetchCampoMapaElementos(),
      ]);
      setPotreros(potreroData);
      setElementos(elementoData);
      if (apiOnline) {
        const [ganaderoData, equinoData, empresasData] = await Promise.all([
          fetchStockGanaderaDispositivos({}),
          fetchStockEquinaDispositivos({}),
          fetchEmpresasOperativasStock(),
        ]);
        setStockGanadero(ganaderoData.filter((d) => d.estado === "VIVO"));
        setStockEquino(equinoData.filter((d) => d.estado === "VIVO"));
        setEmpresasOperativas(empresasData);
      } else {
        setStockGanadero([]);
        setStockEquino([]);
        setEmpresasOperativas([]);
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudieron cargar las capas del mapa.");
    } finally {
      setLoading(false);
    }
  }, [apiOnline, onError]);

  const enrichDispositivosForFeature = useCallback(
    (nombre: string, metaRaw: string | undefined | null): CampoMapaDispositivosMetadata => {
      const base = parseCampoMapaDispositivosMetadata(metaRaw);
      return enrichCampoMapaDispositivosFromStock(
        nombre,
        base,
        stockGanadero,
        stockEquino,
        normalizarPotrero,
      );
    },
    [stockEquino, stockGanadero],
  );

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  useEffect(() => {
    if (!selectedPotrero && !selectedElemento) {
      setEditNombre("");
      setEditNotas("");
      setEditColor(DEFAULT_CAMPO_MAPA_DRAW_COLOR);
      setEditDispositivos(emptyCampoMapaDispositivosMetadata());
      editDispositivosPrevRef.current = emptyCampoMapaDispositivosMetadata();
      editNombrePrevRef.current = "";
      return;
    }
    const item = selectedPotrero ?? selectedElemento;
    if (!item) return;
    setEditNombre(item.nombre);
    setEditNotas(item.notas);
    if (selectedPotrero) {
      setEditColor(normalizePotreroMapaColor(selectedPotrero.color));
      setEditMarcadorId(parseCampoMapaMarcadorId(selectedPotrero.metadata));
    } else if (selectedElemento) {
      setEditColor(normalizePotreroMapaColor(selectedElemento.color));
      setEditMarcadorId(null);
    } else {
      setEditColor(drawColor);
      setEditMarcadorId(null);
    }
    const metaRaw = selectedPotrero?.metadata ?? selectedElemento?.metadata;
    const dispositivos = enrichDispositivosForFeature(item.nombre, metaRaw);
    setEditDispositivos(dispositivos);
    editDispositivosPrevRef.current = dispositivos;
    editNombrePrevRef.current = item.nombre;
    if (selectedPotrero) {
      setEditSaveTarget("potrero");
    } else if (selectedElemento) {
      const target = saveTargetFromElemento(selectedElemento.tipo);
      if (target) setEditSaveTarget(target);
    }
  }, [drawColor, enrichDispositivosForFeature, selectedPotrero, selectedElemento]);

  useEffect(() => {
    setEditingSelectionContent(false);
    setDispositivosModalOpen(false);
  }, [selection]);

  const dispositivosVinculadosCount =
    editDispositivos.dispositivos_ganadero.length + editDispositivos.dispositivos_equino.length;

  const startEditingSelectionContent = useCallback(() => {
    setEditingSelectionContent(true);
  }, []);

  const cancelEditingSelectionContent = useCallback(() => {
    setEditingSelectionContent(false);
    setDispositivosModalOpen(false);
    const item = selectedPotrero ?? selectedElemento;
    if (!item) return;
    setEditNombre(item.nombre);
    setEditNotas(item.notas);
    if (selectedPotrero) {
      setEditColor(normalizePotreroMapaColor(selectedPotrero.color));
      setEditMarcadorId(parseCampoMapaMarcadorId(selectedPotrero.metadata));
    } else if (selectedElemento) {
      setEditColor(normalizePotreroMapaColor(selectedElemento.color));
      setEditMarcadorId(null);
    } else {
      setEditColor(drawColor);
      setEditMarcadorId(null);
    }
    const metaRaw = selectedPotrero?.metadata ?? selectedElemento?.metadata;
    const dispositivos = enrichDispositivosForFeature(item.nombre, metaRaw);
    setEditDispositivos(dispositivos);
    editDispositivosPrevRef.current = dispositivos;
    editNombrePrevRef.current = item.nombre;
  }, [drawColor, enrichDispositivosForFeature, selectedElemento, selectedPotrero]);

  const clearSketchOverlay = useCallback(() => {
    sketchPolylineRef.current?.remove();
    sketchPolylineRef.current = null;
    sketchPolygonRef.current?.remove();
    sketchPolygonRef.current = null;
    sketchPreviewLineRef.current?.remove();
    sketchPreviewLineRef.current = null;
    sketchMeasureLabelMarkersRef.current.forEach((marker) => marker.remove());
    sketchMeasureLabelMarkersRef.current = [];
    sketchMarkersRef.current.forEach((marker) => marker.remove());
    sketchMarkersRef.current = [];
    setSketchVertices([]);
    setSketchCursor(null);
    setSelectedVertexIndex(null);
  }, []);

  const cancelPotreroShapeEdit = useCallback(() => {
    setPotreroShapeEdit(null);
    setSelectedVertexIndex(null);
  }, []);

  const clearDraftOverlay = useCallback(() => {
    draftLayerRef.current?.remove();
    draftLayerRef.current = null;
    setPendingDraft(null);
    setFormNombre("");
    setFormNotas("");
    setFormMarcadorId(null);
    setDraftSaveTarget("area");
  }, []);

  const selectPotrero = useCallback((id: number) => {
    cancelPotreroShapeEdit();
    setSelection({ kind: "potrero", id });
    clearSketchOverlay();
    clearDraftOverlay();
  }, [cancelPotreroShapeEdit, clearDraftOverlay, clearSketchOverlay]);

  const selectElemento = useCallback((id: number) => {
    cancelPotreroShapeEdit();
    setSelection({ kind: "elemento", id });
    clearSketchOverlay();
    clearDraftOverlay();
  }, [cancelPotreroShapeEdit, clearDraftOverlay, clearSketchOverlay]);

  const handleMapFeatureClick = useCallback(
    (kind: "potrero" | "elemento", id: number) => {
      mapRef.current?.closePopup();
      if (kind === "potrero") selectPotrero(id);
      else selectElemento(id);
    },
    [selectElemento, selectPotrero],
  );

  const moveVertexAt = useCallback((index: number, point: MapLatLng) => {
    if (potreroShapeEditRef.current) {
      setPotreroShapeEdit((prev) =>
        prev
          ? {
              ...prev,
              vertices: prev.vertices.map((vertex, i) => (i === index ? point : vertex)),
            }
          : null,
      );
      return;
    }
    setSketchVertices((prev) =>
      prev.map((vertex, i) => (i === index ? point : vertex)),
    );
  }, []);

  const removeVertexAt = useCallback(
    (index: number) => {
      const source = potreroShapeEditRef.current
        ? {
            vertices: potreroShapeEditRef.current.vertices,
            minPoints: 3,
          }
        : {
            vertices: sketchVertices,
            minPoints: minSketchPoints,
          };

      if (source.vertices.length <= source.minPoints) {
        onError(`Necesitás al menos ${source.minPoints} puntos.`);
        return;
      }

      if (potreroShapeEditRef.current) {
        setPotreroShapeEdit((prev) =>
          prev
            ? {
                ...prev,
                vertices: prev.vertices.filter((_, i) => i !== index),
              }
            : null,
        );
      } else {
        setSketchVertices((prev) => prev.filter((_, i) => i !== index));
      }
      setSelectedVertexIndex((prev) => {
        if (prev == null) return null;
        if (prev === index) return null;
        return prev > index ? prev - 1 : prev;
      });
    },
    [minSketchPoints, onError, sketchVertices],
  );

  const deleteSelectedVertex = useCallback(() => {
    if (selectedVertexIndex == null) return;
    removeVertexAt(selectedVertexIndex);
  }, [removeVertexAt, selectedVertexIndex]);

  const startPotreroShapeEdit = useCallback(() => {
    if (!selectedPotrero) return;
    let vertices: MapLatLng[] = [];
    try {
      vertices = openRingFromGeoJson(selectedPotrero.geojson);
    } catch {
      onError("No se pudo leer la forma del potrero.");
      return;
    }
    if (vertices.length < 3) {
      onError("El potrero necesita al menos 3 puntos para editar.");
      return;
    }
    clearSketchOverlay();
    clearDraftOverlay();
    setActiveTool("navegar");
    setPotreroShapeEdit({ potreroId: selectedPotrero.id, vertices });
    setSelectedVertexIndex(null);
  }, [clearDraftOverlay, clearSketchOverlay, onError, selectedPotrero]);

  const renderMapLayers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    potreroLayersRef.current.forEach((layer) => layer.remove());
    potreroLayersRef.current.clear();
    elementoLayersRef.current.forEach((layer) => layer.remove());
    elementoLayersRef.current.clear();

    for (const item of potreros) {
      if (potreroShapeEdit?.potreroId === item.id) continue;
      const layer = renderPotreroLayer(
        map,
        item,
        selection?.kind === "potrero" && selection.id === item.id,
        () => handleMapFeatureClick("potrero", item.id),
        { showName: showFeatureNames, borderWeight },
      );
      if (layer) potreroLayersRef.current.set(item.id, layer);
    }

    for (const item of elementos) {
      const layer = renderElementoLayer(
        map,
        item,
        selection?.kind === "elemento" && selection.id === item.id,
        () => handleMapFeatureClick("elemento", item.id),
        { showName: showFeatureNames, borderWeight },
      );
      if (layer) elementoLayersRef.current.set(item.id, layer);
    }
  }, [borderWeight, elementos, handleMapFeatureClick, potreroShapeEdit, potreros, selection, showFeatureNames]);

  useEffect(() => {
    if (!cuentaTieneGeometriaEnMapa(potreros, elementos)) {
      initialViewAppliedRef.current = false;
    }
  }, [elementos.length, potreros.length]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
      attributionControl: true,
    });

    const { satellite, details } = createCampoMapaBasemapLayers();
    satellite.addTo(map);
    detailsLayerRef.current = details;
    if (loadCampoMapaShowDetails()) {
      details.addTo(map);
    }
    mapRef.current = map;
    setMapReady(true);

    const resize = () => map.invalidateSize();
    const timer = window.setTimeout(resize, 120);
    window.addEventListener("resize", resize);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", resize);
      clearSketchOverlay();
      clearDraftOverlay();
      potreroLayersRef.current.forEach((layer) => layer.remove());
      potreroLayersRef.current.clear();
      elementoLayersRef.current.forEach((layer) => layer.remove());
      elementoLayersRef.current.clear();
      dispositivoMarkersLayerRef.current?.remove();
      dispositivoMarkersLayerRef.current = null;
      potreroResumenLayerRef.current?.remove();
      potreroResumenLayerRef.current = null;
      map.remove();
      mapRef.current = null;
      detailsLayerRef.current = null;
      searchMarkerRef.current?.remove();
      searchMarkerRef.current = null;
      setMapReady(false);
    };
  }, [clearDraftOverlay, clearSketchOverlay]);

  useEffect(() => {
    if (!mapReady) return;
    renderMapLayers();
  }, [mapReady, renderMapLayers]);

  const stockGanaderoVisible = useMemo(
    () => (showGanaderoOnMap ? stockGanadero : []),
    [showGanaderoOnMap, stockGanadero],
  );
  const stockEquinoVisible = useMemo(
    () => (showEquinoOnMap ? stockEquino : []),
    [showEquinoOnMap, stockEquino],
  );

  const dispositivoMapMarkers = useMemo(
    () =>
      buildCampoMapaDispositivoMarkers(
        potreros,
        elementos,
        stockGanaderoVisible,
        stockEquinoVisible,
        empresasOperativas,
      ),
    [elementos, empresasOperativas, potreros, stockEquinoVisible, stockGanaderoVisible],
  );

  useEffect(() => {
    const map = mapRef.current;
    dispositivoMarkersLayerRef.current?.remove();
    dispositivoMarkersLayerRef.current = null;
    if (!map || !showDevicesOnMap || dispositivoMapMarkers.length === 0) return;
    dispositivoMarkersLayerRef.current = renderCampoMapaDispositivoMarkers(
      map,
      dispositivoMapMarkers,
    );
  }, [dispositivoMapMarkers, mapReady, showDevicesOnMap]);

  const potreroResumenes = useMemo(() => {
    // Si hay filtro de capas activo, el resumen sigue la misma visibilidad.
    const ganadero = showDevicesOnMap ? stockGanaderoVisible : stockGanadero;
    const equino = showDevicesOnMap ? stockEquinoVisible : stockEquino;
    return buildAllPotreroResumenes(potreros, ganadero, equino, empresasOperativas);
  }, [
    empresasOperativas,
    potreros,
    showDevicesOnMap,
    stockEquino,
    stockEquinoVisible,
    stockGanadero,
    stockGanaderoVisible,
  ]);


  useEffect(() => {
    const map = mapRef.current;
    potreroResumenLayerRef.current?.remove();
    potreroResumenLayerRef.current = null;
    if (!map || potreroResumenModos.length === 0) return;
    potreroResumenLayerRef.current = renderPotreroResumenOverlays(
      map,
      potreros,
      potreroResumenes,
      potreroResumenModosSet,
    );
  }, [mapReady, potreroResumenModos.length, potreroResumenModosSet, potreroResumenes, potreros]);

  useEffect(() => {
    if (!potreroResumenMenuOpen) return;
    const onDocClick = (event: MouseEvent) => {
      if (
        potreroResumenMenuRef.current &&
        !potreroResumenMenuRef.current.contains(event.target as Node)
      ) {
        setPotreroResumenMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [potreroResumenMenuOpen]);

  useEffect(() => {
    if (!devicesMenuOpen) return;
    const onDocClick = (event: MouseEvent) => {
      if (
        devicesMenuRef.current &&
        !devicesMenuRef.current.contains(event.target as Node)
      ) {
        setDevicesMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [devicesMenuOpen]);

  const togglePotreroResumenModo = useCallback((modo: PotreroResumenModo) => {
    setPotreroResumenModos((prev) =>
      prev.includes(modo) ? prev.filter((item) => item !== modo) : [...prev, modo],
    );
  }, []);

  const toggleDeviceKindOnMap = useCallback((kind: CampoMapaDeviceKind) => {
    setDeviceKindsOnMap((prev) =>
      prev.includes(kind) ? prev.filter((item) => item !== kind) : [...prev, kind],
    );
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selection) return;

    if (selection.kind === "potrero") {
      const layer = potreroLayersRef.current.get(selection.id);
      if (layer && "getBounds" in layer) {
        map.fitBounds((layer as L.Polygon).getBounds(), { padding: [72, 72], maxZoom: 17 });
      }
      return;
    }

    const item = elementos.find((e) => e.id === selection.id);
    if (item) flyToElemento(map, item);
  }, [elementos, mapReady, selection]);

  useEffect(() => {
    if (!mapReady || loading) return;
    if (selection || pendingDraft || isSketching) return;
    if (initialViewAppliedRef.current) return;
    if (!cuentaTieneGeometriaEnMapa(potreros, elementos)) return;

    const map = mapRef.current;
    if (!map) return;
    applyCampoMapaInitialView(map, potreros, elementos, { animate: false });
    initialViewAppliedRef.current = true;
  }, [elementos, isSketching, loading, mapReady, pendingDraft, potreros, selection]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onClick = (event: L.LeafletMouseEvent) => {
      if (pendingDraft || potreroShapeEditRef.current) return;

      if (activeTool === "objeto") {
        const def = getCampoMapaObjetoDef(objetoTipo);
        if (def.geometry === "point") {
          const point = { lat: event.latlng.lat, lng: event.latlng.lng };
          setSelection(null);
          clearSketchOverlay();
          setPendingDraft({
            sourceTool: "objeto",
            point,
            metadata: withCampoMapaObjetoTipo({}, objetoTipo),
          });
          setFormNombre(def.label);
          setFormNotas("");
          return;
        }
        setSketchVertices((prev) => [...prev, { lat: event.latlng.lat, lng: event.latlng.lng }]);
        return;
      }

      if (toolSketchIsPoint(activeTool)) {
        const point = { lat: event.latlng.lat, lng: event.latlng.lng };
        setSelection(null);
        clearSketchOverlay();
        setPendingDraft({ sourceTool: activeTool, point });
        setDraftSaveTarget("marcador");
        const sinGeometria = !cuentaTieneGeometriaEnMapa(potreros, elementos);
        setFormNombre(
          activeTool === "nota"
            ? "Nota"
            : sinGeometria && activeTool === "marcador"
              ? "Predio"
              : "Marcador",
        );
        setFormNotas("");
        return;
      }

      if (toolUsesSketch(activeTool)) {
        setSketchVertices((prev) => [...prev, { lat: event.latlng.lat, lng: event.latlng.lng }]);
      }
    };

    const usesMapClick =
      activeTool === "objeto" ||
      toolSketchIsPoint(activeTool) ||
      toolUsesSketch(activeTool);
    if (usesMapClick && !pendingDraft) {
      map.on("click", onClick);
      map.getContainer().style.cursor = "crosshair";
    } else {
      map.getContainer().style.cursor = "";
    }

    return () => {
      map.off("click", onClick);
      map.getContainer().style.cursor = "";
    };
  }, [
    activeTool,
    clearSketchOverlay,
    elementos,
    mapReady,
    objetoTipo,
    pendingDraft,
    potreros,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const trackingMeasure =
      (activeTool === "medir_distancia" || activeTool === "medir_area") &&
      toolUsesSketch(activeTool) &&
      sketchVertices.length > 0 &&
      !pendingDraft;

    const onMouseMove = (event: L.LeafletMouseEvent) => {
      if (!trackingMeasure) return;
      setSketchCursor({ lat: event.latlng.lat, lng: event.latlng.lng });
    };

    const onMouseOut = () => {
      if (!trackingMeasure) return;
      setSketchCursor(null);
    };

    if (trackingMeasure) {
      map.on("mousemove", onMouseMove);
      map.on("mouseout", onMouseOut);
    } else {
      setSketchCursor(null);
    }

    return () => {
      map.off("mousemove", onMouseMove);
      map.off("mouseout", onMouseOut);
    };
  }, [activeTool, mapReady, pendingDraft, sketchVertices.length]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    sketchPreviewLineRef.current?.remove();
    sketchPreviewLineRef.current = null;
    sketchMeasureLabelMarkersRef.current.forEach((marker) => marker.remove());
    sketchMeasureLabelMarkersRef.current = [];

    const showDistanceOverlay =
      activeTool === "medir_distancia" && !pendingDraft && sketchVertices.length > 0;
    if (!showDistanceOverlay) return;

    const measurePath =
      sketchCursor && sketchVertices.length > 0
        ? [...sketchVertices, sketchCursor]
        : sketchVertices;

    for (let i = 1; i < measurePath.length; i += 1) {
      const a = measurePath[i - 1];
      const b = measurePath[i];
      const meters = computeDistanceMeters([a, b]);
      if (meters == null) continue;
      const isPreview = Boolean(sketchCursor) && i === measurePath.length - 1;
      const marker = L.marker([(a.lat + b.lat) / 2, (a.lng + b.lng) / 2], {
        icon: L.divIcon({
          className: `campo-mapa-measure-label${isPreview ? " is-preview" : ""}`,
          html: `<span>${formatDistance(meters)}</span>`,
        }),
        interactive: false,
      }).addTo(map);
      sketchMeasureLabelMarkersRef.current.push(marker);
    }

    if (sketchCursor && sketchVertices.length >= 1) {
      const last = sketchVertices[sketchVertices.length - 1];
      sketchPreviewLineRef.current = L.polyline(pathsToLeafletLatLngs([last, sketchCursor]), {
        color: CAMPO_MAPA_MEASURE_COLOR,
        weight: borderWeight,
        opacity: 0.75,
        dashArray: "6 6",
      }).addTo(map);
    }

    return () => {
      sketchPreviewLineRef.current?.remove();
      sketchPreviewLineRef.current = null;
      sketchMeasureLabelMarkersRef.current.forEach((marker) => marker.remove());
      sketchMeasureLabelMarkersRef.current = [];
    };
  }, [activeTool, borderWeight, mapReady, pendingDraft, sketchCursor, sketchVertices]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !vertexEditSource) return;

    sketchPolylineRef.current?.remove();
    sketchPolylineRef.current = null;
    sketchPolygonRef.current?.remove();
    sketchPolygonRef.current = null;
    sketchMarkersRef.current.forEach((marker) => marker.remove());
    sketchMarkersRef.current = [];

    const { vertices, isPolygon } = vertexEditSource;
    const isContornoSketch =
      vertexEditSource.kind === "sketch" && activeTool === "contorno";
    const contornoDash = isContornoSketch ? dashArrayForLineStyle(lineStyle) : undefined;

    if (vertices.length >= 2) {
      if (isPolygon) {
        sketchPolygonRef.current = L.polygon(pathsToLeafletLatLngs(vertices), {
          color: sketchStrokeColor,
          weight: borderWeight,
          opacity: 0.95,
          fillColor: sketchStrokeColor,
          fillOpacity: isContornoSketch
            ? 0
            : vertexEditSource.kind === "potrero"
              ? 0.28
              : 0.18,
          fill: !isContornoSketch,
          dashArray:
            vertexEditSource.kind === "potrero"
              ? undefined
              : isContornoSketch
                ? contornoDash
                : "6 4",
        }).addTo(map);
      } else {
        sketchPolylineRef.current = L.polyline(pathsToLeafletLatLngs(vertices), {
          color: sketchStrokeColor,
          weight: borderWeight,
          opacity: 0.95,
          dashArray:
            isContornoSketch
              ? contornoDash
              : "dashLine" in vertexEditSource && vertexEditSource.dashLine
                ? "8 6"
                : undefined,
        }).addTo(map);
      }
    }

    const cleanup = mountVertexHandles(map, vertices, {
      color: sketchStrokeColor,
      selectedIndex: selectedVertexIndex,
      onMove: moveVertexAt,
      onSelect: setSelectedVertexIndex,
      onRemove: removeVertexAt,
    });

    return () => {
      cleanup();
      sketchPolylineRef.current?.remove();
      sketchPolylineRef.current = null;
      sketchPolygonRef.current?.remove();
      sketchPolygonRef.current = null;
    };
  }, [
    activeTool,
    borderWeight,
    lineStyle,
    mapReady,
    moveVertexAt,
    removeVertexAt,
    selectedVertexIndex,
    sketchStrokeColor,
    vertexEditSource,
  ]);

  useEffect(() => {
    if (!vertexEditSource) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (selectedVertexIndex == null) return;
      event.preventDefault();
      removeVertexAt(selectedVertexIndex);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [removeVertexAt, selectedVertexIndex, vertexEditSource]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    draftLayerRef.current?.remove();
    draftLayerRef.current = null;
    if (!pendingDraft) return;

    const draftColor = pendingDraft.isMeasurement ? CAMPO_MAPA_MEASURE_COLOR : drawColor;
    const { point, paths, sourceTool } = pendingDraft;
    if (point) {
      if (sourceTool === "marcador") {
        draftLayerRef.current = L.marker([point.lat, point.lng], {
          icon: createCampoMapaPinIcon(draftColor, true),
        }).addTo(map);
      } else if (sourceTool === "nota") {
        draftLayerRef.current = L.marker([point.lat, point.lng], {
          icon: createCampoMapaNotaBubbleIcon(
            draftColor,
            "Nota",
            formNotas,
            true,
            !formNotas.trim(),
          ),
        }).addTo(map);
      } else if (sourceTool === "objeto") {
        const tipo =
          parseCampoMapaObjetoTipo(JSON.stringify(pendingDraft.metadata ?? {})) ?? objetoTipo;
        const def = getCampoMapaObjetoDef(tipo);
        draftLayerRef.current = L.marker([point.lat, point.lng], {
          icon: createCampoMapaObjetoLeafletIcon(
            tipo,
            def.color,
            formNombre.trim() || def.label,
            true,
          ),
        }).addTo(map);
      } else {
        draftLayerRef.current = L.circleMarker([point.lat, point.lng], {
          radius: sourceTool === "clip" ? 7 : 8,
          color: "#ffffff",
          weight: 3,
          fillColor: draftColor,
          fillOpacity: 1,
        }).addTo(map);
      }
      return;
    }

    if (!paths || paths.length === 0) return;

    if (
      sourceTool === "linea" ||
      sourceTool === "medir_distancia" ||
      sourceTool === "objeto"
    ) {
      const objetoMetaTipo =
        sourceTool === "objeto"
          ? parseCampoMapaObjetoTipo(JSON.stringify(pendingDraft.metadata ?? {})) ?? objetoTipo
          : null;
      const lineColor = objetoMetaTipo
        ? getCampoMapaObjetoDef(objetoMetaTipo).color
        : draftColor;
      draftLayerRef.current = L.polyline(pathsToLeafletLatLngs(paths), {
        color: lineColor,
        weight: borderWeight + (objetoMetaTipo === "camino" ? 1 : 0),
        opacity: 0.95,
        dashArray:
          sourceTool === "medir_distancia" || objetoMetaTipo === "camino" ? "8 6" : undefined,
      }).addTo(map);
      return;
    }

    if (sourceTool === "dibujar" && paths.length < 3) {
      draftLayerRef.current = L.polyline(pathsToLeafletLatLngs(paths), {
        color: draftColor,
        weight: borderWeight,
        opacity: 0.95,
      }).addTo(map);
      return;
    }

    draftLayerRef.current = L.polygon(pathsToLeafletLatLngs(paths), {
      color: draftColor,
      weight: borderWeight,
      opacity: 0.95,
      fillColor: draftColor,
      fillOpacity: sourceTool === "contorno" ? 0 : 0.32,
      fill: sourceTool !== "contorno",
      dashArray:
        sourceTool === "contorno"
          ? dashArrayForLineStyle(
              parseCampoMapaLineaEstilo(JSON.stringify(pendingDraft.metadata ?? {})) ??
                lineStyle,
            )
          : undefined,
    }).addTo(map);
  }, [
    borderWeight,
    drawColor,
    formNombre,
    formNotas,
    lineStyle,
    mapReady,
    objetoTipo,
    pendingDraft,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    const details = detailsLayerRef.current;
    if (!map || !details) return;
    if (showMapDetails) {
      if (!map.hasLayer(details)) details.addTo(map);
    } else {
      map.removeLayer(details);
    }
    saveCampoMapaShowDetails(showMapDetails);
  }, [showMapDetails, mapReady]);

  const toggleMapDetails = useCallback(() => {
    setShowMapDetails((visible) => !visible);
  }, []);

  const clearSearchMarker = useCallback(() => {
    searchMarkerRef.current?.remove();
    searchMarkerRef.current = null;
  }, []);

  const irALugar = useCallback(
    (lugar: CampoMapaLugarResult) => {
      const map = mapRef.current;
      if (!map) return;

      initialViewAppliedRef.current = true;
      clearSearchMarker();
      searchMarkerRef.current = L.circleMarker([lugar.lat, lugar.lng], {
        radius: 8,
        color: "#ffffff",
        weight: 3,
        fillColor: "#2563eb",
        fillOpacity: 1,
      }).addTo(map);

      const flyDuration = 0.85;
      const flyEase = 0.25;

      map.invalidateSize({ animate: false });
      window.requestAnimationFrame(() => {
        if (lugarUsaBoundsAjustados(lugar)) {
          map.flyToBounds(lugarBounds(lugar), {
            padding: [72, 48],
            maxZoom: 17,
            duration: flyDuration,
            easeLinearity: flyEase,
          });
          return;
        }

        map.flyTo([lugar.lat, lugar.lng], lugarZoomCercano(lugar), {
          duration: flyDuration,
          easeLinearity: flyEase,
        });
      });

      setSearchQuery(lugar.label);
      setSearchResults([]);
      setSearchOpen(false);
      setSearchError(null);
    },
    [clearSearchMarker],
  );

  const navegarABusqueda = useCallback(
    async (query: string) => {
      const q = query.trim();
      if (q.length < 2) return;

      const map = mapRef.current;
      if (!map) {
        setSearchError("El mapa todavía está cargando. Probá de nuevo en un instante.");
        setSearchOpen(true);
        return;
      }

      setSearchLoading(true);
      setSearchError(null);
      try {
        const items = await buscarLugaresEnMapa(q);
        setSearchResults(items);
        if (items[0]) {
          irALugar(items[0]);
          return;
        }
        setSearchError("No se encontraron lugares con ese nombre.");
        setSearchOpen(true);
      } catch {
        setSearchResults([]);
        setSearchError("No se pudo buscar en el mapa. Probá de nuevo.");
        setSearchOpen(true);
      } finally {
        setSearchLoading(false);
      }
    },
    [irALugar],
  );

  const onSearchSubmit = (event: FormEvent) => {
    event.preventDefault();
    void navegarABusqueda(searchQuery);
  };

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError(null);
      return;
    }

    setSearchError(null);
    setSearchLoading(true);
    const timer = window.setTimeout(() => {
      void buscarLugaresEnMapa(q)
        .then((items) => {
          setSearchResults(items);
          setSearchOpen(true);
          if (items.length === 0) setSearchError("No se encontraron lugares con ese nombre.");
        })
        .catch(() => {
          setSearchResults([]);
          setSearchError("No se pudo buscar en el mapa. Probá de nuevo.");
        })
        .finally(() => setSearchLoading(false));
    }, 320);

    return () => {
      window.clearTimeout(timer);
      setSearchLoading(false);
    };
  }, [searchQuery]);

  const handleToolSelect = (tool: CampoMapaTool) => {
    cancelPotreroShapeEdit();
    clearSketchOverlay();
    setActiveTool(tool);
    if (tool !== "navegar") {
      setSelection(null);
    }
  };

  const handleSaveClip = () => {
    const map = mapRef.current;
    if (!map) return;
    const center = map.getCenter();
    const clipCount = elementos.filter((e) => e.tipo === "clip").length;
    const sinGeometria = !cuentaTieneGeometriaEnMapa(potreros, elementos);
    clearSketchOverlay();
    setSelection(null);
    setPendingDraft({
      sourceTool: "clip",
      point: { lat: center.lat, lng: center.lng },
      metadata: { zoom: map.getZoom() },
    });
    setFormNombre(sinGeometria && clipCount === 0 ? "Predio" : `Vista ${clipCount + 1}`);
    setFormNotas("");
  };

  const undoSketchPoint = useCallback(() => {
    setSketchVertices((prev) => prev.slice(0, -1));
  }, []);

  const undoLastMarking = useCallback(() => {
    if (saving) return;

    if (pendingDraft) {
      if (pendingDraft.paths && pendingDraft.paths.length > 0) {
        const paths = pendingDraft.paths;
        const sourceTool = pendingDraft.sourceTool;
        clearDraftOverlay();
        setActiveTool(sourceTool);
        setSketchVertices(paths);
        return;
      }
      if (pendingDraft.point) {
        clearDraftOverlay();
        return;
      }
      clearDraftOverlay();
      return;
    }

    if (potreroShapeEdit) {
      if (potreroShapeEdit.vertices.length <= 3) {
        onError("Necesitás al menos 3 puntos en el perímetro.");
        return;
      }
      setPotreroShapeEdit((prev) =>
        prev
          ? {
              ...prev,
              vertices: prev.vertices.slice(0, -1),
            }
          : null,
      );
      setSelectedVertexIndex(null);
      return;
    }

    if (sketchVertices.length > 0) {
      undoSketchPoint();
    }
  }, [
    clearDraftOverlay,
    onError,
    pendingDraft,
    potreroShapeEdit,
    saving,
    sketchVertices.length,
    undoSketchPoint,
  ]);

  const canUndoMarking = useMemo(() => {
    if (saving) return false;
    if (pendingDraft) return true;
    if (potreroShapeEdit && potreroShapeEdit.vertices.length > 3) return true;
    if (sketchVertices.length > 0) return true;
    return false;
  }, [pendingDraft, potreroShapeEdit, saving, sketchVertices.length]);

  const cancelSketch = useCallback(() => {
    clearSketchOverlay();
    setActiveTool("navegar");
  }, [clearSketchOverlay]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (target?.isContentEditable) return;
      if (!puedeEditar) return;

      if ((event.ctrlKey || event.metaKey) && (event.key === "z" || event.key === "Z") && !event.shiftKey) {
        if (!canUndoMarking) return;
        event.preventDefault();
        undoLastMarking();
        return;
      }

      if (event.key !== "Escape") return;

      if (potreroShapeEdit) {
        event.preventDefault();
        cancelPotreroShapeEdit();
        return;
      }

      if (pendingDraft) {
        event.preventDefault();
        clearDraftOverlay();
        clearSketchOverlay();
        setActiveTool("navegar");
        return;
      }

      if (activeTool !== "navegar" || sketchVertices.length > 0) {
        event.preventDefault();
        cancelSketch();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    activeTool,
    canUndoMarking,
    cancelPotreroShapeEdit,
    cancelSketch,
    clearDraftOverlay,
    clearSketchOverlay,
    pendingDraft,
    potreroShapeEdit,
    puedeEditar,
    sketchVertices.length,
    undoLastMarking,
  ]);

  const finishSketch = () => {
    if (sketchVertices.length < minSketchPoints) {
      onError(
        activeTool === "dibujar"
          ? "Marcá al menos dos puntos para finalizar el trazo."
          : toolSketchIsPolygon(activeTool)
            ? "Marcá al menos tres puntos para cerrar la figura."
            : "Marcá al menos dos puntos para finalizar.",
      );
      return;
    }

    const paths = [...sketchVertices];
    clearSketchOverlay();
    setSelection(null);

    if (activeTool === "medir_distancia") {
      const distanceMeters = computeDistanceMeters(paths);
      setPendingDraft({
        sourceTool: activeTool,
        paths,
        distanceMeters,
        metadata: { distancia_m: distanceMeters ?? undefined },
        isMeasurement: true,
      });
      setFormNombre("Medición de distancia");
      setFormNotas("");
      return;
    }

    if (activeTool === "medir_area") {
      const hectareas = computeHectareas(paths);
      setPendingDraft({
        sourceTool: activeTool,
        paths,
        hectareas,
        metadata: { area_ha: hectareas ?? undefined },
        isMeasurement: true,
      });
      setFormNombre("Medición de área");
      setFormNotas("");
      return;
    }

    if (activeTool === "dibujar") {
      if (paths.length === 2) {
        setDraftSaveTarget("linea");
        setPendingDraft({ sourceTool: activeTool, paths });
      } else {
        setDraftSaveTarget("area");
        setPendingDraft({
          sourceTool: activeTool,
          paths,
          hectareas: computeHectareas(paths),
        });
      }
      setFormNombre("");
      setFormNotas("");
      return;
    }

    if (activeTool === "contorno") {
      if (paths.length < 3) {
        onError("Marcá al menos tres puntos unidos por líneas rectas.");
        return;
      }
      setDraftSaveTarget("area");
      setPendingDraft({
        sourceTool: "contorno",
        paths,
        hectareas: computeHectareas(paths),
        metadata: withCampoMapaAreaContorno({}, lineStyle),
      });
      setFormNombre("Contorno");
      setFormNotas("");
      return;
    }

    if (activeTool === "objeto") {
      const def = getCampoMapaObjetoDef(objetoTipo);
      if (def.geometry !== "line") return;
      setPendingDraft({
        sourceTool: "objeto",
        paths,
        metadata: withCampoMapaObjetoTipo({}, objetoTipo),
      });
      setFormNombre(def.label);
      setFormNotas("");
    }
  };

  const savePending = async () => {
    const isNotaDraft = pendingDraft?.sourceTool === "nota";
    const isObjetoDraft = pendingDraft?.sourceTool === "objeto";
    if (!pendingDraft) return;
    if (isNotaDraft) {
      if (!formNotas.trim()) {
        onError("Escribí el texto de la nota.");
        return;
      }
    } else if (!formNombre.trim()) {
      onError("Ingresá un nombre para guardar en el mapa.");
      return;
    }

    setSaving(true);
    try {
      if (isObjetoDraft) {
        const tipo =
          parseCampoMapaObjetoTipo(JSON.stringify(pendingDraft.metadata ?? {})) ?? objetoTipo;
        const def = getCampoMapaObjetoDef(tipo);
        const metadata = withCampoMapaObjetoTipo(pendingDraft.metadata ?? {}, tipo);
        let geojson: unknown;
        let elementoTipo: CampoMapaElementoTipo;
        if (pendingDraft.point) {
          geojson = JSON.parse(pointToGeoJson(pendingDraft.point));
          elementoTipo = "marcador";
        } else if (pendingDraft.paths && pendingDraft.paths.length >= 2) {
          geojson = JSON.parse(pathsToLineGeoJson(pendingDraft.paths));
          elementoTipo = "linea";
        } else {
          throw new Error("No se pudo determinar la geometría del objeto.");
        }
        const created = await createCampoMapaElemento({
          tipo: elementoTipo,
          nombre: formNombre.trim(),
          geojson,
          notas: formNotas,
          color: def.color,
          metadata,
        });
        setElementos((prev) =>
          [...prev, created].sort((a, b) => a.nombre.localeCompare(b.nombre)),
        );
        setSelection({ kind: "elemento", id: created.id });
        clearDraftOverlay();
        setActiveTool("navegar");
        onSuccess(`${def.label} guardado en el mapa.`);
        return;
      }

      const target =
        pendingDraft.isMeasurement || pendingDraft.point ? null : draftSaveTarget;

      if (target === "potrero" && pendingDraft.paths) {
        const created = await createCampoPotreroMapa({
          nombre: formNombre.trim(),
          geojson: JSON.parse(pathsToGeoJson(pendingDraft.paths)),
          color: drawColor,
          hectareas: pendingDraft.hectareas ?? null,
          notas: formNotas,
          metadata: withCampoMapaMarcadorId({}, formMarcadorId),
        });
        setPotreros((prev) =>
          [...prev, created].sort((a, b) => a.nombre.localeCompare(b.nombre)),
        );
        setSelection({ kind: "potrero", id: created.id });
      } else if (target === "marcador") {
        const point = markerPointFromDraft(pendingDraft);
        if (!point) throw new Error("No se pudo determinar el punto del marcador.");
        const created = await createCampoMapaElemento({
          tipo: "marcador",
          nombre: formNombre.trim(),
          geojson: JSON.parse(pointToGeoJson(point)),
          notas: formNotas,
          color: drawColor,
        });
        setElementos((prev) =>
          [...prev, created].sort((a, b) => a.nombre.localeCompare(b.nombre)),
        );
        setSelection({ kind: "elemento", id: created.id });
      } else if (target === "area" && pendingDraft.paths) {
        const created = await createCampoMapaElemento({
          tipo: "area",
          nombre: formNombre.trim(),
          geojson: JSON.parse(pathsToGeoJson(pendingDraft.paths)),
          notas: formNotas,
          color: drawColor,
          metadata: pendingDraft.metadata,
        });
        setElementos((prev) =>
          [...prev, created].sort((a, b) => a.nombre.localeCompare(b.nombre)),
        );
        setSelection({ kind: "elemento", id: created.id });
      } else if (target === "linea" && pendingDraft.paths) {
        const created = await createCampoMapaElemento({
          tipo: "linea",
          nombre: formNombre.trim(),
          geojson: JSON.parse(pathsToLineGeoJson(pendingDraft.paths)),
          notas: formNotas,
          color: drawColor,
        });
        setElementos((prev) =>
          [...prev, created].sort((a, b) => a.nombre.localeCompare(b.nombre)),
        );
        setSelection({ kind: "elemento", id: created.id });
      } else {
        const tipo = toolToElementoTipo(pendingDraft.sourceTool);
        if (!tipo) return;

        let geojson: unknown;
        if (pendingDraft.point) {
          geojson = JSON.parse(pointToGeoJson(pendingDraft.point));
        } else if (
          pendingDraft.sourceTool === "linea" ||
          pendingDraft.sourceTool === "medir_distancia"
        ) {
          geojson = JSON.parse(pathsToLineGeoJson(pendingDraft.paths ?? []));
        } else {
          geojson = JSON.parse(pathsToGeoJson(pendingDraft.paths ?? []));
        }

        const created = await createCampoMapaElemento({
          tipo,
          nombre: isNotaDraft
            ? formNotas.trim().split("\n")[0].slice(0, 48) || "Nota"
            : formNombre.trim(),
          geojson,
          notas: isNotaDraft ? formNotas.trim() : formNotas,
          color: pendingDraft.isMeasurement ? undefined : drawColor,
          metadata: pendingDraft.metadata,
        });
        setElementos((prev) =>
          [...prev, created].sort((a, b) => a.nombre.localeCompare(b.nombre)),
        );
        setSelection({ kind: "elemento", id: created.id });
      }

      clearDraftOverlay();
      setActiveTool("navegar");
      const successMsg =
        target === "potrero"
          ? "Potrero guardado en el mapa."
          : target === "marcador"
            ? "Marcador guardado en el mapa."
            : target === "area"
              ? "Área guardada en el mapa."
              : target === "linea"
                ? "Línea guardada en el mapa."
                : saveSuccessMessage(pendingDraft.sourceTool);
      onSuccess(successMsg);
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo guardar en el mapa.");
    } finally {
      setSaving(false);
    }
  };

  const savePotreroShape = async () => {
    if (!potreroShapeEdit) return;
    if (potreroShapeEdit.vertices.length < 3) {
      onError("Un potrero necesita al menos 3 puntos.");
      return;
    }
    setSaving(true);
    try {
      const hectareas = computeHectareas(potreroShapeEdit.vertices);
      const updated = await updateCampoPotreroMapa(potreroShapeEdit.potreroId, {
        geojson: JSON.parse(pathsToGeoJson(potreroShapeEdit.vertices)),
        hectareas,
      });
      setPotreros((prev) =>
        prev
          .map((item) => (item.id === updated.id ? updated : item))
          .sort((a, b) => a.nombre.localeCompare(b.nombre)),
      );
      cancelPotreroShapeEdit();
      onSuccess("Perímetro del potrero actualizado.");
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo guardar la forma.");
    } finally {
      setSaving(false);
    }
  };

  const saveSelected = async () => {
    if (!selectedPotrero && !selectedElemento) return;
    const isNotaElemento = selectedElemento?.tipo === "nota";
    if (isNotaElemento) {
      if (!editNotas.trim()) {
        onError("Escribí el texto de la nota.");
        return;
      }
    } else if (!editNombre.trim()) {
      onError("Ingresá un nombre para guardar en el mapa.");
      return;
    }

    const metadata = withCampoMapaMarcadorId(
      mergeCampoMapaMetadata(
        selectedPotrero?.metadata ?? selectedElemento?.metadata,
        editDispositivos,
      ),
      selectedPotrero || editSaveTarget === "potrero" ? editMarcadorId : null,
    );
    const currentTarget: DraftSaveTarget | null = selectedPotrero
      ? "potrero"
      : selectedElemento
        ? saveTargetFromElemento(selectedElemento.tipo)
        : null;
    const targetChanged = currentTarget != null && editSaveTarget !== currentTarget;

    setSaving(true);
    try {
      if (!targetChanged && selectedPotrero) {
        const updated = await updateCampoPotreroMapa(selectedPotrero.id, {
          nombre: editNombre,
          notas: editNotas,
          color: editColor,
          metadata,
        });
        await syncCampoMapaDispositivosPotrero(
          editNombre,
          editDispositivos,
          editDispositivosPrevRef.current,
          editNombrePrevRef.current,
        );
        setPotreros((prev) =>
          prev
            .map((item) => (item.id === updated.id ? updated : item))
            .sort((a, b) => a.nombre.localeCompare(b.nombre)),
        );
        editDispositivosPrevRef.current = editDispositivos;
        editNombrePrevRef.current = editNombre;
        setEditingSelectionContent(false);
        onSuccess("Potrero actualizado.");
        return;
      }

      if (!targetChanged && selectedElemento) {
        const updated = await updateCampoMapaElemento(selectedElemento.id, {
          nombre: isNotaElemento
            ? editNotas.trim().split("\n")[0].slice(0, 48) || "Nota"
            : editNombre,
          notas: editNotas,
          color: editColor,
          metadata,
        });
        setElementos((prev) =>
          prev
            .map((item) => (item.id === updated.id ? updated : item))
            .sort((a, b) => a.nombre.localeCompare(b.nombre)),
        );
        setEditingSelectionContent(false);
        onSuccess("Elemento actualizado.");
        return;
      }

      const sourceGeojson = selectedPotrero?.geojson ?? selectedElemento?.geojson ?? "";
      const geojson = geoJsonForSaveTarget(sourceGeojson, editSaveTarget);

      if (editSaveTarget === "potrero") {
        const paths = openRingFromGeoJson(sourceGeojson);
        const created = await createCampoPotreroMapa({
          nombre: editNombre.trim(),
          geojson,
          color: editColor,
          hectareas: computeHectareas(paths),
          notas: editNotas,
          metadata,
        });
        if (selectedPotrero) {
          await deleteCampoPotreroMapa(selectedPotrero.id);
          setPotreros((prev) => prev.filter((item) => item.id !== selectedPotrero.id));
        } else if (selectedElemento) {
          await deleteCampoMapaElemento(selectedElemento.id);
          setElementos((prev) => prev.filter((item) => item.id !== selectedElemento.id));
        }
        setPotreros((prev) =>
          [...prev, created].sort((a, b) => a.nombre.localeCompare(b.nombre)),
        );
        await syncCampoMapaDispositivosPotrero(
          editNombre,
          editDispositivos,
          editDispositivosPrevRef.current,
          editNombrePrevRef.current,
        );
        setSelection({ kind: "potrero", id: created.id });
        editDispositivosPrevRef.current = editDispositivos;
        editNombrePrevRef.current = editNombre;
        setEditingSelectionContent(false);
        onSuccess("Guardado como potrero.");
        return;
      }

      if (selectedPotrero) {
        await clearCampoMapaDispositivosPotrero(
          editDispositivosPrevRef.current,
          editNombrePrevRef.current,
        );
        await deleteCampoPotreroMapa(selectedPotrero.id);
        setPotreros((prev) => prev.filter((item) => item.id !== selectedPotrero.id));
      }

      const elementoTipo = elementoTipoFromSaveTarget(editSaveTarget);
      if (selectedElemento && !selectedPotrero) {
        const updated = await updateCampoMapaElemento(selectedElemento.id, {
          tipo: elementoTipo,
          nombre: isNotaElemento
            ? editNotas.trim().split("\n")[0].slice(0, 48) || "Nota"
            : editNombre.trim(),
          notas: editNotas,
          geojson,
          color: editColor,
          metadata,
        });
        setElementos((prev) =>
          prev
            .map((item) => (item.id === updated.id ? updated : item))
            .sort((a, b) => a.nombre.localeCompare(b.nombre)),
        );
        setSelection({ kind: "elemento", id: updated.id });
        setEditingSelectionContent(false);
        onSuccess(`Guardado como ${saveTargetLabel(editSaveTarget).toLowerCase()}.`);
        return;
      }

      const created = await createCampoMapaElemento({
        tipo: elementoTipo,
        nombre: editNombre.trim(),
        geojson,
        notas: editNotas,
        metadata,
      });
      if (selectedElemento) {
        await deleteCampoMapaElemento(selectedElemento.id);
        setElementos((prev) => prev.filter((item) => item.id !== selectedElemento.id));
      }
      setElementos((prev) =>
        [...prev, created].sort((a, b) => a.nombre.localeCompare(b.nombre)),
      );
      setSelection({ kind: "elemento", id: created.id });
      setEditingSelectionContent(false);
      onSuccess(`Guardado como ${saveTargetLabel(editSaveTarget).toLowerCase()}.`);
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo actualizar.");
    } finally {
      setSaving(false);
    }
  };

  const saveDispositivosFromModal = async () => {
    if (!selectedPotrero && !selectedElemento) return;
    setSaving(true);
    try {
      const metadata = mergeCampoMapaMetadata(
        selectedPotrero?.metadata ?? selectedElemento?.metadata,
        modalDispositivos,
      );
      if (selectedPotrero) {
        const updated = await updateCampoPotreroMapa(selectedPotrero.id, { metadata });
        await syncCampoMapaDispositivosPotrero(
          editNombre,
          modalDispositivos,
          editDispositivosPrevRef.current,
          editNombrePrevRef.current,
        );
        setPotreros((prev) =>
          prev
            .map((item) => (item.id === updated.id ? updated : item))
            .sort((a, b) => a.nombre.localeCompare(b.nombre)),
        );
      } else if (selectedElemento) {
        const updated = await updateCampoMapaElemento(selectedElemento.id, { metadata });
        setElementos((prev) =>
          prev
            .map((item) => (item.id === updated.id ? updated : item))
            .sort((a, b) => a.nombre.localeCompare(b.nombre)),
        );
      }
      setEditDispositivos(modalDispositivos);
      editDispositivosPrevRef.current = modalDispositivos;
      if (apiOnline) {
        const [ganaderoData, equinoData] = await Promise.all([
          fetchStockGanaderaDispositivos({}),
          fetchStockEquinaDispositivos({}),
        ]);
        setStockGanadero(ganaderoData.filter((d) => d.estado === "VIVO"));
        setStockEquino(equinoData.filter((d) => d.estado === "VIVO"));
      }
      setDispositivosModalOpen(false);
      onSuccess("Dispositivos actualizados.");
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudieron guardar los dispositivos.");
    } finally {
      setSaving(false);
    }
  };

  const dispositivosModalSubtitulo = useMemo(() => {
    if (selectedPotrero) {
      const ha =
        selectedPotrero.hectareas != null ? formatHectareas(selectedPotrero.hectareas) : null;
      return ha ? `Potrero · ${ha}` : "Potrero";
    }
    if (selectedElemento) {
      const objeto = parseCampoMapaObjetoTipo(selectedElemento.metadata);
      if (objeto) return getCampoMapaObjetoDef(objeto).label;
      return ELEMENTO_TIPO_LABELS[selectedElemento.tipo];
    }
    return undefined;
  }, [selectedElemento, selectedPotrero]);

  const removeSelected = async () => {
    if (!selectedPotrero && !selectedElemento) return;
    const label = selectedPotrero?.nombre ?? selectedElemento?.nombre ?? "elemento";
    if (!window.confirm(`¿Eliminar "${label}" del mapa?`)) return;

    setSaving(true);
    try {
      if (selectedPotrero) {
        await deleteCampoPotreroMapa(selectedPotrero.id);
        setPotreros((prev) => prev.filter((item) => item.id !== selectedPotrero.id));
        onSuccess("Potrero eliminado del mapa.");
      } else if (selectedElemento) {
        await deleteCampoMapaElemento(selectedElemento.id);
        setElementos((prev) => prev.filter((item) => item.id !== selectedElemento.id));
        onSuccess("Elemento eliminado del mapa.");
      }
      setSelection(null);
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo eliminar.");
    } finally {
      setSaving(false);
    }
  };

  const mapWorkMode = useMemo((): "sketch" | "potrero-shape" | "draft" | null => {
    if (!puedeEditar) return null;
    if (potreroShapeEdit) return "potrero-shape";
    if (pendingDraft) return "draft";
    if (
      toolUsesSketch(activeTool) ||
      (activeTool === "objeto" && getCampoMapaObjetoDef(objetoTipo).geometry === "line")
    ) {
      return "sketch";
    }
    return null;
  }, [activeTool, objetoTipo, pendingDraft, potreroShapeEdit, puedeEditar]);

  const showFullscreenWorkDock = isFullscreen && mapWorkMode != null;

  const mapHint = useMemo(() => {
    if (showFullscreenWorkDock) return null;
    const objetoDef = getCampoMapaObjetoDef(objetoTipo);
    const objetoSketching =
      activeTool === "objeto" && objetoDef.geometry === "line" && !pendingDraft;
    let hint: string | null = null;
    if (measureHint) hint = measureHint;
    else if (vertexEditSource) {
      hint = "Arrastrá un punto para moverlo · Doble clic o Supr para eliminar";
    } else if (
      (activeTool === "medir_distancia" || activeTool === "medir_area") &&
      toolUsesSketch(activeTool) &&
      !pendingDraft
    ) {
      hint = toolDef.hint;
    } else if (objetoSketching) hint = objetoDef.hint;
    else if (toolUsesSketch(activeTool) && !pendingDraft) hint = toolDef.hint;
    else if (toolSketchIsPoint(activeTool) && !pendingDraft) hint = toolDef.hint;
    else if (activeTool === "objeto" && !pendingDraft) hint = objetoDef.hint;

    if (!hint) return null;
    if (pendingDraft) return `${hint} · Deshacer para corregir`;
    return `${hint} · Esc para cancelar · Deshacer último punto`;
  }, [
    activeTool,
    measureHint,
    objetoTipo,
    pendingDraft,
    showFullscreenWorkDock,
    toolDef.hint,
    vertexEditSource,
  ]);

  const renderSaveTargetSelector = (
    value: DraftSaveTarget,
    onChange: (target: DraftSaveTarget) => void,
    geometry: DraftGeometry | null,
  ) => {
    if (!geometry) return null;
    const targets = availableSaveTargets(geometry);
    if (targets.length <= 1) return null;
    return (
      <div className="campo-mapa-draft-tipo">
        <span className="campo-mapa-draft-tipo-label">Guardar como</span>
        <div className="campo-mapa-draft-tipo-options" role="group" aria-label="Tipo en el mapa">
          {targets.map((target) => (
            <button
              key={target}
              type="button"
              className={`campo-mapa-draft-tipo-btn${value === target ? " is-active" : ""}`}
              onClick={() => onChange(target)}
              aria-pressed={value === target}
            >
              {saveTargetLabel(target)}
            </button>
          ))}
        </div>
        <p className="campo-mapa-aside-hint campo-mapa-draft-tipo-hint">
          {saveTargetHint(value)}
        </p>
      </div>
    );
  };

  const renderDraftSaveTargetSelector = () => {
    if (!pendingDraft || pendingDraft.isMeasurement) return null;
    const geometry = draftGeometryFromDraft(pendingDraft);
    return renderSaveTargetSelector(draftSaveTarget, setDraftSaveTarget, geometry);
  };

  const mapaInfoButton = (
    <div className="campo-mapa-aside-info" ref={mapaInfoRef}>
      <button
        type="button"
        className={`campo-mapa-aside-info-btn${mapaInfoOpen ? " is-open" : ""}`}
        aria-label="Información del mapa compartido"
        aria-expanded={mapaInfoOpen}
        aria-controls="campo-mapa-aside-info-panel"
        title="Información del mapa"
        onClick={() => setMapaInfoOpen((open) => !open)}
      >
        <Info size={12} aria-hidden />
      </button>
      {mapaInfoOpen ? (
        <div
          id="campo-mapa-aside-info-panel"
          className="campo-mapa-aside-info-panel"
          role="note"
        >
          Mapa compartido de <strong>{cuentaNombre}</strong>. Potreros y ubicaciones los ven y
          editan todos los integrantes del equipo en esta cuenta.
        </div>
      ) : null}
    </div>
  );

  const sidebarBody = (
    <div className="campo-mapa-aside-body">
      {puedeEditar &&
      ((toolUsesSketch(activeTool) ||
        (activeTool === "objeto" && getCampoMapaObjetoDef(objetoTipo).geometry === "line")) &&
        !pendingDraft &&
        !potreroShapeEdit) ? (
        <div className="campo-mapa-aside-tools">
          <p className="campo-mapa-aside-hint">
            {measureHint ??
              `${
                activeTool === "objeto"
                  ? getCampoMapaObjetoDef(objetoTipo).hint
                  : toolDef.hint
              } Podés arrastrar un punto para moverlo o hacer doble clic para eliminarlo. Presioná Esc para cancelar.`}
          </p>
          <button
            type="button"
            className="campo-mapa-aside-btn campo-mapa-aside-btn--primary"
            onClick={finishSketch}
            disabled={sketchVertices.length < minSketchPoints || saving}
          >
            Finalizar ({sketchVertices.length} pts)
          </button>
          <button
            type="button"
            className="campo-mapa-aside-btn"
            onClick={deleteSelectedVertex}
            disabled={selectedVertexIndex == null || saving}
          >
            <Trash2 size={15} aria-hidden />
            Eliminar punto seleccionado
          </button>
          <button
            type="button"
            className="campo-mapa-aside-btn"
            onClick={undoLastMarking}
            disabled={!canUndoMarking || saving}
          >
            <Undo2 size={15} aria-hidden />
            Deshacer último punto
          </button>
          <button
            type="button"
            className="campo-mapa-aside-btn"
            onClick={cancelSketch}
            disabled={saving}
          >
            Cancelar dibujo
          </button>
        </div>
      ) : null}

      {puedeEditar && potreroShapeEdit ? (
        <div className="campo-mapa-aside-tools">
          <p className="campo-mapa-aside-hint">
            Editando perímetro. Arrastrá un vértice para moverlo; doble clic o Supr para quitarlo.
          </p>
          {potreroShapeEdit.vertices.length >= 3 ? (
            <p className="campo-mapa-aside-hint">
              Superficie:{" "}
              {(() => {
                const ha = computeHectareas(potreroShapeEdit.vertices);
                return ha != null ? formatHectareas(ha) : "—";
              })()}
            </p>
          ) : null}
          <button
            type="button"
            className="campo-mapa-aside-btn campo-mapa-aside-btn--primary"
            onClick={() => void savePotreroShape()}
            disabled={potreroShapeEdit.vertices.length < 3 || saving}
          >
            Guardar perímetro
          </button>
          <button
            type="button"
            className="campo-mapa-aside-btn"
            onClick={deleteSelectedVertex}
            disabled={selectedVertexIndex == null || saving}
          >
            <Trash2 size={15} aria-hidden />
            Eliminar punto seleccionado
          </button>
          <button
            type="button"
            className="campo-mapa-aside-btn"
            onClick={undoLastMarking}
            disabled={!canUndoMarking || saving}
          >
            <Undo2 size={15} aria-hidden />
            Deshacer último punto
          </button>
          <button
            type="button"
            className="campo-mapa-aside-btn"
            onClick={cancelPotreroShapeEdit}
            disabled={saving}
          >
            Cancelar edición
          </button>
        </div>
      ) : null}

      <div className="campo-mapa-aside-section">
        <p className="campo-mapa-aside-label">Ubicaciones y potreros</p>
        {loading ? <p className="campo-mapa-aside-hint">Cargando…</p> : null}
        {!loading && potreros.length === 0 && marcadoresUbicacion.length === 0 ? (
          <div className="campo-mapa-aside-empty">
            <MapPin size={18} aria-hidden />
            <p>Sin ubicaciones ni potreros todavía.</p>
            <p className="campo-mapa-aside-hint">
              Creá un marcador de estancia y después asociá potreros.
            </p>
          </div>
        ) : null}
        <ul className="campo-mapa-aside-tree">
          {potrerosPorUbicacion.map((grupo) => {
            const expandida = ubicacionesExpandidas[grupo.key] ?? true;
            return (
              <li key={grupo.key} className="campo-mapa-aside-tree-branch">
                <div className="campo-mapa-aside-tree-parent">
                  <button
                    type="button"
                    className="campo-mapa-aside-tree-toggle"
                    aria-expanded={expandida}
                    aria-label={expandida ? "Ocultar potreros" : "Mostrar potreros"}
                    onClick={() => toggleUbicacionExpandida(grupo.key)}
                  >
                    {expandida ? (
                      <ChevronDown size={14} aria-hidden />
                    ) : (
                      <ChevronRight size={14} aria-hidden />
                    )}
                  </button>
                  {grupo.marcador ? (
                    <button
                      type="button"
                      className={`campo-mapa-aside-item campo-mapa-aside-item--ubicacion${
                        selection?.kind === "elemento" && selection.id === grupo.marcador.id
                          ? " is-active"
                          : ""
                      }`}
                      onClick={() => selectElemento(grupo.marcador!.id)}
                    >
                      <MapPin
                        size={16}
                        className="campo-mapa-aside-pin"
                        style={{ color: grupo.marcador.color }}
                        aria-hidden
                      />
                      <span className="campo-mapa-aside-item-text">
                        <strong>{grupo.marcador.nombre}</strong>
                        <span>{resumenUbicacionPotreros(grupo.items)}</span>
                      </span>
                    </button>
                  ) : (
                    <div className="campo-mapa-aside-item campo-mapa-aside-item--ubicacion is-static">
                      <MapPin size={16} className="campo-mapa-aside-pin" aria-hidden />
                      <span className="campo-mapa-aside-item-text">
                        <strong>{grupo.label}</strong>
                        <span>{resumenUbicacionPotreros(grupo.items)}</span>
                      </span>
                    </div>
                  )}
                </div>
                {expandida ? (
                  grupo.items.length > 0 ? (
                    <ul className="campo-mapa-aside-tree-children">
                      {grupo.items.map((item) => (
                        <li key={item.id} className="campo-mapa-aside-tree-child">
                          <button
                            type="button"
                            className={`campo-mapa-aside-item campo-mapa-aside-item--potrero${
                              selection?.kind === "potrero" && selection.id === item.id
                                ? " is-active"
                                : ""
                            }`}
                            onClick={() => selectPotrero(item.id)}
                          >
                            <span
                              className="campo-mapa-swatch"
                              style={{ background: item.color }}
                            />
                            <span className="campo-mapa-aside-item-text">
                              <strong>{item.nombre}</strong>
                              <span>
                                {item.hectareas != null
                                  ? `${item.hectareas} ha`
                                  : "Sin superficie"}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : grupo.marcador ? (
                    <p className="campo-mapa-aside-hint campo-mapa-aside-hint--nested">
                      Sin potreros asociados.
                    </p>
                  ) : null
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="campo-mapa-aside-section">
        <p className="campo-mapa-aside-label">Objetos</p>
        {!loading && objetosEnMapa.length === 0 ? (
          <p className="campo-mapa-aside-hint">Sin objetos en el mapa.</p>
        ) : null}
        {objetosEnMapa.length > 0 ? (
          <ul className="campo-mapa-aside-list">
            {objetosEnMapa.map((item) => {
              const tipo = parseCampoMapaObjetoTipo(item.metadata);
              const def = tipo ? getCampoMapaObjetoDef(tipo) : null;
              const Icon = def?.icon ?? Boxes;
              const color = item.color || def?.color || "#7cb342";
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`campo-mapa-aside-item${
                      selection?.kind === "elemento" && selection.id === item.id
                        ? " is-active"
                        : ""
                    }`}
                    onClick={() => selectElemento(item.id)}
                  >
                    <Icon
                      size={16}
                      className="campo-mapa-aside-pin"
                      style={{ color }}
                      aria-hidden
                    />
                    <span className="campo-mapa-aside-item-text">
                      <strong>{item.nombre}</strong>
                      <span>{def?.label ?? "Objeto"}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      <div className="campo-mapa-aside-section">
        <p className="campo-mapa-aside-label">Elementos</p>
        {!loading &&
        [...elementosSinMarcadoresNiObjetos.values()].every((items) => items.length === 0) ? (
          <p className="campo-mapa-aside-hint">Sin otros elementos guardados.</p>
        ) : null}
        {ELEMENTO_TIPO_ORDER.map((tipo) => {
          if (tipo === "marcador") return null;
          const items = elementosSinMarcadoresNiObjetos.get(tipo) ?? [];
          if (items.length === 0) return null;
          return (
            <div key={tipo} className="campo-mapa-aside-section">
              <p className="campo-mapa-aside-hint">{ELEMENTO_TIPO_LABELS[tipo]}</p>
              <ul className="campo-mapa-aside-list">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`campo-mapa-aside-item${
                        selection?.kind === "elemento" && selection.id === item.id
                          ? " is-active"
                          : ""
                      }`}
                      onClick={() => selectElemento(item.id)}
                    >
                      {item.tipo === "nota" ? (
                        <MessageSquare
                          size={16}
                          className="campo-mapa-aside-pin"
                          style={{ color: item.color }}
                          aria-hidden
                        />
                      ) : (
                        <span className="campo-mapa-swatch" style={{ background: item.color }} />
                      )}
                      <span className="campo-mapa-aside-item-text">
                        <strong>
                          {item.tipo === "nota"
                            ? item.notas.trim() || item.nombre
                            : item.nombre}
                        </strong>
                        <span>
                          {item.tipo === "area" && isCampoMapaAreaContorno(item.metadata)
                            ? "Contorno"
                            : ELEMENTO_TIPO_LABELS[item.tipo]}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {puedeEditar && pendingDraft ? (
        <div className="campo-mapa-aside-form">
          <p className="campo-mapa-aside-label">
            {pendingDraft.isMeasurement
              ? draftLabel(pendingDraft.sourceTool)
              : pendingDraft.sourceTool === "nota"
                ? "Nueva nota"
                : pendingDraft.sourceTool === "objeto"
                  ? draftLabel(
                      "objeto",
                      parseCampoMapaObjetoTipo(JSON.stringify(pendingDraft.metadata ?? {})) ??
                        objetoTipo,
                    )
                  : pendingDraft.sourceTool === "contorno"
                    ? "Nuevo contorno"
                    : draftTitle(draftSaveTarget)}
          </p>
          {pendingDraft.sourceTool !== "nota" &&
          pendingDraft.sourceTool !== "objeto" &&
          pendingDraft.sourceTool !== "contorno"
            ? renderDraftSaveTargetSelector()
            : null}
          {pendingDraft.hectareas != null ? (
            <p className="campo-mapa-aside-hint">
              Superficie: {formatHectareas(pendingDraft.hectareas)}
            </p>
          ) : null}
          {pendingDraft.distanceMeters != null ? (
            <p className="campo-mapa-aside-hint">
              Distancia: {formatDistance(pendingDraft.distanceMeters)}
            </p>
          ) : null}
          {pendingDraft.sourceTool === "clip" && pendingDraft.metadata?.zoom != null ? (
            <p className="campo-mapa-aside-hint">Zoom: {String(pendingDraft.metadata.zoom)}</p>
          ) : null}
          {pendingDraft.sourceTool === "nota" ? (
            <label>
              Nota
              <textarea
                value={formNotas}
                onChange={(e) => setFormNotas(e.target.value)}
                rows={4}
                placeholder="Escribí tu nota…"
                autoFocus
              />
            </label>
          ) : (
            <>
              <label>
                Nombre
                <input
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                  placeholder={
                    pendingDraft.isMeasurement
                      ? "Nombre en el mapa"
                      : draftNombrePlaceholder(draftSaveTarget)
                  }
                  maxLength={48}
                />
              </label>
              {draftSaveTarget === "potrero" && !pendingDraft.isMeasurement ? (
                <label>
                  Ubicación / estancia
                  <select
                    value={formMarcadorId ?? ""}
                    onChange={(e) =>
                      setFormMarcadorId(e.target.value ? Number(e.target.value) : null)
                    }
                  >
                    <option value="">Sin ubicación</option>
                    {marcadoresUbicacion.map((marcador) => (
                      <option key={marcador.id} value={marcador.id}>
                        {marcador.nombre}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {draftSaveTarget === "potrero" &&
              !pendingDraft.isMeasurement &&
              marcadoresUbicacion.length === 0 ? (
                <p className="campo-mapa-aside-hint">
                  Creá un marcador en el mapa para clasificar potreros por estancia o ubicación.
                </p>
              ) : null}
              <label>
                Notas
                <textarea
                  value={formNotas}
                  onChange={(e) => setFormNotas(e.target.value)}
                  rows={3}
                  placeholder="Observaciones opcionales"
                />
              </label>
            </>
          )}
          <div className="campo-mapa-aside-form-actions">
            <button
              type="button"
              className="campo-mapa-aside-btn campo-mapa-aside-btn--primary"
              onClick={() => void savePending()}
              disabled={
                saving ||
                (pendingDraft.sourceTool === "nota" ? !formNotas.trim() : !formNombre.trim())
              }
            >
              <Plus size={15} aria-hidden />
              {pendingDraft.isMeasurement
                ? "Guardar medición"
                : pendingDraft.sourceTool === "nota"
                  ? "Guardar nota"
                  : draftSaveButton(draftSaveTarget)}
            </button>
            <button
              type="button"
              className="campo-mapa-aside-btn"
              onClick={clearDraftOverlay}
              disabled={saving}
            >
              Descartar
            </button>
          </div>
        </div>
      ) : null}

      {puedeEditar &&
      (selectedPotrero || selectedElemento) &&
      !pendingDraft &&
      !potreroShapeEdit &&
      !editingSelectionContent ? (
        <div className="campo-mapa-aside-form campo-mapa-aside-preview">
          <p className="campo-mapa-aside-label">
            {selectedPotrero ? "Potrero seleccionado" : "Elemento seleccionado"}
          </p>
          <p className="campo-mapa-aside-preview-name">
            {selectedPotrero?.nombre ?? selectedElemento?.nombre}
          </p>
          {selectedPotrero?.hectareas != null ? (
            <p className="campo-mapa-aside-hint">
              Superficie: {formatHectareas(selectedPotrero.hectareas)}
            </p>
          ) : null}
          {selectedPotrero ? (
            <p className="campo-mapa-aside-hint">
              Ubicación:{" "}
              <strong>
                {(() => {
                  const id = parseCampoMapaMarcadorId(selectedPotrero.metadata);
                  return id != null && marcadorNombreById.has(id)
                    ? marcadorNombreById.get(id)
                    : "Sin ubicación";
                })()}
              </strong>
            </p>
          ) : null}
          {selectedElemento && !selectedPotrero ? (
            <p className="campo-mapa-aside-hint">
              {(() => {
                const objeto = parseCampoMapaObjetoTipo(selectedElemento.metadata);
                if (objeto) return getCampoMapaObjetoDef(objeto).label;
                if (isCampoMapaAreaContorno(selectedElemento.metadata)) return "Contorno";
                return ELEMENTO_TIPO_LABELS[selectedElemento.tipo];
              })()}
            </p>
          ) : null}
          {supportsDispositivosEnMapa(selectedPotrero, selectedElemento) ? (
            <>
              <p className="campo-mapa-aside-hint">
                Dispositivos vinculados: <strong>{dispositivosVinculadosCount}</strong>
              </p>
              <p className="campo-mapa-aside-hint campo-mapa-aside-hint--soft">
                Se vinculan automáticamente desde Stock según el potrero asignado a cada animal.
              </p>
            </>
          ) : null}
          <button
            type="button"
            className="campo-mapa-aside-btn campo-mapa-aside-btn--primary"
            onClick={startEditingSelectionContent}
            disabled={saving}
          >
            <Pencil size={15} aria-hidden />
            Editar contenido
          </button>
        </div>
      ) : null}

      {puedeEditar &&
      (selectedPotrero || selectedElemento) &&
      !pendingDraft &&
      !potreroShapeEdit &&
      editingSelectionContent ? (
        <div className="campo-mapa-aside-form">
          <p className="campo-mapa-aside-label">
            {selectedPotrero ? "Editar potrero" : "Editar elemento"}
          </p>
          {selectedPotrero?.hectareas != null ? (
            <p className="campo-mapa-aside-hint">
              Superficie: {formatHectareas(selectedPotrero.hectareas)}
            </p>
          ) : null}
          {canChangeSaveTarget(selectedPotrero, selectedElemento) &&
          !(selectedElemento && parseCampoMapaObjetoTipo(selectedElemento.metadata)) &&
          !(selectedElemento && isCampoMapaAreaContorno(selectedElemento.metadata))
            ? renderSaveTargetSelector(editSaveTarget, setEditSaveTarget, editGeometry)
            : selectedElemento ? (
                <p className="campo-mapa-aside-hint">
                  {(() => {
                    const objeto = parseCampoMapaObjetoTipo(selectedElemento.metadata);
                    if (objeto) return getCampoMapaObjetoDef(objeto).label;
                    if (isCampoMapaAreaContorno(selectedElemento.metadata)) return "Contorno";
                    return ELEMENTO_TIPO_LABELS[selectedElemento.tipo];
                  })()}
                </p>
              ) : null}
          {selectedPotrero && editSaveTarget === "potrero" ? (
            <button
              type="button"
              className="campo-mapa-aside-btn"
              onClick={startPotreroShapeEdit}
              disabled={saving}
            >
              <Pencil size={15} aria-hidden />
              Editar perímetro
            </button>
          ) : null}
          {editSaveTarget === "potrero" ? (
            <label>
              Ubicación / estancia
              <select
                value={editMarcadorId ?? ""}
                onChange={(e) =>
                  setEditMarcadorId(e.target.value ? Number(e.target.value) : null)
                }
              >
                <option value="">Sin ubicación</option>
                {marcadoresUbicacion.map((marcador) => (
                  <option key={marcador.id} value={marcador.id}>
                    {marcador.nombre}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {editSaveTarget === "potrero" ||
          selectedElemento?.tipo === "nota" ||
          selectedElemento?.tipo === "marcador" ? (
            <div className="campo-mapa-aside-color-field">
              <span className="campo-mapa-aside-color-label">
                {selectedElemento?.tipo === "nota"
                  ? "Color de la nota"
                  : selectedElemento?.tipo === "marcador"
                    ? "Color del marcador"
                    : "Color del potrero"}
              </span>
              <div
                className="campo-mapa-aside-color-options"
                role="radiogroup"
                aria-label="Color del elemento"
              >
                {potreroColorPickerOptions(editColor).map((color) => (
                  <button
                    key={color}
                    type="button"
                    role="radio"
                    className={`campo-mapa-draw-color-option${
                      editColor === color ? " is-selected" : ""
                    }`}
                    style={{ backgroundColor: color }}
                    aria-checked={editColor === color}
                    title={`Color ${color}`}
                    onClick={() => setEditColor(color)}
                  />
                ))}
              </div>
            </div>
          ) : null}
          {selectedElemento?.tipo === "nota" ? (
            <label>
              Texto de la nota
              <textarea
                value={editNotas}
                onChange={(e) => setEditNotas(e.target.value)}
                rows={4}
                placeholder="Escribí tu nota…"
              />
            </label>
          ) : (
            <>
              <label>
                Nombre
                <input
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  maxLength={48}
                />
              </label>
              <label>
                Notas
                <textarea value={editNotas} onChange={(e) => setEditNotas(e.target.value)} rows={3} />
              </label>
            </>
          )}
          {supportsDispositivosEnMapa(selectedPotrero, selectedElemento) ? (
            <button
              type="button"
              className="campo-mapa-aside-btn"
              onClick={() => {
                setModalDispositivos(editDispositivos);
                setDispositivosModalOpen(true);
              }}
              disabled={saving}
            >
              <Cpu size={15} aria-hidden />
              Dispositivos (
              {editDispositivos.dispositivos_ganadero.length +
                editDispositivos.dispositivos_equino.length}
              )
            </button>
          ) : null}
          <div className="campo-mapa-aside-form-actions">
            <button
              type="button"
              className="campo-mapa-aside-btn campo-mapa-aside-btn--primary"
              onClick={() => void saveSelected()}
              disabled={saving}
            >
              Guardar cambios
            </button>
            <button
              type="button"
              className="campo-mapa-aside-btn"
              onClick={cancelEditingSelectionContent}
              disabled={saving}
            >
              Volver
            </button>
            <button
              type="button"
              className="campo-mapa-aside-btn campo-mapa-aside-btn--danger"
              onClick={() => void removeSelected()}
              disabled={saving}
            >
              <Trash2 size={15} aria-hidden />
              Eliminar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="sg-module-page campo-mapa-module-page">
      <SgHubShell
        activeId="mapa"
        items={[]}
        onNavigate={() => undefined}
        onVolverDashboard={onVolver}
        onVolverInicio={onVolver}
        apiOnline={apiOnline}
        title="Mapa del campo"
        subtitle="Vista satelital compartida con tu equipo. Los cambios en potreros y ubicaciones aplican a toda la cuenta."
        asideKicker={hubAsideKicker("CAMPO")}
        asideTitle="Mapa"
        asideLogo={<MenuAppIcon id="campo_mapa" />}
        asideBrandExtra={mapaInfoButton}
        navAriaLabel="Campo y mapa"
        showDashboardInNav={false}
        showAsideNav={false}
        hubClassName="campo-mapa-hub"
        sidebarExtra={sidebarBody}
      >
        <div className="campo-mapa-workspace">
          <div ref={mapShellRef} className="campo-mapa-map-shell">
            <div
              ref={mapContainerRef}
              className="campo-mapa-map"
              role="application"
              aria-label="Mapa satelital del campo"
            />
            {!mapReady ? (
              <div className="campo-mapa-map-overlay">Cargando mapa satelital…</div>
            ) : null}
            <CampoMapaToolbar
              activeTool={activeTool}
              borderWeight={borderWeight}
              drawColor={drawColor}
              lineStyle={lineStyle}
              objetoTipo={objetoTipo}
              disabled={!puedeEditar || !mapReady || saving || !!pendingDraft}
              canUndo={puedeEditar && canUndoMarking}
              onSelect={handleToolSelect}
              onBorderWeightChange={setBorderWeight}
              onDrawColorChange={handleDrawColorChange}
              onLineStyleChange={setLineStyle}
              onObjetoTipoChange={setObjetoTipo}
              onUndo={undoLastMarking}
              onSaveClip={handleSaveClip}
            />
            <form
              className={`campo-mapa-search${searchQuery.trim() ? " has-query" : ""}`}
              onSubmit={onSearchSubmit}
              role="search"
              aria-label="Buscar lugares en el mapa"
            >
              <Search size={16} className="campo-mapa-search-icon" aria-hidden />
              <input
                ref={searchInputRef}
                type="search"
                className="campo-mapa-search-input"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => {
                  if (searchResults.length > 0 || searchError) setSearchOpen(true);
                }}
                onBlur={() => {
                  window.setTimeout(() => setSearchOpen(false), 160);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setSearchOpen(false);
                    searchInputRef.current?.blur();
                  }
                }}
                placeholder="Buscar lugar, ciudad o región…"
                autoComplete="off"
                spellCheck={false}
              />
              {searchQuery ? (
                <button
                  type="button"
                  className="campo-mapa-search-clear"
                  aria-label="Limpiar búsqueda"
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                    setSearchError(null);
                    setSearchOpen(false);
                    clearSearchMarker();
                  }}
                >
                  <X size={14} aria-hidden />
                </button>
              ) : null}
              <button
                type="submit"
                className="campo-mapa-search-submit"
                disabled={searchQuery.trim().length < 2}
                aria-label="Buscar lugar en el mapa"
              >
                Buscar
              </button>
              {searchOpen && (searchLoading || searchResults.length > 0 || searchError) ? (
                <div className="campo-mapa-search-panel">
                  {searchLoading ? (
                    <p className="campo-mapa-search-empty">Buscando lugares…</p>
                  ) : null}
                  {!searchLoading && searchError ? (
                    <p className="campo-mapa-search-empty">{searchError}</p>
                  ) : null}
                  {!searchLoading && searchResults.length > 0 ? (
                    <ul className="campo-mapa-search-list">
                      {searchResults.map((lugar) => (
                        <li key={lugar.id}>
                          <button
                            type="button"
                            className="campo-mapa-search-item"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => irALugar(lugar)}
                          >
                            <MapPin size={14} aria-hidden />
                            <span className="campo-mapa-search-item-text">
                              <strong>{lugar.label}</strong>
                              {lugar.subtitle ? <span>{lugar.subtitle}</span> : null}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </form>
            <div className="campo-mapa-map-corner-actions">
              <button
                type="button"
                className="campo-mapa-map-corner-btn"
                onClick={() => void toggleFullscreen()}
                title={isFullscreen ? "Salir de pantalla completa" : "Ver mapa en pantalla completa"}
                aria-label={isFullscreen ? "Salir de pantalla completa" : "Ver mapa en pantalla completa"}
                aria-pressed={isFullscreen}
              >
                {isFullscreen ? <Minimize2 size={18} aria-hidden /> : <Maximize2 size={18} aria-hidden />}
              </button>
              <div className="campo-mapa-resumen-menu-wrap" ref={devicesMenuRef}>
                <button
                  type="button"
                  className={`campo-mapa-map-corner-btn${showDevicesOnMap ? " is-active" : ""}${
                    devicesMenuOpen ? " is-menu-open" : ""
                  }`}
                  onClick={() => setDevicesMenuOpen((open) => !open)}
                  title="Visibilidad de animales en el mapa"
                  aria-label="Visibilidad de ganado y equinos en el mapa"
                  aria-haspopup="menu"
                  aria-expanded={devicesMenuOpen}
                >
                  <CircleDot size={18} aria-hidden />
                </button>
                {devicesMenuOpen ? (
                  <div
                    className="campo-mapa-resumen-menu"
                    role="menu"
                    aria-label="Mostrar en el mapa"
                  >
                    {CAMPO_MAPA_DEVICE_KIND_OPTIONS.map((opcion) => {
                      const active = deviceKindsOnMap.includes(opcion.id);
                      return (
                        <button
                          key={opcion.id}
                          type="button"
                          role="menuitemcheckbox"
                          className={`campo-mapa-map-corner-btn campo-mapa-resumen-menu-item${
                            active ? " is-active" : ""
                          }${opcion.id === "equino" ? " campo-mapa-device-kind-btn--equino" : ""}`}
                          aria-checked={active}
                          aria-label={opcion.label}
                          title={opcion.label}
                          onClick={() => toggleDeviceKindOnMap(opcion.id)}
                        >
                          {opcion.id === "ganadero" ? (
                            <Tags size={18} aria-hidden />
                          ) : (
                            <StockEquinoModuleIcon size={18} strokeWidth={1.75} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
              <div className="campo-mapa-resumen-menu-wrap" ref={potreroResumenMenuRef}>
                <button
                  type="button"
                  className={`campo-mapa-map-corner-btn${potreroResumenModos.length > 0 ? " is-active" : ""}${
                    potreroResumenMenuOpen ? " is-menu-open" : ""
                  }`}
                  onClick={() => setPotreroResumenMenuOpen((open) => !open)}
                  title="Resumen por potrero"
                  aria-label="Resumen por potrero"
                  aria-haspopup="menu"
                  aria-expanded={potreroResumenMenuOpen}
                >
                  <ListTree size={18} aria-hidden />
                </button>
                {potreroResumenMenuOpen ? (
                  <div className="campo-mapa-resumen-menu" role="menu" aria-label="Vista del resumen">
                    {POTRERO_RESUMEN_MODOS.map((opcion) => {
                      const Icon = POTRERO_RESUMEN_ICONS[opcion.id];
                      return (
                      <button
                        key={opcion.id}
                        type="button"
                        role="menuitemcheckbox"
                        className={`campo-mapa-map-corner-btn campo-mapa-resumen-menu-item${
                          potreroResumenModos.includes(opcion.id) ? " is-active" : ""
                        }`}
                        aria-checked={potreroResumenModos.includes(opcion.id)}
                        aria-label={opcion.label}
                        title={opcion.label}
                        onClick={() => togglePotreroResumenModo(opcion.id)}
                      >
                        <Icon size={18} aria-hidden />
                      </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className={`campo-mapa-map-corner-btn${showFeatureNames ? " is-active" : ""}`}
                onClick={() => setShowFeatureNames((v) => !v)}
                title={showFeatureNames ? "Ocultar nombres en el mapa" : "Mostrar nombres en el mapa"}
                aria-label={showFeatureNames ? "Ocultar nombres en el mapa" : "Mostrar nombres en el mapa"}
                aria-pressed={showFeatureNames}
              >
                <Tag size={18} aria-hidden />
              </button>
              <button
                type="button"
                className={`campo-mapa-map-corner-btn${showMapDetails ? " is-active" : ""}`}
                onClick={toggleMapDetails}
                title={
                  showMapDetails
                    ? CAMPO_MAPA_DETAILS_TOGGLE_LABEL.hide
                    : CAMPO_MAPA_DETAILS_TOGGLE_LABEL.show
                }
                aria-label={
                  showMapDetails
                    ? CAMPO_MAPA_DETAILS_TOGGLE_LABEL.hide
                    : CAMPO_MAPA_DETAILS_TOGGLE_LABEL.show
                }
                aria-pressed={showMapDetails}
              >
                <Map size={18} aria-hidden />
              </button>
            </div>
            {showFullscreenWorkDock ? (
              <div className="campo-mapa-map-work-dock" role="region" aria-label="Acciones del mapa">
                {mapWorkMode === "sketch" ? (
                  <>
                    <p className="campo-mapa-map-work-dock-title">
                      {activeTool === "contorno" ? "Contorno" : "Dibujando"}
                    </p>
                    <p className="campo-mapa-map-work-dock-hint">
                      {measureHint ??
                        (sketchVertices.length > 0
                          ? "Arrastrá un punto para moverlo · Doble clic o Supr para eliminar"
                          : activeTool === "objeto"
                            ? getCampoMapaObjetoDef(objetoTipo).hint
                            : toolDef.hint)}
                    </p>
                    <div className="campo-mapa-map-work-dock-actions">
                      <button
                        type="button"
                        className="campo-mapa-map-work-dock-btn campo-mapa-map-work-dock-btn--primary"
                        onClick={finishSketch}
                        disabled={sketchVertices.length < minSketchPoints || saving}
                      >
                        Finalizar ({sketchVertices.length} pts)
                      </button>
                      <button
                        type="button"
                        className="campo-mapa-map-work-dock-btn"
                        onClick={deleteSelectedVertex}
                        disabled={selectedVertexIndex == null || saving}
                      >
                        <Trash2 size={15} aria-hidden />
                        Eliminar punto
                      </button>
                      <button
                        type="button"
                        className="campo-mapa-map-work-dock-btn"
                        onClick={undoLastMarking}
                        disabled={!canUndoMarking || saving}
                      >
                        <Undo2 size={15} aria-hidden />
                        Deshacer último
                      </button>
                      <button
                        type="button"
                        className="campo-mapa-map-work-dock-btn"
                        onClick={cancelSketch}
                        disabled={saving}
                      >
                        Cancelar
                      </button>
                    </div>
                  </>
                ) : null}

                {mapWorkMode === "potrero-shape" && potreroShapeEdit ? (
                  <>
                    <p className="campo-mapa-map-work-dock-title">Editar perímetro</p>
                    <p className="campo-mapa-map-work-dock-hint">
                      Arrastrá un vértice · Doble clic o Supr para quitarlo
                    </p>
                    {potreroShapeEdit.vertices.length >= 3 ? (
                      <p className="campo-mapa-map-work-dock-hint">
                        Superficie:{" "}
                        {(() => {
                          const ha = computeHectareas(potreroShapeEdit.vertices);
                          return ha != null ? formatHectareas(ha) : "—";
                        })()}
                      </p>
                    ) : null}
                    <div className="campo-mapa-map-work-dock-actions">
                      <button
                        type="button"
                        className="campo-mapa-map-work-dock-btn campo-mapa-map-work-dock-btn--primary"
                        onClick={() => void savePotreroShape()}
                        disabled={potreroShapeEdit.vertices.length < 3 || saving}
                      >
                        Guardar perímetro
                      </button>
                      <button
                        type="button"
                        className="campo-mapa-map-work-dock-btn"
                        onClick={deleteSelectedVertex}
                        disabled={selectedVertexIndex == null || saving}
                      >
                        <Trash2 size={15} aria-hidden />
                        Eliminar punto
                      </button>
                      <button
                        type="button"
                        className="campo-mapa-map-work-dock-btn"
                        onClick={undoLastMarking}
                        disabled={!canUndoMarking || saving}
                      >
                        <Undo2 size={15} aria-hidden />
                        Deshacer último
                      </button>
                      <button
                        type="button"
                        className="campo-mapa-map-work-dock-btn"
                        onClick={cancelPotreroShapeEdit}
                        disabled={saving}
                      >
                        Cancelar
                      </button>
                    </div>
                  </>
                ) : null}

                {mapWorkMode === "draft" && pendingDraft ? (
                  <>
                    <p className="campo-mapa-map-work-dock-title">
                      {pendingDraft.isMeasurement
                        ? draftLabel(pendingDraft.sourceTool)
                        : pendingDraft.sourceTool === "objeto"
                          ? draftLabel(
                              "objeto",
                              parseCampoMapaObjetoTipo(
                                JSON.stringify(pendingDraft.metadata ?? {}),
                              ) ?? objetoTipo,
                            )
                          : pendingDraft.sourceTool === "contorno"
                            ? "Nuevo contorno"
                            : draftTitle(draftSaveTarget)}
                    </p>
                    {!pendingDraft.isMeasurement &&
                    pendingDraft.sourceTool !== "objeto" &&
                    pendingDraft.sourceTool !== "contorno" &&
                    availableSaveTargets(draftGeometryFromDraft(pendingDraft)).length > 1 ? (
                      <div className="campo-mapa-map-work-dock-tipo">
                        {availableSaveTargets(draftGeometryFromDraft(pendingDraft)).map((target) => (
                          <button
                            key={target}
                            type="button"
                            className={`campo-mapa-map-work-dock-tipo-btn${draftSaveTarget === target ? " is-active" : ""}`}
                            onClick={() => setDraftSaveTarget(target)}
                          >
                            {saveTargetLabel(target)}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {pendingDraft.hectareas != null ? (
                      <p className="campo-mapa-map-work-dock-hint">
                        Superficie: {formatHectareas(pendingDraft.hectareas)}
                      </p>
                    ) : null}
                    {pendingDraft.distanceMeters != null ? (
                      <p className="campo-mapa-map-work-dock-hint">
                        Distancia: {formatDistance(pendingDraft.distanceMeters)}
                      </p>
                    ) : null}
                    <label className="campo-mapa-map-work-dock-field">
                      <span className="sr-only">Nombre</span>
                      <input
                        className="campo-mapa-map-work-dock-input"
                        value={formNombre}
                        onChange={(e) => setFormNombre(e.target.value)}
                        placeholder={
                          pendingDraft.isMeasurement
                            ? "Nombre en el mapa"
                            : draftNombrePlaceholder(draftSaveTarget)
                        }
                        maxLength={48}
                      />
                    </label>
                    {draftSaveTarget === "potrero" && !pendingDraft.isMeasurement ? (
                      <label className="campo-mapa-map-work-dock-field">
                        <span className="sr-only">Ubicación / estancia</span>
                        <select
                          className="campo-mapa-map-work-dock-input"
                          value={formMarcadorId ?? ""}
                          onChange={(e) =>
                            setFormMarcadorId(e.target.value ? Number(e.target.value) : null)
                          }
                        >
                          <option value="">Sin ubicación</option>
                          {marcadoresUbicacion.map((marcador) => (
                            <option key={marcador.id} value={marcador.id}>
                              {marcador.nombre}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <div className="campo-mapa-map-work-dock-actions">
                      <button
                        type="button"
                        className="campo-mapa-map-work-dock-btn campo-mapa-map-work-dock-btn--primary"
                        onClick={() => void savePending()}
                        disabled={saving || !formNombre.trim()}
                      >
                        <Plus size={15} aria-hidden />
                        {pendingDraft.isMeasurement
                          ? "Guardar medición"
                          : draftSaveButton(draftSaveTarget)}
                      </button>
                      <button
                        type="button"
                        className="campo-mapa-map-work-dock-btn"
                        onClick={clearDraftOverlay}
                        disabled={saving}
                      >
                        Descartar
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
            {mapHint ? (
              <div
                className={`campo-mapa-map-hint${measureHint ? " campo-mapa-map-hint--measure" : ""}`}
              >
                {mapHint}
              </div>
            ) : null}
          </div>
        </div>
      </SgHubShell>

      <CampoMapaDispositivosModal
        open={dispositivosModalOpen && supportsDispositivosEnMapa(selectedPotrero, selectedElemento)}
        apiOnline={apiOnline}
        puedeEditar={puedeEditar}
        nombre={selectedPotrero?.nombre ?? selectedElemento?.nombre ?? ""}
        subtitulo={dispositivosModalSubtitulo}
        dispositivos={modalDispositivos}
        onChange={setModalDispositivos}
        onClose={() => setDispositivosModalOpen(false)}
        onSave={saveDispositivosFromModal}
        saving={saving}
        potreroNombre={selectedPotrero ? editNombre : undefined}
      />
    </div>
  );
}