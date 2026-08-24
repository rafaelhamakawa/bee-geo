// GeoApis — regras da gestão econômica do apiário.
// Todos os cálculos são por apiário; nunca agregue apiários diferentes.

export type ProductType = "honey" | "propolis" | "pollen" | "wax";

export const PRODUCTS: { value: ProductType; label: string; color: string }[] = [
  { value: "honey", label: "Mel", color: "bg-primary" },
  { value: "propolis", label: "Própolis", color: "bg-orange-500" },
  { value: "pollen", label: "Pólen", color: "bg-purple-500" },
  { value: "wax", label: "Cera", color: "bg-honey" },
];

export function productLabel(v?: string | null) {
  return PRODUCTS.find((p) => p.value === v)?.label ?? "—";
}

export const EXPENSE_CATEGORIES = [
  "Alimentação",
  "Sanidade e medicamentos",
  "Rainhas e material biológico",
  "Mão de obra",
  "Transporte e combustível",
  "Embalagens",
  "Equipamentos",
  "Manutenção",
  "Extração e beneficiamento",
  "Análises laboratoriais",
  "Taxas e impostos",
  "Energia e água",
  "Aluguel",
  "Outros",
] as const;

export const COST_TYPES = [
  { value: "variable", label: "Variável" },
  { value: "fixed", label: "Fixo" },
] as const;

export const SALES_CHANNELS = [
  "Venda direta",
  "Feira",
  "Cooperativa",
  "Atacado",
  "Varejo/mercado",
  "Entreposto",
  "Online",
  "Outro",
] as const;

export const PAYMENT_METHODS = [
  "Dinheiro",
  "Pix",
  "Cartão",
  "Transferência",
  "Boleto",
  "Outro",
] as const;

export type ProductionRecord = {
  id: string;
  user_id: string;
  apiary_id: string;
  hive_id: string;
  product_type: ProductType;
  quantity_kg: number;
  produced_at: string;
  lot_number: string | null;
  notes: string | null;
};

export type Sale = {
  id: string;
  user_id: string;
  apiary_id: string;
  hive_id: string | null;
  product_type: ProductType;
  sale_date: string;
  quantity_kg: number;
  unit_price: number;
  gross_amount: number;
  buyer: string | null;
  sales_channel: string | null;
  lot_number: string | null;
  notes: string | null;
};

export type Expense = {
  id: string;
  user_id: string;
  apiary_id: string;
  occurred_at: string;
  category: string;
  cost_type: "fixed" | "variable";
  description: string | null;
  amount: number;
  supplier: string | null;
  payment_method: string | null;
  is_recurring: boolean;
  notes: string | null;
};

export type HoneyQuote = {
  id: string;
  region: string | null;
  state: string | null;
  honey_type: string | null;
  price_min: number | null;
  price_avg: number | null;
  price_max: number | null;
  unit: string | null;
  reference_date: string | null;
  source_name: string | null;
  source_url: string | null;
  fetched_at: string | null;
  status: string | null;
  error_message: string | null;
};

/* ---------- formatação brasileira ---------- */

export function brl(value: number | null | undefined) {
  const n = Number(value ?? 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
}

export function num(value: number | null | undefined, digits = 1) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

export function pct(value: number | null | undefined, digits = 1) {
  return `${num(value, digits)}%`;
}

export function dateBR(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

export function dateTimeBR(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/* ---------- período ---------- */

export type Period = { start: string; end: string; label: string };

/** Período mensal a partir de "YYYY-MM". */
export function monthPeriod(month: string): Period {
  const [y, m] = month.split("-").map(Number);
  const year = y ?? new Date().getFullYear();
  const mon = m ?? new Date().getMonth() + 1;
  const start = new Date(Date.UTC(year, mon - 1, 1));
  const end = new Date(Date.UTC(year, mon, 0));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    label: start.toLocaleDateString("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" }),
  };
}

export function yearPeriod(year: number): Period {
  return { start: `${year}-01-01`, end: `${year}-12-31`, label: String(year) };
}

export function previousMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/* ---------- indicadores ---------- */

/** Divisão segura: retorna null quando não há denominador válido. */
export function safeDiv(a: number, b: number): number | null {
  if (!b || !Number.isFinite(b) || b === 0) return null;
  const r = a / b;
  return Number.isFinite(r) ? r : null;
}

export function sumBy<T>(rows: T[], pick: (row: T) => number) {
  return rows.reduce((acc, row) => acc + (Number(pick(row)) || 0), 0);
}

export type Summary = {
  revenue: number;
  costs: number;
  fixedCosts: number;
  variableCosts: number;
  profit: number;
  margin: number | null;
  roi: number | null;
  honeyProduced: number;
  honeySold: number;
  honeyRevenue: number;
  activeHives: number;
  productiveHives: number;
  revenuePerHive: number | null;
  costPerHive: number | null;
  productivity: number | null;
  costPerKg: number | null;
  avgSoldPrice: number | null;
  contributionMargin: number;
  breakEvenKg: number | null;
  stockKg: number;
  stockValue: number | null;
  revenueByProduct: Record<ProductType, number>;
  producedByProduct: Record<ProductType, number>;
  soldByProduct: Record<ProductType, number>;
  expensesByCategory: { category: string; amount: number }[];
};

const ZERO_BY_PRODUCT = (): Record<ProductType, number> => ({
  honey: 0,
  propolis: 0,
  pollen: 0,
  wax: 0,
});

export function computeSummary(input: {
  sales: Sale[];
  expenses: Expense[];
  production: ProductionRecord[];
  activeHives: number;
  /** Produção acumulada total (todos os períodos) para estoque. */
  allProduction?: ProductionRecord[];
  allSales?: Sale[];
  /** Preço de referência por kg (FIPMEL) para valor estimado do estoque. */
  referencePricePerKg?: number | null;
}): Summary {
  const { sales, expenses, production, activeHives } = input;

  const revenueByProduct = ZERO_BY_PRODUCT();
  const soldByProduct = ZERO_BY_PRODUCT();
  for (const s of sales) {
    const amount = Number(s.gross_amount) || 0;
    revenueByProduct[s.product_type] = (revenueByProduct[s.product_type] ?? 0) + amount;
    soldByProduct[s.product_type] = (soldByProduct[s.product_type] ?? 0) + (Number(s.quantity_kg) || 0);
  }

  const producedByProduct = ZERO_BY_PRODUCT();
  const productiveSet = new Set<string>();
  for (const p of production) {
    producedByProduct[p.product_type] =
      (producedByProduct[p.product_type] ?? 0) + (Number(p.quantity_kg) || 0);
    if ((Number(p.quantity_kg) || 0) > 0) productiveSet.add(p.hive_id);
  }

  const revenue = sumBy(sales, (s) => s.gross_amount);
  const costs = sumBy(expenses, (e) => e.amount);
  const fixedCosts = sumBy(
    expenses.filter((e) => e.cost_type === "fixed"),
    (e) => e.amount,
  );
  const variableCosts = costs - fixedCosts;
  const profit = revenue - costs;

  const honeyProduced = producedByProduct.honey;
  const honeySold = soldByProduct.honey;
  const honeyRevenue = revenueByProduct.honey;

  const avgSoldPrice = safeDiv(honeyRevenue, honeySold);
  const variableCostPerKg = safeDiv(variableCosts, honeyProduced);
  const contributionDen =
    avgSoldPrice !== null ? avgSoldPrice - (variableCostPerKg ?? 0) : null;
  const breakEvenKg =
    contributionDen !== null && contributionDen > 0 ? fixedCosts / contributionDen : null;

  const allProduction = input.allProduction ?? production;
  const allSales = input.allSales ?? sales;
  const stockKg = Math.max(
    0,
    sumBy(allProduction, (p) => p.quantity_kg) - sumBy(allSales, (s) => s.quantity_kg),
  );
  const ref = input.referencePricePerKg ?? null;
  const stockValue = ref !== null ? stockKg * ref : null;

  const byCategory = new Map<string, number>();
  for (const e of expenses) {
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + (Number(e.amount) || 0));
  }

  return {
    revenue,
    costs,
    fixedCosts,
    variableCosts,
    profit,
    margin: safeDiv(profit, revenue) === null ? null : (profit / revenue) * 100,
    roi: safeDiv(profit, costs) === null ? null : (profit / costs) * 100,
    honeyProduced,
    honeySold,
    honeyRevenue,
    activeHives,
    productiveHives: productiveSet.size,
    revenuePerHive: safeDiv(revenue, activeHives),
    costPerHive: safeDiv(costs, activeHives),
    productivity: safeDiv(honeyProduced, productiveSet.size),
    costPerKg: safeDiv(costs, honeyProduced),
    avgSoldPrice,
    contributionMargin: revenue - variableCosts,
    breakEvenKg,
    stockKg,
    stockValue,
    revenueByProduct,
    producedByProduct,
    soldByProduct,
    expensesByCategory: [...byCategory.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
  };
}

/** Variação percentual em relação ao período anterior. */
export function variation(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

/* ---------- regiões / FIPMEL ---------- */

export const STATE_REGION: Record<string, string> = {
  AC: "Norte", AP: "Norte", AM: "Norte", PA: "Norte", RO: "Norte", RR: "Norte", TO: "Norte",
  AL: "Nordeste", BA: "Nordeste", CE: "Nordeste", MA: "Nordeste", PB: "Nordeste",
  PE: "Nordeste", PI: "Nordeste", RN: "Nordeste", SE: "Nordeste",
  DF: "Centro-Oeste", GO: "Centro-Oeste", MT: "Centro-Oeste", MS: "Centro-Oeste",
  ES: "Sudeste", MG: "Sudeste", RJ: "Sudeste", SP: "Sudeste",
  PR: "Sul", RS: "Sul", SC: "Sul",
};

export const BR_STATES = Object.keys(STATE_REGION).sort();

export function regionOf(state?: string | null) {
  if (!state) return null;
  return STATE_REGION[state.trim().toUpperCase()] ?? null;
}

export const FIPMEL_URL = "https://mel.com.br/fipmel/";
export const FIPMEL_SOURCE = "Índice FIPMEL";

/** Cotação é considerada desatualizada após 30 dias da data de referência. */
export function quoteFreshness(quote: HoneyQuote | null | undefined) {
  if (!quote || quote.price_avg == null) return "unavailable" as const;
  const ref = quote.reference_date ?? quote.fetched_at;
  if (!ref) return "stale" as const;
  const t = new Date(ref.length === 10 ? `${ref}T12:00:00` : ref).getTime();
  if (Number.isNaN(t)) return "stale" as const;
  const days = (Date.now() - t) / 86_400_000;
  return days <= 30 ? ("fresh" as const) : ("stale" as const);
}
