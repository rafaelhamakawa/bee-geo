import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Apiary, ForageAnalysis } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtHa, fmtPct } from "@/lib/geoapis";
import ApiaryMap from "@/components/apiary-map";

export const Route = createFileRoute("/analises/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Análises — GeoApis" },
      { name: "description", content: "Histórico das análises de pasto apícola realizadas." },
      { property: "og:title", content: "Análises — GeoApis" },
      { property: "og:description", content: "Histórico das análises de pasto apícola." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalysesPage,
});

function AnalysesPage() {
  const { user } = useAuth();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["analyses", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [an, ap] = await Promise.all([
        supabase.from("forage_analyses").select("*").order("analyzed_at", { ascending: false }),
        supabase.from("apiaries").select("id,name,latitude,longitude"),
      ]);
      if (an.error) throw an.error;
      if (ap.error) throw ap.error;
      const names = new Map(
        ((ap.data ?? []) as Pick<Apiary, "id" | "name" | "latitude" | "longitude">[]).map(
          (a) => [a.id, a.name],
        ),
      );
      const locations = new Map(
        ((ap.data ?? []) as Pick<Apiary, "id" | "name" | "latitude" | "longitude">[]).map(
          (a) => [a.id, a],
        ),
      );
      return { analyses: (an.data ?? []) as ForageAnalysis[], names, locations };
    },
  });

  return (
    <AppShell title="Análises">
      {isError ? (
        <p className="rounded-2xl bg-card p-5 text-sm text-muted-foreground">
          Não foi possível carregar as análises. Verifique sua conexão.
        </p>
      ) : isLoading || !data ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : isError ? (
        <p className="rounded-2xl bg-card p-5 text-sm text-muted-foreground">
          Não foi possível carregar as análises. Verifique sua conexão.
        </p>
      ) : data!.analyses.length === 0 ? (
        <p className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground">
          Nenhuma análise realizada ainda.
        </p>
      ) : (
        <ul className="space-y-3">
          {data!.analyses.map((an) => (
            <li key={an.id}>
              <Link
                to="/analises/$analysisId"
                params={{ analysisId: an.id }}
                className="block rounded-2xl bg-card p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate font-semibold text-primary">
                    {data!.names.get(an.apiary_id) ?? "Apiário"}
                  </p>
                  <span className="text-lg font-extrabold text-honey">
                    {an.safe_hive_capacity}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(an.analyzed_at).toLocaleDateString("pt-BR")} · pasto{" "}
                  {fmtHa(Number(an.forage_area_ha))} ha · {fmtPct(Number(an.forage_percentage))}
                </p>
                {(() => {
                  const apiary = data!.locations.get(an.apiary_id);
                  if (!apiary?.latitude || !apiary?.longitude) return null;
                  return (
                    <div className="pointer-events-none mt-3 overflow-hidden rounded-xl">
                      <ApiaryMap
                        latitude={apiary.latitude}
                        longitude={apiary.longitude}
                        showCircle={true}
                        className="h-40 w-full"
                      />
                    </div>
                  );
                })()}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
