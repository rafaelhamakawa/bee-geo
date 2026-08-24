import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { LogOut, FileText, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AppShell, initialsOf } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Profile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/perfil")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Meu perfil — GeoApis" },
      { name: "description", content: "Atualize seus dados pessoais e gerencie sua conta GeoApis." },
      { property: "og:title", content: "Meu perfil — GeoApis" },
      { property: "og:description", content: "Atualize seus dados pessoais no GeoApis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<Omit<Profile, "id"> | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as Profile | null;
    },
  });

  useEffect(() => {
    if (form) return;
    setForm({
      full_name: data?.full_name ?? ((user?.user_metadata?.['full_name'] as string) || ""),
      phone: data?.phone ?? "",
      city: data?.city ?? "",
      state: data?.state ?? "",
      business_name: data?.business_name ?? "",
    });
  }, [data, user, form]);

  async function save() {
    if (!user || !form) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: user.id, ...form, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) { toast.error("Não foi possível salvar o perfil."); return; }
    toast.success("Perfil atualizado.");
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  const set = (k: keyof Omit<Profile, "id">, v: string) =>
    setForm((p) => (p ? { ...p, [k]: v } : p));

  return (
    <AppShell title="Meu perfil">
      {isLoading || !form ? (
        <Skeleton className="h-80 w-full" />
      ) : (
        <>
          <div className="flex items-center gap-4 rounded-2xl bg-card p-4 shadow-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
              {initialsOf(form.full_name, user?.email)}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-primary">
                {form.full_name || "Sem nome"}
              </p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <div className="mt-4 space-y-4 rounded-2xl bg-card p-4 shadow-sm">
            <h2 className="font-bold text-primary">Dados pessoais</h2>
            <div className="space-y-2">
              <Label htmlFor="fullname">Nome completo</Label>
              <Input
                id="fullname"
                value={form.full_name ?? ""}
                onChange={(e) => set("full_name", e.target.value)}
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={form.phone ?? ""}
                onChange={(e) => set("phone", e.target.value)}
                className="h-12"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="pcity">Cidade</Label>
                <Input
                  id="pcity"
                  value={form.city ?? ""}
                  onChange={(e) => set("city", e.target.value)}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pstate">UF</Label>
                <Input
                  id="pstate"
                  maxLength={2}
                  value={form.state ?? ""}
                  onChange={(e) => set("state", e.target.value.toUpperCase())}
                  className="h-12"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="business">Nome do negócio</Label>
              <Input
                id="business"
                value={form.business_name ?? ""}
                onChange={(e) => set("business_name", e.target.value)}
                className="h-12"
              />
            </div>
            <Button onClick={save} disabled={busy} className="h-12 w-full font-semibold">
              {busy ? "Salvando…" : "Salvar alterações"}
            </Button>
          </div>

          <div className="mt-4 divide-y divide-border rounded-2xl bg-card shadow-sm">
            <Link to="/admin/cotacoes" className="flex items-center gap-3 p-4 text-sm">
              <Coins className="h-4 w-4 text-primary" /> Cotações do mel (admin)
            </Link>
            <Link to="/privacidade" className="flex items-center gap-3 p-4 text-sm">
              <ShieldCheck className="h-4 w-4 text-primary" /> Política de Privacidade
            </Link>
            <Link to="/termos" className="flex items-center gap-3 p-4 text-sm">
              <FileText className="h-4 w-4 text-primary" /> Termos de Uso
            </Link>
          </div>


          <Button
            variant="outline"
            onClick={signOut}
            className="mt-4 h-12 w-full text-destructive"
          >
            <LogOut className="mr-2 h-4 w-4" /> Sair da conta
          </Button>
        </>
      )}
    </AppShell>
  );
}
