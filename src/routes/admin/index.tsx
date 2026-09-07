import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins, MapPin, Repeat, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { GeoApisMark, GeoApisWordmark } from "@/components/brand";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin, setMode } from "@/hooks/useAdmin";
import type { Apiary, Profile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Administração — GeoApis" },
      {
        name: "description",
        content: "Painel administrativo do GeoApis: usuários, apiários, visão geral e cotações.",
      },
      { property: "og:title", content: "Administração — GeoApis" },
      { property: "og:description", content: "Painel administrativo do GeoApis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

type Role = "admin" | "tecnico" | "apicultor";

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="rounded-2xl bg-card p-4 text-center shadow-sm">
      <p className="text-3xl font-extrabold text-primary">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function AdminPage() {
  const { user, loading } = useAuth();
  const { isAdmin, loading: loadingRole } = useIsAdmin();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [loading, user, navigate]);

  const enabled = !!user && isAdmin;

  const { data, isLoading } = useQuery({
    queryKey: ["admin-overview"],
    enabled,
    queryFn: async () => {
      const [profiles, roles, apiaries, hives, analyses] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
        supabase
          .from("apiaries")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200),
        supabase.from("hives").select("id", { count: "exact", head: true }),
        supabase.from("forage_analyses").select("id", { count: "exact", head: true }),
      ]);
      if (profiles.error) throw profiles.error;
      if (roles.error) throw roles.error;
      if (apiaries.error) throw apiaries.error;
      return {
        profiles: (profiles.data ?? []) as Profile[],
        roles: (roles.data ?? []) as { user_id: string; role: Role }[],
        apiaries: (apiaries.data ?? []) as Apiary[],
        hiveCount: hives.count ?? 0,
        analysisCount: analyses.count ?? 0,
      };
    },
  });

  const changeRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: Role }) => {
      const del = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (del.error) throw del.error;
      const ins = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (ins.error) throw ins.error;
    },
    onSuccess: () => {
      toast.success("Papel atualizado.");
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
      qc.invalidateQueries({ queryKey: ["is-admin"] });
    },
    onError: () => toast.error("Não foi possível alterar o papel deste usuário."),
  });

  if (loading || loadingRole) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-5">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
        <ShieldCheck className="h-10 w-10 text-muted-foreground" />
        <p className="font-semibold text-primary">Área restrita a administradores.</p>
        <Button asChild className="h-12 w-full">
          <Link to="/dashboard">Voltar ao app</Link>
        </Button>
      </div>
    );
  }

  const roleOf = (id: string): Role =>
    data?.roles.find((r) => r.user_id === id)?.role ?? "apicultor";

  const nameOf = (id: string) => data?.profiles.find((p) => p.id === id)?.full_name || "—";

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          <GeoApisMark className="h-8 w-8" />
          <GeoApisWordmark className="text-xl" />
          <span className="ml-2 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            Administração
          </span>
          <button
            type="button"
            onClick={() => {
              setMode("apicultor");
              navigate({ to: "/dashboard" });
            }}
            className="ml-auto flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-primary"
          >
            <Repeat className="h-4 w-4" /> Modo apicultor
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        {isLoading || !data ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <>
            <section>
              <h2 className="mb-2 text-sm font-bold text-primary">Visão geral</h2>
              <div className="grid grid-cols-2 gap-3">
                <Stat value={data.profiles.length} label="Usuários" />
                <Stat value={data.apiaries.length} label="Apiários" />
                <Stat value={data.hiveCount} label="Colmeias" />
                <Stat value={data.analysisCount} label="Análises de pasto" />
              </div>
            </section>

            <section className="rounded-2xl bg-card p-4 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-primary">
                <Users className="h-4 w-4" /> Usuários cadastrados
              </h2>
              <ul className="divide-y divide-border">
                {data.profiles.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-primary">
                        {p.full_name || "Sem nome"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[p.city, p.state].filter(Boolean).join(" · ") ||
                          p.business_name ||
                          "Sem dados de contato"}
                      </p>
                    </div>
                    <Select
                      value={roleOf(p.id)}
                      onValueChange={(role) =>
                        changeRole.mutate({ userId: p.id, role: role as Role })
                      }
                    >
                      <SelectTrigger className="h-9 w-32 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="apicultor">Apicultor</SelectItem>
                        <SelectItem value="tecnico">Técnico</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                  </li>
                ))}
                {data.profiles.length === 0 ? (
                  <li className="py-4 text-center text-xs text-muted-foreground">
                    Nenhum usuário visível.
                  </li>
                ) : null}
              </ul>
            </section>

            <section className="rounded-2xl bg-card p-4 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-primary">
                <MapPin className="h-4 w-4" /> Apiários de todos os usuários
              </h2>
              <ul className="divide-y divide-border">
                {data.apiaries.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-primary">{a.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[a.city, a.state].filter(Boolean).join(" · ") || "Sem localização"} ·{" "}
                        {nameOf(a.user_id)}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-honey">
                      {a.current_hives ?? 0} colmeias
                    </span>
                  </li>
                ))}
                {data.apiaries.length === 0 ? (
                  <li className="py-4 text-center text-xs text-muted-foreground">
                    Nenhum apiário cadastrado.
                  </li>
                ) : null}
              </ul>
            </section>

            <Link
              to="/admin/cotacoes"
              className="flex items-center gap-3 rounded-2xl bg-card p-4 text-sm font-semibold text-primary shadow-sm"
            >
              <Coins className="h-4 w-4" /> Cotações do mel
            </Link>
          </>
        )}
      </main>
    </div>
  );
}
