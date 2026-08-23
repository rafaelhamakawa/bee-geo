export type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  business_name: string | null;
  created_at?: string;
  updated_at?: string;
};

export type Apiary = {
  id: string;
  user_id: string;
  name: string;
  code: string | null;
  property_name: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  biome: string | null;
  predominant_vegetation: string | null;
  current_hives: number;
  status: string;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ForageAnalysis = {
  id: string;
  user_id: string;
  apiary_id: string;
  analysis_mode: string;
  status: string;
  biome: string | null;
  dataset_name: string | null;
  dataset_version: string | null;
  dataset_year: number | null;
  circle_area_ha: number;
  forage_area_ha: number;
  forage_percentage: number;
  gross_hive_capacity: number;
  safety_factor: number;
  safe_hive_capacity: number;
  confidence_level: number | null;
  warnings: unknown;
  technical_notes: string | null;
  analyzed_at: string;
  created_at?: string;
};

export type ForagePatch = {
  id: string;
  user_id: string;
  analysis_id: string;
  patch_number: number;
  name: string | null;
  land_cover_type: string | null;
  vegetation_type: string | null;
  area_ha: number;
  percentage: number;
  hive_multiplier: number;
  gross_hives: number;
  confidence: number | null;
  is_approved: boolean;
  source: string | null;
  notes: string | null;
  geojson: unknown;
};
