import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// Service-role client: bypasses RLS. Server-only. Every query made with it
// MUST filter by a user id that came from a verified session.
export function createAdminClient() {
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
