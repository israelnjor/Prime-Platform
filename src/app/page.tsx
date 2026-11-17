"use client";
/**
 * Prime Console: the owner's inbox of feedback from the apps. Install it (Chrome → Install app; on a
 * phone, Add to Home Screen) and turn on notifications to hear about each report as it arrives.
 */
import { createClient, type Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "missing");
const LABEL: Record<string, string> = { bug: "Bug report", difficulty: "Hard to use", idea: "Feature request", general: "General feedback" };

interface Row {
  id: string; product: string; category: string; description: string; email: string; follow_up: boolean;
  received_at: string; status: "new" | "seen" | "done"; attachments: { name: string; size: number }[]; diagnostics: Record<string, unknown>;
}
interface Detail extends Row { files: { name: string; size: number; type: string; url: string | null }[] }

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
const kb = (n: number) => (n < 1048576 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`);

export default function Console() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  if (!ready) return null;
  return session ? <Inbox session={session} /> : <SignIn />;
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  return (
    <main className="signin">
      <h1>Prime Console</h1>
      <form onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setError(error.message);
      }}>
        <label>Email <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required /></label>
        <label>Password <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label>
        <button className="primary">Sign in</button>
        {error && <p className="error">{error}</p>}
      </form>
    </main>
  );
}

function Inbox({ session }: { session: Session }) {
  const [filter, setFilter] = useState<"new" | "seen" | "done" | "all">("new");
  const [rows, setRows] = useState<Row[]>();
  const [open, setOpen] = useState<Detail>();
  const [error, setError] = useState("");
  const api = useCallback(async (path: string, init: RequestInit = {}) => {
    const res = await fetch(path, { ...init, headers: { ...init.headers, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? res.statusText);
    return data;
  }, [session]);

  const load = useCallback(() => {
    setError("");
    api(`/api/console/reports${filter === "all" ? "" : `?status=${filter}`}`).then((d) => setRows(d.reports)).catch((e) => setError(e.message));
  }, [api, filter]);
  useEffect(load, [load]);
  // A report opened from a notification (?report=…).
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("report");
    if (id) void show(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const show = async (id: string) => {
    try {
      const { report } = await api(`/api/console/reports/${id}`);
      setOpen(report);
      if (report.status === "new") { await api(`/api/console/reports/${id}`, { method: "PATCH", body: JSON.stringify({ status: "seen" }) }); load(); }
    } catch (e) { setError((e as Error).message); }
  };
  const mark = async (status: Row["status"]) => {
    if (!open) return;
    await api(`/api/console/reports/${open.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    setOpen({ ...open, status });
    load();
  };

  return (
    <main className="inbox">
      <header>
        <h1>Prime Console</h1>
        <Notifications api={api} />
        <button className="link" onClick={() => void supabase.auth.signOut()}>Sign out</button>
      </header>
      <nav className="filters">
        {(["new", "seen", "done", "all"] as const).map((f) => (
          <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>{f === "all" ? "All" : f[0].toUpperCase() + f.slice(1)}</button>
        ))}
        <button className="link" onClick={load}>Refresh</button>
      </nav>
      {error && <p className="error">{error}</p>}
      <div className={`panes ${open ? "reading" : ""}`}>
        <ul className="list">
          {rows?.length === 0 && <li className="empty">Nothing here.</li>}
          {rows?.map((r) => (
            <li key={r.id} className={`${open?.id === r.id ? "on" : ""} ${r.status}`} onClick={() => void show(r.id)}>
              <div className="meta"><span className={`kind ${r.category}`}>{LABEL[r.category]}</span><span>{r.product}</span><time>{when(r.received_at)}</time></div>
              <p>{r.description}</p>
              <small>{r.email}{r.attachments.length ? ` · ${r.attachments.length} attachment${r.attachments.length > 1 ? "s" : ""}` : ""}</small>
            </li>
          ))}
        </ul>
        {open && (
          <article className="detail">
            <button className="link back" onClick={() => setOpen(undefined)}>← Back</button>
            <div className="meta"><span className={`kind ${open.category}`}>{LABEL[open.category]}</span><span>{open.product}</span><time>{when(open.received_at)}</time></div>
            <p className="text">{open.description}</p>
            <p><a href={`mailto:${open.email}?subject=${encodeURIComponent(`Your feedback on ${open.product}`)}`}>{open.email}</a>
              {open.follow_up ? " · happy to be contacted" : " · did not ask to be contacted"}</p>
            {open.files.length > 0 && (
              <ul className="files">{open.files.map((f) => <li key={f.name}>{f.url ? <a href={f.url}>{f.name}</a> : f.name} <small>{kb(f.size)}</small></li>)}</ul>
            )}
            <details><summary>Diagnostics</summary><pre>{JSON.stringify(open.diagnostics, null, 2)}</pre></details>
            <div className="actions">
              {open.status !== "done" && <button className="primary" onClick={() => void mark("done")}>Mark done</button>}
              {open.status !== "new" && <button onClick={() => void mark("new")}>Mark as new</button>}
            </div>
          </article>
        )}
      </div>
    </main>
  );
}

/** Notifications on this device: a push for each new report (the service worker shows it). */
function Notifications({ api }: { api: (path: string, init?: RequestInit) => Promise<{ sent?: number }> }) {
  const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
  const [on, setOn] = useState(false);
  const [note, setNote] = useState("");
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  const appKey = useMemo(() => {
    const b = atob((key + "=".repeat((4 - (key.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(b, (c) => c.charCodeAt(0));
  }, [key]);
  useEffect(() => {
    if (!supported) return;
    void navigator.serviceWorker.register("/sw.js").then(async (reg) => setOn(!!(await reg.pushManager.getSubscription())));
  }, [supported]);
  if (!supported) return <span className="hint">Notifications: on iPhone, add this page to the home screen first.</span>;
  const enable = async () => {
    setNote("");
    try {
      if ((await Notification.requestPermission()) !== "granted") { setNote("Notifications are blocked for this site."); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });
      await api("/api/console/push", { method: "POST", body: JSON.stringify({ subscription: sub.toJSON() }) });
      setOn(true);
      const { sent } = await api("/api/console/push/test", { method: "POST" });
      setNote(sent ? "Test notification sent." : "Subscribed; the test notification could not be sent (check the VAPID keys).");
    } catch (e) { setNote((e as Error).message); }
  };
  const disable = async () => {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) { await api("/api/console/push", { method: "DELETE", body: JSON.stringify({ endpoint: sub.endpoint }) }); await sub.unsubscribe(); }
    setOn(false);
  };
  return (
    <span className="notify">
      {on ? <button onClick={() => void disable()}>🔔 Notifications on</button> : <button className="primary" onClick={() => void enable()}>Turn on notifications</button>}
      {note && <span className="hint">{note}</span>}
    </span>
  );
}
