import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage } from "@/hooks/useAuth";
import { GeoApisLogo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/recuperar-senha")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Recuperar senha — GeoApis" },
      { name: "description", content: "Receba um link para redefinir a senha da sua conta GeoApis." },
      { property: "og:title", content: "Recuperar senha — GeoApis" },
      { property: "og:description", content: "Redefina a senha da sua conta GeoApis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ForgotPage,
});

function ForgotPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    setBusy(false);
    if (error) return toast.error(authErrorMessage(error.message));
    setSent(true);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-sm text-center">
        <GeoApisLogo />
        <h1 className="mt-6 text-xl font-bold text-primary">Recuperar senha</h1>
        {sent ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Se existir uma conta com esse e-mail, enviamos um link para redefinir a senha.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4 text-left">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 bg-card"
              />
            </div>
            <Button type="submit" disabled={busy} className="h-12 w-full font-semibold">
              {busy ? "Enviando…" : "Enviar link"}
            </Button>
          </form>
        )}
        <Button asChild variant="ghost" className="mt-4 h-12 w-full">
          <Link to="/login">Voltar para o login</Link>
        </Button>
      </div>
    </div>
  );
}
