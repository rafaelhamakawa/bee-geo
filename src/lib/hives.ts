// Regras do módulo de gestão de colmeias do GeoApis.

export const HIVE_PHOTO_BUCKET = "hive-photos";
export const HIVE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const HIVE_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export type Hive = {
  id: string;
  apiary_id: string;
  user_id: string;
  code: string;
  name: string | null;
  origin: string | null;
  status: string;
  introduced_at: string | null;
  queen_introduced_at: string | null;
  queen_identification: string | null;
  queen_status: string | null;
  purposes: string[] | null;
  cover_photo_path: string | null;
  last_management_at: string | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
};

export type HiveManagement = {
  id: string;
  hive_id: string;
  apiary_id: string;
  user_id: string;
  managed_at: string;
  responsible: string | null;
  management_type: string | null;
  queen_seen: boolean | null;
  queen_status: string | null;
  colony_strength: string | null;
  occupied_frames: number | null;
  brood_pattern: string | null;
  food_reserve: string | null;
  temperament: string | null;
  sanitary_status: string | null;
  feeding: string | null;
  treatment: string | null;
  notes: string | null;
  next_review_at: string | null;
  created_at?: string;
};

export const ORIGINS = [
  { value: "capture", label: "Captura" },
  { value: "division", label: "Divisão" },
  { value: "purchase", label: "Compra" },
] as const;

export const QUEEN_STATUS = [
  "Presente",
  "Não localizada",
  "Ausente",
  "Substituída",
] as const;

export const PURPOSES = [
  "Produção de mel",
  "Própolis",
  "Pólen",
  "Cera",
  "Multiplicação/enxames",
  "Produção de rainhas",
  "Polinização",
] as const;

export const MANAGEMENT_TYPES = [
  "Revisão geral",
  "Alimentação",
  "Inspeção da rainha",
  "Colheita",
  "Tratamento sanitário",
  "Divisão",
  "Outro",
] as const;

export const STRENGTHS = ["Fraca", "Regular", "Boa", "Forte"] as const;
export const BROOD_PATTERNS = ["Falho", "Irregular", "Regular", "Excelente"] as const;
export const FOOD_RESERVES = ["Baixa", "Regular", "Boa"] as const;
export const TEMPERAMENTS = ["Dócil", "Moderado", "Agressivo"] as const;
export const SANITARY = ["Sem sinais clínicos", "Em observação", "Tratamento necessário"] as const;

export function originLabel(value?: string | null) {
  return ORIGINS.find((o) => o.value === value)?.label ?? "—";
}

export type HiveAlert = {
  level: "ok" | "warn" | "urgent";
  days: number | null;
  label: string;
  border: string;
  dot: string;
  text: string;
};

const DAY = 86_400_000;

/** Dias desde o último manejo (ou desde a entrada, quando nunca houve manejo). */
export function daysSinceManagement(hive: Pick<Hive, "last_management_at" | "introduced_at">) {
  const ref = hive.last_management_at ?? hive.introduced_at;
  if (!ref) return null;
  const t = new Date(ref).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / DAY));
}

export function hiveAlert(hive: Pick<Hive, "last_management_at" | "introduced_at">): HiveAlert {
  const days = daysSinceManagement(hive);
  if (days === null || days < 14) {
    return {
      level: "ok",
      days,
      label: "Em dia",
      border: "border-primary/40",
      dot: "bg-primary",
      text: "text-primary",
    };
  }
  if (days < 28) {
    return {
      level: "warn",
      days,
      label: `${days} dias sem manejo`,
      border: "border-honey",
      dot: "bg-honey",
      text: "text-honey",
    };
  }
  return {
    level: "urgent",
    days,
    label: `${days} dias sem manejo`,
    border: "border-destructive",
    dot: "bg-destructive",
    text: "text-destructive",
  };
}

export function fmtDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

export function toDateInput(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/** Idade (em meses) desde uma data — usada para a rainha no apiário. */
export function ageInMonths(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const months = Math.max(0, Math.round((Date.now() - d.getTime()) / (DAY * 30.44)));
  return months;
}

export function ageLabel(value?: string | null) {
  const m = ageInMonths(value);
  if (m === null) return "—";
  if (m < 1) return "menos de 1 mês";
  if (m === 1) return "1 mês";
  if (m < 12) return `${m} meses`;
  const y = Math.floor(m / 12);
  const rest = m % 12;
  return rest ? `${y} ano${y > 1 ? "s" : ""} e ${rest} m` : `${y} ano${y > 1 ? "s" : ""}`;
}

export function nextHiveCode(existing: string[]) {
  let max = 0;
  for (const c of existing) {
    const m = /(\d+)\s*$/.exec(c ?? "");
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `C-${String(max + 1).padStart(2, "0")}`;
}
