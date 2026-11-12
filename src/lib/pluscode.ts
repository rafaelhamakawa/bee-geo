// Converte Plus Code do Google (código completo ou curto com localidade) em coordenadas.
import { OpenLocationCode } from "open-location-code";

const olc = new OpenLocationCode();

export type PlusCodeResult = { lat: number; lng: number };

const CODE_RE = /[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{0,3}/i;

/**
 * Interpreta um texto como Plus Code.
 * Aceita código completo ("588MC9X8+RC") ou curto com localidade ("C9X8+RC São Paulo").
 * Retorna null quando não é um Plus Code válido; lança erro quando o código curto
 * não tem localidade ou a localidade não foi encontrada.
 */
export async function parsePlusCode(input: string): Promise<PlusCodeResult | null> {
  const text = input.trim();
  if (!text) return null;

  const match = text.toUpperCase().match(CODE_RE);
  if (!match) return null;
  const code = match[0];

  if (!olc.isValid(code)) return null;

  if (olc.isFull(code)) {
    const area = olc.decode(code);
    return { lat: area.latitudeCenter, lng: area.longitudeCenter };
  }

  // Código curto: precisa de uma localidade de referência para recuperar o código completo.
  const locality = text.replace(match[0], "").replace(/[,-]/g, " ").trim();
  if (!locality) {
    throw new Error("Para código curto, informe também a cidade. Ex.: C9X8+RC São Paulo");
  }
  const r = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(locality)}`,
    { headers: { "Accept-Language": "pt-BR" } },
  );
  const results = (await r.json()) as { lat: string; lon: string }[];
  const place = results[0];
  if (!place) throw new Error(`Localidade "${locality}" não encontrada.`);

  const full = olc.recoverNearest(code, Number(place.lat), Number(place.lon));
  const area = olc.decode(full);
  return { lat: area.latitudeCenter, lng: area.longitudeCenter };
}
