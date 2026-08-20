export const FORAGING_RADIUS_KM = 1.5;
export const FORAGING_RADIUS_METERS = FORAGING_RADIUS_KM * 1_000;
export const FORAGING_CIRCLE_AREA_HA = Math.PI * FORAGING_RADIUS_KM ** 2 * 100;
export const ONE_PERCENT_AREA_HA = FORAGING_CIRCLE_AREA_HA / 100;
export const SAFETY_FACTOR = 0.85;

export const vegetationCategories = [
  {
    value: "mata-atlantica",
    label: "Mata Atlântica",
    multiplier: 1,
    biome: "Mata Atlântica",
  },
  {
    value: "floresta-amazonica",
    label: "Floresta Amazônica",
    multiplier: 1,
    biome: "Amazônia",
  },
  { value: "cerrado", label: "Cerrado", multiplier: 2, biome: "Cerrado" },
  { value: "pantanal", label: "Pantanal", multiplier: 2, biome: "Pantanal" },
  { value: "pampa", label: "Pampa", multiplier: 2, biome: "Pampa" },
  {
    value: "caatinga",
    label: "Agreste, Caatinga ou semiárido",
    multiplier: 4,
    biome: "Caatinga",
  },
  {
    value: "monocultura-florifera",
    label: "Monocultura florífera",
    multiplier: 4,
    biome: "Uso agrícola",
  },
  {
    value: "acacia-mangium",
    label: "Monocultura de Acácia Mangium",
    multiplier: 8,
    biome: "Uso agrícola",
  },
] as const;

export type VegetationCategory = (typeof vegetationCategories)[number]["value"];

export type PastureFragment = {
  id: string;
  label: string;
  areaHa: number;
  landCoverClass?: string;
};

export type Apiary = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  notes?: string;
  createdAt: string;
  latestAnalysis?: AnalysisResult;
};

export type AnalysisResult = {
  id: string;
  apiaryId: string;
  analyzedAt: string;
  biome: string;
  category: VegetationCategory;
  fragments: PastureFragment[];
  pastureAreaHa: number;
  pasturePercentage: number;
  multiplier: number;
  hivesBeforeSafety: number;
  recommendedHives: number;
  safetyFactor: number;
  source: string;
  sourceYear?: number;
  confidence?: "baixa" | "média" | "alta";
  isDemo?: boolean;
};

export function categoryDetails(category: VegetationCategory) {
  return vegetationCategories.find((item) => item.value === category) ?? vegetationCategories[0];
}

export function calculateAnalysis(input: {
  apiaryId: string;
  category: VegetationCategory;
  fragments: PastureFragment[];
  biome?: string;
  source?: string;
  sourceYear?: number;
  confidence?: AnalysisResult["confidence"];
  isDemo?: boolean;
}): AnalysisResult {
  const details = categoryDetails(input.category);
  const pastureAreaHa = clamp(
    input.fragments.reduce((total, fragment) => total + sanitizeArea(fragment.areaHa), 0),
    0,
    FORAGING_CIRCLE_AREA_HA,
  );
  const pasturePercentage = (pastureAreaHa / FORAGING_CIRCLE_AREA_HA) * 100;
  const hivesBeforeSafety = pasturePercentage * details.multiplier;

  return {
    id: crypto.randomUUID(),
    apiaryId: input.apiaryId,
    analyzedAt: new Date().toISOString(),
    biome: input.biome ?? details.biome,
    category: input.category,
    fragments: input.fragments.map((fragment) => ({
      ...fragment,
      areaHa: sanitizeArea(fragment.areaHa),
    })),
    pastureAreaHa,
    pasturePercentage,
    multiplier: details.multiplier,
    hivesBeforeSafety,
    recommendedHives: Math.floor(hivesBeforeSafety * SAFETY_FACTOR),
    safetyFactor: SAFETY_FACTOR,
    source: input.source ?? "Informado pelo usuário",
    ...(input.sourceYear !== undefined && { sourceYear: input.sourceYear }),
    ...(input.confidence !== undefined && { confidence: input.confidence }),
    ...(input.isDemo !== undefined && { isDemo: input.isDemo }),
  };
}

export function formatNumber(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: maximumFractionDigits,
    maximumFractionDigits,
  }).format(value);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function sanitizeArea(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}
