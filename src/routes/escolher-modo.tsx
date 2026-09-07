import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ShieldCheck, Sprout } from "lucide-react";
import { GeoApisLogo } from "@/components/brand";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin, setMode } from "@/hooks/useAdmin";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/escolher-modo")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Escolher modo — GeoApis" },
      {
        name: "description",
        content: "Escolha entre o modo apicultor e o modo administrador do GeoApis.",
      },
      { property: "og:title", content: "Escolher modo — GeoApis" },
      { property: "og:description", content: "Modo apicultor ou modo administrador." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChooseModePage,
});

function ChooseModePage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { isAdmin, loading: loadingRole } = useIsAdmin();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!loading && user && !loadingRole && !isAdmin) {
      setMode("apicultor");
      navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, user, loadingRole, isAdmin, navigate]);

  function choose(mode: "apicultor" | "adm") {
    setMode(mode);
    navigate({ to: mode === "adm" ? "/admin" : "/dashboard", replace: true });
  }

  if (loading || loadingRole || !user) {
    return (
      <div className="mx-auto max-w-sm space-y-4 p-6">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 text-center">
          <GeoApisLogo />
          <h1 className="mt-4 text-2xl font-extrabold text-primary">Como deseja entrar?</h1>
          <p className="text-sm text-muted-foreground">
            Você pode trocar de modo a qualquer momento pelo seu perfil.
          </p>
        </div>

        <div className="mt-8 space-y-3">
          <button
            type="button"
            onClick={() => choose("apicultor")}
            className="flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-5 text-left shadow-sm"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/40 text-primary">
              <Sprout className="h-6 w-6" />
            </span>
            <span>
              <span className="block font-bold text-primary">Modo apicultor</span>
              <span className="block text-xs text-muted-foreground">
                Seus apiários, colmeias, análises e finanças
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => choose("adm")}
            className="flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-5 text-left shadow-sm"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <span>
              <span className="block font-bold text-primary">Modo administrador</span>
              <span className="block text-xs text-muted-foreground">
                Usuários, visão geral do app e cotações do mel
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
