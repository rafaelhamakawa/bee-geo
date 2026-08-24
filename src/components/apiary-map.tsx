import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import polygonClipping from "polygon-clipping";
import { FLIGHT_RADIUS_M } from "@/lib/geoapis";

export type NearbyApiary = { latitude: number; longitude: number; name?: string | null };


function circleRing(lat: number, lng: number, radiusM: number): [number, number][] {
  const points = 128;
  const coords: [number, number][] = [];
  const distX = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  const distY = radiusM / 110574;
  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    coords.push([lng + distX * Math.cos(theta), lat + distY * Math.sin(theta)]);
  }
  coords.push(coords[0]!);
  return coords;
}

function circleGeoJSON(lat: number, lng: number, radiusM: number) {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "Polygon" as const, coordinates: [circleRing(lat, lng, radiusM)] },
  };
}

// Círculos dos apiários vizinhos + área de sobreposição com o círculo principal.
function neighborsGeoJSON(
  lat: number,
  lng: number,
  radiusM: number,
  nearby: NearbyApiary[],
): maplibregl.GeoJSONSourceSpecification["data"] {
  const main = [[circleRing(lat, lng, radiusM)]] as any;
  const features: any[] = [];
  for (const n of nearby) {
    if (n.latitude == null || n.longitude == null) continue;
    const ring = circleRing(n.latitude, n.longitude, radiusM);
    features.push({
      type: "Feature",
      properties: { kind: "neighbor", name: n.name ?? null },
      geometry: { type: "Polygon", coordinates: [ring] },
    });
    try {
      const inter = polygonClipping.intersection(main, [[ring]] as any);
      if (inter.length) {
        features.push({
          type: "Feature",
          properties: { kind: "overlap" },
          geometry: { type: "MultiPolygon", coordinates: inter as any },
        });
      }
    } catch {
      // ignora falha de interseção
    }
  }
  return { type: "FeatureCollection", features };
}


const SATELLITE_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    esri: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Esri, Maxar, Earthstar Geographics",
    },
  },
  layers: [{ id: "esri", type: "raster", source: "esri" }],
};

export default function ApiaryMap({
  latitude,
  longitude,
  draggable = false,
  onMove,
  showCircle = true,
  className = "h-72 w-full rounded-2xl",
  drawing = false,
  drawPoints,
  onDrawPoint,
  nearby,
}: {
  latitude: number;
  longitude: number;
  draggable?: boolean;
  onMove?: (lat: number, lng: number) => void;
  showCircle?: boolean;
  className?: string;
  drawing?: boolean;
  drawPoints?: [number, number][];
  onDrawPoint?: (lng: number, lat: number) => void;
  nearby?: NearbyApiary[];
}) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const drawingRef = useRef(drawing);
  const onDrawPointRef = useRef(onDrawPoint);
  const nearbyRef = useRef<NearbyApiary[]>(nearby ?? []);
  drawingRef.current = drawing;
  onDrawPointRef.current = onDrawPoint;
  nearbyRef.current = nearby ?? [];
  const [failed, setFailed] = useState(false);



  useEffect(() => {
    if (!container.current || mapRef.current) return;
    try {
      const map = new maplibregl.Map({
        container: container.current,
        style: SATELLITE_STYLE,
        center: [longitude, latitude],
        zoom: 12.5,
        attributionControl: { compact: true },
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.on("error", () => setFailed(true));
      const addLayers = () => {
        if (map.getSource("radius")) return;
        if (showCircle) {
          map.addSource("radius", {
            type: "geojson",
            data: circleGeoJSON(latitude, longitude, FLIGHT_RADIUS_M),
          });
          map.addLayer({
            id: "radius-fill",
            type: "fill",
            source: "radius",
            paint: { "fill-color": "#F5A000", "fill-opacity": 0.28 },
          });
          map.addLayer({
            id: "radius-line",
            type: "line",
            source: "radius",
            paint: { "line-color": "#1A1A1A", "line-width": 3 },
          });
          map.addSource("neighbors", {
            type: "geojson",
            data: neighborsGeoJSON(latitude, longitude, FLIGHT_RADIUS_M, nearbyRef.current),
          });
          map.addLayer({
            id: "neighbors-fill",
            type: "fill",
            source: "neighbors",
            filter: ["==", ["get", "kind"], "neighbor"],
            paint: { "fill-color": "#F5A000", "fill-opacity": 0.12 },
          });
          map.addLayer({
            id: "neighbors-line",
            type: "line",
            source: "neighbors",
            filter: ["==", ["get", "kind"], "neighbor"],
            paint: { "line-color": "#1A1A1A", "line-width": 1.5, "line-dasharray": [2, 2] },
          });
          map.addLayer({
            id: "overlap-fill",
            type: "fill",
            source: "neighbors",
            filter: ["==", ["get", "kind"], "overlap"],
            paint: { "fill-color": "#C1121F", "fill-opacity": 0.4 },
          });
          map.addLayer({
            id: "overlap-line",
            type: "line",
            source: "neighbors",
            filter: ["==", ["get", "kind"], "overlap"],
            paint: { "line-color": "#C1121F", "line-width": 2 },
          });
        }

        map.addSource("draw", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "draw-fill",
          type: "fill",
          source: "draw",
          paint: { "fill-color": "#0B6337", "fill-opacity": 0.35 },
        });
        map.addLayer({
          id: "draw-line",
          type: "line",
          source: "draw",
          paint: { "line-color": "#0B6337", "line-width": 2 },
        });
        map.addLayer({
          id: "draw-points",
          type: "circle",
          source: "draw",
          filter: ["==", "$type", "Point"],
          paint: { "circle-radius": 4, "circle-color": "#F5A000" },
        });
      };
      if (map.isStyleLoaded()) addLayers();
      else map.on("load", addLayers);


      const marker = new maplibregl.Marker({ color: "#0B6337", draggable })
        .setLngLat([longitude, latitude])
        .addTo(map);
      marker.on("dragend", () => {
        if (!draggable) return;
        const { lat, lng } = marker.getLngLat();
        onMove?.(lat, lng);
      });
      map.on("click", (e: maplibregl.MapMouseEvent) => {
        if (drawingRef.current) {
          onDrawPointRef.current?.(e.lngLat.lng, e.lngLat.lat);
          return;
        }
        if (draggable) {
          marker.setLngLat(e.lngLat);
          onMove?.(e.lngLat.lat, e.lngLat.lng);
        }
      });

      markerRef.current = marker;
      mapRef.current = map;
    } catch {
      setFailed(true);
    }
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markerRef.current?.setLngLat([longitude, latitude]);
    map.easeTo({ center: [longitude, latitude], duration: 400 });
    const apply = () => {
      const src = map.getSource("radius") as maplibregl.GeoJSONSource | undefined;
      src?.setData(circleGeoJSON(latitude, longitude, FLIGHT_RADIUS_M));
      const nsrc = map.getSource("neighbors") as maplibregl.GeoJSONSource | undefined;
      nsrc?.setData(neighborsGeoJSON(latitude, longitude, FLIGHT_RADIUS_M, nearby ?? []));
    };
    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [latitude, longitude, nearby]);


  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src = map.getSource("draw") as maplibregl.GeoJSONSource | undefined;
      if (!src) return;
      const pts = drawPoints ?? [];
      const features: any[] = pts.map((p) => ({
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: p },
      }));
      if (pts.length >= 3) {
        features.push({
          type: "Feature",
          properties: {},
          geometry: { type: "Polygon", coordinates: [[...pts, pts[0]!]] },
        });
      } else if (pts.length === 2) {
        features.push({
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: pts },
        });
      }
      src.setData({ type: "FeatureCollection", features });
    };
    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [drawPoints]);

  useEffect(() => {
    const canvas = mapRef.current?.getCanvas();
    if (canvas) canvas.style.cursor = drawing ? "crosshair" : "";
  }, [drawing]);


  if (failed) {
    return (
      <div
        className={`${className} flex items-center justify-center bg-muted p-4 text-center text-sm text-muted-foreground`}
      >
        Não foi possível carregar o mapa. Verifique sua conexão e tente novamente.
      </div>
    );
  }

  return <div ref={container} className={className} />;
}
