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
  type PatchInput,
} from "@/lib/geoapis";
import { polygonAreaHa, scanVegetation } from "@/lib/vegetation-scan";

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

type Near = { latitude: number; longitude: number; name?: string | null };

function StudyPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<"local" | "analise">("local");
  const [lat, setLat] = useState(-15.7801);
  const [lng, setLng] = useState(-47.9292);
  const [biome, setBiome] = useState("");
  const [rows, setRows] = useState<PatchInput[]>([]);
  const [scanning, setScanning] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([]);
  const [nearby, setNearby] = useState<Near[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const mult = biomeMultiplier(biome);
  const totals = useMemo(() => computeAnalysis(rows, 0), [rows]);

  function locate() {
    navigator.geolocation?.getCurrentPosition(
      (p) => { setLat(p.coords.latitude); setLng(p.coords.longitude); },
      () => toast.error("Não foi possível obter sua localização."),
    );
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
      const det: PatchInput[] = [];
      if (r.darkGreenHa > 0.01)
        det.push({ patch_number: 1, name: "Vegetação verde escuro (detectada)", vegetation_type: "Formação florestal", land_cover_type: "Formação florestal", area_ha: Number(r.darkGreenHa.toFixed(2)), hive_multiplier: mult, is_approved: true });
      if (r.lightGreenHa > 0.01)
        det.push({ patch_number: det.length + 1, name: "Vegetação verde claro (detectada)", vegetation_type: "Formação campestre", land_cover_type: "Formação campestre", area_ha: Number(r.lightGreenHa.toFixed(2)), hive_multiplier: mult, is_approved: true });
      if (!det.length) toast.error("Nenhuma área verde detectada. Delimite manualmente.");
      setRows(det);
    } catch {
      toast.error("Não foi possível analisar a imagem. Delimite as áreas manualmente.");
    }
    setScanning(false);
  }

  function finishPolygon() {
    if (drawPoints.length < 3) return toast.error("Marque ao menos 3 pontos no mapa.");
    const area = polygonAreaHa(drawPoints);
    setRows([...rows, { patch_number: rows.length + 1, name: `Área delimitada ${rows.length + 1}`, vegetation_type: "Vegetação nativa", land_cover_type: "Vegetação nativa", area_ha: Number(area.toFixed(2)), hive_multiplier: mult, is_approved: true }]);
    setDrawPoints([]);
    setDrawing(false);
  }

  function discard() {
    setRows([]); setDrawPoints([]); setName(""); setStep("local");
    toast("Estudo descartado.");
    navigate({ to: "/dashboard" });
  }

  async function exportPdf() {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    let y = 20;
    const line = (t: string, size = 11, bold = false) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(size);
      for (const l of doc.splitTextToSize(t, 175)) { if (y > 280) { doc.addPage(); y = 20; } doc.text(l, 18, y); y += size * 0.5 + 1.5; }
    };
    line("GeoApis — Estudo de pasto apícola", 16, true); y += 2;
    line(`Data: ${new Date().toLocaleDateString("pt-BR")}`);
    if (name) line(`Local: ${name}`);
    line(`Coordenadas: ${formatCoord(lat, lng)}`);
    line(`Bioma: ${biome || "Não informado"}`); y += 3;
    line("Resultado", 13, true);
    line(`Raio de voo: 1,5 km (${fmtHa(CIRCLE_AREA_HA)} ha)`);
    line(`Área de pasto: ${fmtHa(totals.total_forage_area_ha)} ha`);
    line(`Percentual do círculo: ${fmtPct(totals.total_forage_percentage)}`);
    line(`Capacidade bruta: ${totals.total_gross_hives.toFixed(2)} colmeias`);
    line("Fator de segurança: 0,85");
    line(`Capacidade segura recomendada: ${totals.safe_hives} colmeias`, 12, true);
    line(`Apiários vizinhos (raios sobrepostos): ${nearby.length}`); y += 3;
    line("Fragmentos", 13, true);
    totals.patches.forEach((p) => line(`• ${p.name}: ${fmtHa(p.area_ha)} ha (${fmtPct(p.percentage)})`));
    y += 4;
    line(TECHNICAL_DISCLAIMER, 8);
    doc.save(`estudo-pasto-${Date.now()}.pdf`);
  }

  async function saveAsApiary() {
    if (!user) return;
    if (!name.trim()) return toast.error("Informe um nome para o apiário.");
    setBusy(true);
    const { data: ap, error } = await supabase
      .from("apiaries")
      .insert({ user_id: user.id, name: name.trim(), latitude: lat, longitude: lng, biome: biome || null, current_hives: 0, status: "active" } as never)
      .select("id").single();
    if (error || !ap) { setBusy(false); return toast.error("Não foi possível salvar o apiário."); }
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
      />
    </Suspense>
  );

  if (step === "local") {
    return (
      <AppShell title="Estudo de pasto apícola" back="/dashboard">
        <p className="mb-3 text-sm text-muted-foreground">Toque no mapa ou arraste o marcador até o local que deseja estudar.</p>
        {map}
        <p className="mt-2 text-center text-xs text-muted-foreground">{formatCoord(lat, lng)}</p>
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
          {rows.map((r, i) => (
            <div key={i} className="flex items-center justify-between py-1 text-sm">
              <span className="truncate">{r.name}</span>
              <span className="flex items-center gap-2 text-muted-foreground">{fmtHa(r.area_ha)} ha
                <button aria-label="Remover" onClick={() => setRows(rows.filter((_, k) => k !== i))}><Trash2 className="h-4 w-4" /></button>
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
    </AppShell>
  );
}
