import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;
let cachedConfigKey = "";

/**
 * Returns a stateless server-only Supabase client authenticated with the
 * project's secret key (bypasses RLS for trusted Next.js server code).
 */
export function getSupabaseAdminClient(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY?.trim();

  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SECRET_KEY environment variables.",
    );
  }

  const configKey = `${supabaseUrl}::${supabaseSecretKey}`;
  if (!cachedClient || cachedConfigKey !== configKey) {
    cachedClient = createClient(supabaseUrl, supabaseSecretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    cachedConfigKey = configKey;
  }

  return cachedClient;
}
