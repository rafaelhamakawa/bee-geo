import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/econ-bits";
import {
  BR_STATES,
  FIPMEL_SOURCE,
  FIPMEL_URL,
  brl,
  dateBR,
  dateTimeBR,
  regionOf,
  type HoneyQuote,
} from "@/lib/economics";

export const Route = createFileRoute("/admin/cotacoes")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Cotações do mel — GeoApis" },
      {
        name: "description",
        content: "Área administrativa para consultar, cadastrar e corrigir as cotações do mel.",
      },
      { property: "og:title", content: "Cotações do mel — GeoApis" },
      { property: "og:description", content: "Gerencie o cache de cotações do mel no GeoApis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: QuotesAdminPage,
});

const today = () => new Date().toISOString().slice(0, 10);

function QuotesAdminPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: isAdmin, isLoading: loadingRole } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "admin")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  const { data: quotes, isLoading } = useQuery({
    queryKey: ["honey-quotes-admin"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("honey_price_quotes")
        .select("*")
        .order("fetched_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as HoneyQuote[];
    },
  });

  const [form, setForm] = useState({
    state: "SP",
    honey_type: "",
    price_min: "",
    price_avg: "",
    price_max: "",
    unit: "R$/kg",
    reference_date: today(),
    source_name: FIPMEL_SOURCE,
    source_url: FIPMEL_URL,
  });

  const save = useMutation({
    mutationFn: async () => {
      const dec = (v: string) => (v.trim() ? Number(v.replace(",", ".")) : null);
      const avg = dec(form.price_avg);
      if (avg === null || !Number.isFinite(avg) || avg < 0)
        throw new Error("Informe um preço médio válido.");
      const { error } = await supabase.from("honey_price_quotes").insert({
        state: form.state,
        region: regionOf(form.state),
        honey_type: form.honey_type || null,
        price_min: dec(form.price_min),
        price_avg: avg,
        price_max: dec(form.price_max),
        unit: form.unit || "R$/kg",
        reference_date: form.reference_date,
        source_name: form.source_name || FIPMEL_SOURCE,
        source_url: form.source_url || FIPMEL_URL,
        fetched_at: new Date().toISOString(),
        status: "ok",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cotação registrada.");
      qc.invalidateQueries({ queryKey: ["honey-quotes-admin"] });
      qc.invalidateQueries({ queryKey: ["honey-quote"] });
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível salvar a cotação."),
  });

  if (loadingRole) {
    return (
      <AppShell back="/perfil">
        <Skeleton className="h-40 w-full rounded-2xl" />
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell back="/perfil">
        <EmptyState
          title="Acesso restrito"
          hint="Somente administradores podem gerenciar as cotações do mel."
        />
      </AppShell>
    );
  }

  const lastError = (quotes ?? []).find((q) => q.status === "error") ?? null;

  return (
    <AppShell back="/perfil" title="Cotações do mel">
      <p className="text-sm text-muted-foreground">
        Fonte de referência:{" "}
        <a
          href={FIPMEL_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-medium text-primary underline"
        >
          Índice FIPMEL <ExternalLink className="h-3 w-3" />
        </a>
        . A consulta automática roda no servidor, no máximo uma vez por dia; use o formulário abaixo
        para cadastrar ou corrigir manualmente.
      </p>

      <section className="mt-4 space-y-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
        <h2 className="text-base font-bold text-primary">Nova cotação / correção</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">UF</Label>
            <Select value={form.state} onValueChange={(v) => setForm((f) => ({ ...f, state: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BR_STATES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Região</Label>
            <Input readOnly value={regionOf(form.state) ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Preço mínimo</Label>
            <Input
              inputMode="decimal"
              value={form.price_min}
              onChange={(e) => setForm((f) => ({ ...f, price_min: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Preço médio *</Label>
            <Input
              inputMode="decimal"
              value={form.price_avg}
              onChange={(e) => setForm((f) => ({ ...f, price_avg: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Preço máximo</Label>
            <Input
              inputMode="decimal"
              value={form.price_max}
              onChange={(e) => setForm((f) => ({ ...f, price_max: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Unidade</Label>
            <Input
              value={form.unit}
              onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Tipo de mel</Label>
            <Input
              value={form.honey_type}
              onChange={(e) => setForm((f) => ({ ...f, honey_type: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Data de referência</Label>
            <Input
              type="date"
              value={form.reference_date}
              onChange={(e) => setForm((f) => ({ ...f, reference_date: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Fonte</Label>
            <Input
              value={form.source_name}
              onChange={(e) => setForm((f) => ({ ...f, source_name: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">URL da fonte</Label>
            <Input
              value={form.source_url}
              onChange={(e) => setForm((f) => ({ ...f, source_url: e.target.value }))}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            className="h-12 flex-1 font-semibold"
            onClick={() => save.mutate()}
            disabled={save.isPending}
          >
            <Save className="mr-2 h-4 w-4" /> Salvar cotação
          </Button>
          <Button
            variant="outline"
            className="h-12"
            onClick={() => {
              qc.invalidateQueries({ queryKey: ["honey-quotes-admin"] });
              qc.invalidateQueries({ queryKey: ["honey-quote"] });
              toast.success("Cache de cotações recarregado.");
            }}
            aria-label="Atualizar cotações"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </section>

      {lastError ? (
        <p className="mt-4 rounded-2xl border border-destructive/40 bg-card p-4 text-xs text-destructive">
          Última tentativa automática com erro ({dateTimeBR(lastError.fetched_at)}):{" "}
          {lastError.error_message ?? "sem detalhes"}
        </p>
      ) : null}

      <h2 className="mt-6 text-base font-bold text-primary">Cotações armazenadas</h2>
      {isLoading ? (
        <Skeleton className="mt-3 h-32 w-full rounded-2xl" />
      ) : (quotes ?? []).length === 0 ? (
        <div className="mt-3">
          <EmptyState title="Nenhuma cotação armazenada" hint="Cadastre a primeira acima." />
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {(quotes ?? []).map((q) => (
            <li key={q.id} className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
              <p className="text-sm font-semibold text-primary">
                {q.state ?? "—"} · {q.region ?? "—"} · {q.price_avg == null ? "—" : brl(q.price_avg)}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  {q.unit ?? "R$/kg"}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                Referência {dateBR(q.reference_date)} · Consulta {dateTimeBR(q.fetched_at)} ·{" "}
                {q.status === "ok" ? "Atualizada" : q.status === "stale" ? "Desatualizada" : "Erro"}
              </p>
              {q.honey_type ? (
                <p className="text-xs text-muted-foreground">Tipo: {q.honey_type}</p>
              ) : null}
              {q.error_message ? (
                <p className="text-xs text-destructive">{q.error_message}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
