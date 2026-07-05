import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import L from "leaflet";
import { Layers, MapPin, Maximize2, Minimize2, Plus, Search, Trash2, Undo2, X } from "lucide-react";
import SgHubShell from "../hub/SgHubShell";
import type { SgHubItem } from "../hub/SgHubTypes";
import { MenuAppIcon } from "../icons/MenuAppIcons";
import {
  createCampoMapaElemento,
  createCampoPotreroMapa,
  deleteCampoMapaElemento,
  deleteCampoPotreroMapa,
  fetchCampoMapaElementos,
  fetchCampoPotrerosMapa,
  updateCampoMapaElemento,
  updateCampoPotreroMapa,
} from "../../api";
import type { CampoMapaElemento, CampoMapaElementoTipo, CampoPotreroMapa } from "../../types";
import { hubAsideKicker } from "../../brand";
import {
  computeDistanceMeters,
  computeHectareas,
  formatDistance,
  formatHectareas,
  geoJsonToPaths,
  pathsToGeoJson,
  pathsToLeafletLatLngs,
  pathsToLineGeoJson,
  pointToGeoJson,
  type MapLatLng,
} from "./campo-mapa-geo";
import { buscarLugaresEnMapa, type CampoMapaLugarResult } from "./campo-mapa-geocode";
import { flyToElemento, renderElementoLayer, renderPotreroLayer } from "./campo-mapa-render";
import {
  applyCampoMapaInitialView,
  CAMPO_MAPA_DEFAULT_CENTER,
  CAMPO_MAPA_DEFAULT_ZOOM,
  cuentaTieneGeometriaEnMapa,
} from "./campo-mapa-view";
import {
  ELEMENTO_TIPO_LABELS,
  getToolDef,
  toolSketchIsPoint,
  toolSketchIsPolygon,
  toolToElementoTipo,
  toolUsesSketch,
  type CampoMapaTool,
} from "./campo-mapa-tools";
import CampoMapaToolbar from "./CampoMapaToolbar";
import type { AuthUser } from "../../types";
import { canWriteCampoMapa } from "../../utils/auth-permissions";

const HUB_ITEMS: SgHubItem[] = [
  {
    id: "mapa",
    label: "Mapa del campo",
    subtitle: "Herramientas de dibujo y medición sobre vista satelital",
    icon: "stock_cabana",
  },
];

const DEFAULT_CENTER = CAMPO_MAPA_DEFAULT_CENTER;
const DEFAULT_ZOOM = CAMPO_MAPA_DEFAULT_ZOOM;
const SKETCH_COLOR = "#7cb342";

const ELEMENTO_TIPO_ORDER: CampoMapaElementoTipo[] = [
  "marcador",
  "nota",
  "linea",
  "area",
  "clip",
  "medicion_distancia",
  "medicion_area",
];

function createSatelliteBaseLayers(): {
  base: L.LayerGroup;
  labels: L.TileLayer;
} {
  const satellite = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom: 19,
      attribution: "Tiles &copy; Esri",
    },
  );
  const labels = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom: 19,
      attribution: "Labels &copy; Esri",
      opacity: 0.85,
    },
  );
  const base = L.layerGroup([satellite, labels]);
  return { base, labels };
}

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

function draftLabel(tool: CampoMapaTool): string {
  switch (tool) {
    case "potrero":
      return "Nuevo potrero";
    case "marcador":
      return "Nuevo marcador";
    case "nota":
      return "Nueva nota";
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
  if (tool === "potrero") return "Potrero guardado en el mapa.";
  if (tool === "clip") return "Clip de vista guardado.";
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
  const [selection, setSelection] = useState<MapSelection | null>(null);
  const [sketchVertices, setSketchVertices] = useState<MapLatLng[]>([]);
  const [pendingDraft, setPendingDraft] = useState<PendingDraft | null>(null);
  const [formNombre, setFormNombre] = useState("");
  const [formNotas, setFormNotas] = useState("");
  const [potreros, setPotreros] = useState<CampoPotreroMapa[]>([]);
  const [elementos, setElementos] = useState<CampoMapaElemento[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editNombre, setEditNombre] = useState("");
  const [editNotas, setEditNotas] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CampoMapaLugarResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const mapShellRef = useRef<HTMLDivElement | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const labelLayerRef = useRef<L.TileLayer | null>(null);
  const searchMarkerRef = useRef<L.CircleMarker | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const potreroLayersRef = useRef<Map<number, L.Layer>>(new Map());
  const elementoLayersRef = useRef<Map<number, L.Layer>>(new Map());
  const draftLayerRef = useRef<L.Layer | null>(null);
  const sketchPolylineRef = useRef<L.Polyline | null>(null);
  const sketchPolygonRef = useRef<L.Polygon | null>(null);
  const sketchMarkersRef = useRef<L.CircleMarker[]>([]);
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

  const elementosByTipo = useMemo(() => {
    const grouped = new Map<CampoMapaElementoTipo, CampoMapaElemento[]>();
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

  const toolDef = getToolDef(activeTool);
  const isSketching = toolUsesSketch(activeTool) && sketchVertices.length > 0 && !pendingDraft;
  const minSketchPoints = toolSketchIsPolygon(activeTool) ? 3 : 2;

  const measureHint = useMemo(() => {
    if (activeTool === "medir_distancia" && sketchVertices.length >= 2) {
      const meters = computeDistanceMeters(sketchVertices);
      return meters != null ? formatDistance(meters) : null;
    }
    if (activeTool === "medir_area" && sketchVertices.length >= 3) {
      const ha = computeHectareas(sketchVertices);
      return ha != null ? formatHectareas(ha) : null;
    }
    return null;
  }, [activeTool, sketchVertices]);

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
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudieron cargar las capas del mapa.");
    } finally {
      setLoading(false);
    }
  }, [apiOnline, onError]);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  useEffect(() => {
    if (!selectedPotrero && !selectedElemento) {
      setEditNombre("");
      setEditNotas("");
      return;
    }
    const item = selectedPotrero ?? selectedElemento;
    if (!item) return;
    setEditNombre(item.nombre);
    setEditNotas(item.notas);
  }, [selectedPotrero, selectedElemento]);

  const clearSketchOverlay = useCallback(() => {
    sketchPolylineRef.current?.remove();
    sketchPolylineRef.current = null;
    sketchPolygonRef.current?.remove();
    sketchPolygonRef.current = null;
    sketchMarkersRef.current.forEach((marker) => marker.remove());
    sketchMarkersRef.current = [];
    setSketchVertices([]);
  }, []);

  const clearDraftOverlay = useCallback(() => {
    draftLayerRef.current?.remove();
    draftLayerRef.current = null;
    setPendingDraft(null);
    setFormNombre("");
    setFormNotas("");
  }, []);

  const selectPotrero = useCallback((id: number) => {
    setSelection({ kind: "potrero", id });
    clearSketchOverlay();
    clearDraftOverlay();
  }, [clearDraftOverlay, clearSketchOverlay]);

  const selectElemento = useCallback((id: number) => {
    setSelection({ kind: "elemento", id });
    clearSketchOverlay();
    clearDraftOverlay();
  }, [clearDraftOverlay, clearSketchOverlay]);

  const renderMapLayers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    potreroLayersRef.current.forEach((layer) => layer.remove());
    potreroLayersRef.current.clear();
    elementoLayersRef.current.forEach((layer) => layer.remove());
    elementoLayersRef.current.clear();

    for (const item of potreros) {
      const layer = renderPotreroLayer(
        map,
        item,
        selection?.kind === "potrero" && selection.id === item.id,
        () => selectPotrero(item.id),
      );
      if (layer) potreroLayersRef.current.set(item.id, layer);
    }

    for (const item of elementos) {
      const layer = renderElementoLayer(
        map,
        item,
        selection?.kind === "elemento" && selection.id === item.id,
        () => selectElemento(item.id),
      );
      if (layer) elementoLayersRef.current.set(item.id, layer);
    }
  }, [elementos, potreros, selectElemento, selectPotrero, selection]);

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

    const { base, labels } = createSatelliteBaseLayers();
    base.addTo(map);
    labelLayerRef.current = labels;
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
      map.remove();
      mapRef.current = null;
      labelLayerRef.current = null;
      searchMarkerRef.current?.remove();
      searchMarkerRef.current = null;
      setMapReady(false);
    };
  }, [clearDraftOverlay, clearSketchOverlay]);

  useEffect(() => {
    if (!mapReady) return;
    renderMapLayers();
  }, [mapReady, renderMapLayers]);

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
      if (pendingDraft) return;

      if (toolSketchIsPoint(activeTool)) {
        const point = { lat: event.latlng.lat, lng: event.latlng.lng };
        setSelection(null);
        clearSketchOverlay();
        setPendingDraft({ sourceTool: activeTool, point });
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

    const usesMapClick = toolSketchIsPoint(activeTool) || toolUsesSketch(activeTool);
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
  }, [activeTool, clearSketchOverlay, elementos, mapReady, pendingDraft, potreros]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    sketchPolylineRef.current?.remove();
    sketchPolygonRef.current?.remove();
    sketchMarkersRef.current.forEach((marker) => marker.remove());
    sketchMarkersRef.current = [];

    for (const point of sketchVertices) {
      const marker = L.circleMarker([point.lat, point.lng], {
        radius: 5,
        color: "#ffffff",
        weight: 2,
        fillColor: SKETCH_COLOR,
        fillOpacity: 1,
      }).addTo(map);
      sketchMarkersRef.current.push(marker);
    }

    if (sketchVertices.length >= 2) {
      if (toolSketchIsPolygon(activeTool)) {
        sketchPolygonRef.current = L.polygon(pathsToLeafletLatLngs(sketchVertices), {
          color: SKETCH_COLOR,
          weight: 2,
          opacity: 0.95,
          fillColor: SKETCH_COLOR,
          fillOpacity: 0.18,
          dashArray: "6 4",
        }).addTo(map);
      } else {
        sketchPolylineRef.current = L.polyline(pathsToLeafletLatLngs(sketchVertices), {
          color: SKETCH_COLOR,
          weight: 2,
          opacity: 0.95,
        }).addTo(map);
      }
    }
  }, [activeTool, sketchVertices, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    draftLayerRef.current?.remove();
    draftLayerRef.current = null;
    if (!pendingDraft) return;

    const { point, paths, sourceTool } = pendingDraft;
    if (point) {
      draftLayerRef.current = L.circleMarker([point.lat, point.lng], {
        radius: sourceTool === "clip" ? 7 : 8,
        color: "#ffffff",
        weight: 3,
        fillColor: SKETCH_COLOR,
        fillOpacity: 1,
      }).addTo(map);
      return;
    }

    if (!paths || paths.length === 0) return;

    if (sourceTool === "linea" || sourceTool === "medir_distancia") {
      draftLayerRef.current = L.polyline(pathsToLeafletLatLngs(paths), {
        color: SKETCH_COLOR,
        weight: 3,
        opacity: 0.95,
        dashArray: sourceTool === "medir_distancia" ? "8 6" : undefined,
      }).addTo(map);
      return;
    }

    draftLayerRef.current = L.polygon(pathsToLeafletLatLngs(paths), {
      color: SKETCH_COLOR,
      weight: 3,
      opacity: 0.95,
      fillColor: SKETCH_COLOR,
      fillOpacity: 0.32,
    }).addTo(map);
  }, [mapReady, pendingDraft]);

  useEffect(() => {
    const map = mapRef.current;
    const labels = labelLayerRef.current;
    if (!map || !labels) return;
    if (showLabels) {
      if (!map.hasLayer(labels)) labels.addTo(map);
    } else {
      map.removeLayer(labels);
    }
  }, [showLabels, mapReady]);

  const clearSearchMarker = useCallback(() => {
    searchMarkerRef.current?.remove();
    searchMarkerRef.current = null;
  }, []);

  const irALugar = useCallback(
    (lugar: CampoMapaLugarResult) => {
      const map = mapRef.current;
      if (!map) return;

      clearSearchMarker();
      searchMarkerRef.current = L.circleMarker([lugar.lat, lugar.lng], {
        radius: 8,
        color: "#ffffff",
        weight: 3,
        fillColor: "#2563eb",
        fillOpacity: 1,
      }).addTo(map);

      if (lugar.extent) {
        const [minLon, maxLon, minLat, maxLat] = lugar.extent;
        map.fitBounds(
          L.latLngBounds([
            [minLat, minLon],
            [maxLat, maxLon],
          ]),
          { padding: [48, 48], maxZoom: 15 },
        );
      } else {
        map.flyTo([lugar.lat, lugar.lng], 14, { duration: 0.8 });
      }

      setSearchQuery(lugar.label);
      setSearchResults([]);
      setSearchOpen(false);
      setSearchError(null);
    },
    [clearSearchMarker],
  );

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError(null);
      return;
    }

    setSearchLoading(true);
    setSearchError(null);
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

    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const onSearchSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (searchResults[0]) {
      irALugar(searchResults[0]);
      return;
    }
    if (searchQuery.trim().length >= 2) {
      setSearchOpen(true);
    }
  };

  const handleToolSelect = (tool: CampoMapaTool) => {
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

  const undoSketchPoint = () => {
    setSketchVertices((prev) => prev.slice(0, -1));
  };

  const cancelSketch = () => {
    clearSketchOverlay();
    setActiveTool("navegar");
  };

  const finishSketch = () => {
    if (sketchVertices.length < minSketchPoints) {
      onError(
        toolSketchIsPolygon(activeTool)
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

    if (activeTool === "potrero") {
      setPendingDraft({
        sourceTool: activeTool,
        paths,
        hectareas: computeHectareas(paths),
      });
      setFormNombre("");
      setFormNotas("");
      return;
    }

    if (activeTool === "linea") {
      setPendingDraft({ sourceTool: activeTool, paths });
      setFormNombre("Línea");
      setFormNotas("");
      return;
    }

    if (activeTool === "area") {
      setPendingDraft({
        sourceTool: activeTool,
        paths,
        hectareas: computeHectareas(paths),
      });
      setFormNombre("Área");
      setFormNotas("");
    }
  };

  const savePending = async () => {
    if (!pendingDraft || !formNombre.trim()) {
      onError("Ingresá un nombre para guardar en el mapa.");
      return;
    }

    setSaving(true);
    try {
      if (pendingDraft.sourceTool === "potrero") {
        const created = await createCampoPotreroMapa({
          nombre: formNombre.trim(),
          geojson: JSON.parse(pathsToGeoJson(pendingDraft.paths ?? [])),
          hectareas: pendingDraft.hectareas ?? null,
          notas: formNotas,
        });
        setPotreros((prev) =>
          [...prev, created].sort((a, b) => a.nombre.localeCompare(b.nombre)),
        );
        setSelection({ kind: "potrero", id: created.id });
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
          nombre: formNombre.trim(),
          geojson,
          notas: formNotas,
          metadata: pendingDraft.metadata,
        });
        setElementos((prev) =>
          [...prev, created].sort((a, b) => a.nombre.localeCompare(b.nombre)),
        );
        setSelection({ kind: "elemento", id: created.id });
      }

      clearDraftOverlay();
      setActiveTool("navegar");
      onSuccess(saveSuccessMessage(pendingDraft.sourceTool));
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo guardar en el mapa.");
    } finally {
      setSaving(false);
    }
  };

  const saveSelected = async () => {
    if (!selectedPotrero && !selectedElemento) return;
    setSaving(true);
    try {
      if (selectedPotrero) {
        const updated = await updateCampoPotreroMapa(selectedPotrero.id, {
          nombre: editNombre,
          notas: editNotas,
        });
        setPotreros((prev) =>
          prev
            .map((item) => (item.id === updated.id ? updated : item))
            .sort((a, b) => a.nombre.localeCompare(b.nombre)),
        );
        onSuccess("Potrero actualizado.");
      } else if (selectedElemento) {
        const updated = await updateCampoMapaElemento(selectedElemento.id, {
          nombre: editNombre,
          notas: editNotas,
        });
        setElementos((prev) =>
          prev
            .map((item) => (item.id === updated.id ? updated : item))
            .sort((a, b) => a.nombre.localeCompare(b.nombre)),
        );
        onSuccess("Elemento actualizado.");
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo actualizar.");
    } finally {
      setSaving(false);
    }
  };

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

  const mapHint = useMemo(() => {
    if (measureHint) return measureHint;
    if (toolUsesSketch(activeTool) && !pendingDraft) return toolDef.hint;
    if (toolSketchIsPoint(activeTool) && !pendingDraft) return toolDef.hint;
    return null;
  }, [activeTool, measureHint, pendingDraft, toolDef.hint]);

  const sidebarBody = (
    <div className="campo-mapa-aside-body">
      <p className="campo-mapa-aside-shared">
        Mapa compartido de <strong>{cuentaNombre}</strong>. Potreros y ubicaciones los ven y
        editan todos los integrantes del equipo en esta cuenta.
      </p>

      {puedeEditar && toolUsesSketch(activeTool) && !pendingDraft ? (
        <div className="campo-mapa-aside-tools">
          <p className="campo-mapa-aside-hint">{toolDef.hint}</p>
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
            onClick={undoSketchPoint}
            disabled={sketchVertices.length === 0 || saving}
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

      <div className="campo-mapa-aside-section">
        <p className="campo-mapa-aside-label">Potreros</p>
        {loading ? <p className="campo-mapa-aside-hint">Cargando…</p> : null}
        {!loading && potreros.length === 0 ? (
          <div className="campo-mapa-aside-empty">
            <MapPin size={18} aria-hidden />
            <p>Sin potreros todavía.</p>
            <p className="campo-mapa-aside-hint">Usá la herramienta Potrero en el mapa.</p>
          </div>
        ) : null}
        <ul className="campo-mapa-aside-list">
          {potreros.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={`campo-mapa-aside-item${
                  selection?.kind === "potrero" && selection.id === item.id ? " is-active" : ""
                }`}
                onClick={() => selectPotrero(item.id)}
              >
                <span className="campo-mapa-swatch" style={{ background: item.color }} />
                <span className="campo-mapa-aside-item-text">
                  <strong>{item.nombre}</strong>
                  <span>
                    {item.hectareas != null ? `${item.hectareas} ha` : "Sin superficie"}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="campo-mapa-aside-section">
        <p className="campo-mapa-aside-label">Elementos</p>
        {!loading && elementos.length === 0 ? (
          <p className="campo-mapa-aside-hint">Sin elementos guardados.</p>
        ) : null}
        {ELEMENTO_TIPO_ORDER.map((tipo) => {
          const items = elementosByTipo.get(tipo) ?? [];
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
                      <span className="campo-mapa-swatch" style={{ background: item.color }} />
                      <span className="campo-mapa-aside-item-text">
                        <strong>{item.nombre}</strong>
                        <span>{ELEMENTO_TIPO_LABELS[item.tipo]}</span>
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
          <p className="campo-mapa-aside-label">{draftLabel(pendingDraft.sourceTool)}</p>
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
          <label>
            Nombre
            <input
              value={formNombre}
              onChange={(e) => setFormNombre(e.target.value)}
              placeholder="Nombre en el mapa"
              maxLength={48}
            />
          </label>
          <label>
            Notas
            <textarea
              value={formNotas}
              onChange={(e) => setFormNotas(e.target.value)}
              rows={3}
              placeholder="Observaciones opcionales"
            />
          </label>
          <div className="campo-mapa-aside-form-actions">
            <button
              type="button"
              className="campo-mapa-aside-btn campo-mapa-aside-btn--primary"
              onClick={() => void savePending()}
              disabled={saving || !formNombre.trim()}
            >
              <Plus size={15} aria-hidden />
              {pendingDraft.isMeasurement ? "Guardar medición" : "Guardar"}
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

      {puedeEditar && (selectedPotrero || selectedElemento) && !pendingDraft ? (
        <div className="campo-mapa-aside-form">
          <p className="campo-mapa-aside-label">
            {selectedPotrero ? "Editar potrero" : "Editar elemento"}
          </p>
          {selectedPotrero?.hectareas != null ? (
            <p className="campo-mapa-aside-hint">
              Superficie: {formatHectareas(selectedPotrero.hectareas)}
            </p>
          ) : null}
          {selectedElemento ? (
            <p className="campo-mapa-aside-hint">{ELEMENTO_TIPO_LABELS[selectedElemento.tipo]}</p>
          ) : null}
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
        items={HUB_ITEMS}
        onNavigate={() => undefined}
        onVolverDashboard={onVolver}
        onVolverInicio={onVolver}
        apiOnline={apiOnline}
        title="Mapa del campo"
        subtitle="Vista satelital compartida con tu equipo. Los cambios en potreros y ubicaciones aplican a toda la cuenta."
        asideKicker={hubAsideKicker("CAMPO")}
        asideTitle="Mapa"
        asideLogo={<MenuAppIcon id="campo_mapa" />}
        navAriaLabel="Campo y mapa"
        showDashboardInNav={false}
        showApiStatus={false}
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
              disabled={!puedeEditar || !mapReady || saving || !!pendingDraft}
              onSelect={handleToolSelect}
              onSaveClip={handleSaveClip}
            />
            <form
              className="campo-mapa-search"
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
              <button
                type="button"
                className={`campo-mapa-map-corner-btn${showLabels ? " is-active" : ""}`}
                onClick={() => setShowLabels((v) => !v)}
                title={showLabels ? "Ocultar etiquetas del mapa" : "Mostrar etiquetas del mapa"}
                aria-label={showLabels ? "Ocultar etiquetas del mapa" : "Mostrar etiquetas del mapa"}
                aria-pressed={showLabels}
              >
                <Layers size={18} aria-hidden />
              </button>
            </div>
            {mapHint ? <div className="campo-mapa-map-hint">{mapHint}</div> : null}
          </div>
        </div>
      </SgHubShell>
    </div>
  );
}