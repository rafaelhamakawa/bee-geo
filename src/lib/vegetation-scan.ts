// Detecção automática de vegetação a partir da imagem de satélite (Esri World Imagery).
// Compõe os tiles que cobrem o círculo de voo, classifica os pixels por cor e
// converte a proporção de pixels verdes em área (km² e hectares).

import { CIRCLE_AREA_HA, FLIGHT_RADIUS_M } from "@/lib/geoapis";

const TILE_URL = (z: number, x: number, y: number) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;

const TILE_SIZE = 256;

export type VegetationScan = {
  darkGreenHa: number;
  lightGreenHa: number;
  waterHa: number;
  otherHa: number;
  totalVegetationHa: number;
  vegetationPercentage: number;
  sampledPixels: number;
};

function lngToWorldX(lng: number, z: number) {
  return ((lng + 180) / 360) * Math.pow(2, z) * TILE_SIZE;
}

function latToWorldY(lat: number, z: number) {
  const s = Math.sin((lat * Math.PI) / 180);
  return (
    (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * Math.pow(2, z) * TILE_SIZE
  );
}

function metersPerPixel(lat: number, z: number) {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, z);
}

function loadTile(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("tile"));
    img.src = url;
  });
}

type Klass = "dark" | "light" | "water" | "other";

function classify(r: number, g: number, b: number): Klass {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;

  // Água: azul dominante, ou superfícies muito escuras e pouco saturadas.
  if (b >= g && b >= r - 4) return "water";
  if (lum < 28 && max - min < 18) return "water";

  const greenish = g > r + 4 && g >= b + 4;
  if (greenish) return lum < 88 ? "dark" : "light";

  // Verdes acinzentados de vegetação densa em sombra.
  if (g >= r && g > b + 8 && lum < 70) return "dark";

  return "other";
}

export async function scanVegetation(
  lat: number,
  lng: number,
  zoom = 15,
): Promise<VegetationScan> {
  if (typeof window === "undefined") throw new Error("browser only");

  const mpp = metersPerPixel(lat, zoom);
  const radiusPx = FLIGHT_RADIUS_M / mpp;
  const cx = lngToWorldX(lng, zoom);
  const cy = latToWorldY(lat, zoom);

  const minX = Math.floor((cx - radiusPx) / TILE_SIZE);
  const maxX = Math.floor((cx + radiusPx) / TILE_SIZE);
  const minY = Math.floor((cy - radiusPx) / TILE_SIZE);
  const maxY = Math.floor((cy + radiusPx) / TILE_SIZE);

  const cols = maxX - minX + 1;
  const rows = maxY - minY + 1;

  const canvas = document.createElement("canvas");
  canvas.width = cols * TILE_SIZE;
  canvas.height = rows * TILE_SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas");

  const jobs: Promise<void>[] = [];
  for (let ty = minY; ty <= maxY; ty++) {
    for (let tx = minX; tx <= maxX; tx++) {
      jobs.push(
        loadTile(TILE_URL(zoom, tx, ty)).then((img) => {
          ctx.drawImage(img, (tx - minX) * TILE_SIZE, (ty - minY) * TILE_SIZE);
        }),
      );
    }
  }
  await Promise.all(jobs);

  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const originX = minX * TILE_SIZE;
  const originY = minY * TILE_SIZE;
  const localCx = cx - originX;
  const localCy = cy - originY;
  const r2 = radiusPx * radiusPx;

  let dark = 0;
  let light = 0;
  let water = 0;
  let other = 0;

  const yStart = Math.max(0, Math.floor(localCy - radiusPx));
  const yEnd = Math.min(canvas.height - 1, Math.ceil(localCy + radiusPx));
  const xStart = Math.max(0, Math.floor(localCx - radiusPx));
  const xEnd = Math.min(canvas.width - 1, Math.ceil(localCx + radiusPx));

  for (let y = yStart; y <= yEnd; y++) {
    const dy = y + 0.5 - localCy;
    for (let x = xStart; x <= xEnd; x++) {
      const dx = x + 0.5 - localCx;
      if (dx * dx + dy * dy > r2) continue;
      const i = (y * canvas.width + x) * 4;
      const k = classify(data[i]!, data[i + 1]!, data[i + 2]!);
      if (k === "dark") dark++;
      else if (k === "light") light++;
      else if (k === "water") water++;
      else other++;
    }
  }

  const total = dark + light + water + other;
  if (total === 0) throw new Error("sem pixels");

  const haOf = (n: number) => (n / total) * CIRCLE_AREA_HA;
  const darkGreenHa = haOf(dark);
  const lightGreenHa = haOf(light);

  return {
    darkGreenHa,
    lightGreenHa,
    waterHa: haOf(water),
    otherHa: haOf(other),
    totalVegetationHa: darkGreenHa + lightGreenHa,
    vegetationPercentage: ((dark + light) / total) * 100,
    sampledPixels: total,
  };
}

export const haToKm2 = (ha: number) => ha / 100;

// Área de um polígono geodésico (fórmula esférica) em hectares.
export function polygonAreaHa(points: [number, number][]): number {
  if (points.length < 3) return 0;
  const R = 6378137;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [lng1, lat1] = points[i]!;
    const [lng2, lat2] = points[(i + 1) % points.length]!;
    sum +=
      ((lng2 - lng1) * Math.PI) / 180 *
      (2 + Math.sin((lat1 * Math.PI) / 180) + Math.sin((lat2 * Math.PI) / 180));
  }
  const area = Math.abs((sum * R * R) / 2);
  return area / 10000;
}
