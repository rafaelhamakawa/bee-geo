import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ApiaryForm, emptyApiary, type ApiaryFormValues } from "@/components/apiary-form";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/apiarios/novo")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Novo apiário — GeoApis" },
      { name: "description", content: "Cadastre um novo apiário e defina bioma e colmeias." },
      { property: "og:title", content: "Novo apiário — GeoApis" },
      { property: "og:description", content: "Cadastre um novo apiário no GeoApis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewApiaryPage,
});

function NewApiaryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function onSubmit(values: ApiaryFormValues) {
    if (!user) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("apiaries")
      .insert({
        ...values,
        code: values.code || null,
        user_id: user.id,
      })
      .select("id")
      .single();
    setBusy(false);
    if (error) {
      toast.error("Não foi possível salvar o apiário. Tente novamente.");
      return;
    }
    toast.success("Apiário cadastrado.");
    navigate({ to: "/apiarios/$id/localizacao", params: { id: data.id as string } });
  }

  return (
    <AppShell title="Novo apiário" back="/apiarios">
      <ApiaryForm initial={emptyApiary()} submitLabel="Salvar e definir localização" busy={busy} onSubmit={onSubmit} />
    </AppShell>
  );
}
