import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useHives } from "@/components/hives-tab";
import {
  Banknote,
  BarChart3,
  Coins,
  MapPin,
  Percent,
  PiggyBank,
  Plus,
  Scale,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Apiary } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarList, ColumnChart, EmptyState, StatCard } from "@/components/econ-bits";
import { HoneyQuoteCard } from "@/components/honey-quote-card";
import { useApiaryEconomics, useHoneyQuote, usePreviousTotals } from "@/lib/economics-data";
import {
  COST_TYPES,
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  PRODUCTS,
  SALES_CHANNELS,
  brl,
  computeSummary,
  currentMonth,
  dateBR,
  monthPeriod,
  num,
  pct,
  previousMonth,
  productLabel,
  variation,
  type Expense,
  type ProductType,
  type ProductionRecord,
  type Sale,
} from "@/lib/economics";

export const Route = createFileRoute("/apiarios/$id/economia")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Gestão econômica do apiário — GeoApis" },
      {
        name: "description",
        content:
          "Receitas, gastos, produção e indicadores financeiros por apiário, com cotação de referência do mel.",
      },
      { property: "og:title", content: "Gestão econômica do apiário — GeoApis" },
      {
        property: "og:description",
        content: "Controle receitas, custos, produção e margem de cada apiário no GeoApis.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EconomyPage,
});

const fmtKg = (v: number) => `${num(v, 1)} kg`;

function EconomyPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [month, setMonth] = useState(currentMonth());

  const period = useMemo(() => monthPeriod(month), [month]);
  const prevPeriod = useMemo(() => monthPeriod(previousMonth(month)), [month]);

  const { data: apiary, isLoading: loadingApiary } = useQuery({
    queryKey: ["apiary", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("apiaries")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as Apiary | null;
    },
  });

  const { data: hives } = useHives(id);
  const { data, isLoading, isError, refetch } = useApiaryEconomics(id, period);
  const { data: prev } = usePreviousTotals(id, prevPeriod);
  const { data: quoteData } = useHoneyQuote(apiary?.state);

  const activeHives = (hives ?? []).filter((h) => h.status === "active").length;

  const summary = useMemo(
    () =>
      computeSummary({
        sales: data?.sales ?? [],
        expenses: data?.expenses ?? [],
        production: data?.production ?? [],
        allSales: data?.allSales ?? [],
        allProduction: data?.allProduction ?? [],
        activeHives,
        referencePricePerKg: quoteData?.quote?.price_avg ?? null,
      }),
    [data, activeHives, quoteData],
  );

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["economics"] });
    qc.invalidateQueries({ queryKey: ["economics-prev"] });
  }

  const removeRow = useMutation({
    mutationFn: async ({ table, rowId }: { table: string; rowId: string }) => {
      const { error } = await supabase.from(table as "apiary_sales").delete().eq("id", rowId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro excluído.");
      invalidate();
    },
    onError: () => toast.error("Não foi possível excluir o registro."),
  });

  if (loadingApiary) {
    return (
      <AppShell back="/apiarios">
        <Skeleton className="h-40 w-full rounded-2xl" />
      </AppShell>
    );
  }
  if (!apiary) {
    return (
      <AppShell back="/apiarios">
        <EmptyState title="Apiário não encontrado ou indisponível." />
      </AppShell>
    );
  }

  const revenueVar = prev ? variation(summary.revenue, prev.revenue) : null;
  const costVar = prev ? variation(summary.costs, prev.costs) : null;
  const honeyVar = prev ? variation(summary.producedByProduct.honey, prev.honeyKg) : null;

  return (
    <AppShell back={`/apiarios/${id}`}>
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-extrabold text-primary">{apiary.name}</h1>
        <p className="truncate text-xs text-muted-foreground">
          <MapPin className="mr-1 inline h-3 w-3" />
          {[apiary.city, apiary.state].filter(Boolean).join(" / ") || "Sem localização"}
        </p>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold text-primary">Gestão econômica</h2>
        <div className="flex items-center gap-2">
          <Label htmlFor="periodo" className="sr-only">
            Período
          </Label>
          <Input
            id="periodo"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value || currentMonth())}
            className="h-10 w-40"
          />
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Período: {dateBR(period.start)} a {dateBR(period.end)}
      </p>

      {isError ? (
        <div className="mt-4 rounded-2xl border border-destructive/40 bg-card p-4 text-sm">
          <p className="font-medium text-destructive">Não foi possível carregar os dados.</p>
          <Button variant="outline" className="mt-2" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : null}

      <Tabs defaultValue="resumo" className="mt-4">
        <TabsList className="w-full">
          <TabsTrigger value="resumo" className="flex-1">
            Resumo
          </TabsTrigger>
          <TabsTrigger value="producao" className="flex-1">
            Produção
          </TabsTrigger>
          <TabsTrigger value="receitas" className="flex-1">
            Receitas
          </TabsTrigger>
          <TabsTrigger value="gastos" className="flex-1">
            Gastos
          </TabsTrigger>
        </TabsList>

        {/* ---------------- RESUMO ---------------- */}
        <TabsContent value="resumo" className="space-y-4">
          {isLoading ? (
            <Skeleton className="h-48 w-full rounded-2xl" />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  icon={<PiggyBank className="h-5 w-5" />}
                  label="Receita bruta"
                  value={brl(summary.revenue)}
                  hint={revenueVar !== null ? `${pct(revenueVar)} vs. mês anterior` : undefined}
                />
                <StatCard
                  icon={<Wallet className="h-5 w-5" />}
                  label="Custos"
                  value={brl(summary.costs)}
                  tone="honey"
                  hint={costVar !== null ? `${pct(costVar)} vs. mês anterior` : undefined}
                />
                <StatCard
                  icon={<TrendingUp className="h-5 w-5" />}
                  label="Lucro líquido"
                  value={brl(summary.profit)}
                />
                <StatCard
                  icon={<Percent className="h-5 w-5" />}
                  label="Margem líquida"
                  value={summary.margin === null ? "—" : pct(summary.margin)}
                />
                <StatCard
                  icon={<BarChart3 className="h-5 w-5" />}
                  label="ROI"
                  value={summary.roi === null ? "—" : pct(summary.roi)}
                />
                <StatCard
                  icon={<Scale className="h-5 w-5" />}
                  label="Produção de mel"
                  value={fmtKg(summary.producedByProduct.honey)}
                  hint={honeyVar !== null ? `${pct(honeyVar)} vs. mês anterior` : undefined}
                />
              </div>

              <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
                <h3 className="text-sm font-bold text-primary">Indicadores por colmeia</h3>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <Metric label="Colmeias ativas" value={num(summary.activeHives, 0)} />
                  <Metric label="Colmeias produtivas" value={num(summary.productiveHives, 0)} />
                  <Metric
                    label="Receita/colmeia"
                    value={summary.revenuePerHive === null ? "—" : brl(summary.revenuePerHive)}
                  />
                  <Metric
                    label="Custo/colmeia"
                    value={summary.costPerHive === null ? "—" : brl(summary.costPerHive)}
                  />
                  <Metric
                    label="Produtividade"
                    value={summary.productivity === null ? "—" : `${num(summary.productivity, 2)} kg`}
                  />
                  <Metric
                    label="Custo/kg de mel"
                    value={summary.costPerKg === null ? "—" : brl(summary.costPerKg)}
                  />
                  <Metric
                    label="Preço médio vendido"
                    value={summary.avgSoldPrice === null ? "—" : `${brl(summary.avgSoldPrice)}/kg`}
                  />
                  <Metric
                    label="Ponto de equilíbrio"
                    value={summary.breakEvenKg === null ? "—" : `${num(summary.breakEvenKg, 0)} kg`}
                  />
                  <Metric label="Margem de contribuição" value={brl(summary.contributionMargin)} />
                  <Metric
                    label="Estoque estimado"
                    value={
                      summary.stockValue === null
                        ? `${fmtKg(summary.stockKg)} · sem cotação`
                        : `${brl(summary.stockValue)}`
                    }
                    hint={`${fmtKg(summary.stockKg)} em estoque`}
                  />
                </dl>
              </div>

              <HoneyQuoteCard state={apiary.state} />

              <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
                <h3 className="text-sm font-bold text-primary">Receita por produto</h3>
                <div className="mt-3">
                  <BarList
                    items={PRODUCTS.map((p) => ({
                      label: p.label,
                      value: summary.revenueByProduct[p.value],
                      color: p.color,
                    }))}
                    format={brl}
                    emptyLabel="Sem vendas registradas no período."
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
                <h3 className="text-sm font-bold text-primary">Receita x gastos</h3>
                <div className="mt-3">
                  <ColumnChart
                    data={[
                      {
                        label: prevPeriod.label,
                        series: [
                          { name: "Receita", value: prev?.revenue ?? 0, color: "bg-primary" },
                          { name: "Gastos", value: prev?.costs ?? 0, color: "bg-honey" },
                        ],
                      },
                      {
                        label: period.label,
                        series: [
                          { name: "Receita", value: summary.revenue, color: "bg-primary" },
                          { name: "Gastos", value: summary.costs, color: "bg-honey" },
                        ],
                      },
                    ]}
                    format={brl}
                  />
                </div>
              </div>
            </>
          )}
        </TabsContent>

        {/* ---------------- PRODUÇÃO ---------------- */}
        <TabsContent value="producao" className="space-y-4">
          <ProductionDialog apiaryId={id} hives={hives ?? []} onSaved={invalidate} />
          {isLoading ? (
            <Skeleton className="h-40 w-full rounded-2xl" />
          ) : (
            <>
              <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
                <h3 className="text-sm font-bold text-primary">Produção do apiário</h3>
                <p className="text-xs text-muted-foreground">
                  Somatório automático dos registros das colmeias ({num(activeHives, 0)} ativas).
                  Para corrigir um total, edite o registro da colmeia de origem.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {PRODUCTS.map((p) => (
                    <div key={p.value} className="rounded-xl border border-border/60 p-3">
                      <p className="text-xs text-muted-foreground">{p.label}</p>
                      <p className="text-lg font-extrabold text-primary">
                        {fmtKg(summary.producedByProduct[p.value])}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Vendido {fmtKg(summary.soldByProduct[p.value])}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Estoque disponível (acumulado): {fmtKg(summary.stockKg)}
                </p>
              </div>

              <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
                <h3 className="text-sm font-bold text-primary">Produção por colmeia</h3>
                <div className="mt-3">
                  <BarList
                    items={byHive(data?.production ?? [], hives ?? [])}
                    format={fmtKg}
                    emptyLabel="Sem produção registrada no período."
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
                <h3 className="text-sm font-bold text-primary">Produção mensal por produto</h3>
                <p className="text-xs text-muted-foreground">
                  {prevPeriod.label} vs. {period.label}
                </p>
                <div className="mt-3">
                  <ColumnChart
                    data={[
                      {
                        label: prevPeriod.label,
                        series: [{ name: "Mel", value: prev?.honeyKg ?? 0, color: "bg-primary" }],
                      },
                      {
                        label: period.label,
                        series: PRODUCTS.map((p) => ({
                          name: p.label,
                          value: summary.producedByProduct[p.value],
                          color: p.color,
                        })),
                      },
                    ]}
                    format={fmtKg}
                  />
                </div>
              </div>

              {(data?.production ?? []).length === 0 ? (
                <EmptyState
                  title="Sem produção registrada"
                  hint="Registre a colheita de cada colmeia para alimentar os indicadores."
                />
              ) : (
                <ul className="space-y-2">
                  {(data?.production ?? []).map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-primary">
                          {productLabel(p.product_type)} · {fmtKg(Number(p.quantity_kg))}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {dateBR(p.produced_at)} · Colmeia{" "}
                          {(hives ?? []).find((h) => h.id === p.hive_id)?.code ?? "—"}
                          {p.lot_number ? ` · Lote ${p.lot_number}` : ""}
                        </p>
                      </div>
                      <DeleteButton
                        onConfirm={() =>
                          removeRow.mutate({ table: "hive_production_records", rowId: p.id })
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </TabsContent>

        {/* ---------------- RECEITAS ---------------- */}
        <TabsContent value="receitas" className="space-y-4">
          <SaleDialog apiaryId={id} hives={hives ?? []} onSaved={invalidate} />
          {isLoading ? (
            <Skeleton className="h-40 w-full rounded-2xl" />
          ) : (
            <>
              <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
                <h3 className="text-sm font-bold text-primary">Receita por produto</h3>
                <div className="mt-3">
                  <BarList
                    items={PRODUCTS.map((p) => ({
                      label: p.label,
                      value: summary.revenueByProduct[p.value],
                      color: p.color,
                    }))}
                    format={brl}
                    emptyLabel="Sem vendas registradas no período."
                  />
                </div>
                <p className="mt-3 text-sm font-bold text-primary">
                  Receita total do apiário: {brl(summary.revenue)}
                </p>
              </div>

              {(data?.sales ?? []).length === 0 ? (
                <EmptyState
                  title="Sem vendas registradas"
                  hint="A receita bruta considera apenas vendas efetivamente registradas."
                />
              ) : (
                <ul className="space-y-2">
                  {(data?.sales ?? []).map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-primary">
                          {productLabel(s.product_type)} · {brl(s.gross_amount)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {dateBR(s.sale_date)} · {num(Number(s.quantity_kg), 2)} kg ×{" "}
                          {brl(s.unit_price)}
                          {s.buyer ? ` · ${s.buyer}` : ""}
                          {s.sales_channel ? ` · ${s.sales_channel}` : ""}
                        </p>
                      </div>
                      <DeleteButton
                        onConfirm={() => removeRow.mutate({ table: "apiary_sales", rowId: s.id })}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </TabsContent>

        {/* ---------------- GASTOS ---------------- */}
        <TabsContent value="gastos" className="space-y-4">
          <ExpenseDialog apiaryId={id} onSaved={invalidate} />
          {isLoading ? (
            <Skeleton className="h-40 w-full rounded-2xl" />
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <StatCard label="Total" value={brl(summary.costs)} tone="honey" />
                <StatCard label="Fixos" value={brl(summary.fixedCosts)} />
                <StatCard label="Variáveis" value={brl(summary.variableCosts)} />
              </div>

              <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
                <h3 className="text-sm font-bold text-primary">Gastos por categoria</h3>
                <div className="mt-3">
                  <BarList
                    items={summary.expensesByCategory.map((c) => ({
                      label: c.category,
                      value: c.amount,
                      color: "bg-honey",
                    }))}
                    format={brl}
                    emptyLabel="Sem gastos registrados no período."
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
                <h3 className="text-sm font-bold text-primary">Evolução mensal</h3>
                <div className="mt-3">
                  <ColumnChart
                    data={[
                      {
                        label: prevPeriod.label,
                        series: [{ name: "Gastos", value: prev?.costs ?? 0, color: "bg-honey" }],
                      },
                      {
                        label: period.label,
                        series: [{ name: "Gastos", value: summary.costs, color: "bg-honey" }],
                      },
                    ]}
                    format={brl}
                  />
                </div>
              </div>

              {(data?.expenses ?? []).length === 0 ? (
                <EmptyState
                  title="Sem gastos registrados"
                  hint="Registre os custos do apiário para calcular lucro, margem e ROI."
                />
              ) : (
                <ul className="space-y-2">
                  {(data?.expenses ?? []).map((e) => (
                    <li
                      key={e.id}
                      className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-primary">
                          {e.category} · {brl(e.amount)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {dateBR(e.occurred_at)} ·{" "}
                          {e.cost_type === "fixed" ? "Custo fixo" : "Custo variável"}
                          {e.is_recurring ? " · Recorrente" : ""}
                          {e.description ? ` · ${e.description}` : ""}
                        </p>
                      </div>
                      <DeleteButton
                        onConfirm={() => removeRow.mutate({ table: "apiary_expenses", rowId: e.id })}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-bold text-primary">{value}</dd>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function byHive(
  production: ProductionRecord[],
  hives: { id: string; code: string }[],
): { label: string; value: number }[] {
  const map = new Map<string, number>();
  for (const p of production) {
    map.set(p.hive_id, (map.get(p.hive_id) ?? 0) + (Number(p.quantity_kg) || 0));
  }
  return [...map.entries()]
    .map(([hiveId, value]) => ({
      label: hives.find((h) => h.id === hiveId)?.code ?? "—",
      value,
    }))
    .sort((a, b) => b.value - a.value);
}

function DeleteButton({ onConfirm }: { onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Excluir registro">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
          <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Excluir</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

/* ---------------- diálogos ---------------- */

function ProductionDialog({
  apiaryId,
  hives,
  onSaved,
}: {
  apiaryId: string;
  hives: { id: string; code: string; status: string }[];
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    hive_id: "",
    product_type: "honey" as ProductType,
    quantity_kg: "",
    produced_at: today(),
    lot_number: "",
    notes: "",
  });

  const save = useMutation({
    mutationFn: async () => {
      const qty = Number(form.quantity_kg.replace(",", "."));
      if (!form.hive_id) throw new Error("Selecione a colmeia.");
      if (!Number.isFinite(qty) || qty < 0) throw new Error("Quantidade inválida.");
      const payload: Partial<ProductionRecord> = {
        user_id: user!.id,
        apiary_id: apiaryId,
        hive_id: form.hive_id,
        product_type: form.product_type,
        quantity_kg: qty,
        produced_at: form.produced_at,
        lot_number: form.lot_number || null,
        notes: form.notes || null,
      };
      const { error } = await supabase.from("hive_production_records").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produção registrada.");
      setOpen(false);
      setForm((f) => ({ ...f, quantity_kg: "", lot_number: "", notes: "" }));
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível registrar a produção."),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-12 w-full font-semibold">
          <Plus className="mr-2 h-4 w-4" /> Registrar produção da colmeia
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Produção da colmeia</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Colmeia">
            <Select
              value={form.hive_id}
              onValueChange={(v) => setForm((f) => ({ ...f, hive_id: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {hives.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Produto">
            <ProductSelect
              value={form.product_type}
              onChange={(v) => setForm((f) => ({ ...f, product_type: v }))}
            />
          </Field>
          <Field label="Quantidade (kg)">
            <Input
              inputMode="decimal"
              value={form.quantity_kg}
              onChange={(e) => setForm((f) => ({ ...f, quantity_kg: e.target.value }))}
            />
          </Field>
          <Field label="Data">
            <Input
              type="date"
              value={form.produced_at}
              onChange={(e) => setForm((f) => ({ ...f, produced_at: e.target.value }))}
            />
          </Field>
          <Field label="Lote (opcional)">
            <Input
              value={form.lot_number}
              onChange={(e) => setForm((f) => ({ ...f, lot_number: e.target.value }))}
            />
          </Field>
          <Field label="Observações">
            <Textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SaleDialog({
  apiaryId,
  hives,
  onSaved,
}: {
  apiaryId: string;
  hives: { id: string; code: string }[];
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    hive_id: "",
    product_type: "honey" as ProductType,
    sale_date: today(),
    quantity_kg: "",
    unit_price: "",
    buyer: "",
    sales_channel: "",
    lot_number: "",
    notes: "",
  });

  const qty = Number(form.quantity_kg.replace(",", ".")) || 0;
  const price = Number(form.unit_price.replace(",", ".")) || 0;
  const gross = qty * price;

  const save = useMutation({
    mutationFn: async () => {
      if (qty < 0 || price < 0) throw new Error("Valores não podem ser negativos.");
      const payload: Partial<Sale> = {
        user_id: user!.id,
        apiary_id: apiaryId,
        hive_id: form.hive_id || null,
        product_type: form.product_type,
        sale_date: form.sale_date,
        quantity_kg: qty,
        unit_price: price,
        gross_amount: Number(gross.toFixed(2)),
        buyer: form.buyer || null,
        sales_channel: form.sales_channel || null,
        lot_number: form.lot_number || null,
        notes: form.notes || null,
      };
      const { error } = await supabase.from("apiary_sales").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Venda registrada.");
      setOpen(false);
      setForm((f) => ({ ...f, quantity_kg: "", unit_price: "", buyer: "", notes: "" }));
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível registrar a venda."),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-12 w-full font-semibold">
          <Coins className="mr-2 h-4 w-4" /> Registrar venda
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova venda</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Colmeia de origem (opcional)">
            <Select
              value={form.hive_id}
              onValueChange={(v) => setForm((f) => ({ ...f, hive_id: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Não informar" />
              </SelectTrigger>
              <SelectContent>
                {hives.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Produto">
            <ProductSelect
              value={form.product_type}
              onChange={(v) => setForm((f) => ({ ...f, product_type: v }))}
            />
          </Field>
          <Field label="Data da venda">
            <Input
              type="date"
              value={form.sale_date}
              onChange={(e) => setForm((f) => ({ ...f, sale_date: e.target.value }))}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantidade (kg)">
              <Input
                inputMode="decimal"
                value={form.quantity_kg}
                onChange={(e) => setForm((f) => ({ ...f, quantity_kg: e.target.value }))}
              />
            </Field>
            <Field label="Preço por kg (R$)">
              <Input
                inputMode="decimal"
                value={form.unit_price}
                onChange={(e) => setForm((f) => ({ ...f, unit_price: e.target.value }))}
              />
            </Field>
          </div>
          <p className="rounded-xl bg-accent/30 p-3 text-sm font-bold text-primary">
            Valor total: {brl(gross)}
          </p>
          <Field label="Comprador">
            <Input
              value={form.buyer}
              onChange={(e) => setForm((f) => ({ ...f, buyer: e.target.value }))}
            />
          </Field>
          <Field label="Canal de venda">
            <Select
              value={form.sales_channel}
              onValueChange={(v) => setForm((f) => ({ ...f, sales_channel: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {SALES_CHANNELS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Lote (opcional)">
            <Input
              value={form.lot_number}
              onChange={(e) => setForm((f) => ({ ...f, lot_number: e.target.value }))}
            />
          </Field>
          <Field label="Observações">
            <Textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Salvar venda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExpenseDialog({ apiaryId, onSaved }: { apiaryId: string; onSaved: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    occurred_at: today(),
    category: EXPENSE_CATEGORIES[0] as string,
    cost_type: "variable" as "fixed" | "variable",
    description: "",
    amount: "",
    supplier: "",
    payment_method: "",
    is_recurring: false,
    notes: "",
  });

  const save = useMutation({
    mutationFn: async () => {
      const amount = Number(form.amount.replace(",", "."));
      if (!Number.isFinite(amount) || amount < 0) throw new Error("Valor inválido.");
      const payload: Partial<Expense> = {
        user_id: user!.id,
        apiary_id: apiaryId,
        occurred_at: form.occurred_at,
        category: form.category,
        cost_type: form.cost_type,
        description: form.description || null,
        amount,
        supplier: form.supplier || null,
        payment_method: form.payment_method || null,
        is_recurring: form.is_recurring,
        notes: form.notes || null,
      };
      const { error } = await supabase.from("apiary_expenses").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Gasto registrado.");
      setOpen(false);
      setForm((f) => ({ ...f, amount: "", description: "", supplier: "", notes: "" }));
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível registrar o gasto."),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-12 w-full font-semibold">
          <Banknote className="mr-2 h-4 w-4" /> Registrar gasto
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo gasto</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Data">
            <Input
              type="date"
              value={form.occurred_at}
              onChange={(e) => setForm((f) => ({ ...f, occurred_at: e.target.value }))}
            />
          </Field>
          <Field label="Categoria">
            <Select
              value={form.category}
              onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Tipo de custo">
            <Select
              value={form.cost_type}
              onValueChange={(v) => setForm((f) => ({ ...f, cost_type: v as "fixed" | "variable" }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COST_TYPES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Descrição">
            <Input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </Field>
          <Field label="Valor (R$)">
            <Input
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </Field>
          <Field label="Fornecedor (opcional)">
            <Input
              value={form.supplier}
              onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
            />
          </Field>
          <Field label="Forma de pagamento (opcional)">
            <Select
              value={form.payment_method}
              onValueChange={(v) => setForm((f) => ({ ...f, payment_method: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="flex items-center justify-between rounded-xl border border-border/60 p-3">
            <Label htmlFor="recorrente" className="text-sm">
              Gasto recorrente
            </Label>
            <Switch
              id="recorrente"
              checked={form.is_recurring}
              onCheckedChange={(v) => setForm((f) => ({ ...f, is_recurring: v }))}
            />
          </div>
          <Field label="Observações">
            <Textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Salvar gasto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProductSelect({
  value,
  onChange,
}: {
  value: ProductType;
  onChange: (v: ProductType) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ProductType)}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PRODUCTS.map((p) => (
          <SelectItem key={p.value} value={p.value}>
            {p.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
