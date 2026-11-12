// Localiza município/UF/região pela base do IBGE (via coordenadas).
export type IbgeLocation = { municipio: string; uf: string; regiao: string };

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export async function ibgeLocate(lat: number, lng: number): Promise<IbgeLocation | null> {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&addressdetails=1&lat=${lat}&lon=${lng}`, { headers: { "Accept-Language": "pt-BR" } });
    const j = await r.json();
    const a = j?.address ?? {};
    const uf = String(a["ISO3166-2-lvl4"] ?? "").replace("BR-", "");
    const city = a.city ?? a.town ?? a.municipality ?? a.village ?? "";
    if (!uf) return null;
    const [est, muns] = await Promise.all([
      fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}`).then((x) => x.json()),
      fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`).then((x) => x.json()),
    ]);
    const m = (muns as { nome: string }[]).find((x) => norm(x.nome) === norm(city));
    return { municipio: m?.nome ?? city, uf: est?.sigla ?? uf, regiao: est?.regiao?.nome ?? "" };
  } catch {
    return null;
  }
}
