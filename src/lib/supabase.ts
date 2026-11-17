/**
 * The platform's Supabase client, with its secret key: server only (API routes). The products and the
 * console's browser never see this key; row-level security keeps the publishable key out of every table.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let admin: SupabaseClient | undefined;

export function db(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY)");
  admin ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}

/** Where attachments are kept (a private bucket). */
export const BUCKET = "feedback";
