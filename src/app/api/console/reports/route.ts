/** GET /api/console/reports — Prime Console's inbox: the latest reports (complete ones), newest first. */
import { db } from "@/lib/supabase";
import { json } from "@/lib/http";
import { requireAdmin } from "@/lib/admin";

export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  const who = await requireAdmin(req);
  if (who instanceof Response) return who;
  const status = new URL(req.url).searchParams.get("status");
  let q = db().from("feedback")
    .select("id, product, category, description, email, follow_up, received_at, completed_at, status, attachments, diagnostics")
    .not("completed_at", "is", null).order("received_at", { ascending: false }).limit(300);
  if (status === "new" || status === "seen" || status === "done") q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return json({ error: error.message }, 500);
  return json({ reports: data });
}
