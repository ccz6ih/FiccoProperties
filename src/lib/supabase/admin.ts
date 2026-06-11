import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Server-only Supabase client using the service-role key. BYPASSES Row-Level
 * Security — never import this into a client component, and always do your own
 * authorization checks before using it. Used for privileged operations like
 * uploading to the private application-docs bucket and minting signed URLs.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
