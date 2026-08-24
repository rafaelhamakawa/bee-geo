// Consultas Supabase da gestão econômica — sempre filtradas por apiário.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Expense, HoneyQuote, Period, ProductionRecord, Sale } from "@/lib/economics";
import { regionOf } from "@/lib/economics";

export function useApiaryEconomics(apiaryId: string, period: Period) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["economics", apiaryId, user?.id, period.start, period.end],
    enabled: !!user && !!apiaryId,
    queryFn: async () => {
      const [sales, expenses, production, allSales, allProduction] = await Promise.all([
        supabase
          .from("apiary_sales")
          .select("*")
          .eq("apiary_id", apiaryId)
          .gte("sale_date", period.start)
          .lte("sale_date", period.end)
          .order("sale_date", { ascending: false }),
        supabase
          .from("apiary_expenses")
          .select("*")
          .eq("apiary_id", apiaryId)
          .gte("occurred_at", period.start)
          .lte("occurred_at", period.end)
          .order("occurred_at", { ascending: false }),
        supabase
          .from("hive_production_records")
          .select("*")
          .eq("apiary_id", apiaryId)
          .gte("produced_at", period.start)
          .lte("produced_at", period.end)
          .order("produced_at", { ascending: false }),
        supabase.from("apiary_sales").select("*").eq("apiary_id", apiaryId),
        supabase.from("hive_production_records").select("*").eq("apiary_id", apiaryId),
      ]);
      for (const r of [sales, expenses, production, allSales, allProduction]) {
        if (r.error) throw r.error;
      }
      return {
        sales: (sales.data ?? []) as Sale[],
        expenses: (expenses.data ?? []) as Expense[],
        production: (production.data ?? []) as ProductionRecord[],
        allSales: (allSales.data ?? []) as Sale[],
        allProduction: (allProduction.data ?? []) as ProductionRecord[],
      };
    },
  });
}

/** Totais do período anterior (para comparação). */
export function usePreviousTotals(apiaryId: string, period: Period) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["economics-prev", apiaryId, user?.id, period.start, period.end],
    enabled: !!user && !!apiaryId,
    queryFn: async () => {
      const [sales, expenses, production] = await Promise.all([
        supabase
          .from("apiary_sales")
          .select("gross_amount")
          .eq("apiary_id", apiaryId)
          .gte("sale_date", period.start)
          .lte("sale_date", period.end),
        supabase
          .from("apiary_expenses")
          .select("amount")
          .eq("apiary_id", apiaryId)
          .gte("occurred_at", period.start)
          .lte("occurred_at", period.end),
        supabase
          .from("hive_production_records")
          .select("quantity_kg, product_type")
          .eq("apiary_id", apiaryId)
          .gte("produced_at", period.start)
          .lte("produced_at", period.end),
      ]);
      if (sales.error) throw sales.error;
      if (expenses.error) throw expenses.error;
      if (production.error) throw production.error;
      const sum = (rows: Record<string, unknown>[], key: string) =>
        rows.reduce((a, r) => a + (Number(r[key]) || 0), 0);
      return {
        revenue: sum(sales.data ?? [], "gross_amount"),
        costs: sum(expenses.data ?? [], "amount"),
        honeyKg: (production.data ?? [])
          .filter((r) => (r as { product_type: string }).product_type === "honey")
          .reduce((a, r) => a + (Number((r as { quantity_kg: number }).quantity_kg) || 0), 0),
      };
    },
  });
}

/** Cotação em cache: preferência para a UF do apiário, depois a região. */
export function useHoneyQuote(state?: string | null) {
  const region = regionOf(state);
  return useQuery({
    queryKey: ["honey-quote", state ?? null, region],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("honey_price_quotes")
        .select("*")
        .order("reference_date", { ascending: false, nullsFirst: false })
        .order("fetched_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const rows = (data ?? []) as HoneyQuote[];
      const valid = rows.filter((r) => r.price_avg != null);
      const byState = state
        ? valid.find((r) => (r.state ?? "").toUpperCase() === state.toUpperCase())
        : undefined;
      const byRegion = region ? valid.find((r) => r.region === region) : undefined;
      const lastError = rows.find((r) => r.status === "error") ?? null;
      return { quote: byState ?? byRegion ?? null, lastError, region };
    },
  });
}
