import { createFileRoute, Link } from "@tanstack/react-router";
import { GeoApisLogo } from "@/components/brand";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — GeoApis" },
      {
        name: "description",
        content: "Como o GeoApis usa localização e dados da sua conta apícola.",
      },
      { property: "og:title", content: "Política de Privacidade — GeoApis" },
      { property: "og:description", content: "Como o GeoApis trata seus dados e localização." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="mx-auto min-h-screen max-w-2xl px-5 py-10">
      <GeoApisLogo compact />
      <h1 className="mt-6 text-2xl font-extrabold text-primary">Política de Privacidade</h1>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-foreground">
        <p>
          A localização é usada exclusivamente para posicionar o apiário no mapa e calcular o raio de
          análise de 1,5 km.
        </p>
        <p>
          A localização só é obtida após uma ação sua e com seu consentimento explícito no
          navegador.
        </p>
        <p>Os dados cadastrados ficam vinculados à sua conta e não são visíveis a outros usuários.</p>
        <p>Você pode editar ou excluir seus apiários e análises a qualquer momento.</p>
        <p>O aplicativo não vende dados pessoais e não utiliza cookies publicitários ou rastreamento.</p>
        <p>
          As análises apresentadas são estimativas técnicas e não substituem levantamento de campo.
        </p>
      </div>
      <Link to="/login" className="mt-8 inline-block text-sm font-medium text-primary underline">
        Voltar
      </Link>
    </div>
  );
}
