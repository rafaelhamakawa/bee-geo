import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronRight,
  MapPin,
  Percent,
  PiggyBank,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Apiary } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { EmptyState, StatCard } from "@/components/econ-bits";
import { HoneyQuoteCard } from "@/components/honey-quote-card";
import { brl, currentMonth, monthPeriod, pct, safeDiv } from "@/lib/economics";

export const Route = createFileRoute("/financeiro")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Gestão financeira e cotação do mel — GeoApis" },
      {
        name: "description",
        content:
          "Painel financeiro do apicultor: receita, custos, lucro e margem de todos os apiários, com a cotação de referência do mel.",
      },
      { property: "og:title", content: "Gestão financeira e cotação do mel — GeoApis" },
      {
        property: "og:description",
        content:
          "Acompanhe receita, custos e lucro dos seus apiários e a cotação regional do mel no GeoApis.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FinancePage,
});

function FinancePage() {
  const { user } = useAuth();
  const [month, setMonth] = useState(currentMonth());
  const period = useMemo(() => monthPeriod(month), [month]);

  const { data: apiaries, isLoading: loadingApiaries } = useQuery({
    queryKey: ["apiaries-finance", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("apiaries")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Apiary[];
    },
  });

  const { data: totals, isLoading: loadingTotals } = useQuery({
    queryKey: ["finance-totals", user?.id, period.start, period.end],
    enabled: !!user,
    queryFn: async () => {
      const [sales, expenses] = await Promise.all([
        supabase
          .from("apiary_sales")
          .select("apiary_id, gross_amount")
          .gte("sale_date", period.start)
          .lte("sale_date", period.end),
        supabase
          .from("apiary_expenses")
          .select("apiary_id, amount")
          .gte("occurred_at", period.start)
          .lte("occurred_at", period.end),
      ]);
      if (sales.error) throw sales.error;
      if (expenses.error) throw expenses.error;
      const byApiary = new Map<string, { revenue: number; costs: number }>();
      const bump = (id: string, key: "revenue" | "costs", value: number) => {
        const row = byApiary.get(id) ?? { revenue: 0, costs: 0 };
        row[key] += value;
        byApiary.set(id, row);
      };
      let revenue = 0;
      let costs = 0;
      for (const s of sales.data ?? []) {
        const v = Number((s as { gross_amount: number }).gross_amount) || 0;
        revenue += v;
        bump((s as { apiary_id: string }).apiary_id, "revenue", v);
      }
      for (const e of expenses.data ?? []) {
        const v = Number((e as { amount: number }).amount) || 0;
        costs += v;
        bump((e as { apiary_id: string }).apiary_id, "costs", v);
      }
      return { revenue, costs, byApiary };
    },
  });

  const revenue = totals?.revenue ?? 0;
  const costs = totals?.costs ?? 0;
  const profit = revenue - costs;
  const margin = safeDiv(profit, revenue);
  const stateForQuote = apiaries?.find((a) => a.state)?.state ?? null;

  return (
    <AppShell title="Gestão financeira">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Consolidado de {period.label}</p>
        <Input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value || currentMonth())}
          aria-label="Mês de referência"
          className="h-11 w-40"
        />
      </div>

      {loadingTotals ? (
        <Skeleton className="mt-4 h-32 w-full rounded-2xl" />
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <StatCard label="Receita bruta" value={brl(revenue)} icon={<PiggyBank className="h-5 w-5" />} />
          <StatCard label="Custos" value={brl(costs)} icon={<Wallet className="h-5 w-5" />} tone="honey" />
          <StatCard label="Lucro líquido" value={brl(profit)} icon={<TrendingUp className="h-5 w-5" />} />
          <StatCard
            label="Margem líquida"
            value={margin == null ? "—" : pct(margin * 100)}
            icon={<Percent className="h-5 w-5" />}
          />
        </div>
      )}

      <div className="mt-4">
        <HoneyQuoteCard state={stateForQuote} />
      </div>

      <h2 className="mt-6 text-base font-bold text-primary">Apiários</h2>
      {loadingApiaries ? (
        <Skeleton className="mt-3 h-28 w-full rounded-2xl" />
      ) : (apiaries ?? []).length === 0 ? (
        <div className="mt-3">
          <EmptyState
            title="Nenhum apiário cadastrado"
            hint="Cadastre um apiário para começar a registrar receitas e gastos."
          />
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {(apiaries ?? []).map((a) => {
            const row = totals?.byApiary.get(a.id) ?? { revenue: 0, costs: 0 };
            const result = row.revenue - row.costs;
            return (
              <li key={a.id}>
                <Link
                  to="/apiarios/$id/economia"
                  params={{ id: a.id }}
                  className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-primary">{a.name}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {[a.city, a.state].filter(Boolean).join(" / ") || "Local não informado"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Receita {brl(row.revenue)} · Custos {brl(row.costs)}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-extrabold ${
                      result < 0 ? "text-destructive" : "text-primary"
                    }`}
                  >
                    {brl(result)}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
