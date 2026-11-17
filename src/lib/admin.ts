/**
 * Prime Console's requests: signed in with Supabase Auth (the browser sends its access token), and the
 * person's email among ADMIN_EMAILS. Anyone else gets 401 / 403.
 */
import { db } from "./supabase";
import { json } from "./http";

export async function requireAdmin(req: Request): Promise<{ email: string } | Response> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "sign in" }, 401);
  const { data, error } = await db().auth.getUser(token);
  const email = data.user?.email?.toLowerCase();
  if (error || !email) return json({ error: "sign in again" }, 401);
  const allowed = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!allowed.includes(email)) return json({ error: "not allowed" }, 403);
  return { email };
}
