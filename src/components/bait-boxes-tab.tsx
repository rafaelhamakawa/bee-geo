import { lazy, Suspense, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Crosshair, MapPin, Navigation, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Apiary } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HivePhoto } from "@/components/hive-photo";
import {
  HIVE_PHOTO_BUCKET,
  HIVE_PHOTO_MAX_BYTES,
  HIVE_PHOTO_TYPES,
  fmtDate,
} from "@/lib/hives";
import {
  distanceMeters,
  fmtDistance,
  mapsDirectionsUrl,
  nextBaitCode,
  type BaitBox,
} from "@/lib/bait-boxes";
import type { ExtraMarker } from "@/components/apiary-map";

const ApiaryMap = lazy(() => import("@/components/apiary-map"));

export function BaitBoxesTab({ apiary }: { apiary: Apiary }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [picking, setPicking] = useState(false);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<{ lat: number; lng: number } | null>(null);
  const [code, setCode] = useState("");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);

  const { data: boxes, isLoading, isError } = useQuery({
    queryKey: ["bait-boxes", apiary.id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bait_boxes")
        .select("*")
        .eq("apiary_id", apiary.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BaitBox[];
    },
  });

  const list = boxes ?? [];

  const markers = useMemo<ExtraMarker[]>(() => {
    const out: ExtraMarker[] = [];
    if (me) out.push({ latitude: me.lat, longitude: me.lng, color: "#C1121F", title: "Você está aqui" });
    for (const b of list) {
      out.push({ latitude: b.latitude, longitude: b.longitude, color: "#F5A000", title: b.code });
    }
    if (pending) {
      out.push({ latitude: pending.lat, longitude: pending.lng, color: "#2563EB", title: "Nova caixa isca" });
    }
    return out;
  }, [me, list, pending]);

  function locate(then?: (lat: number, lng: number) => void) {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Seu aparelho não permite obter a localização.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setMe({ lat, lng });
        then?.(lat, lng);
      },
      () => {
        setLocating(false);
        toast.error("Não foi possível obter sua localização. Autorize o acesso e tente de novo.");
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  function startWithMyLocation() {
    locate((lat, lng) => openDialog(lat, lng));
  }

  function openDialog(lat: number, lng: number) {
    setPending({ lat, lng });
    setCode(nextBaitCode(list.map((b) => b.code)));
    setNotes("");
    setPhoto(null);
    setPicking(false);
    setOpen(true);
  }

  function pickPhoto() {
    fileRef.current?.click();
  }

  function onPhoto(file?: File | null) {
    if (!file) return;
    if (!HIVE_PHOTO_TYPES.includes(file.type)) {
      toast.error("Use uma foto JPG, PNG ou WEBP.");
      return;
    }
    if (file.size > HIVE_PHOTO_MAX_BYTES) {
      toast.error("A foto deve ter no máximo 5 MB.");
      return;
    }
    setPhoto(file);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!user || !pending) throw new Error("no-data");
      let photo_path: string | null = null;
      if (photo) {
        const ext = photo.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${user.id}/iscas/${apiary.id}-${Date.now()}.${ext}`;
        const up = await supabase.storage
          .from(HIVE_PHOTO_BUCKET)
          .upload(path, photo, { contentType: photo.type, upsert: false });
        if (up.error) throw up.error;
        photo_path = path;
      }
      const { error } = await supabase.from("bait_boxes").insert({
        apiary_id: apiary.id,
        user_id: user.id,
        code: code.trim(),
        latitude: pending.lat,
        longitude: pending.lng,
        status: "installed",
        photo_path,
        notes: notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Caixa isca salva com a localização.");
      setOpen(false);
      setPending(null);
      setPhoto(null);
      qc.invalidateQueries({ queryKey: ["bait-boxes", apiary.id] });
    },
    onError: (e: unknown) => {
      const msg = String((e as { message?: string })?.message ?? "");
      toast.error(
        msg.includes("duplicate")
          ? "Já existe uma caixa isca com este código."
          : "Não foi possível salvar a caixa isca.",
      );
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bait_boxes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Caixa isca removida.");
      qc.invalidateQueries({ queryKey: ["bait-boxes", apiary.id] });
    },
    onError: () => toast.error("Não foi possível remover a caixa isca."),
  });

  if (apiary.latitude == null || apiary.longitude == null) {
    return (
      <p className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground">
        Defina a localização do apiário para usar as caixas isca.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <Suspense fallback={<Skeleton className="h-72 w-full rounded-2xl" />}>
        <ApiaryMap
          latitude={apiary.latitude}
          longitude={apiary.longitude}
          markers={markers}
          onMapClick={picking ? (lat, lng) => openDialog(lat, lng) : undefined}
          className="h-72 w-full rounded-2xl"
        />
      </Suspense>

      <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-primary align-middle" /> Apiário
        </span>
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-destructive align-middle" /> Você
        </span>
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-honey align-middle" /> Caixas isca
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Button variant="outline" className="h-12" onClick={() => locate()} disabled={locating}>
          <Crosshair className="mr-1 h-4 w-4" />
          {locating ? "Localizando…" : "Minha localização"}
        </Button>
        <Button className="h-12 font-semibold" onClick={startWithMyLocation} disabled={locating}>
          <Plus className="mr-1 h-4 w-4" /> Adicionar caixa isca
        </Button>
        <Button
          variant={picking ? "default" : "outline"}
          className="h-12"
          onClick={() => setPicking((p) => !p)}
        >
          <MapPin className="mr-1 h-4 w-4" />
          {picking ? "Toque no mapa…" : "Marcar no mapa"}
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-24 w-full rounded-2xl" />
      ) : isError ? (
        <p className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground">
          Não foi possível carregar as caixas isca agora.
        </p>
      ) : list.length === 0 ? (
        <p className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground">
          Nenhuma caixa isca marcada neste apiário.
        </p>
      ) : (
        <ul className="space-y-3">
          {list.map((b) => {
            const dist = me ? distanceMeters(me.lat, me.lng, b.latitude, b.longitude) : null;
            return (
              <li key={b.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm">
                <HivePhoto path={b.photo_path} alt={`Foto da caixa isca ${b.code}`} className="h-20 w-20 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-extrabold text-primary">{b.code}</p>
                  <p className="text-xs text-muted-foreground">
                    {b.latitude.toFixed(5)}, {b.longitude.toFixed(5)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Instalada em {fmtDate(b.installed_at)}
                    {dist != null ? ` · ${fmtDistance(dist)} de você` : ""}
                  </p>
                  {b.notes ? <p className="mt-1 text-xs">{b.notes}</p> : null}
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  <Button asChild variant="outline" size="icon" aria-label={`Rota até ${b.code}`}>
                    <a href={mapsDirectionsUrl(b.latitude, b.longitude)} target="_blank" rel="noreferrer">
                      <Navigation className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={`Remover ${b.code}`}
                    onClick={() => remove.mutate(b.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onPhoto(e.target.files?.[0])}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova caixa isca</DialogTitle>
            <DialogDescription>
              A localização já foi capturada. Tire uma foto do local para encontrar depois.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">
              {pending ? `${pending.lat.toFixed(5)}, ${pending.lng.toFixed(5)}` : "—"}
            </p>
            <div>
              <Label htmlFor="bait-code">Identificação</Label>
              <Input
                id="bait-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="mt-1 h-12"
              />
            </div>
            <div>
              <Label htmlFor="bait-notes">Referência do local (opcional)</Label>
              <Input
                id="bait-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex.: na árvore grande junto à cerca"
                className="mt-1 h-12"
              />
            </div>
            <Button variant="outline" className="h-12 w-full" onClick={pickPhoto}>
              <Camera className="mr-1 h-4 w-4" />
              {photo ? "Trocar foto" : "Tirar foto do local"}
            </Button>
            {photo ? <p className="text-xs text-muted-foreground">Foto pronta: {photo.name}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!code.trim()) {
                  toast.error("Informe a identificação da caixa isca.");
                  return;
                }
                save.mutate();
              }}
              disabled={save.isPending}
            >
              {save.isPending ? "Salvando…" : "Salvar local"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
