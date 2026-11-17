/**
 * GET /api/console/reports/<id> — a report with short-lived download links for its attachments.
 * PATCH { status: "new" | "seen" | "done" } — marks it.
 */
import { BUCKET, db } from "@/lib/supabase";
import { json } from "@/lib/http";
import { requireAdmin } from "@/lib/admin";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const who = await requireAdmin(req);
  if (who instanceof Response) return who;
  const { id } = await params;
  const supabase = db();
  const { data: row } = await supabase.from("feedback").select("*").eq("id", id).maybeSingle();
  if (!row) return json({ error: "not found" }, 404);
  const files = [];
  for (const a of row.attachments as { file: string; name: string; type: string; size: number }[]) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(`${row.id}/${a.file}`, 600, { download: a.name });
    files.push({ ...a, url: data?.signedUrl ?? null });
  }
  return json({ report: { ...row, files } });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const who = await requireAdmin(req);
  if (who instanceof Response) return who;
  const { id } = await params;
  const { status } = (await req.json().catch(() => ({}))) as { status?: string };
  if (status !== "new" && status !== "seen" && status !== "done") return json({ error: "bad status" }, 400);
  const { error } = await db().from("feedback").update({ status }).eq("id", id);
  return error ? json({ error: error.message }, 500) : json({ ok: true });
}
