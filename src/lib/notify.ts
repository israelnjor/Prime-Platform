/**
 * Telling the owner a report arrived: a push notification to every device where Prime Console has
 * notifications on, and (if set up) an email through Resend. Failures here never fail the report.
 */
import webpush from "web-push";
import { db } from "./supabase";
import { LABEL, type Report } from "./feedback";

function vapid(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(`mailto:${process.env.VAPID_CONTACT ?? "owner@example.com"}`, pub, priv);
  return true;
}

/** A push to every subscribed device; subscriptions the push service says are gone are removed. */
export async function pushAll(message: { title: string; body: string; url: string; tag?: string }): Promise<number> {
  if (!vapid()) return 0;
  const { data } = await db().from("push_subscriptions").select("endpoint, subscription");
  let sent = 0;
  for (const row of data ?? []) {
    try {
      await webpush.sendNotification(row.subscription, JSON.stringify(message), { TTL: 24 * 3600, urgency: "high" });
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await db().from("push_subscriptions").delete().eq("endpoint", row.endpoint);
    }
  }
  return sent;
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
