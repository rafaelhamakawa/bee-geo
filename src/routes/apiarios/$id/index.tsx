import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { MapPin, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Apiary, ForageAnalysis } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HivesTab, useHives } from "@/components/hives-tab";
import { BaitBoxesTab } from "@/components/bait-boxes-tab";
import { formatCoord, fmtHa, fmtPct } from "@/lib/geoapis";

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

const ApiaryMap = lazy(() => import("@/components/apiary-map"));

export const Route = createFileRoute("/apiarios/$id/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Detalhes do apiário — GeoApis" },
      { name: "description", content: "Visão geral, colmeias e análises do apiário selecionado." },
      { property: "og:title", content: "Detalhes do apiário — GeoApis" },
      { property: "og:description", content: "Visão geral, colmeias e análises do apiário." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ApiaryDetailPage,
});

function ApiaryDetailPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["apiary", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [a, an] = await Promise.all([
        supabase.from("apiaries").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("forage_analyses")
          .select("*")
          .eq("apiary_id", id)
          .order("analyzed_at", { ascending: false }),
      ]);
      if (a.error) throw a.error;
      if (an.error) throw an.error;
      return { apiary: a.data as Apiary | null, analyses: (an.data ?? []) as ForageAnalysis[] };
    },
  });

  const { data: hives } = useHives(id);

  if (isLoading) {
    return (
      <AppShell back="/apiarios">
        <Skeleton className="h-48 w-full" />
      </AppShell>
    );
  }
  if (isError || !data?.apiary) {
    return (
      <AppShell back="/apiarios">
        <p className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground">
          Apiário não encontrado ou indisponível.
        </p>
      </AppShell>
    );
  }

  const a = data.apiary;
  const analyses = data.analyses;
  const latest = analyses[0];
  const safe = latest?.safe_hive_capacity ?? 0;
  // Colmeias instaladas = contagem das colmeias ativas do apiário.
  const current = (hives ?? []).filter((h) => h.status === "active").length;


  async function remove() {
    const { error } = await supabase.from("apiaries").delete().eq("id", id);
    if (error) { toast.error("Não foi possível excluir o apiário."); return; }
    toast.success("Apiário excluído.");
    navigate({ to: "/apiarios", replace: true });
  }

  return (
    <AppShell back="/apiarios">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-extrabold text-primary">{a.name}</h1>
          <p className="truncate text-xs text-muted-foreground">
            <MapPin className="mr-1 inline h-3 w-3" />
            {[a.city, a.state].filter(Boolean).join(" / ") || "Sem localização"}
            {a.biome ? ` · ${a.biome}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="icon" aria-label="Editar apiário">
            <Link to="/apiarios/$id/editar" params={{ id }}>
              <Pencil className="h-4 w-4" />
            </Link>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Excluir apiário">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir apiário?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação remove o apiário e todas as análises vinculadas. Não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={remove}>Excluir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Tabs defaultValue="overview" className="mt-4">
        <TabsList className="w-full">
          <TabsTrigger value="overview" className="flex-1">
            Visão geral
          </TabsTrigger>
          <TabsTrigger value="hives" className="flex-1">
            Colmeias
          </TabsTrigger>
          <TabsTrigger value="baits" className="flex-1">
            Iscas
          </TabsTrigger>
          <TabsTrigger value="analyses" className="flex-1">
            Análises
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {a.latitude != null && a.longitude != null ? (
            <>
              <Suspense fallback={<Skeleton className="h-72 w-full rounded-2xl" />}>
                <ApiaryMap latitude={a.latitude} longitude={a.longitude} />
              </Suspense>
              <p className="text-xs text-muted-foreground">{formatCoord(a.latitude, a.longitude)}</p>
            </>
          ) : (
            <div className="rounded-2xl bg-card p-5 text-center text-sm text-muted-foreground">
              Este apiário ainda não tem localização definida.
            </div>
          )}
          <Button asChild variant="outline" className="h-12 w-full">
            <Link to="/apiarios/$id/localizacao" params={{ id }}>
              Definir / ajustar localização
            </Link>
          </Button>
          <Button asChild className="h-12 w-full font-semibold">
            <Link to="/apiarios/$id/analise" params={{ id }}>
              Analisar pasto apícola
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-12 w-full font-semibold">
            <Link to="/apiarios/$id/economia" params={{ id }}>
              Financeiro — gestão econômica
            </Link>
          </Button>


          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-card p-4 text-center shadow-sm">
              <p className="text-2xl font-extrabold text-honey">{current}</p>
              <p className="text-xs text-muted-foreground">Colmeias</p>
            </div>
            <div className="rounded-2xl bg-card p-4 text-center shadow-sm">
              <p className="text-2xl font-extrabold text-primary">{safe}</p>
              <p className="text-xs text-muted-foreground">Capacidade segura</p>
            </div>
            <div className="rounded-2xl bg-card p-4 text-center shadow-sm">
              <p className="text-2xl font-extrabold text-primary">
                {Math.max(0, safe - current)}
              </p>
              <p className="text-xs text-muted-foreground">Disponível</p>
            </div>
          </div>
          {a.description ? (
            <p className="rounded-2xl bg-card p-4 text-sm">{a.description}</p>
          ) : null}
          {a.notes ? <p className="rounded-2xl bg-card p-4 text-sm">{a.notes}</p> : null}
        </TabsContent>

        <TabsContent value="hives" className="space-y-4">
          <HivesTab apiary={a} safeCapacity={safe} />
        </TabsContent>

        <TabsContent value="baits" className="space-y-4">
          <BaitBoxesTab apiary={a} />
        </TabsContent>


        <TabsContent value="analyses" className="space-y-3">
          {analyses.length === 0 ? (
            <p className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground">
              Nenhuma análise realizada para este apiário.
            </p>
          ) : (
            analyses.map((an) => (
              <Link
                key={an.id}
                to="/analises/$analysisId"
                params={{ analysisId: an.id }}
                className="block rounded-2xl bg-card p-4 shadow-sm"
              >
                <p className="font-semibold text-primary">
                  {new Date(an.analyzed_at).toLocaleDateString("pt-BR")} ·{" "}
                  {an.safe_hive_capacity} colmeias seguras
                </p>
                <p className="text-xs text-muted-foreground">
                  Pasto {fmtHa(Number(an.forage_area_ha))} ha ·{" "}
                  {fmtPct(Number(an.forage_percentage))} · {an.biome ?? "—"}
                </p>
              </Link>
            ))
          )}
          <Button asChild className="h-12 w-full font-semibold">
            <Link to="/apiarios/$id/analise" params={{ id }}>
              Nova análise
            </Link>
          </Button>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
