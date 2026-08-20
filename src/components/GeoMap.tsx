import { MapPin, Satellite, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { FORAGING_RADIUS_METERS } from "../lib/geoapis";

type Coordinates = { latitude: number; longitude: number };

type GeoMapProps = {
  center: Coordinates;
  onLocationChange: (coordinates: Coordinates) => void;
};

let googleMapsPromise: Promise<void> | undefined;

function loadGoogleMaps(apiKey: string) {
  if (window.google?.maps) return Promise.resolve();
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-geoapis-google-maps]");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Falha ao carregar o Google Maps.")),
        {
          once: true,
        },
      );
      return;
    }

    const script = document.createElement("script");
    script.dataset["geoapisGoogleMaps"] = "true";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=geometry&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Falha ao carregar o Google Maps."));
    document.head.append(script);
  });

  return googleMapsPromise;
}

export function GeoMap({ center, onLocationChange }: GeoMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | undefined>(undefined);
  const markerRef = useRef<google.maps.Marker | undefined>(undefined);
  const circleRef = useRef<google.maps.Circle | undefined>(undefined);
  const callbackRef = useRef(onLocationChange);
  const initialCenterRef = useRef(center);
  const [error, setError] = useState<string>();
  const apiKey = import.meta.env["VITE_GOOGLE_MAPS_API_KEY"] as string | undefined;

  callbackRef.current = onLocationChange;

  useEffect(() => {
    if (!apiKey || !containerRef.current) return;
    let cancelled = false;
    let clickListener: google.maps.MapsEventListener | undefined;

    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !containerRef.current) return;
        const position = {
          lat: initialCenterRef.current.latitude,
          lng: initialCenterRef.current.longitude,
        };
        const map = new google.maps.Map(containerRef.current, {
          center: position,
          zoom: 13,
          mapTypeId: google.maps.MapTypeId.HYBRID,
          streetViewControl: false,
          fullscreenControl: false,
          mapTypeControl: true,
          clickableIcons: false,
        });
        const marker = new google.maps.Marker({
          map,
          position,
          draggable: true,
          title: "Localização do apiário",
        });
        const circle = new google.maps.Circle({
          map,
          center: position,
          radius: FORAGING_RADIUS_METERS,
          strokeColor: "#f6ad2f",
          strokeOpacity: 1,
          strokeWeight: 2,
          fillColor: "#f6ad2f",
          fillOpacity: 0.16,
        });

        mapRef.current = map;
        markerRef.current = marker;
        circleRef.current = circle;
        const bounds = circle.getBounds();
        if (bounds) map.fitBounds(bounds, 36);

        const updatePosition = (latLng: google.maps.LatLng | null) => {
          if (!latLng) return;
          const next = { latitude: latLng.lat(), longitude: latLng.lng() };
          marker.setPosition(latLng);
          circle.setCenter(latLng);
          callbackRef.current(next);
        };

        clickListener = map.addListener("click", (event: google.maps.MapMouseEvent) => {
          updatePosition(event.latLng);
        });
        marker.addListener("dragend", (event: google.maps.MapMouseEvent) => {
          updatePosition(event.latLng);
        });
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "Não foi possível carregar o mapa.");
      });

    return () => {
      cancelled = true;
      clickListener?.remove();
      markerRef.current?.setMap(null);
      circleRef.current?.setMap(null);
    };
  }, [apiKey]);

  useEffect(() => {
    const position = { lat: center.latitude, lng: center.longitude };
    markerRef.current?.setPosition(position);
    circleRef.current?.setCenter(position);
    mapRef.current?.panTo(position);
  }, [center.latitude, center.longitude]);

  if (!apiKey || error) {
    return (
      <div className="map-fallback" role="img" aria-label="Prévia do raio de 1,5 quilômetro">
        <div className="map-grid" />
        <div className="map-forest forest-one" />
        <div className="map-forest forest-two" />
        <div className="radius-ring">
          <span>1,5 km</span>
        </div>
        <MapPin className="map-pin" aria-hidden="true" />
        <div className="map-status">
          {error ? <TriangleAlert size={16} /> : <Satellite size={16} />}
          <span>
            {error ? error : "Adicione VITE_GOOGLE_MAPS_API_KEY para ativar o mapa interativo."}
          </span>
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className="map-canvas" aria-label="Mapa do apiário" />;
}
