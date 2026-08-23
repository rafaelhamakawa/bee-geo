import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useState } from "react";
import { Crosshair } from "lucide-react";
import { toast } from "sonner";
import { AppShell, StepIndicator } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Apiary } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCoord } from "@/lib/geoapis";

const ApiaryMap = lazy(() => import("@/components/apiary-map"));

const DEFAULT_LAT = -15.7801;
const DEFAULT_LNG = -47.9292;

export const Route = createFileRoute("/apiarios/$id/localizacao")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Localização do apiário — GeoApis" },
      {
        name: "description",
        content: "Defina a coordenada do apiário e visualize o raio de voo de 1,5 km.",
      },
      { property: "og:title", content: "Localização do apiário — GeoApis" },
      { property: "og:description", content: "Defina a coordenada e o raio de voo de 1,5 km." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LocationPage,
});

function LocationPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [lat, setLat] = useState<number>(DEFAULT_LAT);
  const [lng, setLng] = useState<number>(DEFAULT_LNG);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["apiary-loc", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("apiaries").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as Apiary | null;
    },
  });

  useEffect(() => {
    if (data && !ready) {
      if (data.latitude != null && data.longitude != null) {
        setLat(data.latitude);
        setLng(data.longitude);
      }
      setReady(true);
    }
  }, [data, ready]);

  function useMyLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Localização não disponível neste dispositivo.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        toast.success("Localização obtida.");
      },
      () => toast.error("Localização não autorizada. Você pode marcar o ponto no mapa."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const valid =
    Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

  async function save() {
    if (!valid) return toast.error("Coordenadas inválidas.");
    setBusy(true);
    const { error } = await supabase
      .from("apiaries")
      .update({ latitude: lat, longitude: lng })
      .eq("id", id);
    setBusy(false);
    if (error) return toast.error("Erro ao salvar a localização.");
    toast.success("Localização salva.");
    qc.invalidateQueries({ queryKey: ["apiary", id] });
    navigate({ to: "/apiarios/$id/analise", params: { id } });
  }

  return (
    <AppShell title="Localização do apiário">
      <StepIndicator step={1} />
      {isLoading || !ready ? (
        <Skeleton className="mt-4 h-72 w-full rounded-2xl" />
      ) : (
        <div className="mt-4 space-y-4">
          <Suspense fallback={<Skeleton className="h-72 w-full rounded-2xl" />}>
            <ApiaryMap
              latitude={lat}
              longitude={lng}
              draggable
              onMove={(la, ln) => {
                setLat(la);
                setLng(ln);
              }}
            />
          </Suspense>
          <p className="text-xs text-muted-foreground">
            Toque no mapa ou arraste o marcador. Raio de voo exibido: 1,5 km (706,86 ha).
          </p>
          {valid ? (
            <p className="text-sm font-medium text-primary">{formatCoord(lat, lng)}</p>
          ) : (
            <p className="text-sm text-destructive">Coordenadas inválidas.</p>
          )}

          <Button variant="outline" onClick={useMyLocation} className="h-12 w-full">
            <Crosshair className="mr-2 h-4 w-4" /> Usar minha localização
          </Button>

          <div className="grid grid-cols-2 gap-3">
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

          <Button onClick={save} disabled={busy || !valid} className="h-12 w-full font-semibold">
            {busy ? "Salvando…" : "Salvar localização e continuar"}
          </Button>
        </div>
      )}
    </AppShell>
  );
}
