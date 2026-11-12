import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Loader2, LocateFixed, PenLine, Save, FileDown, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BIOMES,
  biomeMultiplier,
  computeAnalysis,
  CIRCLE_AREA_HA,
  fmtHa,
  fmtPct,
  formatCoord,
  TECHNICAL_DISCLAIMER,
  LIABILITY_DISCLAIMER,
  type PatchInput,
} from "@/lib/geoapis";
import { multiPolygonAreaHa, polygonAreaHa, scaleArea, scanVegetation, type MultiPoly } from "@/lib/vegetation-scan";
import { parsePlusCode } from "@/lib/pluscode";
import { Slider } from "@/components/ui/slider";
import { Maximize2, X } from "lucide-react";

const ApiaryMap = lazy(() => import("@/components/apiary-map"));

export const Route = createFileRoute("/estudo-pasto")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Estudo de pasto apícola — GeoApis" },
      { name: "description", content: "Avalie o pasto apícola de um local antes de instalar o apiário." },
      { property: "og:title", content: "Estudo de pasto apícola — GeoApis" },
      { property: "og:description", content: "Avalie um local e salve como apiário ou exporte em PDF." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudyPage,
});

type Row = PatchInput & { id: string; biome: string; base?: MultiPoly; geom?: MultiPoly; scale: number; kind: "dark" | "light" | "manual" };
const AREA_COLORS = { dark: "#1E7A3C", light: "#7CC94B", manual: "#2F80ED" } as const;
let rowSeq = 0;
const newId = () => `a${++rowSeq}`;

type Near = { latitude: number; longitude: number; name?: string | null };

function StudyPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<"local" | "analise">("local");
  const [lat, setLat] = useState(-15.7801);
  const [lng, setLng] = useState(-47.9292);
  const [plusCode, setPlusCode] = useState("");
  const [searchingCode, setSearchingCode] = useState(false);
  const [biome, setBiome] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [scanning, setScanning] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([]);
  const [nearby, setNearby] = useState<Near[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const sel = rows.find((r) => r.id === selected) ?? null;

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function resize(r: Row, scale: number) {
    if (!r.base) return;
    const geom = scaleArea(r.base, scale, lat, lng);
    updateRow(r.id, { scale, geom, area_ha: Number(multiPolygonAreaHa(geom).toFixed(2)) });
  }
  function changeBiome(r: Row, b: string) {
    updateRow(r.id, { biome: b, hive_multiplier: biomeMultiplier(b) });
  }
  function removeRow(id: string) {
    setRows((rs) => rs.filter((r) => r.id !== id).map((r, i) => ({ ...r, patch_number: i + 1 })));
    setSelected(null); setEditing(false);
  }
  const mapAreas = useMemo(
    () => rows.filter((r) => r.geom).map((r) => ({ id: r.id, geometry: r.geom!, color: AREA_COLORS[r.kind], selected: r.id === selected })),
    [rows, selected],
  );

  const mult = biomeMultiplier(biome);
  const totals = useMemo(() => computeAnalysis(rows, 0), [rows]);

  function locate() {
    navigator.geolocation?.getCurrentPosition(
      (p) => { setLat(p.coords.latitude); setLng(p.coords.longitude); },
      () => toast.error("Não foi possível obter sua localização."),
    );
  }

  async function searchPlusCode() {
    if (!plusCode.trim()) { toast.error("Digite um Plus Code. Ex.: 588MC9X8+RC"); return; }
    setSearchingCode(true);
    try {
      const result = await parsePlusCode(plusCode);
      if (!result) {
        toast.error("Plus Code inválido. Ex.: 588MC9X8+RC ou C9X8+RC São Paulo");
      } else {
        setLat(Number(result.lat.toFixed(6)));
        setLng(Number(result.lng.toFixed(6)));
        toast.success("Localização encontrada pelo Plus Code.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível localizar o Plus Code.");
    }
    setSearchingCode(false);
  }
  useEffect(locate, []);

  async function start() {
    setStep("analise");
    setScanning(true);
    setRows([]);
    const { data } = await supabase.from("apiaries").select("name,latitude,longitude");
    setNearby(
      ((data ?? []) as Near[]).filter((a) => {
        if (a.latitude == null || a.longitude == null) return false;
        const dy = (a.latitude - lat) * 110574;
        const dx = (a.longitude - lng) * 111320 * Math.cos((lat * Math.PI) / 180);
        return Math.hypot(dx, dy) < 3000;
      }),
    );
    try {
      const r = await scanVegetation(lat, lng);
      const det: Row[] = r.areas.map((a, i) => ({
        id: newId(), kind: a.kind, biome, scale: 1, base: a.geometry, geom: a.geometry,
        patch_number: i + 1,
        name: `${a.kind === "dark" ? "Verde escuro" : "Verde claro"} ${i + 1}`,
        vegetation_type: a.kind === "dark" ? "Formação florestal" : "Formação campestre",
        land_cover_type: a.kind === "dark" ? "Formação florestal" : "Formação campestre",
        area_ha: Number(a.area_ha.toFixed(2)), hive_multiplier: mult, is_approved: true,
      }));
      if (!det.length) toast.error("Nenhuma área verde detectada. Delimite manualmente.");
      setRows(det);
    } catch {
      toast.error("Não foi possível analisar a imagem. Delimite as áreas manualmente.");
    }
    setScanning(false);
  }

  function finishPolygon() {
    if (drawPoints.length < 3) { toast.error("Marque ao menos 3 pontos no mapa."); return; }
    const area = polygonAreaHa(drawPoints);
    const geom: MultiPoly = [[[...drawPoints, drawPoints[0]!]]];
    setRows([...rows, { id: newId(), kind: "manual", biome, scale: 1, base: geom, geom, patch_number: rows.length + 1, name: `Área delimitada ${rows.length + 1}`, vegetation_type: "Vegetação nativa", land_cover_type: "Vegetação nativa", area_ha: Number(area.toFixed(2)), hive_multiplier: mult, is_approved: true }]);
    setDrawPoints([]);
    setDrawing(false);
  }

  function discard() {
    setRows([]); setDrawPoints([]); setName(""); setStep("local");
    toast("Estudo descartado.");
    navigate({ to: "/dashboard" });
  }

  async function exportPdf() {
    const { exportStudyPdf } = await import("@/lib/study-pdf");
    const { ibgeLocate } = await import("@/lib/ibge");
    const loc = await ibgeLocate(lat, lng);
    await exportStudyPdf({ name, lat, lng, biome, nearby, totals, loc,
      areas: totals.patches.map((p, i) => ({ ...p, geom: rows[i]?.geom, biome: rows[i]?.biome })) });
  }

  async function saveAsApiary() {
    if (!user) return;
    if (!name.trim()) { toast.error("Informe um nome para o apiário."); return; }
    setBusy(true);
    const { data: ap, error } = await supabase
      .from("apiaries")
      .insert({ user_id: user.id, name: name.trim(), latitude: lat, longitude: lng, biome: biome || null, current_hives: 0, status: "active" } as never)
      .select("id").single();
    if (error || !ap) { setBusy(false); toast.error("Não foi possível salvar o apiário."); return;  }
    const apId = (ap as { id: string }).id;
    const { data: an } = await supabase.from("forage_analyses").insert({
      user_id: user.id, apiary_id: apId, analysis_mode: "manual", status: "completed", biome: biome || null,
      circle_area_ha: CIRCLE_AREA_HA, forage_area_ha: totals.total_forage_area_ha, forage_percentage: totals.total_forage_percentage,
      gross_hive_capacity: totals.total_gross_hives, safety_factor: 0.85, safe_hive_capacity: totals.safe_hives,
      technical_notes: "Gerado a partir do estudo de pasto apícola.",
    } as never).select("id").single();
    if (an && totals.patches.length) {
      await supabase.from("forage_patches").insert(totals.patches.map((p, i) => ({
        user_id: user.id, analysis_id: (an as { id: string }).id, patch_number: p.patch_number ?? i + 1, name: p.name ?? null,
        land_cover_type: p.land_cover_type ?? null, vegetation_type: p.vegetation_type ?? null, area_ha: p.area_ha,
        percentage: p.percentage, hive_multiplier: p.hive_multiplier, gross_hives: p.gross_hives, is_approved: true, source: "manual",
      })) as never);
    }
    setBusy(false);
    toast.success("Apiário salvo com o estudo.");
    navigate({ to: "/apiarios/$id", params: { id: apId } });
  }

  const map = (
    <Suspense fallback={<Skeleton className="h-72 w-full rounded-2xl" />}>
      <ApiaryMap
        latitude={lat}
        longitude={lng}
        draggable={step === "local"}
        onMove={(a, b) => { setLat(a); setLng(b); }}
        nearby={step === "analise" ? nearby : []}
        drawing={drawing}
        drawPoints={drawPoints}
        onDrawPoint={(x, yy) => setDrawPoints((p) => [...p, [x, yy]])}
        areas={step === "analise" ? mapAreas : []}
        onAreaClick={(id) => { setSelected(id); setEditing(false); }}
      />
    </Suspense>
  );

  if (step === "local") {
    return (
      <AppShell title="Estudo de pasto apícola" back="/dashboard">
        <p className="mb-3 text-sm text-muted-foreground">Toque no mapa ou arraste o marcador até o local que deseja estudar.</p>
        {map}
        <p className="mt-2 text-center text-xs text-muted-foreground">{formatCoord(lat, lng)}</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="lat">Latitude</Label>
            <Input
              id="lat"
              type="number"
              step="any"
              value={lat}
              onChange={(e) => setLat(Number(e.target.value))}
              className="h-12 bg-card"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lng">Longitude</Label>
            <Input
              id="lng"
              type="number"
              step="any"
              value={lng}
              onChange={(e) => setLng(Number(e.target.value))}
              className="h-12 bg-card"
            />
          </div>
        </div>
        <Button variant="outline" className="mt-3 w-full" onClick={locate}><LocateFixed className="mr-2 h-4 w-4" />Usar minha localização</Button>
        <div className="mt-4 space-y-2">
          <Label>Bioma</Label>
          <Select value={biome} onValueChange={setBiome}>
            <SelectTrigger><SelectValue placeholder="Selecione o bioma" /></SelectTrigger>
            <SelectContent>{BIOMES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button className="mt-5 h-12 w-full" onClick={start}><Sparkles className="mr-2 h-4 w-4" />Analisar pasto</Button>
      </AppShell>
    );
  }

  return (
    <AppShell title="Estudo de pasto apícola" back="/dashboard">
      {map}
      {rows.some((r) => r.geom) && !sel ? (
        <p className="mt-2 text-center text-xs text-muted-foreground">Toque numa área verde do mapa para editar, trocar o bioma ou excluir.</p>
      ) : null}
      {sel ? (
        <div className="mt-3 rounded-2xl border-2 border-primary bg-card p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-bold text-primary">{sel.name}</p>
              <p className="text-xs text-muted-foreground">{fmtHa(sel.area_ha)} ha · {sel.biome || "Bioma não informado"} · ×{sel.hive_multiplier}</p>
            </div>
            <button aria-label="Fechar" onClick={() => { setSelected(null); setEditing(false); }}><X className="h-4 w-4" /></button>
          </div>
          {editing && sel.base ? (
            <div className="mt-4 space-y-2">
              <Label>Tamanho da área: {Math.round(sel.scale * 100)}%</Label>
              <Slider min={20} max={300} step={5} value={[Math.round(sel.scale * 100)]} onValueChange={(v) => resize(sel, (v[0] ?? 100) / 100)} />
              <div className="flex justify-between text-xs text-muted-foreground"><span>Reduzir</span><span>Aumentar</span></div>
            </div>
          ) : null}
          <div className="mt-4 space-y-2">
            <Label>Bioma desta área</Label>
            <Select value={sel.biome} onValueChange={(b) => changeBiome(sel, b)}>
              <SelectTrigger><SelectValue placeholder="Selecione o bioma" /></SelectTrigger>
              <SelectContent>{BIOMES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant={editing ? "default" : "outline"} disabled={!sel.base} onClick={() => setEditing(!editing)}><Maximize2 className="mr-2 h-4 w-4" />Editar tamanho</Button>
            <Button variant="outline" className="text-destructive" onClick={() => removeRow(sel.id)}><Trash2 className="mr-2 h-4 w-4" />Excluir área</Button>
          </div>
        </div>
      ) : null}
      <div className="mt-3 flex gap-2">
        {drawing ? (
          <>
            <Button className="flex-1" onClick={finishPolygon}>Concluir área ({drawPoints.length})</Button>
            <Button variant="ghost" onClick={() => { setDrawing(false); setDrawPoints([]); }}>Cancelar</Button>
          </>
        ) : (
          <Button variant="outline" className="flex-1" onClick={() => setDrawing(true)}><PenLine className="mr-2 h-4 w-4" />Delimitar área manualmente</Button>
        )}
      </div>

      {scanning ? (
        <p className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Analisando vegetação pelo satélite…</p>
      ) : null}

      {rows.length ? (
        <div className="mt-4 rounded-2xl bg-card p-4 shadow-sm">
          <h2 className="mb-2 font-bold text-primary">Fragmentos</h2>
          {rows.map((r) => (
            <div key={r.id} className={`flex items-center justify-between rounded-lg px-1 py-1 text-sm ${r.id === selected ? "bg-primary/10" : ""}`}>
              <button className="flex min-w-0 items-center gap-2 text-left" onClick={() => { setSelected(r.id); setEditing(false); }}>
                <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: AREA_COLORS[r.kind] }} />
                <span className="truncate">{r.name}{r.biome ? ` · ${r.biome}` : ""}</span>
              </button>
              <span className="flex items-center gap-2 text-muted-foreground">{fmtHa(r.area_ha)} ha
                <button aria-label="Remover" onClick={() => removeRow(r.id)}><Trash2 className="h-4 w-4" /></button>
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl bg-primary p-5 text-center text-primary-foreground">
        <p className="text-sm opacity-90">Capacidade segura recomendada</p>
        <p className="mt-1 text-5xl font-extrabold text-honey-light">{totals.safe_hives}</p>
        <p className="text-sm opacity-90">colmeias</p>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-card p-3 shadow-sm"><p className="font-bold text-primary">{fmtHa(totals.total_forage_area_ha)}</p><p className="text-xs text-muted-foreground">ha de pasto</p></div>
        <div className="rounded-2xl bg-card p-3 shadow-sm"><p className="font-bold text-primary">{fmtPct(totals.total_forage_percentage)}</p><p className="text-xs text-muted-foreground">do círculo</p></div>
        <div className="rounded-2xl bg-card p-3 shadow-sm"><p className="font-bold text-primary">{totals.total_gross_hives.toFixed(1)}</p><p className="text-xs text-muted-foreground">cap. bruta</p></div>
      </div>
      {nearby.length ? (
        <p className="mt-3 rounded-2xl bg-destructive/10 p-3 text-xs text-destructive">{nearby.length} apiário(s) vizinho(s) com raio sobreposto — competição por néctar.</p>
      ) : null}

      <div className="mt-5 space-y-2">
        <Label htmlFor="nm">Nome do apiário (para salvar)</Label>
        <Input id="nm" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Sítio Boa Vista" />
      </div>
      <div className="mt-4 space-y-3">
        <Button className="h-12 w-full" disabled={busy || scanning} onClick={saveAsApiary}><Save className="mr-2 h-4 w-4" />Salvar como apiário</Button>
        <Button variant="outline" className="h-12 w-full" disabled={scanning} onClick={exportPdf}><FileDown className="mr-2 h-4 w-4" />Exportar PDF</Button>
        <Button variant="ghost" className="h-12 w-full text-destructive" onClick={discard}><Trash2 className="mr-2 h-4 w-4" />Descartar</Button>
      </div>
      <p className="mt-6 rounded-2xl border border-border bg-muted p-3 text-xs text-muted-foreground">{LIABILITY_DISCLAIMER}</p>
    </AppShell>
  );
}
