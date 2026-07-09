import { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import { Map } from "lucide-react";
import { fetchHomeLayoutMonitorCampoMapa } from "../../api";
import type { CampoMapaElemento, CampoPotreroMapa } from "../../types";
import { renderElementoLayer, renderPotreroLayer } from "../campo/campo-mapa-render";
import {
  applyCampoMapaInitialView,
  cuentaTieneGeometriaEnMapa,
} from "../campo/campo-mapa-view";

interface Props {
  apiOnline: boolean;
  userId: number;
  cuentaNombre?: string | null;
  onError: (msg: string) => void;
}

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

export default function HomeLayoutMonitorCampoMapaSection({
  apiOnline,
  userId,
  cuentaNombre,
  onError,
}: Props) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.Layer[]>([]);
  const [loading, setLoading] = useState(true);
  const [potreros, setPotreros] = useState<CampoPotreroMapa[]>([]);
  const [elementos, setElementos] = useState<CampoMapaElemento[]>([]);
  const [mapCuentaNombre, setMapCuentaNombre] = useState<string | null>(cuentaNombre ?? null);
  const [sinCuenta, setSinCuenta] = useState(false);

  useEffect(() => {
    if (!apiOnline || userId <= 0) {
      setPotreros([]);
      setElementos([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void fetchHomeLayoutMonitorCampoMapa(userId)
      .then((data) => {
        if (cancelled) return;
        setPotreros(data.potreros);
        setElementos(data.elementos);
        setMapCuentaNombre(data.cuenta_nombre ?? cuentaNombre ?? null);
        setSinCuenta(data.cuenta_id == null);
      })
      .catch((e) => {
        if (cancelled) return;
        onError(e instanceof Error ? e.message : "Error al cargar mapa del campo");
        setPotreros([]);
        setElementos([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [apiOnline, userId, cuentaNombre, onError]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [-32.85, -56.02],
      zoom: 12,
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: true,
    });
    createSatelliteBaseLayers().addTo(map);
    mapRef.current = map;

    const resize = () => map.invalidateSize();
    const timer = window.setTimeout(resize, 120);
    window.addEventListener("resize", resize);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", resize);
      layersRef.current.forEach((layer) => layer.remove());
      layersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const renderLayers = useCallback(() => {
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

    window.setTimeout(() => map.invalidateSize(), 80);
  }, [elementos, loading, potreros]);

  useEffect(() => {
    renderLayers();
  }, [renderLayers]);

  const totalMarcaciones = potreros.length + elementos.length;

  return (
    <section
      className="home-layout-users-monitor-extra home-layout-users-monitor-mapa"
      aria-labelledby="home-layout-monitor-mapa-title"
    >
      <header className="home-layout-users-monitor-extra-head">
        <div>
          <p className="sg-hub-panel-kicker">Mapa del campo</p>
          <h4 id="home-layout-monitor-mapa-title">
            <Map size={16} aria-hidden />
            Predio cargado en Google Maps
          </h4>
          <p className="muted">
            Potreros y marcaciones de la cuenta
            {mapCuentaNombre ? ` «${mapCuentaNombre}»` : ""}.
          </p>
        </div>
        {!loading && totalMarcaciones > 0 ? (
          <span className="home-layout-users-monitor-extra-count muted">
            {potreros.length} potrero{potreros.length === 1 ? "" : "s"} · {elementos.length}{" "}
            marcación{elementos.length === 1 ? "" : "es"}
          </span>
        ) : null}
      </header>

      <div className="home-layout-users-monitor-mapa-frame">
        <div ref={mapContainerRef} className="home-layout-users-monitor-mapa-canvas" aria-hidden />
        {loading ? (
          <div className="home-layout-users-monitor-mapa-overlay muted">Cargando mapa…</div>
        ) : null}
        {!loading && sinCuenta ? (
          <div className="home-layout-users-monitor-mapa-overlay muted">
            Este usuario no tiene una cuenta operativa asignada.
          </div>
        ) : null}
        {!loading && !sinCuenta && totalMarcaciones === 0 ? (
          <div className="home-layout-users-monitor-mapa-overlay muted">
            La cuenta no tiene potreros ni marcaciones dibujadas en el mapa.
          </div>
        ) : null}
      </div>
    </section>
  );
}
