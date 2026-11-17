/**
 * POST /api/console/push { subscription } — this device gets a push for each new report.
 * DELETE /api/console/push { endpoint } — it no longer does.
 */
import { db } from "@/lib/supabase";
import { json } from "@/lib/http";
import { requireAdmin } from "@/lib/admin";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  const who = await requireAdmin(req);
  if (who instanceof Response) return who;
  const { subscription } = (await req.json().catch(() => ({}))) as { subscription?: { endpoint?: string } };
  if (!subscription?.endpoint || !/^https:\/\//.test(subscription.endpoint)) return json({ error: "bad subscription" }, 400);
  const { error } = await db().from("push_subscriptions").upsert({ endpoint: subscription.endpoint, subscription, email: who.email });
  return error ? json({ error: error.message }, 500) : json({ ok: true });
}

export async function DELETE(req: Request): Promise<Response> {
  const who = await requireAdmin(req);
  if (who instanceof Response) return who;
  const { endpoint } = (await req.json().catch(() => ({}))) as { endpoint?: string };
  if (endpoint) await db().from("push_subscriptions").delete().eq("endpoint", endpoint);
  return json({ ok: true });
}
