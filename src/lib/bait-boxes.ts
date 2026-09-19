// Caixas isca (armadilhas de enxame) vinculadas a um apiário.

export type BaitBox = {
  id: string;
  apiary_id: string;
  user_id: string;
  code: string;
  latitude: number;
  longitude: number;
  status: string;
  photo_path: string | null;
  notes: string | null;
  installed_at: string | null;
  created_at?: string;
  updated_at?: string;
};

export const BAIT_BOX_STATUS = [
  { value: "installed", label: "Instalada" },
  { value: "occupied", label: "Ocupada" },
  { value: "collected", label: "Recolhida" },
] as const;

export function baitStatusLabel(value?: string | null) {
  return BAIT_BOX_STATUS.find((s) => s.value === value)?.label ?? "Instalada";
}

export function nextBaitCode(existing: string[]) {
  let max = 0;
  for (const c of existing) {
    const m = /(\d+)\s*$/.exec(c ?? "");
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `ISCA-${String(max + 1).padStart(2, "0")}`;
}

/** Distância aproximada em metros entre dois pontos (Haversine). */
export function distanceMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
) {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function fmtDistance(m: number) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`;
}

export function mapsDirectionsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
