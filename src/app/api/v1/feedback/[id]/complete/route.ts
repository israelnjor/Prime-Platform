/**
 * POST /v1/feedback/<id>/complete — a product says a report is all sent. Once every announced attachment
 * is stored (and the size matches), the report is complete and the owner is notified (once). Until then
 * 409: the product announces it again and gets the missing upload links.
 */
import { BUCKET, db } from "@/lib/supabase";
import { json, preflight } from "@/lib/http";
import { notifyReport } from "@/lib/notify";
import type { AttachmentMeta, Report } from "@/lib/feedback";

export const runtime = "nodejs";
export const OPTIONS = preflight;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "bad id" }, 400);
  const supabase = db();
  const { data: row, error } = await supabase.from("feedback").select("*").eq("id", id.toLowerCase()).maybeSingle();
  if (error) return json({ error: "try again" }, 503);
  if (!row) return json({ error: "unknown report" }, 404);
  if (row.completed_at) return json({ status: "complete" });

  const attachments = row.attachments as AttachmentMeta[];
  if (attachments.length) {
    const { data: files } = await supabase.storage.from(BUCKET).list(row.id);
    const size = new Map((files ?? []).map((f) => [f.name, Number((f.metadata as { size?: number } | null)?.size ?? -1)]));
    const missing = attachments.filter((a) => size.get(a.file) !== a.size);
    if (missing.length) return json({ error: "attachments missing", missing: missing.map((a) => a.file) }, 409);
  }

  // Complete once (a second, simultaneous complete changes nothing and notifies no one).
  const { data: done } = await supabase.from("feedback").update({ completed_at: new Date().toISOString() }).eq("id", row.id).is("completed_at", null).select("id");
  if (done?.length) {
    const report: Report = {
      id: row.id, product: row.product, category: row.category, description: row.description, email: row.email, followUp: row.follow_up,
      diagnostics: row.diagnostics ?? {}, attachments,
    };
    await notifyReport(report, new URL(req.url).origin);
  }
  return json({ status: "complete" });
}
