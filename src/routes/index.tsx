import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { GeoApisLogo } from "@/components/brand";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "GeoApis — Pasto apícola e capacidade de colmeias" },
      {
        name: "description",
        content:
          "Cadastre apiários, analise o pasto apícola em um raio de 1,5 km e descubra a capacidade segura de colmeias.",
      },
      { property: "og:title", content: "GeoApis — Gestão apícola inteligente" },
      {
        property: "og:description",
        content:
          "Cadastre apiários, analise o pasto apícola e calcule a capacidade segura de colmeias.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    navigate({ to: user ? "/dashboard" : "/login", replace: true });
  }, [user, loading, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <GeoApisLogo />
      <p className="text-sm text-muted-foreground">Carregando…</p>
    </div>
  );
}
