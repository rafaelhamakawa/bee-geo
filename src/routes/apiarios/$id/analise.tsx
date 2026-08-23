import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Loader2, Sparkles, PenLine } from "lucide-react";
import { toast } from "sonner";
import { AppShell, StepIndicator } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Apiary } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  biomeMultiplier,
  computeAnalysis,
  fmtHa,
  fmtPct,
  SPECIAL_MULTIPLIERS,
  VEGETATION_TYPES,
  CIRCLE_AREA_HA,
  type PatchInput,
} from "@/lib/geoapis";
import { haToKm2, polygonAreaHa, scanVegetation, type VegetationScan } from "@/lib/vegetation-scan";

const ApiaryMap = lazy(() => import("@/components/apiary-map"));


export const Route = createFileRoute("/apiarios/$id/analise")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Análise do pasto apícola — GeoApis" },
      {
        name: "description",
        content: "Cadastre os fragmentos de vegetação e calcule a capacidade de colmeias.",
      },
      { property: "og:title", content: "Análise do pasto apícola — GeoApis" },
      { property: "og:description", content: "Calcule a área de pasto e a capacidade de colmeias." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalysisPage,
});

type Row = PatchInput & { id: string };

function newRow(n: number, mult: number): Row {
  return {
    id: crypto.randomUUID(),
    patch_number: n,
    name: `Fragmento ${n}`,
    vegetation_type: "Vegetação nativa",
    land_cover_type: "Vegetação nativa",
    area_ha: 0,
    hive_multiplier: mult,
    is_approved: true,
  };
}

function AnalysisPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [scan, setScan] = useState<VegetationScan | null>(null);
  const [scanStatus, setScanStatus] = useState<"idle" | "running" | "done" | "failed">("idle");
  const [drawing, setDrawing] = useState(false);
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([]);
  const scanStarted = useRef(false);


  const { data, isLoading } = useQuery({
    queryKey: ["apiary-analysis", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("apiaries").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as Apiary | null;
    },
  });

  const apiary = data ?? null;
  const baseMultiplier = biomeMultiplier(apiary?.biome);
  const list = rows ?? [newRow(1, baseMultiplier)];

  const totals = useMemo(
    () => computeAnalysis(list, apiary?.current_hives ?? 0),
    [list, apiary?.current_hives],
  );

  const overCircle = totals.total_forage_area_ha > CIRCLE_AREA_HA;

  function update(rowId: string, patch: Partial<Row>) {
    setRows(list.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));
  }

  async function runScan() {
    if (apiary?.latitude == null || apiary?.longitude == null) return;
    setScanStatus("running");
    try {
      const result = await scanVegetation(apiary.latitude, apiary.longitude);
      setScan(result);
      const detected: Row[] = [];
      if (result.darkGreenHa > 0.01)
        detected.push({
          id: crypto.randomUUID(),
          patch_number: 1,
          name: "Vegetação verde escuro (detectada)",
          vegetation_type: "Formação florestal",
          land_cover_type: "Formação florestal",
          area_ha: Number(result.darkGreenHa.toFixed(2)),
          hive_multiplier: baseMultiplier,
          is_approved: true,
        });
      if (result.lightGreenHa > 0.01)
        detected.push({
          id: crypto.randomUUID(),
          patch_number: detected.length + 1,
          name: "Vegetação verde claro (detectada)",
          vegetation_type: "Formação campestre",
          land_cover_type: "Formação campestre",
          area_ha: Number(result.lightGreenHa.toFixed(2)),
          hive_multiplier: baseMultiplier,
          is_approved: true,
        });
      if (detected.length === 0) {
        setScanStatus("failed");
        toast.error("Nenhuma área verde detectada. Delimite manualmente.");
        return;
      }
      setRows(detected);
      setScanStatus("done");
      toast.success("Vegetação detectada automaticamente pelo satélite.");
    } catch {
      setScanStatus("failed");
      toast.error("Não foi possível analisar a imagem. Delimite as áreas manualmente.");
    }
  }

  useEffect(() => {
    if (scanStarted.current) return;
    if (apiary?.latitude == null || apiary?.longitude == null) return;
    scanStarted.current = true;
    void runScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiary?.latitude, apiary?.longitude]);

  function finishPolygon() {
    if (drawPoints.length < 3) {
      toast.error("Marque ao menos 3 pontos no mapa.");
      return;
    }
    const area = polygonAreaHa(drawPoints);
    const base = rows ?? [];
    setRows([
      ...base,
      {
        id: crypto.randomUUID(),
        patch_number: base.length + 1,
        name: `Área delimitada ${base.length + 1}`,
        vegetation_type: "Vegetação nativa",
        land_cover_type: "Vegetação nativa",
        area_ha: Number(area.toFixed(2)),
        hive_multiplier: baseMultiplier,
        is_approved: true,
      },
    ]);
    setDrawPoints([]);
    setDrawing(false);
    toast.success(`Área delimitada: ${fmtHa(area)} ha`);
  }



  async function calculate() {
    if (!user || !apiary) return;
    if (totals.total_forage_area_ha <= 0)
      { toast.error("Informe a área de pelo menos um fragmento."); return; }
    if (overCircle)
      { toast.error("A área total não pode ultrapassar 706,86 ha (raio de 1,5 km)."); return; }
    setBusy(true);
    const { data: analysis, error } = await supabase
      .from("forage_analyses")
      .insert({
        user_id: user.id,
        apiary_id: apiary.id,
        analysis_mode: "manual",
        status: "completed",
        biome: apiary.biome,
        circle_area_ha: CIRCLE_AREA_HA,
        forage_area_ha: totals.total_forage_area_ha,
        forage_percentage: totals.total_forage_percentage,
        gross_hive_capacity: totals.total_gross_hives,
        safety_factor: 0.85,
        safe_hive_capacity: totals.safe_hives,
        technical_notes: "Fragmentos informados manualmente pelo usuário.",
      })
      .select("id")
      .single();

    if (error || !analysis) {
      setBusy(false);
      { toast.error("Erro ao salvar a análise. Tente novamente."); return; }
    }

    const payload = totals.patches.map((p, i) => ({
      user_id: user.id,
      analysis_id: analysis.id as string,
      patch_number: p.patch_number ?? i + 1,
      name: p.name ?? null,
      land_cover_type: p.land_cover_type ?? null,
      vegetation_type: p.vegetation_type ?? null,
      area_ha: p.area_ha,
      percentage: p.percentage,
      hive_multiplier: p.hive_multiplier,
      gross_hives: p.gross_hives,
      is_approved: p.is_approved !== false,
      source: "manual",
    }));
    const { error: patchErr } = await supabase.from("forage_patches").insert(payload);
    setBusy(false);
    if (patchErr) { toast.error("Erro ao salvar os fragmentos."); return; }
    toast.success("Análise salva com sucesso.");
    navigate({ to: "/analises/$analysisId", params: { analysisId: analysis.id as string } });
  }

  if (isLoading) {
    return (
      <AppShell title="Análise do pasto apícola">
        <Skeleton className="mt-4 h-72 w-full" />
      </AppShell>
    );
  }

  if (!apiary) {
    return (
      <AppShell title="Análise do pasto apícola" back="/apiarios">
        <p className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground">
          Apiário não encontrado.
        </p>
      </AppShell>
    );
  }

  if (apiary.latitude == null || apiary.longitude == null) {
    return (
      <AppShell title="Análise do pasto apícola">
        <StepIndicator step={1} />
        <div className="mt-4 rounded-2xl bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Defina primeiro a localização do apiário para iniciar a análise.
          </p>
          <Button asChild className="mt-4 h-12 w-full">
            <Link to="/apiarios/$id/localizacao" params={{ id }}>
              Definir localização
            </Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Análise do pasto apícola">
      <StepIndicator step={2} />

      <div className="mt-4 space-y-4">
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
          <ApiaryMap
            latitude={apiary.latitude}
            longitude={apiary.longitude}
            className="h-64 w-full rounded-2xl"
          />
        </Suspense>

        <div className="rounded-2xl bg-card p-4 text-sm shadow-sm">
          <p className="font-semibold text-primary">Área de referência</p>
          <p className="text-muted-foreground">
            Círculo de 1,5 km = 706,86 ha · 1% da área = 7,0686 ha
          </p>
          <p className="mt-1 text-muted-foreground">
            Bioma: {apiary.biome ?? "não informado"} · multiplicador base {baseMultiplier}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Serviço automático de detecção ainda não configurado — informe os fragmentos manualmente.
          </p>
        </div>

        <div className="space-y-3">
          {list.map((r, idx) => (
            <div key={r.id} className="rounded-2xl bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-primary">Fragmento {idx + 1}</p>
                {list.length > 1 ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remover fragmento ${idx + 1}`}
                    onClick={() => setRows(list.filter((x) => x.id !== r.id))}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                ) : null}
              </div>

              <div className="mt-3 space-y-3">
                <div className="space-y-2">
                  <Label htmlFor={`veg-${r.id}`}>Tipo de vegetação</Label>
                  <Select
                    value={r.vegetation_type ?? ""}
                    onValueChange={(val) =>
                      update(r.id, {
                        vegetation_type: val,
                        land_cover_type: val,
                        hive_multiplier: SPECIAL_MULTIPLIERS[val] ?? baseMultiplier,
                      })
                    }
                  >
                    <SelectTrigger id={`veg-${r.id}`} className="h-12 w-full">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {VEGETATION_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor={`area-${r.id}`}>Área (ha)</Label>
                    <Input
                      id={`area-${r.id}`}
                      type="number"
                      min={0}
                      step="any"
                      value={r.area_ha}
                      onChange={(e) => update(r.id, { area_ha: Math.max(0, Number(e.target.value)) })}
                      className="h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`mult-${r.id}`}>Multiplicador</Label>
                    <Input
                      id={`mult-${r.id}`}
                      type="number"
                      min={0}
                      step="any"
                      value={r.hive_multiplier}
                      onChange={(e) =>
                        update(r.id, { hive_multiplier: Math.max(0, Number(e.target.value)) })
                      }
                      className="h-12"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {fmtPct((r.area_ha || 0) / 7.06858347)} da área ·{" "}
                  {((r.area_ha || 0) / 7.06858347 * (r.hive_multiplier || 0)).toFixed(2)} colmeias
                  brutas
                </p>
              </div>
            </div>
          ))}

          <Button
            variant="outline"
            className="h-12 w-full"
            onClick={() => setRows([...list, newRow(list.length + 1, baseMultiplier)])}
          >
            <Plus className="mr-2 h-4 w-4" /> Adicionar fragmento
          </Button>
        </div>

        <div className="rounded-2xl bg-card p-4 shadow-sm">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Área total de pasto</span>
            <span className="font-semibold text-primary">
              {fmtHa(totals.total_forage_area_ha)} ha
            </span>
          </div>
          <div className="mt-1 flex justify-between text-sm">
            <span className="text-muted-foreground">Percentual do círculo</span>
            <span className="font-semibold text-primary">
              {fmtPct(totals.total_forage_percentage)}
            </span>
          </div>
          <div className="mt-1 flex justify-between text-sm">
            <span className="text-muted-foreground">Capacidade bruta</span>
            <span className="font-semibold text-honey">
              {totals.total_gross_hives.toFixed(2)}
            </span>
          </div>
          {overCircle ? (
            <p className="mt-2 text-xs text-destructive">
              A área total ultrapassa 706,86 ha. Revise os fragmentos.
            </p>
          ) : null}
        </div>

        <Button onClick={calculate} disabled={busy} className="h-12 w-full font-semibold">
          {busy ? "Calculando…" : "Calcular colmeias"}
        </Button>
        <Button asChild variant="ghost" className="h-12 w-full">
          <Link to="/apiarios/$id" params={{ id }}>
            Voltar ao apiário
          </Link>
        </Button>
      </div>
    </AppShell>
  );
}
