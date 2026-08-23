import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { FLIGHT_RADIUS_M } from "@/lib/geoapis";

function circleGeoJSON(lat: number, lng: number, radiusM: number) {
  const points = 96;
  const coords: [number, number][] = [];
  const distX = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  const distY = radiusM / 110574;
  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    coords.push([lng + distX * Math.cos(theta), lat + distY * Math.sin(theta)]);
  }
  coords.push(coords[0]!);
  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "Polygon" as const, coordinates: [coords] },
  };
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
}: {
  latitude: number;
  longitude: number;
  draggable?: boolean;
  onMove?: (lat: number, lng: number) => void;
  showCircle?: boolean;
  className?: string;
}) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
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
      map.on("load", () => {
        if (showCircle) {
          map.addSource("radius", {
            type: "geojson",
            data: circleGeoJSON(latitude, longitude, FLIGHT_RADIUS_M),
          });
          map.addLayer({
            id: "radius-fill",
            type: "fill",
            source: "radius",
            paint: { "fill-color": "#F5A000", "fill-opacity": 0.15 },
          });
          map.addLayer({
            id: "radius-line",
            type: "line",
            source: "radius",
            paint: { "line-color": "#F5A000", "line-width": 2 },
          });
        }
      });

      const marker = new maplibregl.Marker({ color: "#0B6337", draggable })
        .setLngLat([longitude, latitude])
        .addTo(map);
      if (draggable) {
        marker.on("dragend", () => {
          const { lat, lng } = marker.getLngLat();
          onMove?.(lat, lng);
        });
        map.on("click", (e: maplibregl.MapMouseEvent) => {
          marker.setLngLat(e.lngLat);
          onMove?.(e.lngLat.lat, e.lngLat.lng);
        });
      }
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
    const src = map.getSource("radius") as maplibregl.GeoJSONSource | undefined;
    src?.setData(circleGeoJSON(latitude, longitude, FLIGHT_RADIUS_M));
  }, [latitude, longitude]);

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
