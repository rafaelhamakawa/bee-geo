import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StatCard({
  icon,
  label,
  value,
  hint,
  tone = "primary",
}: {
  icon?: ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: "primary" | "honey" | "muted";
}) {
  const toneText =
    tone === "honey" ? "text-honey" : tone === "muted" ? "text-foreground" : "text-primary";
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        {icon ? (
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
              tone === "honey" ? "bg-accent/40 text-honey" : "bg-primary/10 text-primary",
            )}
          >
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={cn("truncate text-xl font-extrabold", toneText)}>{value}</p>
          {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
        </div>
      </div>
    </div>
  );
}

/** Gráfico de barras horizontais em CSS puro (sem dependências novas). */
export function BarList({
  items,
  format,
  emptyLabel = "Sem dados no período.",
}: {
  items: { label: string; value: number; color?: string }[];
  format: (v: number) => string;
  emptyLabel?: string;
}) {
  const max = Math.max(...items.map((i) => i.value), 0);
  if (!items.length || max <= 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-3 text-sm">
          <span className="w-24 shrink-0 truncate text-muted-foreground">{i.label}</span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <span
              className={cn("block h-full rounded-full", i.color ?? "bg-primary")}
              style={{ width: `${max ? Math.max(2, (i.value / max) * 100) : 0}%` }}
            />
          </span>
          <span className="w-24 shrink-0 text-right font-semibold text-primary">
            {format(i.value)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Colunas mensais (receita x gastos ou produção). */
export function ColumnChart({
  data,
  format,
}: {
  data: { label: string; series: { value: number; color: string; name: string }[] }[];
  format: (v: number) => string;
}) {
  const max = Math.max(...data.flatMap((d) => d.series.map((s) => s.value)), 0);
  if (max <= 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">Sem dados no período.</p>;
  }
  return (
    <div className="flex items-end gap-2 overflow-x-auto pb-1">
      {data.map((d) => (
        <div key={d.label} className="flex min-w-12 flex-1 flex-col items-center gap-1">
          <div className="flex h-28 w-full items-end justify-center gap-1">
            {d.series.map((s) => (
              <span
                key={s.name}
                title={`${s.name}: ${format(s.value)}`}
                className={cn("w-3 rounded-t-md", s.color)}
                style={{ height: `${max ? Math.max(2, (s.value / max) * 100) : 0}%` }}
              />
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
      <p className="text-sm font-medium text-primary">{title}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
