import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, StepIndicator } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Apiary, ForageAnalysis, ForagePatch } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtHa, fmtPct, TECHNICAL_DISCLAIMER } from "@/lib/geoapis";
import ApiaryMap from "@/components/apiary-map";

export const Route = createFileRoute("/analises/$analysisId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Resultado da análise — GeoApis" },
      {
        name: "description",
        content: "Capacidade segura recomendada de colmeias com base no pasto apícola analisado.",
      },
      { property: "og:title", content: "Resultado da análise — GeoApis" },
      { property: "og:description", content: "Capacidade segura recomendada de colmeias." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResultPage,
});

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border/60 py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function ResultPage() {
  const { analysisId } = Route.useParams();
  const { user } = useAuth();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["analysis", analysisId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: an, error } = await supabase
        .from("forage_analyses")
        .select("*")
        .eq("id", analysisId)
        .maybeSingle();
      if (error) throw error;
      if (!an) return null;
      const [patches, apiary] = await Promise.all([
        supabase
          .from("forage_patches")
          .select("*")
          .eq("analysis_id", analysisId)
          .order("patch_number"),
        supabase.from("apiaries").select("*").eq("id", (an as ForageAnalysis).apiary_id).maybeSingle(),
      ]);
      return {
        analysis: an as ForageAnalysis,
        patches: (patches.data ?? []) as ForagePatch[],
        apiary: apiary.data as Apiary | null,
      };
    },
  });

  if (isLoading) {
    return (
      <AppShell title="Resultado">
        <Skeleton className="h-64 w-full" />
      </AppShell>
    );
  }
  if (isError || !data) {
    return (
      <AppShell title="Resultado" back="/analises">
        <p className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground">
          Análise não encontrada ou indisponível.
        </p>
      </AppShell>
    );
  }

  const { analysis: an, patches, apiary } = data;
  const installed = apiary?.current_hives ?? 0;
  const available = Math.max(0, an.safe_hive_capacity - installed);
  const occupancy =
    an.safe_hive_capacity > 0
      ? Math.min(100, Math.round((installed / an.safe_hive_capacity) * 100))
      : 0;
  const multipliers = [...new Set(patches.map((p) => Number(p.hive_multiplier)))].join(", ") || "1";

  return (
    <AppShell title="Resultado" back="/analises">
      <StepIndicator step={3} />

      <div className="mt-4 rounded-2xl bg-primary p-6 text-center text-primary-foreground">
        <p className="text-sm opacity-90">Capacidade segura recomendada</p>
        <p className="mt-1 text-6xl font-extrabold text-honey-light">{an.safe_hive_capacity}</p>
        <p className="text-sm opacity-90">colmeias</p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-card p-4 text-center shadow-sm">
          <p className="text-2xl font-extrabold text-primary">{installed}</p>
          <p className="text-xs text-muted-foreground">Instaladas</p>
        </div>
        <div className="rounded-2xl bg-card p-4 text-center shadow-sm">
          <p className="text-2xl font-extrabold text-honey">{available}</p>
          <p className="text-xs text-muted-foreground">Disponíveis</p>
        </div>
      </div>

      <div className="mt-3 rounded-2xl bg-card p-4 shadow-sm">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Ocupação</span>
          <span>{occupancy}%</span>
        </div>
        <Progress value={occupancy} className="mt-2" />
      </div>

      <div className="mt-4 rounded-2xl bg-card p-4 shadow-sm">
        <h2 className="mb-2 font-bold text-primary">Resumo do cálculo</h2>
        <Line label="Bioma" value={an.biome ?? "Não informado"} />
        <Line label="Área de pasto" value={`${fmtHa(Number(an.forage_area_ha))} ha`} />
        <Line label="Percentual do círculo" value={fmtPct(Number(an.forage_percentage))} />
        <Line label="Multiplicador(es)" value={multipliers} />
        <Line label="Capacidade bruta" value={Number(an.gross_hive_capacity).toFixed(2)} />
        <Line label="Fator de segurança" value="0,85" />
        <Line label="Capacidade final" value={`${an.safe_hive_capacity} colmeias`} />
      </div>

      {patches.length ? (
        <div className="mt-4 rounded-2xl bg-card p-4 shadow-sm">
          <h2 className="mb-2 font-bold text-primary">Fragmentos analisados</h2>
          <ul className="space-y-2">
            {patches.map((p) => (
              <li key={p.id} className="flex items-center justify-between text-sm">
                <span className="min-w-0 truncate">
                  {p.name ?? `Fragmento ${p.patch_number}`}
                  <span className="text-muted-foreground"> · {p.vegetation_type ?? "—"}</span>
                </span>
                <span className="ml-3 shrink-0 text-muted-foreground">
                  {fmtHa(Number(p.area_ha))} ha · {fmtPct(Number(p.percentage))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-4 rounded-2xl bg-muted p-4 text-xs leading-relaxed text-muted-foreground">
        {TECHNICAL_DISCLAIMER}
      </p>

      <div className="mt-4 space-y-3">
        <Button disabled className="h-12 w-full">
          Gerar relatório — disponível em breve
        </Button>
        {apiary ? (
          <>
            <Button asChild variant="outline" className="h-12 w-full">
              <Link to="/apiarios/$id" params={{ id: apiary.id }}>
                Voltar ao apiário
              </Link>
            </Button>
            <Button asChild variant="ghost" className="h-12 w-full">
              <Link to="/apiarios/$id/analise" params={{ id: apiary.id }}>
                Nova análise
              </Link>
            </Button>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
