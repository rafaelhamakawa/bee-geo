import { useEffect, useState } from "react";
import { MapPin, Leaf, Hexagon, Box, BarChart3, Smartphone, type LucideIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const KEY = "geoapis-tour-done";

const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: MapPin, title: "Bem-vindo ao GeoApis", text: "Cadastre seus apiários com a localização exata no mapa de satélite. Tudo começa por aqui." },
  { icon: Leaf, title: "Estudo do pasto apícola", text: "O app traça o raio de voo de 1,5 km, mede a vegetação disponível e mostra apiários vizinhos e áreas de sobreposição." },
  { icon: BarChart3, title: "Capacidade segura", text: "Com base no pasto, calculamos quantas colmeias o local suporta e comparamos com as que você já instalou." },
  { icon: Hexagon, title: "Gestão de colmeias", text: "Registre manejos, fotos e a rainha. Alertas coloridos avisam quando uma colmeia está há muito tempo sem manejo." },
  { icon: Box, title: "Caixas isca", text: "Marque no mapa onde deixou cada caixa isca, tire uma foto e depois siga a rota para voltar ao local." },
  { icon: BarChart3, title: "Financeiro", text: "Acompanhe produção, receitas, custos, lucro e a cotação regional do mel." },
  { icon: Smartphone, title: "Instale no celular", text: "No Safari ou Chrome, use “Adicionar à tela inicial” para usar o GeoApis como um aplicativo." },
];

export function WelcomeTour() {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (!localStorage.getItem(KEY)) setOpen(true);
  }, []);

  const close = () => {
    localStorage.setItem(KEY, "1");
    setOpen(false);
  };

  const step = STEPS[i]!;
  const Icon = step.icon;
  const last = i === STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-sm text-center">
        <div className="mx-auto mt-2 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Icon className="h-8 w-8" />
        </div>
        <DialogTitle className="text-xl text-primary">{step.title}</DialogTitle>
        <DialogDescription className="text-sm leading-relaxed">{step.text}</DialogDescription>
        <div className="flex justify-center gap-1.5">
          {STEPS.map((_, k) => (
            <span key={k} className={`h-2 rounded-full transition-all ${k === i ? "w-5 bg-primary" : "w-2 bg-muted"}`} />
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          {i > 0 ? (
            <Button variant="outline" className="flex-1" onClick={() => setI(i - 1)}>Voltar</Button>
          ) : (
            <Button variant="ghost" className="flex-1" onClick={close}>Pular</Button>
          )}
          <Button className="flex-1" onClick={() => (last ? close() : setI(i + 1))}>
            {last ? "Começar" : "Próximo"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
