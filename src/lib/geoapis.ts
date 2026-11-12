// Regras de negócio do GeoApis — cálculo de pasto apícola e capacidade de colmeias.

export const FLIGHT_RADIUS_M = 1500;
export const CIRCLE_AREA_M2 = Math.PI * FLIGHT_RADIUS_M * FLIGHT_RADIUS_M;
export const CIRCLE_AREA_HA = 706.858347;
export const ONE_PERCENT_AREA_HA = 7.06858347;
export const SAFETY_FACTOR = 0.85;

export const BIOME_MULTIPLIERS: Record<string, number> = {
  "Amazônia": 1,
  "Mata Atlântica": 1,
  "Cerrado": 2,
  "Pantanal": 2,
  "Pampa": 2,
  "Caatinga": 4,
  "Agreste": 4,
  "Semiárido": 4,
};

export const BIOMES = Object.keys(BIOME_MULTIPLIERS);

// Monoculturas floríferas: exigem confirmação manual do usuário.
export const SPECIAL_MULTIPLIERS: Record<string, number> = {
  "Eucalipto confirmado": 4,
  "Girassol confirmado": 4,
  "Canola confirmada": 4,
  "Outra monocultura florífera confirmada": 4,
  "Acacia mangium confirmada": 8,
};

export const VEGETATION_TYPES = [
  "Vegetação nativa",
  "Formação florestal",
  "Formação savânica",
  "Formação campestre",
  "Silvicultura",
  ...Object.keys(SPECIAL_MULTIPLIERS),
];

export function biomeMultiplier(biome: string | null | undefined): number {
  if (!biome) return 1;
  return BIOME_MULTIPLIERS[biome] ?? 1;
}

export type PatchInput = {
  patch_number: number;
  name?: string | null;
  land_cover_type?: string | null;
  vegetation_type?: string | null;
  area_ha: number;
  hive_multiplier: number;
  is_approved?: boolean;
};

export type PatchComputed = PatchInput & {
  percentage: number;
  gross_hives: number;
};

export type AnalysisTotals = {
  patches: PatchComputed[];
  total_forage_area_ha: number;
  total_forage_percentage: number;
  total_gross_hives: number;
  safe_hives_decimal: number;
  safe_hives: number;
  available_capacity: number;
};

export function computeAnalysis(patches: PatchInput[], currentHives: number): AnalysisTotals {
  const approved = patches.filter((p) => p.is_approved !== false);

  const computed: PatchComputed[] = patches.map((p) => {
    const percentage = (p.area_ha || 0) / ONE_PERCENT_AREA_HA;
    return {
      ...p,
      percentage,
      gross_hives: percentage * (p.hive_multiplier || 0),
    };
  });

  const total_forage_area_ha = approved.reduce((s, p) => s + (p.area_ha || 0), 0);
  const rawPercentage = total_forage_area_ha / ONE_PERCENT_AREA_HA;
  const total_forage_percentage = Math.min(100, Math.max(0, rawPercentage));
  const total_gross_hives = computed
    .filter((p) => p.is_approved !== false)
    .reduce((s, p) => s + p.gross_hives, 0);
  const safe_hives_decimal = total_gross_hives * SAFETY_FACTOR;
  const safe_hives = Math.floor(safe_hives_decimal);
  const available_capacity = Math.max(0, safe_hives - (currentHives || 0));

  return {
    patches: computed,
    total_forage_area_ha,
    total_forage_percentage,
    total_gross_hives,
    safe_hives_decimal,
    safe_hives,
    available_capacity,
  };
}

export const fmtHa = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtPct = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";

export function formatCoord(lat: number, lng: number): string {
  const dms = (value: number, pos: string, neg: string) => {
    const dir = value >= 0 ? pos : neg;
    const abs = Math.abs(value);
    const d = Math.floor(abs);
    const mFloat = (abs - d) * 60;
    const m = Math.floor(mFloat);
    const s = ((mFloat - m) * 60).toFixed(1).replace(".", ",");
    return `${d}°${String(m).padStart(2, "0")}'${s}" ${dir}`;
  };
  return `${dms(lat, "N", "S")} · ${dms(lng, "L", "O")}`;
}

export const TECHNICAL_DISCLAIMER =
  "Esta análise apresenta uma estimativa potencial de cobertura vegetal e capacidade de suporte apícola. A disponibilidade real de néctar e pólen varia conforme as espécies vegetais, floração, clima, estação do ano, defensivos agrícolas, queimadas e competição com outros apiários. Recomenda-se validar os resultados por meio de levantamento de campo.";

export const LIABILITY_DISCLAIMER =
  "O GeoApis não assume responsabilidade pela veracidade dos dados apresentados. Este é apenas um estudo preliminar. Para ter certeza, consulte um zootecnista, médico veterinário, engenheiro agrônomo ou engenheiro florestal.";
