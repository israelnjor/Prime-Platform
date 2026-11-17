/** Feedback reports: what a product sends (docs: Prime Word's docs/feedback-api.md), checked. */

export const CATEGORIES = ["bug", "difficulty", "idea", "general"] as const;
export const MAX_FILE = 10 * 1024 * 1024;
export const MAX_FILES = 5;
/** Limits on new reports (a retry of a known report is not counted). */
export const PER_INSTALL_PER_HOUR = 10;
export const PER_IP_PER_HOUR = 30;

export interface AttachmentMeta { file: string; name: string; type: string; size: number; sha256: string }
export interface Report {
  id: string;
  product: string;
  category: (typeof CATEGORIES)[number];
  description: string;
  email: string;
  followUp: boolean;
  createdAt?: string;
  diagnostics: Record<string, unknown>;
  attachments: AttachmentMeta[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The report, or why it cannot be accepted. */
export function check(body: unknown): { report: Report } | { error: string } {
  const r = body as Partial<Report> | null;
  if (!r || typeof r !== "object") return { error: "not a report" };
  if (typeof r.id !== "string" || !UUID.test(r.id)) return { error: "bad id" };
  if (typeof r.product !== "string" || !/^[a-z0-9-]{2,40}$/.test(r.product)) return { error: "bad product" };
  if (!CATEGORIES.includes(r.category as Report["category"])) return { error: "bad category" };
  if (typeof r.description !== "string" || r.description.trim().length < 3 || r.description.length > 10000) return { error: "bad description" };
  if (typeof r.email !== "string" || r.email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) return { error: "bad email" };
  const attachments = Array.isArray(r.attachments) ? r.attachments : null;
  if (!attachments || attachments.length > MAX_FILES) return { error: "bad attachments" };
  for (const a of attachments) {
    if (!a || !/^a\d{1,3}$/.test(a.file) || typeof a.name !== "string" || a.name.length > 200 || typeof a.type !== "string" || a.type.length > 120
      || !Number.isInteger(a.size) || a.size <= 0 || a.size > MAX_FILE || typeof a.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(a.sha256)) {
      return { error: "attachment too large or badly described" };
    }
  }
  const diagnostics = r.diagnostics && typeof r.diagnostics === "object" ? r.diagnostics : {};
  if (JSON.stringify(diagnostics).length > 20000) return { error: "diagnostics too large" };
  return {
    report: {
      id: r.id.toLowerCase(), product: r.product, category: r.category as Report["category"], description: r.description.trim(), email: r.email.trim(),
      followUp: r.followUp === true, ...(typeof r.createdAt === "string" && !Number.isNaN(Date.parse(r.createdAt)) ? { createdAt: r.createdAt } : {}),
      diagnostics: diagnostics as Record<string, unknown>,
      attachments: attachments.map((a) => ({ file: a.file, name: a.name, type: a.type, size: a.size, sha256: a.sha256 })),
    },
  };
}

export const LABEL: Record<Report["category"], string> = { bug: "Bug report", difficulty: "Hard to use", idea: "Feature request", general: "General feedback" };
