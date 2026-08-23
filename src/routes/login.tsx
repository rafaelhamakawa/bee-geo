import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage, useAuth } from "@/hooks/useAuth";
import { GeoApisLogo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar no GeoApis" },
      { name: "description", content: "Acesse sua conta GeoApis para gerenciar seus apiários." },
      { property: "og:title", content: "Entrar no GeoApis" },
      { property: "og:description", content: "Acesse sua conta GeoApis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/dashboard", replace: true });
  }, [user, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      toast.error(authErrorMessage(error.message));
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 text-center">
          <GeoApisLogo />
          <p className="mt-1 text-sm text-muted-foreground">
            Gestão de apiários e análise de pasto apícola
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
              className="h-12 bg-card"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-12 bg-card"
            />
          </div>

          <Button type="submit" disabled={busy} className="h-12 w-full text-base font-semibold">
            {busy ? "Entrando…" : "Entrar"}
          </Button>
          <Button
            asChild
            variant="secondary"
            className="h-12 w-full bg-honey text-base font-semibold text-white hover:bg-honey/90"
          >
            <Link to="/cadastro">Criar uma conta</Link>
          </Button>

          <div className="text-center">
            <Link to="/recuperar-senha" className="text-sm font-medium text-primary underline">
              Esqueci minha senha
            </Link>
          </div>
        </form>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          <Link to="/privacidade" className="underline">
            Privacidade
          </Link>{" "}
          ·{" "}
          <Link to="/termos" className="underline">
            Termos
          </Link>
        </p>
      </div>
    </div>
  );
}
