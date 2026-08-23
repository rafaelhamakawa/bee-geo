import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage } from "@/hooks/useAuth";
import { GeoApisLogo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/redefinir-senha")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Definir nova senha — GeoApis" },
      { name: "description", content: "Defina uma nova senha para sua conta GeoApis." },
      { property: "og:title", content: "Definir nova senha — GeoApis" },
      { property: "og:description", content: "Defina uma nova senha para sua conta GeoApis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) { toast.error("A senha deve ter no mínimo 6 caracteres."); return; }
    if (password !== confirm) { toast.error("As senhas não coincidem."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { toast.error(authErrorMessage(error.message)); return; }
    toast.success("Senha atualizada com sucesso.");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <GeoApisLogo />
          <h1 className="mt-6 text-xl font-bold text-primary">Definir nova senha</h1>
        </div>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nova senha</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 bg-card"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirmar nova senha</Label>
            <Input
              id="confirm"
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="h-12 bg-card"
            />
          </div>
          <Button type="submit" disabled={busy} className="h-12 w-full font-semibold">
            {busy ? "Salvando…" : "Salvar nova senha"}
          </Button>
          <Button asChild variant="ghost" className="h-12 w-full">
            <Link to="/login">Voltar</Link>
          </Button>
        </form>
      </div>
    </div>
  );
}
