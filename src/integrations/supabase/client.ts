import { createClient } from "@supabase/supabase-js";

// Projeto Supabase do usuário (chave publishable — segura no frontend)
export const SUPABASE_URL = "https://sklsjtnvpqswtunoxcgh.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_ZK28X_Ypf9aifffENBiPnA_mUPOY6sS";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});
