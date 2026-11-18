/**
 * Telling the owner a report arrived: a push notification to every device where Prime Console has
 * notifications on, and (if set up) an email through Resend. Failures here never fail the report.
 */
import { createECDH } from "node:crypto";
import webpush from "web-push";
import { db } from "./supabase";
import { LABEL, type Report } from "./feedback";

/** Sets up the VAPID keys; returns why they cannot be used, or "" when they can. */
function vapid(): string {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim(), priv = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!pub || !priv) return "VAPID keys are not set on the server";
  try {
    const ecdh = createECDH("prime256v1");
    ecdh.setPrivateKey(Buffer.from(priv, "base64url"));
    if (ecdh.getPublicKey().toString("base64url") !== pub)
      return "VAPID_PRIVATE_KEY does not match NEXT_PUBLIC_VAPID_PUBLIC_KEY: set both from the same `npm run vapid`, redeploy, then turn notifications on again";
  } catch { return "VAPID_PRIVATE_KEY is not a valid key"; }
  const contact = (process.env.VAPID_CONTACT ?? "owner@example.com").trim().replace(/^mailto:/i, "");
  webpush.setVapidDetails(/^https:\/\//.test(contact) ? contact : `mailto:${contact}`, pub, priv);
  return "";
}

export interface PushResult { devices: number; sent: number; failures: { status?: number; reason: string }[] }

/**
 * A push to every subscribed device. Subscriptions the push service rejects for good (gone, or made with
 * other VAPID keys) are removed: the device turns notifications on again to get a fresh one.
 */
export async function pushAll(message: { title: string; body: string; url: string; tag?: string }): Promise<PushResult> {
  const result: PushResult = { devices: 0, sent: 0, failures: [] };
  const problem = vapid();
  if (problem) { console.error("push:", problem); result.failures.push({ reason: problem }); return result; }
  const { data, error } = await db().from("push_subscriptions").select("endpoint, subscription");
  if (error) { result.failures.push({ reason: error.message }); return result; }
  result.devices = data?.length ?? 0;
  for (const row of data ?? []) {
    try {
      await webpush.sendNotification(row.subscription, JSON.stringify(message), { TTL: 24 * 3600, urgency: "high" });
      result.sent++;
    } catch (e) {
      const { statusCode, body, message: msg } = e as { statusCode?: number; body?: string; message?: string };
      const reason = String(body || msg || "push failed").slice(0, 200);
      console.error("push failed", statusCode, new URL(row.endpoint).host, reason);
      result.failures.push({ status: statusCode, reason });
      if (statusCode === 403 || statusCode === 404 || statusCode === 410) await db().from("push_subscriptions").delete().eq("endpoint", row.endpoint);
    }
  }
  return result;
}

async function email(subject: string, text: string): Promise<void> {
  const key = process.env.RESEND_API_KEY, to = process.env.NOTIFY_EMAIL;
  if (!key || !to) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.NOTIFY_FROM ?? "Prime Feedback <onboarding@resend.dev>", to: [to], subject, text }),
  }).catch(() => undefined);
}

/** A new report: push and email. */
export async function notifyReport(r: Report, origin: string): Promise<void> {
  const title = `${LABEL[r.category]} · ${r.product}`;
  const body = r.description.length > 140 ? `${r.description.slice(0, 137)}…` : r.description;
  const url = `${origin}/?report=${r.id}`;
  await Promise.allSettled([
    pushAll({ title, body, url, tag: r.id }),
    email(`[${r.product}] ${LABEL[r.category]}: ${body.slice(0, 60)}`,
      `${r.description}\n\nFrom: ${r.email}${r.followUp ? " (may be contacted)" : ""}\nAttachments: ${r.attachments.length}\nVersion: ${String(r.diagnostics.appVersion ?? "?")}\n\n${url}`),
  ]);
}
