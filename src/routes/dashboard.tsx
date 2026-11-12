import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, MapPin } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Apiary, ForageAnalysis } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WelcomeTour } from "@/components/welcome-tour";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Painel — GeoApis" },
      {
        name: "description",
        content: "Resumo dos seus apiários, colmeias instaladas e capacidade segura estimada.",
      },
      { property: "og:title", content: "Painel — GeoApis" },
      { property: "og:description", content: "Resumo dos seus apiários e capacidade segura." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

function StatCard({ value, label, tone }: { value: string | number; label: string; tone: string }) {
  return (
    <div className="rounded-2xl bg-card p-4 text-center shadow-sm">
      <p className={`text-3xl font-extrabold ${tone}`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function DashboardPage() {
  const { user } = useAuth();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [apiaries, analyses, hives] = await Promise.all([
        supabase.from("apiaries").select("*").order("created_at", { ascending: false }),
        supabase.from("forage_analyses").select("*").order("analyzed_at", { ascending: false }),
        supabase.from("hives").select("apiary_id,status").eq("status", "active"),
      ]);
      if (apiaries.error) throw apiaries.error;
      if (analyses.error) throw analyses.error;
      const hiveCounts = new Map<string, number>();
      for (const h of (hives.data ?? []) as { apiary_id: string }[]) {
        hiveCounts.set(h.apiary_id, (hiveCounts.get(h.apiary_id) ?? 0) + 1);
      }
      return {
        apiaries: (apiaries.data ?? []) as Apiary[],
        analyses: (analyses.data ?? []) as ForageAnalysis[],
        hiveCounts,
      };
    },
  });

  const firstName = ((user?.user_metadata?.['full_name'] as string) || user?.email || "").split(" ")[0];

  const apiaries = data?.apiaries ?? [];
  const analyses = data?.analyses ?? [];
  const hiveCounts = data?.hiveCounts ?? new Map<string, number>();
  const totalHives = apiaries.reduce((s, a) => s + (hiveCounts.get(a.id) ?? 0), 0);
  const latestByApiary = new Map<string, ForageAnalysis>();
  for (const a of analyses) if (!latestByApiary.has(a.apiary_id)) latestByApiary.set(a.apiary_id, a);
  const totalSafe = [...latestByApiary.values()].reduce((s, a) => s + (a.safe_hive_capacity || 0), 0);

  return (
    <AppShell>
      <WelcomeTour />
      <div className="mb-4">
        <p className="text-sm text-muted-foreground">Olá,</p>
        <h1 className="text-2xl font-extrabold text-primary">{firstName || "apicultor"} 👋</h1>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : isError ? (
        <div className="rounded-2xl bg-card p-5 text-sm text-muted-foreground">
          Não foi possível carregar seus dados agora. Verifique sua conexão e tente novamente.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <StatCard value={apiaries.length} label="Apiários" tone="text-primary" />
            <StatCard value={totalHives} label="Colmeias" tone="text-honey" />
            <StatCard value={totalSafe} label="Capacidade segura" tone="text-primary" />
          </div>

          <Button asChild className="mt-6 h-12 w-full">
            <Link to="/estudo-pasto">
              <MapPin className="mr-2 h-4 w-4" /> Estudo pasto apícola
            </Link>
          </Button>

          <div className="mt-6 flex items-center justify-between">
            <h2 className="text-lg font-bold text-primary">Meus apiários</h2>
            <Button asChild size="sm" className="rounded-full">
              <Link to="/apiarios/novo">
                <Plus className="mr-1 h-4 w-4" /> Novo
              </Link>
            </Button>
          </div>

          {apiaries.length === 0 ? (
            <div className="mt-3 rounded-2xl bg-card p-6 text-center shadow-sm">
              <p className="text-sm text-muted-foreground">
                Você ainda não cadastrou nenhum apiário.
              </p>
              <Button asChild className="mt-4 h-12 w-full font-semibold">
                <Link to="/apiarios/novo">Cadastrar primeiro apiário</Link>
              </Button>
            </div>
          ) : (
            <ul className="mt-3 space-y-3">
              {apiaries.map((a) => {
                const an = latestByApiary.get(a.id);
                const safe = an?.safe_hive_capacity ?? 0;
                const activeHives = hiveCounts.get(a.id) ?? 0;
                const pct = safe > 0 ? Math.min(100, Math.round((activeHives / safe) * 100)) : 0;
                return (
                  <li key={a.id}>
                    <Link
                      to="/apiarios/$id"
                      params={{ id: a.id }}
                      className="flex items-center gap-4 rounded-2xl bg-card p-4 shadow-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-primary">{a.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          <MapPin className="mr-1 inline h-3 w-3" />
                          {[a.city, a.state].filter(Boolean).join(" / ") || "Sem localização"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {activeHives} colmeias
                          {an ? ` · capacidade segura ${safe}` : " · sem análise"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-extrabold text-honey">{pct}%</p>
                        <p className="text-[10px] text-muted-foreground">ocupação</p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </AppShell>
  );
}
