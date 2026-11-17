/**
 * Answers for the products' calls: JSON, and CORS open to any origin (the calls carry no cookies or
 * credentials; the desktop apps' pages come from tauri://localhost or http://tauri.localhost).
 */
import { createHash } from "node:crypto";

export const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Prime-Install, X-Prime-Product",
  "Access-Control-Max-Age": "86400",
};

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...CORS, ...headers } });
}

export const preflight = () => new Response(null, { status: 204, headers: CORS });

/** The caller's IP, hashed (never stored as it is). */
export function ipHash(req: Request): string {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(`${process.env.IP_SALT ?? ""}:${ip}`).digest("hex").slice(0, 32);
}
