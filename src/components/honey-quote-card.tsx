import { ExternalLink, Droplet } from "lucide-react";
import { useHoneyQuote } from "@/lib/economics-data";
import {
  FIPMEL_SOURCE,
  FIPMEL_URL,
  brl,
  dateBR,
  dateTimeBR,
  quoteFreshness,
} from "@/lib/economics";
import { Skeleton } from "@/components/ui/skeleton";

export function HoneyQuoteCard({ state }: { state?: string | null }) {
  const { data, isLoading, isError } = useHoneyQuote(state);

  if (isLoading) return <Skeleton className="h-32 w-full rounded-2xl" />;

  const quote = data?.quote ?? null;
  const freshness = quoteFreshness(quote);
  const region = data?.region ?? null;

  return (
    <section className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-bold text-primary">Cotação do mel</h2>
        <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
          {region ?? "Região não definida"}
          {state ? ` · ${state.toUpperCase()}` : ""}
        </span>
      </div>

      {freshness === "unavailable" || !quote ? (
        <div className="mt-3 space-y-1">
          <p className="text-sm font-semibold text-destructive">Cotação indisponível</p>
          <p className="text-xs text-muted-foreground">
            Nenhuma cotação válida armazenada para {region ?? "esta região"}. Um administrador pode
            cadastrar ou atualizar em “Cotações do mel”.
          </p>
          {isError ? (
            <p className="text-xs text-destructive">Falha ao consultar o cache de cotações.</p>
          ) : null}
          {data?.lastError?.error_message ? (
            <p className="text-xs text-muted-foreground">
              Último erro: {data.lastError.error_message}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-3 flex items-start gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/40 text-honey">
            <Droplet className="h-6 w-6" />
          </span>
          <div className="min-w-0 space-y-1">
            <p className="text-2xl font-extrabold text-primary">
              {brl(quote.price_avg)}{" "}
              <span className="text-sm font-medium text-muted-foreground">
                / {quote.unit?.replace("R$/", "") || "kg"}
              </span>
            </p>
            {quote.price_min != null || quote.price_max != null ? (
              <p className="text-xs text-muted-foreground">
                Mín. {brl(quote.price_min)} · Máx. {brl(quote.price_max)}
              </p>
            ) : null}
            {quote.honey_type ? (
              <p className="text-xs text-muted-foreground">Tipo: {quote.honey_type}</p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Referência: {dateBR(quote.reference_date)} · Consulta: {dateTimeBR(quote.fetched_at)}
            </p>
            <p className="text-xs">
              {freshness === "fresh" ? (
                <span className="font-semibold text-primary">Cotação atualizada</span>
              ) : (
                <span className="font-semibold text-honey">
                  Cotação desatualizada — última atualização {dateBR(quote.reference_date)}
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        Fonte: {quote?.source_name ?? FIPMEL_SOURCE} —{" "}
        <a
          href={quote?.source_url ?? FIPMEL_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-medium text-primary underline"
        >
          mel.com.br/fipmel <ExternalLink className="h-3 w-3" />
        </a>
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Valor de referência para estimar o estoque. Não é contabilizado como receita.
      </p>
    </section>
  );
}
