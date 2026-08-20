// GeoApis - Supabase Edge Function para análise MapBiomas no Google Earth Engine.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
// O pacote oficial do Earth Engine é CommonJS; o Deno faz a interoperabilidade.
// @ts-ignore Tipos do pacote oficial ainda não cobrem o runtime Deno.
import earthEngine from "npm:@google/earthengine";

const ee: any = earthEngine;
const DEFAULT_MAPBIOMAS_ASSET =
  "projects/mapbiomas-public/assets/brazil/lulc_10m/collection3/mapbiomas_10m_collection3_integration_v1";
const DEFAULT_BIOMES_ASSET = "projects/mapbiomas-workspace/AUXILIAR/biomas-2019";
const PASTURE_CLASS_IDS = [3, 4, 5, 6, 49] as const;
const CLASS_NAMES: Record<number, string> = {
  3: "Formação florestal",
  4: "Formação savânica",
  5: "Mangue",
  6: "Floresta alagável",
  49: "Restinga arborizada",
};

let earthEngineInitialization: Promise<void> | undefined;

function corsHeaders() {
  return {
    "access-control-allow-origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), "content-type": "application/json; charset=utf-8" },
  });
}

function initializeEarthEngine() {
  if (earthEngineInitialization) return earthEngineInitialization;

  earthEngineInitialization = new Promise<void>((resolve, reject) => {
    const projectId = Deno.env.get("EARTH_ENGINE_PROJECT_ID");
    const privateKeyJson = Deno.env.get("EARTH_ENGINE_PRIVATE_KEY_JSON");
    if (!projectId || !privateKeyJson) {
      reject(
        new Error(
          "Defina EARTH_ENGINE_PROJECT_ID e EARTH_ENGINE_PRIVATE_KEY_JSON nos secrets da função.",
        ),
      );
      return;
    }

    let privateKey: Record<string, unknown>;
    try {
      privateKey = JSON.parse(privateKeyJson);
    } catch {
      reject(new Error("EARTH_ENGINE_PRIVATE_KEY_JSON não contém um JSON válido."));
      return;
    }

    ee.data.authenticateViaPrivateKey(
      privateKey,
      () =>
        ee.initialize(
          null,
          null,
          () => resolve(),
          (error: unknown) => reject(normalizeError(error)),
          null,
          projectId,
        ),
      (error: unknown) => reject(normalizeError(error)),
    );
  });

  return earthEngineInitialization;
}

function evaluate<T>(value: any): Promise<T> {
  return new Promise((resolve, reject) => {
    value.evaluate((result: T, error: unknown) => {
      if (error) reject(normalizeError(error));
      else resolve(result);
    });
  });
}

function normalizeError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function categoryFromBiome(biome: string) {
  const normalized = normalizeText(biome);
  if (normalized.includes("amazon")) return "floresta-amazonica";
  if (normalized.includes("cerrado")) return "cerrado";
  if (normalized.includes("pantanal")) return "pantanal";
  if (normalized.includes("pampa")) return "pampa";
  if (normalized.includes("caatinga")) return "caatinga";
  return "mata-atlantica";
}

function readBiomeName(feature: any) {
  const properties = feature?.properties ?? {};
  const preferredProperty = Deno.env.get("BIOMES_NAME_PROPERTY") ?? "Bioma";
  const preferred = properties[preferredProperty];
  if (typeof preferred === "string" && preferred.trim()) return preferred.trim();

  const candidates = ["Bioma", "BIOMA", "bioma", "name", "NAME", "nome", "NOME"];
  for (const key of candidates) {
    const value = properties[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  const firstText = Object.values(properties).find(
    (value) => typeof value === "string" && value.trim(),
  );
  return typeof firstText === "string" ? firstText.trim() : "Mata Atlântica";
}

async function assertAuthenticated(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization) throw new Error("AUTH_REQUIRED");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) throw new Error("SUPABASE_NOT_CONFIGURED");

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { authorization } },
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("AUTH_REQUIRED");
  return data.user;
}

async function analyze(latitude: number, longitude: number, radiusMeters: number) {
  await initializeEarthEngine();

  const assetId = Deno.env.get("MAPBIOMAS_ASSET_ID") ?? DEFAULT_MAPBIOMAS_ASSET;
  const bandName = Deno.env.get("MAPBIOMAS_BAND") ?? "classification_2024";
  const biomesAssetId = Deno.env.get("BIOMES_ASSET_ID") ?? DEFAULT_BIOMES_ASSET;
  const scale = Number(Deno.env.get("MAPBIOMAS_SCALE_METERS") ?? "10");
  const minimumFragmentHa = Number(Deno.env.get("MINIMUM_FRAGMENT_HA") ?? "0.05");
  const sourceYear = Number(Deno.env.get("MAPBIOMAS_SOURCE_YEAR") ?? "2024");

  const point = ee.Geometry.Point([longitude, latitude]);
  const circle = point.buffer(radiusMeters);
  const classification = ee.Image(assetId).select(bandName).clip(circle);
  const pastureMask = classification
    .remap([...PASTURE_CLASS_IDS], PASTURE_CLASS_IDS.map(() => 1), 0)
    .eq(1);
  const pastureClasses = classification
    .updateMask(pastureMask)
    .rename("class_id")
    .toInt();

  const vectors = pastureClasses.reduceToVectors({
    geometry: circle,
    scale,
    geometryType: "polygon",
    eightConnected: true,
    labelProperty: "class_id",
    reducer: ee.Reducer.countEvery(),
    maxPixels: 2_000_000,
    tileScale: 4,
  });

  const summarizedFragments = vectors
    .map((feature: any) =>
      ee.Feature(null, {
        class_id: feature.get("class_id"),
        area_ha: feature.geometry().area(1).divide(10_000),
      }),
    )
    .filter(ee.Filter.gte("area_ha", minimumFragmentHa))
    .sort("area_ha", false)
    .limit(100);

  const biomeFeature = ee.FeatureCollection(biomesAssetId).filterBounds(point).first();
  const [fragmentInfo, biomeInfo] = await Promise.all([
    evaluate<any>(summarizedFragments),
    evaluate<any>(biomeFeature),
  ]);

  const features = Array.isArray(fragmentInfo?.features) ? fragmentInfo.features : [];
  const fragments = features.map((feature: any, index: number) => {
    const classId = Number(feature?.properties?.class_id);
    return {
      label: `Área ${index + 1} — ${CLASS_NAMES[classId] ?? "Vegetação natural"}`,
      areaHa: Number(Number(feature?.properties?.area_ha ?? 0).toFixed(4)),
      landCoverClass: CLASS_NAMES[classId] ?? `Classe MapBiomas ${classId}`,
      classId,
    };
  });

  const biome = readBiomeName(biomeInfo);
  return {
    biome,
    category: categoryFromBiome(biome),
    source: "MapBiomas Cobertura e Uso 10 m — Coleção 3",
    sourceYear,
    confidence: "média",
    methodologyVersion: "geoapis-mapbiomas-1.0",
    assetId,
    bandName,
    radiusMeters,
    minimumFragmentHa,
    fragments,
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders() });
  if (request.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

  try {
    await assertAuthenticated(request);
    const body = await request.json();
    const latitude = Number(body?.latitude);
    const longitude = Number(body?.longitude);
    const radiusMeters = Number(body?.radiusMeters ?? 1_500);

    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      return jsonResponse({ error: "Latitude inválida." }, 400);
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      return jsonResponse({ error: "Longitude inválida." }, 400);
    }
    if (!Number.isFinite(radiusMeters) || radiusMeters <= 0 || radiusMeters > 5_000) {
      return jsonResponse({ error: "Raio inválido." }, 400);
    }

    return jsonResponse(await analyze(latitude, longitude, radiusMeters));
  } catch (error) {
    const normalized = normalizeError(error);
    if (normalized.message === "AUTH_REQUIRED") {
      return jsonResponse({ error: "Faça login para executar a análise." }, 401);
    }
    console.error("GeoApis analysis error", normalized);
    return jsonResponse(
      { error: "Não foi possível consultar o MapBiomas.", details: normalized.message },
      502,
    );
  }
});
