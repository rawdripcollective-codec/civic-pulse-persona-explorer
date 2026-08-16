import { DEFAULT_STATE_BOUNDARY_URL } from "@shared/personas";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";

const stateCodes: Record<string, string> = { Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA", Colorado: "CO", Connecticut: "CT", Delaware: "DE", Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA", Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD", Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS", Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT", Virginia: "VA", Washington: "WA", "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY", "District of Columbia": "DC" };

type StateStat = { total: number; positive: number; neutral: number; negative: number; dominant: "positive" | "neutral" | "negative" };
type Props = { stateStats: Record<string, StateStat>; onSelectState: (state: string | null) => void; selectedState: string | null; boundaryUrl?: string };

const asGeojson = (base: GeoJSON.FeatureCollection, stats: Record<string, StateStat>) => ({
  ...base,
  features: base.features.map((feature) => {
    const state = stateCodes[String(feature.properties?.name || "")] || "";
    const stat = stats[state];
    const score = stat ? (stat.positive - stat.negative) / Math.max(stat.total, 1) : 0;
    return { ...feature, properties: { ...feature.properties, state, responseCount: stat?.total || 0, dominant: stat?.dominant || "awaiting", score, height: stat ? 1000 + stat.total * 90 : 120 } };
  }),
});

export default function USSentimentMap({ stateStats, onSelectState, selectedState, boundaryUrl = DEFAULT_STATE_BOUNDARY_URL }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const sourceData = useRef<GeoJSON.FeatureCollection | null>(null);
  const popup = useRef(new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 }));

  useEffect(() => {
    if (!container.current) return;
    const instance = new maplibregl.Map({ container: container.current, style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json", center: [-98.35, 39.6], zoom: 3.35, bearing: -10, pitch: 45, attributionControl: false });
    map.current = instance;
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    instance.once("style.load", async () => {
      try {
        instance.addSource("terrain", { type: "raster-dem", tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 14, encoding: "terrarium" });
        instance.setTerrain({ source: "terrain", exaggeration: 1.25 });
        instance.addLayer({ id: "terrain-hillshade", type: "hillshade", source: "terrain", paint: { "hillshade-shadow-color": "#020617", "hillshade-highlight-color": "#1e3a5f", "hillshade-exaggeration": 0.35 } });
      } catch { /* Terrain is decorative; retain an interactive map if the public tiles are unavailable. */ }
      const response = await fetch(boundaryUrl || DEFAULT_STATE_BOUNDARY_URL);
      if (!response.ok) throw new Error("State boundary layer could not be loaded.");
      const base = await response.json() as GeoJSON.FeatureCollection;
      sourceData.current = base;
      instance.addSource("states", { type: "geojson", data: asGeojson(base, stateStats) });
      instance.addLayer({ id: "state-extrusion", type: "fill-extrusion", source: "states", paint: { "fill-extrusion-color": ["case", [">", ["get", "responseCount"], 0], ["interpolate", ["linear"], ["get", "score"], -1, "#ff5c74", 0, "#ffb457", 1, "#3ee6b1"], "#17314e"], "fill-extrusion-height": ["get", "height"], "fill-extrusion-base": 0, "fill-extrusion-opacity": 0.75 } });
      instance.addLayer({ id: "state-outline", type: "line", source: "states", paint: { "line-color": "#76e4ff", "line-width": 0.65, "line-opacity": 0.55 } });
      instance.on("mousemove", "state-extrusion", (event) => {
        instance.getCanvas().style.cursor = "pointer";
        const props = event.features?.[0]?.properties;
        if (!props) return;
        popup.current.setLngLat(event.lngLat).setHTML(`<div class="map-popover"><strong>${props.name}</strong><span>${props.responseCount || 0} synthetic responses</span><span>Dominant: ${props.dominant}</span></div>`).addTo(instance);
      });
      instance.on("mouseleave", "state-extrusion", () => { instance.getCanvas().style.cursor = ""; popup.current.remove(); });
      instance.on("click", "state-extrusion", (event) => onSelectState(event.features?.[0]?.properties?.state || null));
    });
    return () => { popup.current.remove(); instance.remove(); map.current = null; };
  }, [boundaryUrl, onSelectState]);

  useEffect(() => {
    const source = map.current?.getSource("states") as maplibregl.GeoJSONSource | undefined;
    if (source && sourceData.current) source.setData(asGeojson(sourceData.current, stateStats));
  }, [stateStats]);

  useEffect(() => {
    const mapInstance = map.current;
    if (!mapInstance?.getLayer("state-outline")) return;
    mapInstance.setPaintProperty("state-outline", "line-width", ["case", ["==", ["get", "state"], selectedState || ""], 2.5, 0.65]);
  }, [selectedState]);

  return <div ref={container} className="h-full min-h-[520px] w-full overflow-hidden rounded-[28px]" aria-label="Interactive state-level sentiment map" />;
}
