import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type AppMode = "apicultor" | "adm";

const KEY = "geoapis:mode";
const EVT = "geoapis:mode-change";

export function getMode(): AppMode | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(KEY);
  return v === "adm" || v === "apicultor" ? v : null;
}

export function setMode(mode: AppMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, mode);
  window.dispatchEvent(new Event(EVT));
}

export function clearMode() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVT));
}

/** Modo atual escolhido pelo usuário (persistido no aparelho). */
export function useAppMode() {
  const [mode, setModeState] = useState<AppMode | null>(null);

  useEffect(() => {
    const sync = () => setModeState(getMode());
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const change = useCallback((m: AppMode) => setMode(m), []);
  return { mode, setMode: change };
}

/** Indica se o usuário logado possui o papel de administrador. */
export function useIsAdmin() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "admin")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
  return { isAdmin: !!data, loading: !!user && isLoading };
}

/** Consulta direta (fora de React) usada logo após o login. */
export async function checkIsAdmin(userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) return false;
  return !!data;
}
