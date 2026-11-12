import { useQuery } from "@tanstack/react-query";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/economics";
import { Skeleton } from "@/components/ui/skeleton";

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function FinanceTimelineChart({ userId, startDate }: { userId?: string | undefined; startDate?: string | null | undefined }) {
  const { data, isLoading } = useQuery({
    queryKey: ["finance-timeline", userId, startDate],
    enabled: !!userId,
    queryFn: async () => {
      const [sales, expenses] = await Promise.all([
        supabase.from("apiary_sales").select("sale_date, gross_amount"),
        supabase.from("apiary_expenses").select("occurred_at, amount"),
      ]);
      if (sales.error) throw sales.error;
      if (expenses.error) throw expenses.error;
      const map = new Map<string, { revenue: number; costs: number }>();
      const add = (d: string | null, key: "revenue" | "costs", v: number) => {
        if (!d) return;
        const k = d.slice(0, 7);
        const row = map.get(k) ?? { revenue: 0, costs: 0 };
        row[key] += v;
        map.set(k, row);
      };
      for (const s of sales.data ?? []) add(s.sale_date as string, "revenue", Number(s.gross_amount) || 0);
      for (const e of expenses.data ?? []) add(e.occurred_at as string, "costs", Number(e.amount) || 0);
      const keys = [...map.keys(), startDate?.slice(0, 7)].filter(Boolean).sort() as string[];
      const now = new Date();
      const endKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const first = keys[0] ?? endKey;
      let y = Number(first.slice(0, 4));
      let m = Number(first.slice(5, 7));
      const out: { label: string; revenue: number; costs: number }[] = [];
      for (let i = 0; i < 600; i++) {
        const k = `${y}-${String(m).padStart(2, "0")}`;
        const row = map.get(k) ?? { revenue: 0, costs: 0 };
        out.push({ label: `${MONTHS[m - 1]}/${String(y).slice(2)}`, ...row });
        if (k >= endKey) break;
        m++;
        if (m > 12) { m = 1; y++; }
      }
      return out;
    },
  });

  return (
    <section className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
      <h2 className="text-base font-bold text-primary">Evolução desde a implantação</h2>
      <p className="text-xs text-muted-foreground">Custos e valores produzidos por mês, todos os apiários</p>
      {isLoading ? (
        <Skeleton className="mt-3 h-56 w-full rounded-xl" />
      ) : (
        <div className="mt-3 h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data ?? []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} width={56} tickFormatter={(v) => `R$${Math.round(Number(v))}`} />
              <Tooltip formatter={(v: number) => brl(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="costs" name="Custos" stroke="var(--color-red-600, #dc2626)" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="revenue" name="Valores produzidos" stroke="var(--color-green-600, #16a34a)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
