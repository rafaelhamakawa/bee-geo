import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ApiaryForm, fromApiary, type ApiaryFormValues } from "@/components/apiary-form";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Apiary } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/apiarios/$id/editar")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Editar apiário — GeoApis" },
      { name: "description", content: "Atualize os dados cadastrais do seu apiário." },
      { property: "og:title", content: "Editar apiário — GeoApis" },
      { property: "og:description", content: "Atualize os dados cadastrais do seu apiário." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EditApiaryPage,
});

function EditApiaryPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["apiary-edit", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("apiaries").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as Apiary | null;
    },
  });

  async function onSubmit(values: ApiaryFormValues) {
    setBusy(true);
    const { error } = await supabase
      .from("apiaries")
      .update({ ...values, code: values.code || null })
      .eq("id", id);
    setBusy(false);
    if (error) { toast.error("Não foi possível salvar as alterações."); return; }
    toast.success("Apiário atualizado.");
    qc.invalidateQueries({ queryKey: ["apiary", id] });
    navigate({ to: "/apiarios/$id", params: { id } });
  }

  return (
    <AppShell title="Editar apiário">
      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : !data ? (
        <p className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground">
          Apiário não encontrado.
        </p>
      ) : (
        <ApiaryForm
          initial={fromApiary(data)}
          submitLabel="Salvar alterações"
          busy={busy}
          onSubmit={onSubmit}
        />
      )}
    </AppShell>
  );
}
