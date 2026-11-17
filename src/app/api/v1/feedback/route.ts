/**
 * POST /v1/feedback — a product announces a report (Prime Word: docs/feedback-api.md). Idempotent by the
 * report's id: a retry finds the same record and is only handed upload links for attachments not yet
 * stored. New reports are limited per installation and per IP.
 */
import { BUCKET, db } from "@/lib/supabase";
import { check, PER_INSTALL_PER_HOUR, PER_IP_PER_HOUR } from "@/lib/feedback";
import { ipHash, json, preflight } from "@/lib/http";

export const runtime = "nodejs";
export const OPTIONS = preflight;

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try { body = await req.json(); } catch { return json({ error: "not JSON" }, 400); }
  const checked = check(body);
  if ("error" in checked) return json({ error: checked.error }, 400);
  const r = checked.report;
  const supabase = db();
  const install = (req.headers.get("x-prime-install") ?? "").slice(0, 64) || null;
  const ip = ipHash(req);

  const { data: known, error: readError } = await supabase.from("feedback").select("id, completed_at, announce_count").eq("id", r.id).maybeSingle();
  if (readError) return json({ error: "try again" }, 503);
  if (known) {
    await supabase.from("feedback").update({ announce_count: known.announce_count + 1 }).eq("id", r.id);
  } else {
    // Limits on new reports.
    const hourAgo = new Date(Date.now() - 3600_000).toISOString();
    const [byInstall, byIp] = await Promise.all([
      install ? supabase.from("feedback").select("id", { count: "exact", head: true }).eq("install_id", install).gte("received_at", hourAgo) : Promise.resolve({ count: 0 }),
      supabase.from("feedback").select("id", { count: "exact", head: true }).eq("ip_hash", ip).gte("received_at", hourAgo),
    ]);
    if ((byInstall.count ?? 0) >= PER_INSTALL_PER_HOUR || (byIp.count ?? 0) >= PER_IP_PER_HOUR) {
      return json({ error: "too many reports; try again later" }, 429, { "Retry-After": "900" });
    }
    const { error } = await supabase.from("feedback").insert({
      id: r.id, product: r.product, category: r.category, description: r.description, email: r.email, follow_up: r.followUp,
      created_at: r.createdAt ?? null, install_id: install, ip_hash: ip, diagnostics: r.diagnostics, attachments: r.attachments,
    });
    // Two retries at once: the other one made it.
    if (error && error.code !== "23505") return json({ error: "try again" }, 503);
  }
  if (known?.completed_at) return json({ status: "complete", uploads: [] });

  // Upload links for the attachments not stored yet.
  const stored = new Set(((await supabase.storage.from(BUCKET).list(r.id)).data ?? []).map((f) => f.name));
  const uploads = [];
  for (const a of r.attachments.filter((a) => !stored.has(a.file))) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(`${r.id}/${a.file}`, { upsert: true });
    if (error || !data) return json({ error: "try again" }, 503);
    uploads.push({ file: a.file, url: data.signedUrl, headers: { "x-upsert": "true" } });
  }
  return json({ status: "received", uploads });
}
