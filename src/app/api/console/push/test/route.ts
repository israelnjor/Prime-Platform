/** POST /api/console/push/test — a test notification to every subscribed device. */
import { json } from "@/lib/http";
import { requireAdmin } from "@/lib/admin";
import { pushAll } from "@/lib/notify";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  const who = await requireAdmin(req);
  if (who instanceof Response) return who;
  const sent = await pushAll({ title: "Prime Console", body: "Notifications are working on this device.", url: new URL(req.url).origin, tag: "test" });
  return json({ sent });
}
