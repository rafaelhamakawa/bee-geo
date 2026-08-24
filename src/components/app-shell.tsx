import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { BarChart3, Home, Layers, User, ArrowLeft } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { GeoApisMark, GeoApisWordmark } from "@/components/brand";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";

const NAV = [
  { to: "/dashboard", label: "Início", icon: Home },
  { to: "/apiarios", label: "Apiários", icon: Layers },
  { to: "/financeiro", label: "Financeiro", icon: BarChart3 },
  { to: "/perfil", label: "Perfil", icon: User },
] as const;


export function initialsOf(name?: string | null, email?: string | null) {
  const base = (name || email || "").trim();
  if (!base) return "?";
  const parts = base.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || base.charAt(0).toUpperCase();
}

export function AppShell({
  children,
  title,
  back,
  hideNav,
}: {
  children: ReactNode;
  title?: string;
  back?: string;
  hideNav?: boolean;
}) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-5">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  const initials = initialsOf(user.user_metadata?.['full_name'] as string, user.email);

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          {back ? (
            <Link
              to={back}
              aria-label="Voltar"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-primary"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
          ) : null}
          <Link to="/dashboard" className="flex items-center gap-2" aria-label="Ir para o início">
            <GeoApisMark className="h-8 w-8" />
            <GeoApisWordmark className="text-xl" />
          </Link>
          <Link
            to="/perfil"
            aria-label="Abrir meu perfil"
            className="ml-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground"
          >
            {initials}
          </Link>
        </div>
        {title ? (
          <div className="mx-auto max-w-2xl px-4 pb-3">
            <h1 className="text-3xl font-extrabold text-primary">{title}</h1>
          </div>
        ) : null}
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4">{children}</main>

      {!hideNav ? (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card">
          <ul className="mx-auto flex max-w-2xl">
            {NAV.map(({ to, label, icon: Icon }) => {
              const active = pathname === to || pathname.startsWith(to + "/");
              return (
                <li key={to} className="flex-1">
                  <Link
                    to={to}
                    className="flex min-h-16 flex-col items-center justify-center gap-1 py-2 text-xs font-medium text-primary"
                  >
                    <span
                      className={`flex h-9 w-14 items-center justify-center rounded-full ${
                        active ? "bg-accent/40" : ""
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}

export function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const steps = ["Localização", "Análise", "Resultado"];
  return (
    <ol className="mt-6 flex items-center justify-between rounded-2xl bg-card p-4 shadow-sm">
      {steps.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const active = n === step;
        return (
          <li key={label} className="flex flex-1 flex-col items-center gap-1">
            <span
              aria-current={active ? "step" : undefined}
              className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-bold ${
                active
                  ? "border-honey bg-accent/40 text-honey"
                  : "border-border text-muted-foreground"
              }`}
            >
              {n}
            </span>
            <span className={`text-xs ${active ? "text-primary" : "text-muted-foreground"}`}>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
