import { createServerFn } from "@tanstack/react-start";

const SOURCE_URL = "https://mel.com.br/fipmel/";
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

export type FipmelQuote = {
  valor_brl_kg: number;
  data_referencia: string;
  consultado_em: string;
  fonte: string;
  fonte_url: string;
  erro?: string | undefined;
};

function parseQuote(html: string) {
  for (const [, script = ""] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    const m = /window\.FIPMEL_DADOS\s*=\s*(\{[\s\S]*?\})\s*(?=;\s*(?:window\.|$)|$)/.exec(script);
    if (!m) continue;
    const data = JSON.parse(m[1] ?? "{}");
    const br = data?.ufs?.BR;
    const d = typeof data?.atualizado === "string" ? /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(data.atualizado) : null;
    if (typeof br?.i !== "number" || !Number.isFinite(br.i) || !d) throw new Error("Formato inesperado");
    const centavos = Math.round(br.i * 100);
    if (centavos < 1) throw new Error("Valor inválido");
    return { valor_centavos: centavos, data_referencia: `${d[3]}-${d[2]}-${d[1]}` };
  }
  throw new Error("Cotação ausente na página");
}

export const getFipmelQuote = createServerFn({ method: "GET" }).handler(
  async (): Promise<FipmelQuote | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: saved } = await supabaseAdmin
      .from("fipmel_cotacao_atual" as never)
      .select("valor_centavos,data_referencia,consultado_em")
      .eq("id", 1)
      .maybeSingle();
    let row = saved as { valor_centavos: number; data_referencia: string; consultado_em: string } | null;
    let erro: string | undefined;
    if (!row || Date.now() - Date.parse(row.consultado_em) > MAX_AGE_MS) {
      try {
        const res = await fetch(SOURCE_URL, { headers: { Accept: "text/html", "User-Agent": "Mozilla/5.0 (compatible; GeoApis/1.0)" }, signal: AbortSignal.timeout(12000) });
        if (!res.ok) throw new Error(`FIPMEL HTTP ${res.status}`);
        const q = parseQuote(await res.text());
        const fresh = { id: 1, ...q, consultado_em: new Date().toISOString() };
        await supabaseAdmin.from("fipmel_cotacao_atual" as never).upsert(fresh as never);
        row = fresh;
      } catch (e) {
        erro = e instanceof Error ? e.message : "Falha na coleta";
        console.warn("FIPMEL:", erro);
      }
    }
    if (!row) return null;
    return {
      valor_brl_kg: row.valor_centavos / 100,
      data_referencia: row.data_referencia,
      consultado_em: row.consultado_em,
      fonte: "FIPMEL / Mel.com.br",
      fonte_url: SOURCE_URL,
      erro,
    };
  },
);
