import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Apiary } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/apiarios/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Meus apiários — GeoApis" },
      { name: "description", content: "Lista dos apiários cadastrados na sua conta GeoApis." },
      { property: "og:title", content: "Meus apiários — GeoApis" },
      { property: "og:description", content: "Gerencie os apiários cadastrados na sua conta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ApiariesPage,
});

function ApiariesPage() {
  const { user } = useAuth();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["apiaries", user?.id],
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

  return (
    <AppShell title="Apiários">
      <Button asChild className="h-12 w-full font-semibold">
        <Link to="/apiarios/novo">
          <Plus className="mr-1 h-4 w-4" /> Novo apiário
        </Link>
      </Button>

      {isLoading ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : isError ? (
        <p className="mt-6 rounded-2xl bg-card p-5 text-sm text-muted-foreground">
          Não foi possível carregar os apiários. Verifique sua conexão.
        </p>
      ) : (data ?? []).length === 0 ? (
        <p className="mt-6 rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground">
          Nenhum apiário cadastrado ainda.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {data!.map((a) => (
            <li key={a.id}>
              <Link
                to="/apiarios/$id"
                params={{ id: a.id }}
                className="block rounded-2xl bg-card p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate font-semibold text-primary">{a.name}</p>
                  <span className="rounded-full bg-accent/40 px-2 py-0.5 text-[11px] font-medium text-primary">
                    {a.status === "active" ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  <MapPin className="mr-1 inline h-3 w-3" />
                  {[a.city, a.state].filter(Boolean).join(" / ") || "Sem localização"}
                  {a.biome ? ` · ${a.biome}` : ""}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{a.current_hives} colmeias</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
