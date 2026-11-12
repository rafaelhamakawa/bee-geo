// Detecção automática de vegetação a partir da imagem de satélite (Esri World Imagery).
// Compõe os tiles que cobrem o círculo de voo, classifica os pixels por cor e
// converte a proporção de pixels verdes em área (km² e hectares).

import polygonClipping from "polygon-clipping";
import { CIRCLE_AREA_HA, FLIGHT_RADIUS_M } from "@/lib/geoapis";

export type MultiPoly = [number, number][][][];
export type DetectedArea = { kind: "dark" | "light"; geometry: MultiPoly; area_ha: number };

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
  areas: DetectedArea[];
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

function worldXToLng(x: number, z: number) {
  return (x / (Math.pow(2, z) * TILE_SIZE)) * 360 - 180;
}
function worldYToLat(y: number, z: number) {
  const n = Math.PI - (2 * Math.PI * y) / (Math.pow(2, z) * TILE_SIZE);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

export function circleRingLngLat(lat: number, lng: number, radiusM = FLIGHT_RADIUS_M): [number, number][] {
  const pts: [number, number][] = [];
  const dx = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  const dy = radiusM / 110574;
  for (let i = 0; i < 128; i++) {
    const t = (i / 128) * 2 * Math.PI;
    pts.push([lng + dx * Math.cos(t), lat + dy * Math.sin(t)]);
  }
  pts.push(pts[0]!);
  return pts;
}

export function multiPolygonAreaHa(mp: MultiPoly): number {
  let a = 0;
  for (const poly of mp) {
    poly.forEach((ring, i) => {
      const r = polygonAreaHa(ring.slice(0, -1));
      a += i === 0 ? r : -r;
    });
  }
  return Math.max(0, a);
}

// Redimensiona a área em torno do seu centro (fator 0.2–3) e recorta ao círculo de voo.
export function scaleArea(mp: MultiPoly, factor: number, lat: number, lng: number): MultiPoly {
  let sx = 0, sy = 0, n = 0;
  for (const poly of mp) for (const [x, y] of poly[0] ?? []) { sx += x; sy += y; n++; }
  if (!n) return mp;
  const cx = sx / n, cy = sy / n;
  const scaled = mp.map((poly) => poly.map((ring) => ring.map(([x, y]) => [cx + (x - cx) * factor, cy + (y - cy) * factor] as [number, number])));
  try {
    return polygonClipping.intersection(scaled as any, [[circleRingLngLat(lat, lng)]] as any) as MultiPoly;
  } catch {
    return scaled;
  }
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

  // Agrupa pixels em células (~50 m) e une células vizinhas da mesma classe em áreas.
  const cellPx = Math.max(4, Math.round(50 / mpp));
  const gw = Math.ceil((xEnd - xStart + 1) / cellPx);
  const gh = Math.ceil((yEnd - yStart + 1) / cellPx);
  const grid = new Int8Array(gw * gh); // 0 nada, 1 escuro, 2 claro
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      let d = 0, l = 0, t = 0;
      for (let y = yStart + gy * cellPx; y < Math.min(yEnd + 1, yStart + (gy + 1) * cellPx); y++) {
        const dy = y + 0.5 - localCy;
        for (let x = xStart + gx * cellPx; x < Math.min(xEnd + 1, xStart + (gx + 1) * cellPx); x++) {
          const dx = x + 0.5 - localCx;
          if (dx * dx + dy * dy > r2) continue;
          t++;
          const i = (y * canvas.width + x) * 4;
          const k = classify(data[i]!, data[i + 1]!, data[i + 2]!);
          if (k === "dark") d++;
          else if (k === "light") l++;
        }
      }
      if (t && (d + l) / t >= 0.5) grid[gy * gw + gx] = d >= l ? 1 : 2;
    }
  }
  const seen = new Uint8Array(gw * gh);
  const circle = [[circleRingLngLat(lat, lng)]];
  const areas: DetectedArea[] = [];
  for (let start = 0; start < grid.length; start++) {
    const k = grid[start];
    if (!k || seen[start]) continue;
    const stack = [start];
    seen[start] = 1;
    const rects: [number, number][][][] = [];
    while (stack.length) {
      const c = stack.pop()!;
      const gx = c % gw, gy = Math.floor(c / gw);
      const x0 = originX + xStart + gx * cellPx, y0 = originY + yStart + gy * cellPx;
      const x1 = x0 + cellPx, y1 = y0 + cellPx;
      const a = worldXToLng(x0, zoom), b = worldXToLng(x1, zoom);
      const t = worldYToLat(y0, zoom), u = worldYToLat(y1, zoom);
      rects.push([[[a, u], [b, u], [b, t], [a, t], [a, u]]]);
      const nb = [gx > 0 ? c - 1 : -1, gx < gw - 1 ? c + 1 : -1, gy > 0 ? c - gw : -1, gy < gh - 1 ? c + gw : -1];
      for (const q of nb) if (q >= 0 && !seen[q] && grid[q] === k) { seen[q] = 1; stack.push(q); }
    }
    if (rects.length < 2) continue;
    try {
      const u = polygonClipping.union(rects[0] as any, ...(rects.slice(1) as any));
      const geom = polygonClipping.intersection(u, circle as any) as MultiPoly;
      const ha = multiPolygonAreaHa(geom);
      if (ha >= 0.5) areas.push({ kind: k === 1 ? "dark" : "light", geometry: geom, area_ha: ha });
    } catch {
      // ignora componente inválido
    }
  }
  areas.sort((p, q) => q.area_ha - p.area_ha);

  return {
    areas: areas.slice(0, 40),
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
