import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  Activity,
  Camera,
  CalendarDays,
  Crown,
  Grid2x2,
  History,
  ListOrdered,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Apiary } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HivePhoto } from "@/components/hive-photo";
import { cn } from "@/lib/utils";
import {
  BROOD_PATTERNS,
  FOOD_RESERVES,
  HIVE_PHOTO_BUCKET,
  HIVE_PHOTO_MAX_BYTES,
  HIVE_PHOTO_TYPES,
  MANAGEMENT_TYPES,
  ORIGINS,
  PURPOSES,
  QUEEN_STATUS,
  SANITARY,
  STRENGTHS,
  TEMPERAMENTS,
  ageLabel,
  fmtDate,
  hiveAlert,
  originLabel,
  queenMarkColor,
  toDateInput,
  type Hive,
  type HiveManagement,
} from "@/lib/hives";

export const Route = createFileRoute("/apiarios/$id/colmeias/$hiveId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Gestão da colmeia — GeoApis" },
      {
        name: "description",
        content: "Rainha, finalidade, manejos e condição da colônia da colmeia selecionada.",
      },
      { property: "og:title", content: "Gestão da colmeia — GeoApis" },
      { property: "og:description", content: "Histórico de manejos e condição da colônia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HiveDetailPage,
});

function Section({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-honey/15 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="text-base font-bold text-primary">{title}</h2>
        {action ? <div className="ml-auto">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

const EMPTY_MANAGEMENT = {
  managed_at: toDateInput(new Date().toISOString()),
  responsible: "",
  management_type: "Revisão geral",
  queen_seen: true,
  colony_strength: "Boa",
  occupied_frames: "",
  brood_pattern: "Regular",
  food_reserve: "Boa",
  temperament: "Dócil",
  sanitary_status: "Sem sinais clínicos",
  feeding: "",
  treatment: "",
  notes: "",
  next_review_at: "",
};

function HiveDetailPage() {
  const { id, hiveId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [mForm, setMForm] = useState({ ...EMPTY_MANAGEMENT });
  const [edit, setEdit] = useState<Partial<Hive>>({});
  const [notes, setNotes] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["hive", hiveId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [h, a, m] = await Promise.all([
        supabase.from("hives").select("*").eq("id", hiveId).maybeSingle(),
        supabase.from("apiaries").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("hive_managements")
          .select("*")
          .eq("hive_id", hiveId)
          .order("managed_at", { ascending: false }),
      ]);
      if (h.error) throw h.error;
      if (a.error) throw a.error;
      if (m.error) throw m.error;
      return {
        hive: h.data as Hive | null,
        apiary: a.data as Apiary | null,
        managements: (m.data ?? []) as HiveManagement[],
      };
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["hive", hiveId] });
    qc.invalidateQueries({ queryKey: ["hives", id] });
    qc.invalidateQueries({ queryKey: ["apiary", id] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const saveHive = useMutation({
    mutationFn: async (patch: Partial<Hive>) => {
      const { error } = await supabase.from("hives").update(patch).eq("id", hiveId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Colmeia atualizada.");
      setEditOpen(false);
      invalidate();
    },
    onError: () => toast.error("Não foi possível salvar a colmeia."),
  });

  const addManagement = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("no-user");
      const { error } = await supabase.from("hive_managements").insert({
        hive_id: hiveId,
        apiary_id: id,
        user_id: user.id,
        managed_at: new Date(mForm.managed_at || new Date()).toISOString(),
        responsible: mForm.responsible.trim() || null,
        management_type: mForm.management_type,
        queen_seen: mForm.queen_seen,
        queen_status: mForm.queen_seen ? "Presente" : "Não localizada",
        colony_strength: mForm.colony_strength,
        occupied_frames: mForm.occupied_frames ? Number(mForm.occupied_frames) : null,
        brood_pattern: mForm.brood_pattern,
        food_reserve: mForm.food_reserve,
        temperament: mForm.temperament,
        sanitary_status: mForm.sanitary_status,
        feeding: mForm.feeding.trim() || null,
        treatment: mForm.treatment.trim() || null,
        notes: mForm.notes.trim() || null,
        next_review_at: mForm.next_review_at || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Manejo registrado.");
      setManageOpen(false);
      setMForm({ ...EMPTY_MANAGEMENT });
      invalidate();
    },
    onError: () => toast.error("Não foi possível registrar o manejo."),
  });

  const uploadPhoto = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("no-user");
      if (!HIVE_PHOTO_TYPES.includes(file.type)) throw new Error("type");
      if (file.size > HIVE_PHOTO_MAX_BYTES) throw new Error("size");
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${id}/${hiveId}/cover-${Date.now()}.${ext}`;
      const up = await supabase.storage.from(HIVE_PHOTO_BUCKET).upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (up.error) throw up.error;
      const { error } = await supabase.from("hives").update({ cover_photo_path: path }).eq("id", hiveId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Foto atualizada.");
      invalidate();
    },
    onError: (e: unknown) => {
      const msg = String((e as { message?: string })?.message ?? "");
      if (msg === "type") toast.error("Use JPG, PNG ou WebP.");
      else if (msg === "size") toast.error("A foto deve ter até 5 MB.");
      else toast.error("Não foi possível enviar a foto.");
    },
  });

  const removeHive = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("hives").delete().eq("id", hiveId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Colmeia excluída.");
      navigate({ to: "/apiarios/$id", params: { id }, replace: true });
    },
    onError: () => toast.error("Não foi possível excluir a colmeia."),
  });

  if (isLoading) {
    return (
      <AppShell back="/apiarios">
        <Skeleton className="h-48 w-full rounded-2xl" />
      </AppShell>
    );
  }
  if (isError || !data?.hive) {
    return (
      <AppShell back="/apiarios">
        <p className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground">
          Colmeia não encontrada ou indisponível.
        </p>
      </AppShell>
    );
  }

  const hive = data.hive;
  const managements = data.managements;
  const last = managements[0];
  const alert = hiveAlert(hive);
  const purposes = hive.purposes ?? [];
  const timeline = showAll ? managements : managements.slice(0, 3);

  function openEdit() {
    setEdit({
      code: hive.code,
      name: hive.name,
      origin: hive.origin,
      status: hive.status,
      introduced_at: hive.introduced_at,
      queen_introduced_at: hive.queen_introduced_at,
      queen_identification: hive.queen_identification,
      queen_status: hive.queen_status,
      purposes: purposes,
    });
    setEditOpen(true);
  }

  function togglePurpose(p: string) {
    const current = edit.purposes ?? [];
    setEdit({
      ...edit,
      purposes: current.includes(p) ? current.filter((x) => x !== p) : [...current, p],
    });
  }

  return (
    <AppShell back="/apiarios">
      <p className="text-xs text-muted-foreground">
        <Link to="/apiarios/$id" params={{ id }} className="underline-offset-2 hover:underline">
          {data.apiary?.name ?? "Apiário"}
        </Link>{" "}
        / Colmeias
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold text-primary">Colmeia {hive.code}</h1>
        <Button variant="outline" size="icon" aria-label="Editar colmeia" onClick={openEdit}>
          <Pencil className="h-4 w-4" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Excluir colmeia">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir colmeia?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação remove a colmeia e seu histórico de manejos. Não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => removeHive.mutate()}>Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <span
          className={cn(
            "ml-auto rounded-xl border px-3 py-2 text-xs font-medium",
            alert.border,
            alert.text,
          )}
        >
          <span className={cn("mr-1 inline-block h-2 w-2 rounded-full align-middle", alert.dot)} />
          {alert.level === "ok" ? "Em dia" : `Atenção • ${alert.label}`}
        </span>
      </div>

      <div className="mt-4 space-y-4">
        <section className="flex flex-wrap items-center gap-4 rounded-2xl bg-card p-4 shadow-sm">
          <HivePhoto path={hive.cover_photo_path} alt={`Foto da colmeia ${hive.code}`} className="h-40 w-40" />
          <div className="min-w-0 space-y-2">
            <p className="text-3xl font-extrabold text-primary">{hive.code}</p>
            <p className="text-sm">
              <Activity className="mr-2 inline h-4 w-4 text-primary" />
              {hive.status === "active" ? "Ativa" : "Inativa"}
            </p>
            <p className="text-sm">
              <Crown className="mr-2 inline h-4 w-4 text-primary" />
              Rainha {(hive.queen_status ?? "—").toLowerCase()}
            </p>
            <p className="text-sm">
              <Grid2x2 className="mr-2 inline h-4 w-4 text-primary" />
              {last?.occupied_frames ?? "—"} quadros ocupados · força {last?.colony_strength ?? "—"}
            </p>
          </div>
        </section>

        <Section icon={Crown} title="Origem e rainha">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Origem" value={originLabel(hive.origin)} />
            <Field label="Entrada no apiário" value={fmtDate(hive.introduced_at)} />
            <Field label="Introdução da rainha" value={fmtDate(hive.queen_introduced_at)} />
            <Field label="Idade no apiário" value={ageLabel(hive.queen_introduced_at)} />
            <Field label="Identificação da rainha" value={hive.queen_identification || "—"} />
            <Field label="Situação da rainha" value={hive.queen_status || "—"} />
          </div>
        </Section>

        <Section icon={ListOrdered} title="Finalidade">
          {purposes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma finalidade selecionada.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {purposes.map((p) => (
                <span
                  key={p}
                  className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                >
                  {p}
                </span>
              ))}
            </div>
          )}
        </Section>

        <Section icon={CalendarDays} title="Último manejo">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Data" value={fmtDate(hive.last_management_at)} />
            <Field label="Responsável" value={last?.responsible || "—"} />
            <Field label="Tipo" value={last?.management_type || "—"} />
            <Field label="Próxima revisão" value={fmtDate(last?.next_review_at)} />
          </div>
          <Button className="mt-4 h-12 w-full font-semibold" onClick={() => setManageOpen(true)}>
            Registrar novo manejo
          </Button>
        </Section>

        <Section icon={Activity} title="Condição da colônia">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Field label="Força" value={last?.colony_strength || "—"} />
            <Field label="Quadros ocupados" value={last?.occupied_frames ?? "—"} />
            <Field label="Padrão de cria" value={last?.brood_pattern || "—"} />
            <Field label="Reserva de alimento" value={last?.food_reserve || "—"} />
            <Field label="Temperamento" value={last?.temperament || "—"} />
            <Field label="Sanidade" value={last?.sanitary_status || "—"} />
          </div>
        </Section>

        <Section icon={Pencil} title="Observações">
          <Textarea
            aria-label="Observações da colmeia"
            value={notes ?? hive.notes ?? ""}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-24"
          />
          <Button
            variant="outline"
            className="mt-3 h-12 w-full"
            disabled={saveHive.isPending || notes === null}
            onClick={() => saveHive.mutate({ notes: notes })}
          >
            Salvar observações
          </Button>
        </Section>

        <Section icon={History} title="Histórico">
          {managements.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum manejo registrado.</p>
          ) : (
            <ul className="space-y-3">
              {timeline.map((m) => (
                <li key={m.id} className="flex gap-3 text-sm">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0">
                    <p className="font-medium text-primary">
                      {fmtDate(m.managed_at)} · {m.management_type || "manejo"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {m.responsible ? `${m.responsible} · ` : ""}
                      {m.notes ? m.notes.slice(0, 90) : "sem observações"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Button variant="outline" className="h-12" onClick={() => fileRef.current?.click()}>
              <Camera className="mr-2 h-4 w-4" />
              {uploadPhoto.isPending ? "Enviando…" : "Adicionar foto"}
            </Button>
            <Button
              variant="outline"
              className="h-12"
              onClick={() => setShowAll((v) => !v)}
              disabled={managements.length <= 3}
            >
              <ListOrdered className="mr-2 h-4 w-4" />
              {showAll ? "Ver menos" : "Ver histórico completo"}
            </Button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadPhoto.mutate(f);
              e.target.value = "";
            }}
          />
        </Section>
      </div>

      {/* Editar colmeia */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar colmeia</DialogTitle>
            <DialogDescription>Dados de identificação, rainha e finalidade.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="e-code">Código</Label>
              <Input
                id="e-code"
                value={edit.code ?? ""}
                onChange={(e) => setEdit({ ...edit, code: e.target.value })}
                className="mt-1 h-12"
              />
            </div>
            <div>
              <Label htmlFor="e-name">Nome</Label>
              <Input
                id="e-name"
                value={edit.name ?? ""}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                className="mt-1 h-12"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Origem</Label>
                <Select
                  value={edit.origin ?? "capture"}
                  onValueChange={(v) => setEdit({ ...edit, origin: v })}
                >
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
                <Label>Situação</Label>
                <Select
                  value={edit.status ?? "active"}
                  onValueChange={(v) => setEdit({ ...edit, status: v })}
                >
                  <SelectTrigger className="mt-1 h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativa</SelectItem>
                    <SelectItem value="inactive">Inativa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="e-in">Entrada no apiário</Label>
                <Input
                  id="e-in"
                  type="date"
                  value={toDateInput(edit.introduced_at)}
                  onChange={(e) => setEdit({ ...edit, introduced_at: e.target.value || null })}
                  className="mt-1 h-12"
                />
              </div>
              <div>
                <Label htmlFor="e-queen">Introdução da rainha</Label>
                <Input
                  id="e-queen"
                  type="date"
                  value={toDateInput(edit.queen_introduced_at)}
                  onChange={(e) => setEdit({ ...edit, queen_introduced_at: e.target.value || null })}
                  className="mt-1 h-12"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="e-qid">Identificação da rainha</Label>
              <Input
                id="e-qid"
                value={edit.queen_identification ?? ""}
                onChange={(e) => setEdit({ ...edit, queen_identification: e.target.value })}
                className="mt-1 h-12"
              />
            </div>
            <div>
              <Label>Situação da rainha</Label>
              <Select
                value={edit.queen_status ?? "Presente"}
                onValueChange={(v) => setEdit({ ...edit, queen_status: v })}
              >
                <SelectTrigger className="mt-1 h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUEEN_STATUS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <fieldset>
              <legend className="text-sm font-medium">Finalidade</legend>
              <div className="mt-2 space-y-2">
                {PURPOSES.map((p) => (
                  <label key={p} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={(edit.purposes ?? []).includes(p)}
                      onCheckedChange={() => togglePurpose(p)}
                    />
                    {p}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={saveHive.isPending}
              onClick={() =>
                saveHive.mutate({
                  code: (edit.code ?? "").trim() || hive.code,
                  name: edit.name || null,
                  origin: edit.origin ?? null,
                  status: edit.status ?? "active",
                  introduced_at: edit.introduced_at ?? null,
                  queen_introduced_at: edit.queen_introduced_at ?? null,
                  queen_identification: edit.queen_identification || null,
                  queen_status: edit.queen_status ?? null,
                  purposes: edit.purposes ?? [],
                })
              }
            >
              {saveHive.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Registrar manejo */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar novo manejo</DialogTitle>
            <DialogDescription>Os dados alimentam a condição da colônia e o alerta.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="m-date">Data</Label>
                <Input
                  id="m-date"
                  type="date"
                  value={mForm.managed_at}
                  onChange={(e) => setMForm({ ...mForm, managed_at: e.target.value })}
                  className="mt-1 h-12"
                />
              </div>
              <div>
                <Label htmlFor="m-resp">Responsável</Label>
                <Input
                  id="m-resp"
                  value={mForm.responsible}
                  onChange={(e) => setMForm({ ...mForm, responsible: e.target.value })}
                  className="mt-1 h-12"
                />
              </div>
            </div>
            <div>
              <Label>Tipo do manejo</Label>
              <Select
                value={mForm.management_type}
                onValueChange={(v) => setMForm({ ...mForm, management_type: v })}
              >
                <SelectTrigger className="mt-1 h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MANAGEMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={mForm.queen_seen}
                onCheckedChange={(v) => setMForm({ ...mForm, queen_seen: v === true })}
              />
              Rainha localizada
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Força da colônia</Label>
                <Select
                  value={mForm.colony_strength}
                  onValueChange={(v) => setMForm({ ...mForm, colony_strength: v })}
                >
                  <SelectTrigger className="mt-1 h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STRENGTHS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="m-frames">Quadros ocupados</Label>
                <Input
                  id="m-frames"
                  type="number"
                  min={0}
                  value={mForm.occupied_frames}
                  onChange={(e) => setMForm({ ...mForm, occupied_frames: e.target.value })}
                  className="mt-1 h-12"
                />
              </div>
              <div>
                <Label>Padrão de cria</Label>
                <Select
                  value={mForm.brood_pattern}
                  onValueChange={(v) => setMForm({ ...mForm, brood_pattern: v })}
                >
                  <SelectTrigger className="mt-1 h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BROOD_PATTERNS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Reserva de alimento</Label>
                <Select
                  value={mForm.food_reserve}
                  onValueChange={(v) => setMForm({ ...mForm, food_reserve: v })}
                >
                  <SelectTrigger className="mt-1 h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FOOD_RESERVES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Temperamento</Label>
                <Select
                  value={mForm.temperament}
                  onValueChange={(v) => setMForm({ ...mForm, temperament: v })}
                >
                  <SelectTrigger className="mt-1 h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPERAMENTS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Condição sanitária</Label>
                <Select
                  value={mForm.sanitary_status}
                  onValueChange={(v) => setMForm({ ...mForm, sanitary_status: v })}
                >
                  <SelectTrigger className="mt-1 h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SANITARY.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="m-feed">Alimentação fornecida</Label>
                <Input
                  id="m-feed"
                  value={mForm.feeding}
                  onChange={(e) => setMForm({ ...mForm, feeding: e.target.value })}
                  className="mt-1 h-12"
                />
              </div>
              <div>
                <Label htmlFor="m-treat">Tratamento realizado</Label>
                <Input
                  id="m-treat"
                  value={mForm.treatment}
                  onChange={(e) => setMForm({ ...mForm, treatment: e.target.value })}
                  className="mt-1 h-12"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="m-next">Próxima revisão</Label>
              <Input
                id="m-next"
                type="date"
                value={mForm.next_review_at}
                onChange={(e) => setMForm({ ...mForm, next_review_at: e.target.value })}
                className="mt-1 h-12"
              />
            </div>
            <div>
              <Label htmlFor="m-notes">Observações</Label>
              <Textarea
                id="m-notes"
                value={mForm.notes}
                onChange={(e) => setMForm({ ...mForm, notes: e.target.value })}
                className="mt-1 min-h-20"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={addManagement.isPending} onClick={() => addManagement.mutate()}>
              {addManagement.isPending ? "Salvando…" : "Salvar manejo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
