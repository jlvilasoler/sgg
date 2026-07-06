import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { ArrowRight } from "lucide-react";
import {
  fetchCampoMapaElementos,
  fetchCampoPotrerosMapa,
  fetchEmpresasOperativasStock,
  fetchStockEquinaDispositivos,
  fetchStockGanaderaDispositivos,
  type EmpresaOperativaStock,
} from "../../api";
import type { CampoMapaElemento, CampoPotreroMapa, StockGanaderaDispositivo } from "../../types";
import {
  buildCampoMapaDispositivoMarkers,
  filterDispositivoMarkersInBounds,
  renderCampoMapaDispositivoMarkersPreview,
} from "../campo/campo-mapa-dispositivos-map";
import { renderElementoLayer, renderPotreroLayer } from "../campo/campo-mapa-render";
import {
  applyCampoMapaInitialView,
  cuentaTieneGeometriaEnMapa,
} from "../campo/campo-mapa-view";

function createSatelliteBaseLayers(): L.LayerGroup {
  const satellite = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 19, attribution: "Tiles &copy; Esri" },
  );
  const labels = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 19, attribution: "Labels &copy; Esri", opacity: 0.85 },
  );
  return L.layerGroup([satellite, labels]);
}

interface Props {
  apiOnline: boolean;
  onOpenMapa: () => void;
}

export default function HomeCampoMapaPanel({ apiOnline, onOpenMapa }: Props) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.Layer[]>([]);
  const deviceLayerRef = useRef<L.LayerGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [potreros, setPotreros] = useState<CampoPotreroMapa[]>([]);
  const [elementos, setElementos] = useState<CampoMapaElemento[]>([]);
  const [stockGanadero, setStockGanadero] = useState<StockGanaderaDispositivo[]>([]);
  const [stockEquino, setStockEquino] = useState<StockGanaderaDispositivo[]>([]);
  const [empresasOperativas, setEmpresasOperativas] = useState<EmpresaOperativaStock[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void Promise.all([
      fetchCampoPotrerosMapa(),
      fetchCampoMapaElementos(),
      fetchStockGanaderaDispositivos({}),
      fetchStockEquinaDispositivos({}),
      fetchEmpresasOperativasStock(),
    ])
      .then(([potrerosData, elementosData, ganaderoData, equinoData, empresasData]) => {
        if (cancelled) return;
        setPotreros(potrerosData);
        setElementos(elementosData);
        setStockGanadero(ganaderoData);
        setStockEquino(equinoData);
        setEmpresasOperativas(empresasData);
      })
      .catch(() => {
        if (cancelled) return;
        setError("No se pudo cargar el mapa del predio.");
        setPotreros([]);
        setElementos([]);
        setStockGanadero([]);
        setStockEquino([]);
        setEmpresasOperativas([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiOnline]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [-32.85, -56.02],
      zoom: 12,
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: false,
      dragging: true,
      doubleClickZoom: true,
    });
    createSatelliteBaseLayers().addTo(map);
    mapRef.current = map;

    const resize = () => map.invalidateSize();
    const timer = window.setTimeout(resize, 120);
    window.addEventListener("resize", resize);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", resize);
      deviceLayerRef.current?.remove();
      deviceLayerRef.current = null;
      layersRef.current.forEach((layer) => layer.remove());
      layersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const allDeviceMarkers = useMemo(
    () =>
      buildCampoMapaDispositivoMarkers(
        potreros,
        elementos,
        stockGanadero,
        stockEquino,
        empresasOperativas,
      ),
    [elementos, empresasOperativas, potreros, stockEquino, stockGanadero],
  );

  const syncVisibleDevices = useCallback(() => {
    const map = mapRef.current;
    if (!map || loading) return;

    deviceLayerRef.current?.remove();
    deviceLayerRef.current = null;
    if (allDeviceMarkers.length === 0) return;

    const visible = filterDispositivoMarkersInBounds(allDeviceMarkers, map.getBounds());
    if (visible.length === 0) return;

    deviceLayerRef.current = renderCampoMapaDispositivoMarkersPreview(map, visible);
  }, [allDeviceMarkers, loading]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || loading) return;

    layersRef.current.forEach((layer) => layer.remove());
    layersRef.current = [];

    const noop = () => {};
    for (const item of potreros) {
      const layer = renderPotreroLayer(map, item, false, noop);
      if (layer) layersRef.current.push(layer);
    }
    for (const item of elementos) {
      const layer = renderElementoLayer(map, item, false, noop);
      if (layer) layersRef.current.push(layer);
    }

    if (cuentaTieneGeometriaEnMapa(potreros, elementos)) {
      applyCampoMapaInitialView(map, potreros, elementos, { animate: false });
    }

    syncVisibleDevices();
    window.setTimeout(() => {
      map.invalidateSize();
      syncVisibleDevices();
    }, 80);
  }, [elementos, loading, potreros, syncVisibleDevices]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onViewChange = () => syncVisibleDevices();
    map.on("moveend", onViewChange);
    map.on("zoomend", onViewChange);
    return () => {
      map.off("moveend", onViewChange);
      map.off("zoomend", onViewChange);
    };
  }, [syncVisibleDevices]);

  const totalMarcaciones = potreros.length + elementos.length;

  return (
    <section className="sg-hub-panel home-hub-panel--mapa" aria-label="Mapa del predio">
      <div className="sg-hub-panel-head home-hub-panel-head-row">
        <div>
          <p className="sg-hub-panel-kicker">Mapa del campo</p>
          <h2 className="sg-hub-panel-title">Tu predio</h2>
        </div>
        <button type="button" className="home-hub-link" onClick={onOpenMapa}>
          Abrir mapa
          <ArrowRight size={14} aria-hidden />
        </button>
      </div>

      <button
        type="button"
        className="home-hub-mapa-preview"
        onClick={onOpenMapa}
        aria-label="Abrir mapa del campo en pantalla completa"
      >
        <div ref={mapContainerRef} className="home-hub-mapa-canvas" aria-hidden />
        {loading ? (
          <div className="home-hub-mapa-overlay">Cargando mapa del predio…</div>
        ) : null}
        {!loading && error ? (
          <div className="home-hub-mapa-overlay home-hub-mapa-overlay--muted">{error}</div>
        ) : null}
        {!loading && !error && totalMarcaciones === 0 ? (
          <div className="home-hub-mapa-overlay home-hub-mapa-overlay--muted">
            Todavía no hay potreros ni marcaciones. Abrí el mapa del campo para dibujar tu predio.
          </div>
        ) : null}
      </button>

      {!loading && !error && totalMarcaciones > 0 ? (
        <p className="home-hub-mapa-meta">
          {potreros.length > 0
            ? `${potreros.length} potrero${potreros.length === 1 ? "" : "s"}`
            : "Sin potreros"}
          {" · "}
          {elementos.length > 0
            ? `${elementos.length} marcación${elementos.length === 1 ? "" : "es"}`
            : "Sin marcaciones"}
        </p>
      ) : null}
    </section>
  );
}
