import { createFileRoute } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import {
  ArrowLeft,
  BarChart3,
  Bug as Bee,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  History,
  Info,
  LayoutDashboard,
  LoaderCircle,
  LocateFixed,
  LogOut,
  MapPin,
  MapPinned,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Sprout,
  Trash2,
  Trees,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

import { GeoMap } from "../components/GeoMap";
import {
  FORAGING_CIRCLE_AREA_HA,
  FORAGING_RADIUS_KM,
  ONE_PERCENT_AREA_HA,
  SAFETY_FACTOR,
  calculateAnalysis,
  categoryDetails,
  formatDate,
  formatNumber,
  vegetationCategories,
  type AnalysisResult,
  type Apiary,
  type PastureFragment,
  type VegetationCategory,
} from "../lib/geoapis";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

export const Route = createFileRoute("/")({ component: GeoApisApp });

type View = "dashboard" | "apiaries" | "new-apiary" | "analysis" | "profile" | "admin";
type UserRole = "user" | "admin";

type AdminUser = {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: UserRole;
  createdAt: string;
  apiaryCount: number;
  analysisCount: number;
};

type AdminApiary = {
  id: string;
  userEmail: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  createdAt: string;
  analysisCount: number;
  recommendedHives: number;
};

const DEFAULT_LOCATION = { latitude: -15.77972, longitude: -47.92972 };

const demoAnalysis = calculateAnalysis({
  apiaryId: "demo-apiary",
  category: "cerrado",
  biome: "Cerrado",
  source: "Dados demonstrativos",
  sourceYear: 2024,
  confidence: "média",
  isDemo: true,
  fragments: [
    {
      id: "demo-fragment-1",
      label: "Mata nativa norte",
      areaHa: 84.32,
      landCoverClass: "Formação savânica",
    },
    {
      id: "demo-fragment-2",
      label: "Corredor ripário",
      areaHa: 27.46,
      landCoverClass: "Formação florestal",
    },
    {
      id: "demo-fragment-3",
      label: "Vegetação oeste",
      areaHa: 16.74,
      landCoverClass: "Campo alagado",
    },
  ],
});

const demoApiary: Apiary = {
  id: "demo-apiary",
  name: "Apiário Flor do Cerrado",
  address: "Brasília, DF",
  latitude: -15.77972,
  longitude: -47.92972,
  notes: "Apiário demonstrativo do GeoApis.",
  createdAt: "2026-08-18T12:00:00.000Z",
  latestAnalysis: demoAnalysis,
};

function GeoApisApp() {
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>("user");
  const [view, setView] = useState<View>("dashboard");
  const [apiaries, setApiaries] = useState<Apiary[]>([]);
  const [selectedApiaryId, setSelectedApiaryId] = useState<string>();
  const [dataLoading, setDataLoading] = useState(false);
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !supabase || demoMode) {
      setUserRole("user");
      return;
    }

    let cancelled = false;
    supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setUserRole("user");
          return;
        }
        setUserRole(data?.role === "admin" ? "admin" : "user");
      });

    return () => {
      cancelled = true;
    };
  }, [demoMode, user]);

  useEffect(() => {
    if (view === "admin" && userRole !== "admin") setView("dashboard");
  }, [userRole, view]);

  useEffect(() => {
    if (demoMode) {
      setApiaries([demoApiary]);
      return;
    }
    if (!user || !supabase) {
      setApiaries([]);
      return;
    }
    let cancelled = false;
    setDataLoading(true);
    Promise.all([
      supabase.from("apiaries").select("*").order("created_at", { ascending: false }),
      supabase.from("analyses").select("*").order("analyzed_at", { ascending: false }),
    ]).then(([apiaryResponse, analysisResponse]) => {
      if (cancelled) return;
      if (apiaryResponse.error) {
        setNotice(`Não foi possível carregar os apiários: ${apiaryResponse.error.message}`);
        setDataLoading(false);
        return;
      }
      const analysisByApiary = new Map<string, AnalysisResult>();
      for (const row of analysisResponse.data ?? []) {
        if (analysisByApiary.has(row.apiary_id as string)) continue;
        analysisByApiary.set(row.apiary_id as string, {
          id: row.id as string,
          apiaryId: row.apiary_id as string,
          analyzedAt: row.analyzed_at as string,
          biome: row.biome as string,
          category: row.vegetation_category as VegetationCategory,
          fragments: [],
          pastureAreaHa: Number(row.pasture_area_ha),
          pasturePercentage: Number(row.pasture_percentage),
          multiplier: Number(row.multiplier),
          hivesBeforeSafety: Number(row.hives_before_safety),
          recommendedHives: Number(row.recommended_hives),
          safetyFactor: Number(row.safety_factor),
          source: row.source as string,
          ...(row.source_year ? { sourceYear: Number(row.source_year) } : {}),
          ...(row.confidence
            ? { confidence: row.confidence as NonNullable<AnalysisResult["confidence"]> }
            : {}),
        });
      }
      setApiaries(
        (apiaryResponse.data ?? []).map((row) => ({
          id: row.id as string,
          name: row.name as string,
          address: (row.address as string | null) ?? "Localização por coordenadas",
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
          ...(row.notes ? { notes: row.notes as string } : {}),
          createdAt: row.created_at as string,
          ...(analysisByApiary.get(row.id as string)
            ? { latestAnalysis: analysisByApiary.get(row.id as string)! }
            : {}),
        })),
      );
      setDataLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [demoMode, user]);

  const selectedApiary = apiaries.find((apiary) => apiary.id === selectedApiaryId) ?? apiaries[0];
  const totalRecommendedHives = apiaries.reduce(
    (sum, apiary) => sum + (apiary.latestAnalysis?.recommendedHives ?? 0),
    0,
  );

  async function handleSignOut() {
    setDemoMode(false);
    setUserRole("user");
    setUser(null);
    setApiaries([]);
    setView("dashboard");
    if (supabase) await supabase.auth.signOut();
  }

  async function handleCreateApiary(input: Omit<Apiary, "id" | "createdAt">) {
    if (user && supabase) {
      const { data, error } = await supabase
        .from("apiaries")
        .insert({
          user_id: user.id,
          name: input.name,
          address: input.address,
          latitude: input.latitude,
          longitude: input.longitude,
          notes: input.notes ?? null,
        })
        .select("*")
        .single();
      if (error) throw error;
      const created: Apiary = {
        id: data.id as string,
        name: data.name as string,
        address: (data.address as string | null) ?? "Localização por coordenadas",
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        ...(data.notes ? { notes: data.notes as string } : {}),
        createdAt: data.created_at as string,
      };
      setApiaries((current) => [created, ...current]);
      setSelectedApiaryId(created.id);
      setView("analysis");
      return;
    }
    const created: Apiary = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    setApiaries((current) => [created, ...current]);
    setSelectedApiaryId(created.id);
    setView("analysis");
  }

  async function handleSaveAnalysis(result: AnalysisResult) {
    if (user && supabase) {
      const { data, error } = await supabase
        .from("analyses")
        .insert({
          user_id: user.id,
          apiary_id: result.apiaryId,
          analyzed_at: result.analyzedAt,
          biome: result.biome,
          vegetation_category: result.category,
          pasture_area_ha: result.pastureAreaHa,
          pasture_percentage: result.pasturePercentage,
          multiplier: result.multiplier,
          hives_before_safety: result.hivesBeforeSafety,
          safety_factor: result.safetyFactor,
          recommended_hives: result.recommendedHives,
          source: result.source,
          source_year: result.sourceYear ?? null,
          confidence: result.confidence ?? null,
          methodology_version: "geoapis-1.0",
        })
        .select("id")
        .single();
      if (error) throw error;
      result = { ...result, id: data.id as string };
      if (result.fragments.length) {
        const { error: fragmentError } = await supabase.from("pasture_fragments").insert(
          result.fragments.map((fragment, index) => ({
            analysis_id: result.id,
            user_id: user.id,
            label: fragment.label || `Área ${index + 1}`,
            area_ha: fragment.areaHa,
            land_cover_class: fragment.landCoverClass ?? null,
            position: index + 1,
          })),
        );
        if (fragmentError) throw fragmentError;
      }
    }
    setApiaries((current) =>
      current.map((apiary) =>
        apiary.id === result.apiaryId ? { ...apiary, latestAnalysis: result } : apiary,
      ),
    );
    setNotice("Análise salva com sucesso.");
  }

  if (authLoading) return <LoadingScreen />;
  if (!user && !demoMode)
    return (
      <AuthScreen
        onDemo={() => {
          setDemoMode(true);
          setApiaries([demoApiary]);
        }}
      />
    );

  return (
    <AppShell
      view={view}
      onNavigate={setView}
      onSignOut={handleSignOut}
      isAdmin={userRole === "admin"}
      userName={
        demoMode ? "Rafael" : user?.user_metadata?.["full_name"] || user?.email || "Apicultor"
      }
    >
      {notice && (
        <button className="notice" onClick={() => setNotice(undefined)} aria-label="Fechar aviso">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
        </button>
      )}
      {view === "dashboard" && (
        <Dashboard
          apiaries={apiaries}
          totalRecommendedHives={totalRecommendedHives}
          loading={dataLoading}
          onNew={() => setView("new-apiary")}
          onAnalyze={(id) => {
            setSelectedApiaryId(id);
            setView("analysis");
          }}
          onList={() => setView("apiaries")}
        />
      )}
      {view === "apiaries" && (
        <ApiariesList
          apiaries={apiaries}
          onNew={() => setView("new-apiary")}
          onAnalyze={(id) => {
            setSelectedApiaryId(id);
            setView("analysis");
          }}
        />
      )}
      {view === "new-apiary" && (
        <NewApiaryScreen onBack={() => setView("dashboard")} onSave={handleCreateApiary} />
      )}
      {view === "analysis" && selectedApiary && (
        <AnalysisScreen
          key={selectedApiary.id}
          apiary={selectedApiary}
          demoMode={demoMode}
          onBack={() => setView("dashboard")}
          onSave={handleSaveAnalysis}
        />
      )}
      {view === "analysis" && !selectedApiary && (
        <EmptyState
          title="Cadastre um apiário primeiro"
          description="A análise precisa de um ponto central para traçar o raio de 1,5 km."
          action="Cadastrar apiário"
          onAction={() => setView("new-apiary")}
        />
      )}
      {view === "admin" && userRole === "admin" && <AdminScreen />}
      {view === "profile" && (
        <ProfileScreen
          user={user}
          demoMode={demoMode}
          apiaryCount={apiaries.length}
          onSignOut={handleSignOut}
        />
      )}
    </AppShell>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "brand-compact" : ""}`} aria-label="GeoApis">
      <span className="brand-mark">
        <MapPin size={compact ? 24 : 30} strokeWidth={2.3} />
        <Bee className="brand-bee" size={compact ? 12 : 15} fill="currentColor" />
      </span>
      <span>
        <strong>Geo</strong>Apis
      </span>
    </div>
  );
}

function AuthScreen({ onDemo }: { onDemo: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>();
  const demoEnabled = (import.meta.env["VITE_ENABLE_DEMO_MODE"] as string | undefined) !== "false";

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(undefined);
    if (!supabase) {
      setMessage("Conecte as variáveis do Supabase para ativar o cadastro e o login.");
      return;
    }
    setLoading(true);
    const response =
      mode === "register"
        ? await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName.trim() } },
          })
        : await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (response.error) {
      setMessage(response.error.message);
      return;
    }
    if (mode === "register" && !response.data.session)
      setMessage("Cadastro realizado. Confirme seu e-mail para entrar.");
  }

  async function resetPassword() {
    if (!supabase || !email) {
      setMessage("Informe seu e-mail e conecte o Supabase.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    setMessage(error ? error.message : "Enviamos as instruções de recuperação para seu e-mail.");
  }

  return (
    <main className="auth-page">
      <section className="auth-visual" aria-label="Apresentação do GeoApis">
        <div className="auth-pattern" />
        <Brand />
        <div className="auth-copy">
          <span className="eyebrow light">
            <Sprout size={16} /> Tecnologia para uma apicultura sustentável
          </span>
          <h1>Conheça o potencial apícola ao redor das suas colmeias.</h1>
          <p>
            Mapeie o pasto, organize seus apiários e estime a capacidade de suporte com segurança.
          </p>
        </div>
        <div className="auth-radius-illustration">
          <span className="pulse-ring ring-one" />
          <span className="pulse-ring ring-two" />
          <span className="hive-dot">
            <Bee size={20} fill="currentColor" />
          </span>
          <span className="radius-label">raio de 1,5 km</span>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <div className="mobile-brand">
            <Brand compact />
          </div>
          <span className="eyebrow">
            {mode === "login" ? "Bem-vindo de volta" : "Crie sua conta"}
          </span>
          <h2>{mode === "login" ? "Entre no GeoApis" : "Comece a mapear seus apiários"}</h2>
          <p className="muted">
            {mode === "login"
              ? "Acesse seus apiários e análises salvas."
              : "Seus dados ficarão protegidos e vinculados ao seu perfil."}
          </p>
          <form onSubmit={submit} className="form-stack">
            {mode === "register" && (
              <label>
                Nome completo
                <input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  required
                />
              </label>
            )}
            <label>
              E-mail
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label>
              Senha
              <span className="password-field">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label="Mostrar ou ocultar senha"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>
            {mode === "login" && (
              <button type="button" className="text-button align-right" onClick={resetPassword}>
                Esqueci minha senha
              </button>
            )}
            {message && (
              <div className="form-message">
                <Info size={17} /> {message}
              </div>
            )}
            <button className="button primary full" disabled={loading}>
              {loading && <LoaderCircle className="spin" size={18} />}
              {mode === "login" ? "Entrar" : "Criar conta"}
            </button>
          </form>
          <button
            className="text-button auth-switch"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? "Ainda não tem conta? Cadastre-se" : "Já tem uma conta? Entre"}
          </button>
          {demoEnabled && (
            <>
              <div className="divider">
                <span>ou</span>
              </div>
              <button className="button secondary full" onClick={onDemo}>
                <Sparkles size={18} /> Explorar demonstração
              </button>
            </>
          )}
          {!isSupabaseConfigured && (
            <p className="config-hint">
              <ShieldCheck size={15} /> Preview seguro: nenhuma credencial foi inserida no código.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

function AppShell({
  children,
  view,
  onNavigate,
  onSignOut,
  userName,
  isAdmin,
}: {
  children: ReactNode;
  view: View;
  onNavigate: (view: View) => void;
  onSignOut: () => void;
  userName: string;
  isAdmin: boolean;
}) {
  const baseNavItems: { view: View; label: string; icon: typeof LayoutDashboard }[] = [
    { view: "dashboard", label: "Início", icon: LayoutDashboard },
    { view: "apiaries", label: "Apiários", icon: Bee },
    { view: "analysis", label: "Analisar", icon: MapPinned },
    { view: "profile", label: "Perfil", icon: UserRound },
  ];
  const navItems = isAdmin
    ? [...baseNavItems, { view: "admin" as const, label: "Admin", icon: UsersRound }]
    : baseNavItems;
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <Brand compact />
        <nav aria-label="Navegação principal">
          {navItems.map((item) => (
            <button
              key={item.view}
              className={view === item.view ? "active" : ""}
              onClick={() => onNavigate(item.view)}
            >
              <item.icon size={20} /> {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-user">
          <span className="avatar">{userName.slice(0, 1).toUpperCase()}</span>
          <span>
            <strong>{userName}</strong>
            <small>{isAdmin ? "Administrador" : "Conta do apicultor"}</small>
          </span>
          <button onClick={onSignOut} aria-label="Sair">
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <main className="app-main">{children}</main>
      <nav
        className="bottom-nav"
        aria-label="Navegação inferior"
        style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}
      >
        {navItems.map((item) => (
          <button
            key={item.view}
            className={view === item.view ? "active" : ""}
            onClick={() => onNavigate(item.view)}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function Dashboard({
  apiaries,
  totalRecommendedHives,
  loading,
  onNew,
  onAnalyze,
  onList,
}: {
  apiaries: Apiary[];
  totalRecommendedHives: number;
  loading: boolean;
  onNew: () => void;
  onAnalyze: (id: string) => void;
  onList: () => void;
}) {
  const analyzedCount = apiaries.filter((apiary) => apiary.latestAnalysis).length;
  const totalPastureArea = apiaries.reduce(
    (sum, apiary) => sum + (apiary.latestAnalysis?.pastureAreaHa ?? 0),
    0,
  );
  return (
    <div className="page-content">
      <header className="page-header split">
        <div>
          <span className="eyebrow">Visão geral</span>
          <h1>Seus apiários, em um só lugar</h1>
          <p>Acompanhe o potencial apícola e planeje a instalação das colmeias.</p>
        </div>
        <button className="button primary" onClick={onNew}>
          <Plus size={19} /> Novo apiário
        </button>
      </header>
      <section className="metric-grid" aria-label="Resumo dos apiários">
        <MetricCard
          icon={<Bee />}
          label="Apiários cadastrados"
          value={String(apiaries.length)}
          tone="amber"
        />
        <MetricCard
          icon={<Trees />}
          label="Pasto apícola mapeado"
          value={`${formatNumber(totalPastureArea, 1)} ha`}
          tone="green"
        />
        <MetricCard
          icon={<BarChart3 />}
          label="Análises concluídas"
          value={String(analyzedCount)}
          tone="blue"
        />
        <MetricCard
          icon={<ShieldCheck />}
          label="Capacidade segura"
          value={`${totalRecommendedHives} colmeias`}
          tone="dark"
        />
      </section>
      <section className="content-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Atividade recente</span>
            <h2>Meus apiários</h2>
          </div>
          {apiaries.length > 0 && (
            <button className="text-button" onClick={onList}>
              Ver todos <ChevronRight size={16} />
            </button>
          )}
        </div>
        {loading ? (
          <div className="center-state">
            <LoaderCircle className="spin" /> Carregando seus apiários...
          </div>
        ) : apiaries.length === 0 ? (
          <EmptyState
            title="Seu primeiro apiário começa aqui"
            description="Cadastre a localização para visualizar o raio e calcular o pasto apícola."
            action="Cadastrar apiário"
            onAction={onNew}
          />
        ) : (
          <div className="apiary-grid">
            {apiaries.slice(0, 3).map((apiary) => (
              <ApiaryCard key={apiary.id} apiary={apiary} onAnalyze={() => onAnalyze(apiary.id)} />
            ))}
          </div>
        )}
      </section>
      <section className="method-banner">
        <span className="method-icon">
          <Sprout size={24} />
        </span>
        <div>
          <strong>Como o GeoApis calcula?</strong>
          <p>
            O raio de {FORAGING_RADIUS_KM.toFixed(1).replace(".", ",")} km cobre{" "}
            {formatNumber(FORAGING_CIRCLE_AREA_HA, 2)} ha. Cada{" "}
            {formatNumber(ONE_PERCENT_AREA_HA, 2)} ha corresponde a 1% da região analisada.
          </p>
        </div>
        <span className="formula">
          colmeias = % × vegetação × {SAFETY_FACTOR.toFixed(2).replace(".", ",")}
        </span>
      </section>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <article className="metric-card">
      <span className={`metric-icon ${tone}`}>{icon}</span>
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
    </article>
  );
}

function ApiaryCard({ apiary, onAnalyze }: { apiary: Apiary; onAnalyze: () => void }) {
  const analysis = apiary.latestAnalysis;
  return (
    <article className="apiary-card">
      <div className="apiary-map-thumb">
        <div className="thumb-ring" />
        <MapPin size={26} fill="currentColor" />
      </div>
      <div className="apiary-card-body">
        <div className="card-title-row">
          <span className="hive-icon">
            <Bee size={18} />
          </span>
          <div>
            <h3>{apiary.name}</h3>
            <p>
              <MapPin size={13} /> {apiary.address}
            </p>
          </div>
        </div>
        {analysis ? (
          <div className="card-stats">
            <span>
              <small>Pasto apícola</small>
              <strong>{formatNumber(analysis.pastureAreaHa, 1)} ha</strong>
            </span>
            <span>
              <small>Capacidade segura</small>
              <strong>{analysis.recommendedHives} colmeias</strong>
            </span>
          </div>
        ) : (
          <p className="pending-analysis">
            <Info size={15} /> Ainda não analisado
          </p>
        )}
        <button className="button secondary full" onClick={onAnalyze}>
          {analysis ? <History size={17} /> : <Sparkles size={17} />}
          {analysis ? "Ver ou refazer análise" : "Analisar região"}
        </button>
      </div>
    </article>
  );
}

function ApiariesList({
  apiaries,
  onNew,
  onAnalyze,
}: {
  apiaries: Apiary[];
  onNew: () => void;
  onAnalyze: (id: string) => void;
}) {
  return (
    <div className="page-content">
      <header className="page-header split">
        <div>
          <span className="eyebrow">Gestão</span>
          <h1>Meus apiários</h1>
          <p>Consulte as propriedades e o histórico de potencial apícola.</p>
        </div>
        <button className="button primary" onClick={onNew}>
          <Plus size={19} /> Novo apiário
        </button>
      </header>
      {apiaries.length ? (
        <div className="apiary-grid wide">
          {apiaries.map((apiary) => (
            <ApiaryCard key={apiary.id} apiary={apiary} onAnalyze={() => onAnalyze(apiary.id)} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Nenhum apiário cadastrado"
          description="Adicione o primeiro ponto de produção para iniciar."
          action="Cadastrar apiário"
          onAction={onNew}
        />
      )}
    </div>
  );
}

function NewApiaryScreen({
  onBack,
  onSave,
}: {
  onBack: () => void;
  onSave: (input: Omit<Apiary, "id" | "createdAt">) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [coordinates, setCoordinates] = useState(DEFAULT_LOCATION);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    try {
      await onSave({
        name: name.trim(),
        address:
          address.trim() ||
          `${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}`,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar o apiário.");
      setSaving(false);
    }
  }
  return (
    <div className="page-content narrow-page">
      <BackButton onClick={onBack} />
      <header className="page-header">
        <span className="eyebrow">Novo cadastro</span>
        <h1>Localize seu apiário</h1>
        <p>Marque o ponto central das colmeias. O raio de 1,5 km será traçado automaticamente.</p>
      </header>
      <form onSubmit={save} className="two-column-form">
        <section className="content-card form-card">
          <h2>Informações do apiário</h2>
          <label>
            Nome do apiário
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Apiário Santa Clara"
              required
            />
          </label>
          <label>
            Endereço ou referência
            <input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Cidade, estrada ou propriedade"
            />
          </label>
          <div className="field-row">
            <label>
              Latitude
              <input
                type="number"
                step="any"
                value={coordinates.latitude}
                onChange={(event) =>
                  setCoordinates((current) => ({
                    ...current,
                    latitude: Number(event.target.value),
                  }))
                }
                required
              />
            </label>
            <label>
              Longitude
              <input
                type="number"
                step="any"
                value={coordinates.longitude}
                onChange={(event) =>
                  setCoordinates((current) => ({
                    ...current,
                    longitude: Number(event.target.value),
                  }))
                }
                required
              />
            </label>
          </div>
          <button
            type="button"
            className="button ghost"
            onClick={() =>
              navigator.geolocation?.getCurrentPosition((position) =>
                setCoordinates({
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                }),
              )
            }
          >
            <LocateFixed size={18} /> Usar minha localização
          </button>
          <label>
            Observações
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              placeholder="Acesso, quantidade atual de colmeias ou outras informações"
            />
          </label>
          {error && (
            <div className="form-message error">
              <Info size={17} /> {error}
            </div>
          )}
          <button className="button primary full" disabled={saving}>
            {saving ? <LoaderCircle className="spin" size={18} /> : <Save size={18} />} Salvar e
            analisar
          </button>
        </section>
        <section className="map-panel">
          <GeoMap center={coordinates} onLocationChange={setCoordinates} />
          <div className="map-caption">
            <span>
              <MapPinned size={18} /> Ponto central
            </span>
            <strong>Raio fixo: 1,5 km</strong>
          </div>
        </section>
      </form>
    </div>
  );
}

type AnalysisStep = "location" | "fragments" | "result";

function AnalysisScreen({
  apiary,
  demoMode,
  onBack,
  onSave,
}: {
  apiary: Apiary;
  demoMode: boolean;
  onBack: () => void;
  onSave: (result: AnalysisResult) => Promise<void>;
}) {
  const [step, setStep] = useState<AnalysisStep>(apiary.latestAnalysis ? "result" : "location");
  const [coordinates, setCoordinates] = useState({
    latitude: apiary.latitude,
    longitude: apiary.longitude,
  });
  const [category, setCategory] = useState<VegetationCategory>(
    apiary.latestAnalysis?.category ?? "mata-atlantica",
  );
  const [biome, setBiome] = useState(apiary.latestAnalysis?.biome ?? "Mata Atlântica");
  const [fragments, setFragments] = useState<PastureFragment[]>(
    apiary.latestAnalysis?.fragments ?? [],
  );
  const [result, setResult] = useState<AnalysisResult | undefined>(apiary.latestAnalysis);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>();
  const analysisUrl = import.meta.env["VITE_GEO_ANALYSIS_URL"] as string | undefined;
  const draftResult = useMemo(
    () => calculateAnalysis({ apiaryId: apiary.id, category, biome, fragments }),
    [apiary.id, biome, category, fragments],
  );

  async function automaticAnalysis() {
    if (!analysisUrl) {
      setMessage(
        "A análise MapBiomas ainda não está conectada. Você pode informar os fragmentos manualmente sem perder o cálculo.",
      );
      setStep("fragments");
      return;
    }
    setAnalyzing(true);
    setMessage(undefined);
    try {
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      const response = await fetch(analysisUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(session?.access_token ? { authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          radiusMeters: 1_500,
        }),
      });
      if (!response.ok) throw new Error("O serviço geoespacial não concluiu a análise.");
      const data = (await response.json()) as {
        biome: string;
        category: VegetationCategory;
        source: string;
        sourceYear?: number;
        confidence?: AnalysisResult["confidence"];
        fragments: Array<{ label: string; areaHa: number; landCoverClass?: string }>;
      };
      const mapped = data.fragments.map((fragment, index) => ({
        id: crypto.randomUUID(),
        label: fragment.label || `Área ${index + 1}`,
        areaHa: fragment.areaHa,
        ...(fragment.landCoverClass ? { landCoverClass: fragment.landCoverClass } : {}),
      }));
      setBiome(data.biome);
      setCategory(data.category);
      setFragments(mapped);
      setResult(
        calculateAnalysis({
          apiaryId: apiary.id,
          biome: data.biome,
          category: data.category,
          fragments: mapped,
          source: data.source,
          ...(data.sourceYear !== undefined ? { sourceYear: data.sourceYear } : {}),
          ...(data.confidence !== undefined ? { confidence: data.confidence } : {}),
        }),
      );
      setStep("result");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Falha ao analisar a região.");
    } finally {
      setAnalyzing(false);
    }
  }

  function useDemoData() {
    setBiome(demoAnalysis.biome);
    setCategory(demoAnalysis.category);
    setFragments(demoAnalysis.fragments);
    setResult({ ...demoAnalysis, apiaryId: apiary.id, id: crypto.randomUUID() });
    setStep("result");
  }
  function calculateManualResult() {
    if (!fragments.some((fragment) => fragment.areaHa > 0)) {
      setMessage("Adicione pelo menos uma área com valor maior que zero.");
      return;
    }
    setResult({ ...draftResult, source: "Delimitação manual", confidence: "baixa" });
    setStep("result");
    setMessage(undefined);
  }
  async function saveResult() {
    if (!result) return;
    setSaving(true);
    setMessage(undefined);
    try {
      await onSave(result);
      setSaving(false);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Não foi possível salvar a análise.");
      setSaving(false);
    }
  }

  return (
    <div className="page-content narrow-page analysis-page">
      <BackButton onClick={onBack} />
      <header className="page-header split">
        <div>
          <span className="eyebrow">Análise de potencial</span>
          <h1>{apiary.name}</h1>
          <p>
            <MapPin size={15} /> {apiary.address}
          </p>
        </div>
        <StepIndicator current={step} />
      </header>
      {step === "location" && (
        <div className="analysis-layout">
          <section className="map-panel large">
            <GeoMap center={coordinates} onLocationChange={setCoordinates} />
            <div className="map-caption">
              <span>
                <MapPinned size={18} /> {coordinates.latitude.toFixed(5)},{" "}
                {coordinates.longitude.toFixed(5)}
              </span>
              <strong>{formatNumber(FORAGING_CIRCLE_AREA_HA, 2)} ha no círculo</strong>
            </div>
          </section>
          <aside className="content-card analysis-actions">
            <span className="step-number">1</span>
            <h2>Confirme a localização</h2>
            <p>
              O marcador deve representar o centro do conjunto de colmeias. Clique no mapa ou
              arraste o pino para corrigir.
            </p>
            <div className="info-box">
              <Info size={18} />
              <span>
                O círculo possui raio fixo de <strong>1,5 km</strong>, equivalente a aproximadamente{" "}
                <strong>707 ha</strong>.
              </span>
            </div>
            {message && (
              <div className="form-message">
                <Info size={17} /> {message}
              </div>
            )}
            <button
              className="button primary full"
              onClick={automaticAnalysis}
              disabled={analyzing}
            >
              {analyzing ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />}{" "}
              Analisar cobertura vegetal
            </button>
            <button className="button secondary full" onClick={() => setStep("fragments")}>
              <Trees size={18} /> Informar áreas manualmente
            </button>
            {demoMode && (
              <button className="text-button centered" onClick={useDemoData}>
                Usar resultado demonstrativo
              </button>
            )}
          </aside>
        </div>
      )}
      {step === "fragments" && (
        <div className="analysis-layout">
          <section className="content-card fragment-editor">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Delimitação</span>
                <h2>Áreas de pasto apícola</h2>
              </div>
              <button
                className="button secondary compact"
                onClick={() =>
                  setFragments((current) => [
                    ...current,
                    { id: crypto.randomUUID(), label: `Área ${current.length + 1}`, areaHa: 0 },
                  ])
                }
              >
                <Plus size={17} /> Adicionar área
              </button>
            </div>
            <p className="muted">
              Informe separadamente cada fragmento de mata, formação natural ou cultura florífera
              relevante dentro do raio.
            </p>
            <div className="fragment-list">
              {fragments.map((fragment, index) => (
                <div className="fragment-row" key={fragment.id}>
                  <span className="fragment-index">{index + 1}</span>
                  <label>
                    Identificação
                    <input
                      value={fragment.label}
                      onChange={(event) =>
                        setFragments((current) =>
                          current.map((item) =>
                            item.id === fragment.id ? { ...item, label: event.target.value } : item,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    Área (ha)
                    <input
                      type="number"
                      min="0"
                      max={FORAGING_CIRCLE_AREA_HA}
                      step="0.01"
                      value={fragment.areaHa || ""}
                      onChange={(event) =>
                        setFragments((current) =>
                          current.map((item) =>
                            item.id === fragment.id
                              ? { ...item, areaHa: Number(event.target.value) }
                              : item,
                          ),
                        )
                      }
                    />
                  </label>
                  <button
                    className="icon-button danger"
                    onClick={() =>
                      setFragments((current) => current.filter((item) => item.id !== fragment.id))
                    }
                    aria-label={`Excluir área ${index + 1}`}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
              {!fragments.length && (
                <div className="empty-fragments">
                  <Trees size={32} />
                  <p>Nenhuma área adicionada.</p>
                </div>
              )}
            </div>
            {message && (
              <div className="form-message">
                <Info size={17} /> {message}
              </div>
            )}
          </section>
          <aside className="content-card calculation-card">
            <span className="eyebrow">Parâmetros</span>
            <h2>Vegetação predominante</h2>
            <label>
              Bioma ou região
              <input value={biome} onChange={(event) => setBiome(event.target.value)} />
            </label>
            <label>
              Categoria para capacidade
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as VegetationCategory)}
              >
                {vegetationCategories.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label} — ×{item.multiplier}
                  </option>
                ))}
              </select>
            </label>
            <p className="config-hint">
              <Info size={15} /> O bioma sugerido deve ser confirmado. Monoculturas e Acácia Mangium
              exigem validação do usuário.
            </p>
            <div className="live-total">
              <small>Área total informada</small>
              <strong>{formatNumber(draftResult.pastureAreaHa, 2)} ha</strong>
              <span>{formatNumber(draftResult.pasturePercentage, 2)}% do círculo</span>
            </div>
            <button className="button primary full" onClick={calculateManualResult}>
              Calcular capacidade <ChevronRight size={18} />
            </button>
            <button className="text-button centered" onClick={() => setStep("location")}>
              Voltar ao mapa
            </button>
          </aside>
        </div>
      )}
      {step === "result" && result && (
        <ResultView
          result={result}
          onEdit={() => setStep("fragments")}
          onSave={saveResult}
          saving={saving}
          message={message}
        />
      )}
    </div>
  );
}

function StepIndicator({ current }: { current: AnalysisStep }) {
  const steps: AnalysisStep[] = ["location", "fragments", "result"];
  const currentIndex = steps.indexOf(current);
  return (
    <div className="step-indicator" aria-label={`Etapa ${currentIndex + 1} de 3`}>
      {steps.map((step, index) => (
        <span key={step} className={index <= currentIndex ? "active" : ""}>
          {index + 1}
        </span>
      ))}
    </div>
  );
}

function ResultView({
  result,
  onEdit,
  onSave,
  saving,
  message,
}: {
  result: AnalysisResult;
  onEdit: () => void;
  onSave: () => void;
  saving: boolean;
  message: string | undefined;
}) {
  const details = categoryDetails(result.category);
  const circleDegrees = Math.min(360, result.pasturePercentage * 3.6);
  return (
    <div className="result-stack">
      {result.isDemo && (
        <div className="demo-banner">
          <Sparkles size={18} />
          <span>Resultado demonstrativo — não representa uma medição real desta localização.</span>
        </div>
      )}
      <section className="result-hero">
        <div>
          <span className="eyebrow light">Capacidade recomendada</span>
          <strong>{result.recommendedHives}</strong>
          <h2>colmeias</h2>
          <p>Estimativa conservadora com fator de segurança de 0,85.</p>
        </div>
        <div
          className="result-gauge"
          style={{
            background: `conic-gradient(#f6ad2f ${circleDegrees}deg, rgba(255,255,255,.16) 0deg)`,
          }}
        >
          <span>
            <Trees size={25} />
            <strong>{formatNumber(result.pasturePercentage, 1)}%</strong>
            <small>pasto apícola</small>
          </span>
        </div>
      </section>
      <section className="result-grid">
        <article className="content-card result-details">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Cobertura detectada</span>
              <h2>{formatNumber(result.pastureAreaHa, 2)} hectares</h2>
            </div>
            <span className="status-pill">
              {result.fragments.length} {result.fragments.length === 1 ? "fragmento" : "fragmentos"}
            </span>
          </div>
          <div className="fragment-results">
            {result.fragments.map((fragment, index) => (
              <div key={fragment.id}>
                <span className="fragment-index">{index + 1}</span>
                <span>
                  <strong>{fragment.label}</strong>
                  <small>{fragment.landCoverClass ?? "Pasto apícola"}</small>
                </span>
                <strong>{formatNumber(fragment.areaHa, 2)} ha</strong>
              </div>
            ))}
          </div>
        </article>
        <article className="content-card formula-card">
          <span className="eyebrow">Memória de cálculo</span>
          <h2>Resultado transparente</h2>
          <ol>
            <li>
              <span>Área total ÷ {formatNumber(ONE_PERCENT_AREA_HA, 2)}</span>
              <strong>{formatNumber(result.pasturePercentage, 2)}%</strong>
            </li>
            <li>
              <span>{details.label} — multiplicador</span>
              <strong>× {result.multiplier}</strong>
            </li>
            <li>
              <span>Capacidade antes da segurança</span>
              <strong>{formatNumber(result.hivesBeforeSafety, 1)}</strong>
            </li>
            <li className="highlight">
              <span>Fator de segurança</span>
              <strong>× {formatNumber(result.safetyFactor, 2)}</strong>
            </li>
            <li className="total">
              <span>Recomendação inteira</span>
              <strong>{result.recommendedHives} colmeias</strong>
            </li>
          </ol>
          <p className="source-note">
            <Info size={15} /> Fonte: {result.source}
            {result.sourceYear ? ` (${result.sourceYear})` : ""}.{" "}
            {result.confidence ? `Confiança ${result.confidence}.` : ""}
          </p>
        </article>
      </section>
      {message && (
        <div className="form-message">
          <Info size={17} /> {message}
        </div>
      )}
      <div className="result-actions">
        <button className="button secondary" onClick={onEdit}>
          <Trees size={18} /> Revisar áreas
        </button>
        <button className="button primary" onClick={onSave} disabled={saving}>
          {saving ? <LoaderCircle className="spin" size={18} /> : <Save size={18} />} Salvar análise
        </button>
      </div>
    </div>
  );
}


function AdminScreen() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [apiaries, setAdminApiaries] = useState<AdminApiary[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>();
  const [form, setForm] = useState({ fullName: "", phone: "", role: "user" as UserRole });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function loadAdminData() {
      const [usersResponse, apiariesResponse] = await Promise.all([
        supabase!.rpc("admin_list_users"),
        supabase!.rpc("admin_list_apiaries"),
      ]);

      if (cancelled) return;
      if (usersResponse.error || apiariesResponse.error) {
        setMessage(
          usersResponse.error?.message ??
            apiariesResponse.error?.message ??
            "Não foi possível carregar os dados administrativos.",
        );
        setLoading(false);
        return;
      }

      setUsers(
        (
          (usersResponse.data ?? []) as Array<{
            id: unknown;
            email: unknown;
            full_name: unknown;
            phone: unknown;
            role: unknown;
            created_at: unknown;
            apiary_count: unknown;
            analysis_count: unknown;
          }>
        ).map((row) => ({
          id: String(row.id),
          email: String(row.email ?? ""),
          fullName: String(row.full_name ?? ""),
          phone: String(row.phone ?? ""),
          role: row.role === "admin" ? "admin" : "user",
          createdAt: String(row.created_at),
          apiaryCount: Number(row.apiary_count ?? 0),
          analysisCount: Number(row.analysis_count ?? 0),
        })),
      );
      setAdminApiaries(
        (
          (apiariesResponse.data ?? []) as Array<{
            id: unknown;
            user_email: unknown;
            name: unknown;
            address: unknown;
            latitude: unknown;
            longitude: unknown;
            created_at: unknown;
            analysis_count: unknown;
            recommended_hives: unknown;
          }>
        ).map((row) => ({
          id: String(row.id),
          userEmail: String(row.user_email ?? ""),
          name: String(row.name ?? ""),
          address: String(row.address ?? "Localização por coordenadas"),
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
          createdAt: String(row.created_at),
          analysisCount: Number(row.analysis_count ?? 0),
          recommendedHives: Number(row.recommended_hives ?? 0),
        })),
      );
      setLoading(false);
    }

    void loadAdminData();
    return () => {
      cancelled = true;
    };
  }, []);

  function editUser(user: AdminUser) {
    setSelectedUserId(user.id);
    setForm({ fullName: user.fullName, phone: user.phone, role: user.role });
    setMessage(undefined);
  }

  async function saveUser(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !selectedUserId) return;
    setSaving(true);
    setMessage(undefined);

    const { error } = await supabase.rpc("admin_update_profile", {
      target_user_id: selectedUserId,
      new_full_name: form.fullName,
      new_phone: form.phone,
      new_role: form.role,
    });

    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }

    setUsers((current) =>
      current.map((item) =>
        item.id === selectedUserId
          ? { ...item, fullName: form.fullName.trim(), phone: form.phone.trim(), role: form.role }
          : item,
      ),
    );
    setSelectedUserId(undefined);
    setMessage("Perfil atualizado com segurança.");
  }

  const selectedUser = users.find((item) => item.id === selectedUserId);
  const totalAnalyses = users.reduce((total, item) => total + item.analysisCount, 0);

  return (
    <div className="page-content admin-page">
      <header className="page-header split">
        <div>
          <span className="eyebrow">Área restrita</span>
          <h1>Administração do GeoApis</h1>
          <p>Consulte usuários, apiários e análises. As alterações ficam protegidas pelo Supabase.</p>
        </div>
        <span className="status-pill">
          <ShieldCheck size={15} /> Administrador
        </span>
      </header>

      <section className="metric-grid">
        <MetricCard icon={<UsersRound />} label="Usuários" value={String(users.length)} tone="green" />
        <MetricCard
          icon={<Bee />}
          label="Apiários cadastrados"
          value={String(apiaries.length)}
          tone="amber"
        />
        <MetricCard
          icon={<BarChart3 />}
          label="Análises salvas"
          value={String(totalAnalyses)}
          tone="green"
        />
        <MetricCard
          icon={<ShieldCheck />}
          label="Administradores"
          value={String(users.filter((item) => item.role === "admin").length)}
          tone="amber"
        />
      </section>

      {message && (
        <div className="form-message">
          <Info size={17} /> {message}
        </div>
      )}

      <section className="admin-grid">
        <article className="content-card admin-table-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Contas</span>
              <h2>Usuários cadastrados</h2>
            </div>
          </div>
          {loading ? (
            <div className="loading-inline">
              <LoaderCircle className="spin" size={22} /> Carregando usuários...
            </div>
          ) : (
            <div className="table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>Papel</th>
                    <th>Apiários</th>
                    <th>Análises</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {users.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.fullName || "Nome não informado"}</strong>
                        <small>{item.email}</small>
                      </td>
                      <td>
                        <span className={`role-pill ${item.role}`}>
                          {item.role === "admin" ? "Administrador" : "Usuário"}
                        </span>
                      </td>
                      <td>{item.apiaryCount}</td>
                      <td>{item.analysisCount}</td>
                      <td>
                        <button className="button secondary compact" onClick={() => editUser(item)}>
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <aside className="content-card admin-editor">
          <span className="eyebrow">Edição protegida</span>
          <h2>{selectedUser ? selectedUser.email : "Selecione um usuário"}</h2>
          {!selectedUser ? (
            <p className="muted">Use o botão “Editar” para alterar nome, telefone ou papel da conta.</p>
          ) : (
            <form onSubmit={saveUser}>
              <label>
                Nome completo
                <input
                  value={form.fullName}
                  onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                />
              </label>
              <label>
                Telefone
                <input
                  value={form.phone}
                  onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                />
              </label>
              <label>
                Papel da conta
                <select
                  value={form.role}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, role: event.target.value as UserRole }))
                  }
                >
                  <option value="user">Usuário</option>
                  <option value="admin">Administrador</option>
                </select>
              </label>
              <div className="admin-editor-actions">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setSelectedUserId(undefined)}
                >
                  Cancelar
                </button>
                <button className="button primary" disabled={saving}>
                  {saving ? <LoaderCircle className="spin" size={18} /> : <Save size={18} />}
                  Salvar
                </button>
              </div>
            </form>
          )}
        </aside>
      </section>

      <section className="content-card admin-table-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Dados dos apiários</span>
            <h2>Visão geral da plataforma</h2>
          </div>
        </div>
        <div className="table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Apiário</th>
                <th>Responsável</th>
                <th>Localização</th>
                <th>Análises</th>
                <th>Colmeias estimadas</th>
              </tr>
            </thead>
            <tbody>
              {apiaries.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.name}</strong>
                    <small>{formatDate(item.createdAt)}</small>
                  </td>
                  <td>{item.userEmail}</td>
                  <td>
                    <strong>{item.address}</strong>
                    <small>
                      {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
                    </small>
                  </td>
                  <td>{item.analysisCount}</td>
                  <td>{item.recommendedHives}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ProfileScreen({
  user,
  demoMode,
  apiaryCount,
  onSignOut,
}: {
  user: User | null;
  demoMode: boolean;
  apiaryCount: number;
  onSignOut: () => void;
}) {
  const displayName = demoMode ? "Rafael" : user?.user_metadata?.["full_name"] || "Apicultor";
  return (
    <div className="page-content narrow-page">
      <header className="page-header">
        <span className="eyebrow">Sua conta</span>
        <h1>Perfil do usuário</h1>
        <p>Dados pessoais e informações de segurança.</p>
      </header>
      <section className="profile-grid">
        <article className="content-card profile-card">
          <span className="profile-avatar">{displayName.slice(0, 1).toUpperCase()}</span>
          <h2>{displayName}</h2>
          <p>{demoMode ? "demonstracao@geoapis.app" : user?.email}</p>
          <span className="status-pill">
            {apiaryCount} {apiaryCount === 1 ? "apiário" : "apiários"}
          </span>
        </article>
        <article className="content-card security-card">
          <span className="metric-icon green">
            <ShieldCheck />
          </span>
          <div>
            <h2>Dados protegidos</h2>
            <p>
              As políticas RLS garantem que cada usuário acesse somente o próprio perfil, apiários e
              análises.
            </p>
          </div>
          <button className="button secondary" onClick={onSignOut}>
            <LogOut size={18} /> Sair da conta
          </button>
        </article>
      </section>
    </div>
  );
}

function EmptyState({
  title,
  description,
  action,
  onAction,
}: {
  title: string;
  description: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="empty-state">
      <span>
        <Bee size={30} />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      <button className="button primary" onClick={onAction}>
        <Plus size={18} /> {action}
      </button>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="text-button back-button" onClick={onClick}>
      <ArrowLeft size={18} /> Voltar
    </button>
  );
}
function LoadingScreen() {
  return (
    <div className="loading-screen">
      <Brand />
      <LoaderCircle className="spin" size={28} />
      <span>Preparando seu mapa...</span>
    </div>
  );
}
