import { useState } from "react";
import { BIOMES, VEGETATION_TYPES } from "@/lib/geoapis";
import type { Apiary } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ApiaryFormValues = {
  name: string;
  code: string;
  property_name: string;
  description: string;
  address: string;
  city: string;
  state: string;
  biome: string;
  predominant_vegetation: string;
  current_hives: number;
  status: string;
  notes: string;
};

export function emptyApiary(): ApiaryFormValues {
  return {
    name: "",
    code: "",
    property_name: "",
    description: "",
    address: "",
    city: "",
    state: "",
    biome: "",
    predominant_vegetation: "",
    current_hives: 0,
    status: "active",
    notes: "",
  };
}

export function fromApiary(a: Apiary): ApiaryFormValues {
  return {
    name: a.name ?? "",
    code: a.code ?? "",
    property_name: a.property_name ?? "",
    description: a.description ?? "",
    address: a.address ?? "",
    city: a.city ?? "",
    state: a.state ?? "",
    biome: a.biome ?? "",
    predominant_vegetation: a.predominant_vegetation ?? "",
    current_hives: a.current_hives ?? 0,
    status: a.status ?? "active",
    notes: a.notes ?? "",
  };
}

export function ApiaryForm({
  initial,
  submitLabel,
  busy,
  onSubmit,
}: {
  initial: ApiaryFormValues;
  submitLabel: string;
  busy?: boolean;
  onSubmit: (values: ApiaryFormValues) => void;
}) {
  const [v, setV] = useState<ApiaryFormValues>(initial);
  const set = <K extends keyof ApiaryFormValues>(k: K, value: ApiaryFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: value }));

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(v);
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="name">Nome do apiário *</Label>
        <Input
          id="name"
          required
          value={v.name}
          onChange={(e) => set("name", e.target.value)}
          className="h-12 bg-card"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="code">Código</Label>
          <Input
            id="code"
            value={v.code}
            onChange={(e) => set("code", e.target.value)}
            className="h-12 bg-card"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="hives">Colmeias instaladas</Label>
          <Input
            id="hives"
            type="number"
            min={0}
            value={v.current_hives}
            onChange={(e) => set("current_hives", Number(e.target.value))}
            className="h-12 bg-card"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="property">Nome da propriedade</Label>
        <Input
          id="property"
          value={v.property_name}
          onChange={(e) => set("property_name", e.target.value)}
          className="h-12 bg-card"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Endereço / referência</Label>
        <Input
          id="address"
          value={v.address}
          onChange={(e) => set("address", e.target.value)}
          className="h-12 bg-card"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 space-y-2">
          <Label htmlFor="city">Cidade</Label>
          <Input
            id="city"
            value={v.city}
            onChange={(e) => set("city", e.target.value)}
            className="h-12 bg-card"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">UF</Label>
          <Input
            id="state"
            maxLength={2}
            value={v.state}
            onChange={(e) => set("state", e.target.value.toUpperCase())}
            className="h-12 bg-card"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="biome">Bioma</Label>
        <Select value={v.biome} onValueChange={(val) => set("biome", val)}>
          <SelectTrigger id="biome" className="h-12 w-full bg-card">
            <SelectValue placeholder="Selecione o bioma" />
          </SelectTrigger>
          <SelectContent>
            {BIOMES.map((b) => (
              <SelectItem key={b} value={b}>
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="veg">Vegetação predominante</Label>
        <Select
          value={v.predominant_vegetation}
          onValueChange={(val) => set("predominant_vegetation", val)}
        >
          <SelectTrigger id="veg" className="h-12 w-full bg-card">
            <SelectValue placeholder="Selecione a vegetação" />
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

      <div className="space-y-2">
        <Label htmlFor="status">Situação</Label>
        <Select value={v.status} onValueChange={(val) => set("status", val)}>
          <SelectTrigger id="status" className="h-12 w-full bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="inactive">Inativo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Observações</Label>
        <Textarea
          id="notes"
          value={v.notes}
          onChange={(e) => set("notes", e.target.value)}
          className="min-h-24 bg-card"
        />
      </div>

      <Button type="submit" disabled={busy} className="h-12 w-full font-semibold">
        {busy ? "Salvando…" : submitLabel}
      </Button>
    </form>
  );
}
