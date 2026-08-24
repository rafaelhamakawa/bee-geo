import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Apiary } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HivePhoto } from "@/components/hive-photo";
import { cn } from "@/lib/utils";
import {
  ORIGINS,
  fmtDate,
  hiveAlert,
  nextHiveCode,
  toDateInput,
  type Hive,
} from "@/lib/hives";

type FilterKey = "all" | "ok" | "warn" | "urgent";

const FILTERS: { key: FilterKey; label: string; dot?: string }[] = [
  { key: "all", label: "Todas" },
  { key: "ok", label: "Em dia", dot: "bg-primary" },
  { key: "warn", label: "Atenção", dot: "bg-honey" },
  { key: "urgent", label: "Urgentes", dot: "bg-destructive" },
];

const FILTER_STORAGE_KEY = "geoapis:hives-filter";

export function useHives(apiaryId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["hives", apiaryId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hives")
        .select("*")
        .eq("apiary_id", apiaryId)
        .order("code", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Hive[];
    },
  });
}

export function HivesTab({ apiary, safeCapacity }: { apiary: Apiary; safeCapacity: number }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: hives, isLoading, isError } = useHives(apiary.id);
  const [filter, setFilter] = useState<FilterKey>(() => {
    if (typeof window === "undefined") return "all";
    return (sessionStorage.getItem(FILTER_STORAGE_KEY) as FilterKey) || "all";
  });
  const [open, setOpen] = useState(false);
  const [confirmOver, setConfirmOver] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    origin: "capture",
    introduced_at: toDateInput(new Date().toISOString()),
  });

  function changeFilter(key: FilterKey) {
    setFilter(key);
    if (typeof window !== "undefined") sessionStorage.setItem(FILTER_STORAGE_KEY, key);
  }

  const list = hives ?? [];
  const active = useMemo(() => list.filter((h) => h.status === "active"), [list]);
  const counts = useMemo(() => {
    const c = { ok: 0, warn: 0, urgent: 0 };
    for (const h of active) c[hiveAlert(h).level] += 1;
    return c;
  }, [active]);

  const visible = useMemo(
    () => (filter === "all" ? list : list.filter((h) => hiveAlert(h).level === filter)),
    [list, filter],
  );

  const occupancy = safeCapacity > 0 ? Math.min(100, Math.round((active.length / safeCapacity) * 100)) : 0;

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("no-user");
      const { error } = await supabase.from("hives").insert({
        apiary_id: apiary.id,
        user_id: user.id,
        code: form.code.trim(),
        name: form.name.trim() || null,
        origin: form.origin,
        status: "active",
        introduced_at: form.introduced_at || null,
        queen_status: "Presente",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Colmeia adicionada.");
      setOpen(false);
      setConfirmOver(false);
      qc.invalidateQueries({ queryKey: ["hives", apiary.id] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: unknown) => {
      const msg = String((e as { message?: string })?.message ?? "");
      toast.error(msg.includes("duplicate") ? "Já existe uma colmeia com este código." : "Não foi possível adicionar a colmeia.");
    },
  });

  function openDialog() {
    setForm((f) => ({ ...f, code: nextHiveCode(list.map((h) => h.code)) }));
    setConfirmOver(false);
    setOpen(true);
  }

  function submit() {
    if (!form.code.trim()) {
      toast.error("Informe o código da colmeia.");
      return;
    }
    if (safeCapacity > 0 && active.length + 1 > safeCapacity && !confirmOver) {
      setConfirmOver(true);
      return;
    }
    create.mutate();
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }
  if (isError) {
    return (
      <p className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground">
        Não foi possível carregar as colmeias agora.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-card p-4 shadow-sm">
        <p className="font-semibold text-primary">{apiary.name}</p>
        <p className="text-xs text-muted-foreground">
          <MapPin className="mr-1 inline h-3 w-3" />
          {[apiary.city, apiary.state].filter(Boolean).join(" / ") || "Sem localização"}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="text-center">
            <p className="text-3xl font-extrabold text-primary">{active.length}</p>
            <p className="text-xs text-muted-foreground">colmeias</p>
          </div>
          <div className="flex flex-1 flex-wrap gap-2">
            <span className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs text-primary">
              <span className="mr-1 inline-block h-2 w-2 rounded-full bg-primary align-middle" />
              {counts.ok} em dia
            </span>
            <span className="rounded-xl border border-honey/50 bg-honey/10 px-3 py-1.5 text-xs text-honey">
              <span className="mr-1 inline-block h-2 w-2 rounded-full bg-honey align-middle" />
              {counts.warn} atenção
            </span>
            <span className="rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-1.5 text-xs text-destructive">
              <span className="mr-1 inline-block h-2 w-2 rounded-full bg-destructive align-middle" />
              {counts.urgent} urgentes
            </span>
          </div>
          <Button onClick={openDialog} className="h-12 font-semibold">
            <Plus className="mr-1 h-4 w-4" /> Adicionar colmeia
          </Button>
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Ocupação</span>
            <span>
              {active.length} / {safeCapacity || "—"} (capacidade recomendada)
            </span>
          </div>
          <Progress value={occupancy} className="mt-2" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar colmeias">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => changeFilter(f.key)}
            aria-pressed={filter === f.key}
            className={cn(
              "rounded-full border px-4 py-2 text-sm",
              filter === f.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground",
            )}
          >
            {f.dot ? <span className={cn("mr-2 inline-block h-2 w-2 rounded-full align-middle", f.dot)} /> : null}
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl bg-card p-6 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">
            {list.length === 0
              ? "Nenhuma colmeia cadastrada neste apiário."
              : "Nenhuma colmeia neste filtro."}
          </p>
          {list.length === 0 ? (
            <Button onClick={openDialog} className="mt-4 h-12 w-full font-semibold">
              Adicionar primeira colmeia
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {visible.map((h) => {
            const alert = hiveAlert(h);
            return (
              <li key={h.id}>
                <Link
                  to="/apiarios/$id/colmeias/$hiveId"
                  params={{ id: apiary.id, hiveId: h.id }}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border-2 bg-card p-3 shadow-sm",
                    alert.border,
                  )}
                >
                  <HivePhoto path={h.cover_photo_path} alt={`Foto da colmeia ${h.code}`} className="h-20 w-20 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate text-xl font-extrabold text-primary">{h.code}</p>
                    <p className={cn("truncate text-xs", alert.text)}>
                      <span className={cn("mr-1 inline-block h-2 w-2 rounded-full align-middle", alert.dot)} />
                      {alert.label}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Último manejo
                      <br />
                      {fmtDate(h.last_management_at)}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-primary align-middle" /> Em dia
        </span>
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-honey align-middle" /> 2 semanas
        </span>
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-destructive align-middle" /> 4 semanas
        </span>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar colmeia</DialogTitle>
            <DialogDescription>Cadastre a colmeia neste apiário.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="hive-code">Código</Label>
              <Input
                id="hive-code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="mt-1 h-12"
              />
            </div>
            <div>
              <Label htmlFor="hive-name">Nome (opcional)</Label>
              <Input
                id="hive-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 h-12"
              />
            </div>
            <div>
              <Label>Origem</Label>
              <Select value={form.origin} onValueChange={(v) => setForm({ ...form, origin: v })}>
                <SelectTrigger className="mt-1 h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORIGINS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="hive-in">Entrada no apiário</Label>
              <Input
                id="hive-in"
                type="date"
                value={form.introduced_at}
                onChange={(e) => setForm({ ...form, introduced_at: e.target.value })}
                className="mt-1 h-12"
              />
            </div>
            {confirmOver ? (
              <p className="rounded-xl border border-honey bg-honey/10 p-3 text-xs text-honey">
                Esta colmeia ultrapassa a capacidade recomendada do apiário ({safeCapacity}). Confirme
                para cadastrar mesmo assim.
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={create.isPending}>
              {create.isPending ? "Salvando…" : confirmOver ? "Cadastrar mesmo assim" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
