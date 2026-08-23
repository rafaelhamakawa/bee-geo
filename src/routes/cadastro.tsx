import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage } from "@/hooks/useAuth";
import { GeoApisLogo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/cadastro")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Criar conta no GeoApis" },
      { name: "description", content: "Crie sua conta gratuita no GeoApis e cadastre apiários." },
      { property: "og:title", content: "Criar conta no GeoApis" },
      { property: "og:description", content: "Crie sua conta gratuita no GeoApis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) return toast.error("A senha deve ter no mínimo 6 caracteres.");
    if (password !== confirm) return toast.error("As senhas não coincidem.");
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName.trim() },
      },
    });
    setBusy(false);
    if (error) return toast.error(authErrorMessage(error.message));
    if (data.session) {
      toast.success("Conta criada com sucesso!");
      navigate({ to: "/dashboard", replace: true });
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <GeoApisLogo />
        <h1 className="text-xl font-bold text-primary">Confirme seu e-mail</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Enviamos um link de confirmação para <strong>{email}</strong>. Abra o link para ativar sua
          conta e depois faça login.
        </p>
        <Button asChild className="h-12 w-full max-w-xs">
          <Link to="/login">Voltar para o login</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 text-center">
          <GeoApisLogo />
          <p className="mt-1 text-sm text-muted-foreground">Crie sua conta gratuita</p>
        </div>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome completo</Label>
            <Input
              id="name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-12 bg-card"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 bg-card"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 bg-card"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirmar senha</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="h-12 bg-card"
            />
          </div>

          <Button type="submit" disabled={busy} className="h-12 w-full text-base font-semibold">
            {busy ? "Criando conta…" : "Criar conta"}
          </Button>
          <Button asChild variant="ghost" className="h-12 w-full">
            <Link to="/login">Já tenho conta</Link>
          </Button>
        </form>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Ao criar a conta você concorda com os{" "}
          <Link to="/termos" className="underline">
            Termos
          </Link>{" "}
          e a{" "}
          <Link to="/privacidade" className="underline">
            Política de Privacidade
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
