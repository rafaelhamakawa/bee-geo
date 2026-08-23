import { createFileRoute, Link } from "@tanstack/react-router";
import { GeoApisLogo } from "@/components/brand";
import { TECHNICAL_DISCLAIMER } from "@/lib/geoapis";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — GeoApis" },
      { name: "description", content: "Condições de uso do aplicativo GeoApis para apicultores." },
      { property: "og:title", content: "Termos de Uso — GeoApis" },
      { property: "og:description", content: "Condições de uso do aplicativo GeoApis." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="mx-auto min-h-screen max-w-2xl px-5 py-10">
      <GeoApisLogo compact />
      <h1 className="mt-6 text-2xl font-extrabold text-primary">Termos de Uso</h1>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-foreground">
        <p>
          O GeoApis é uma ferramenta de apoio à gestão apícola. O uso é pessoal e você é responsável
          pelas informações cadastradas.
        </p>
        <p>
          O cálculo de capacidade de colmeias segue metodologia de estimativa e aplica um fator de
          segurança de 0,85.
        </p>
        <p>{TECHNICAL_DISCLAIMER}</p>
        <p>
          Você pode encerrar o uso e solicitar a exclusão dos seus dados a qualquer momento pela tela
          de perfil.
        </p>
      </div>
      <Link to="/login" className="mt-8 inline-block text-sm font-medium text-primary underline">
        Voltar
      </Link>
    </div>
  );
}
