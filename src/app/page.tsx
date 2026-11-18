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
  const [recovering, setRecovering] = useState(false);
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  if (!ready) return null;
  if (recovering) return <Welcome mode="reset" onDone={() => setRecovering(false)} />;
  return session ? <Inbox session={session} /> : <Welcome mode="signin" />;
}

/** The Prime P with its red prime mark: the family's logo. */
function Logo({ size = 44 }: { size?: number }) {
  return <img src="/logo.svg" width={size} height={size} alt="" />;
}

/** Sign in, "forgot password", and setting a new password (from the emailed link): one welcoming page. */
function Welcome({ mode: start, onDone }: { mode: "signin" | "reset"; onDone?: () => void }) {
  const [mode, setMode] = useState<"signin" | "forgot" | "reset">(start);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setNote("");
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setError(error.message === "Invalid login credentials" ? "That email and password don't match." : error.message);
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin });
        if (error) setError(error.message);
        else setNote("If that email has an account, a link to set a new password is on its way.");
      } else {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) setError(error.message);
        else { history.replaceState(null, "", "/"); onDone?.(); }
      }
    } finally { setBusy(false); }
  };

  const title = { signin: "Welcome back", forgot: "Reset your password", reset: "Choose a new password" }[mode];
  const lead = {
    signin: "Use your Prime Console email and password.",
    forgot: "Enter your email and we'll send you a link to set a new password.",
    reset: "At least 8 characters. You'll stay signed in on this device.",
  }[mode];

  return (
    <div className="welcome">
      <aside className="brand-panel">
        <div className="brand-mark"><Logo size={72} /><span>Prime<br />Productivity</span></div>
        <div className="brand-copy">
          <p className="eyebrow">Prime Console</p>
          <h2>Every report, from every app, in one place.</h2>
          <span className="rule" />
          <p className="lede">Bug reports, feature requests and feedback from Prime Word and the apps to come, with a
            notification on your phone the moment one arrives.</p>
        </div>
        <footer><span className="eyebrow">Tools that work for you</span><span>© Prime Productivity</span></footer>
      </aside>
      <main className="form-panel">
        <form onSubmit={submit}>
          <div className="mobile-mark"><Logo size={44} /></div>
          <p className="eyebrow">{mode === "signin" ? "Sign in" : "Password"}</p>
          <h1>{title}</h1>
          <span className="rule" />
          <p className="lead">{lead}</p>
          {mode !== "reset" && (
            <label className="field"><span>Email address</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="username" required autoFocus />
            </label>
          )}
          {mode !== "forgot" && (
            <label className="field">
              <span>{mode === "reset" ? "New password" : "Password"}
                {mode === "signin" && <button type="button" className="text-link" onClick={() => { setMode("forgot"); setError(""); }}>Forgot password?</button>}
              </span>
              <span className="pw">
                <input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "reset" ? "new-password" : "current-password"} minLength={mode === "reset" ? 8 : undefined} required autoFocus={mode === "reset"} />
                <button type="button" className="eye" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} title={show ? "Hide password" : "Show password"}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />
                    {show && <path d="M4 4l16 16" />}
                  </svg>
                </button>
              </span>
            </label>
          )}
          <button className="go" disabled={busy}>
            {{ signin: "Sign in", forgot: "Send the link", reset: "Save password" }[mode]}
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12h12M11 7l5 5-5 5M20 4v16" />
            </svg>
          </button>
          {error && <p className="error" role="alert">{error}</p>}
          {note && <p className="note" role="status">{note}</p>}
          {mode === "forgot"
            ? <p className="foot"><button type="button" className="text-link" onClick={() => { setMode("signin"); setNote(""); setError(""); }}>← Back to sign in</button></p>
            : <p className="foot">Need an account? Accounts are added by the owner in Supabase → Authentication.</p>}
        </form>
      </main>
    </div>
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
        <h1><Logo size={30} /> Prime Console</h1>
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

/**
 * Notifications on this device: a push for each new report (the service worker shows it). A subscription made
 * with older VAPID keys can never receive, so it is replaced; and the server is told about it on each visit.
 */
type PushResult = { devices?: number; sent?: number; failures?: { status?: number; reason: string }[] };
function Notifications({ api }: { api: (path: string, init?: RequestInit) => Promise<PushResult> }) {
  const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
  const [on, setOn] = useState(false);
  const [note, setNote] = useState("");
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  const appKey = useMemo(() => {
    const b = atob((key + "=".repeat((4 - (key.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(b, (c) => c.charCodeAt(0));
  }, [key]);
  const sameKey = (sub: PushSubscription) => {
    const k = sub.options.applicationServerKey;
    if (!k) return true;
    const a = new Uint8Array(k);
    return a.length === appKey.length && a.every((v, i) => v === appKey[i]);
  };
  useEffect(() => {
    if (!supported) return;
    void navigator.serviceWorker.register("/sw.js").then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return;
      if (!sameKey(sub) || Notification.permission !== "granted") { await sub.unsubscribe(); setNote("Notifications need turning on again on this device."); return; }
      setOn(true);
      await api("/api/console/push", { method: "POST", body: JSON.stringify({ subscription: sub.toJSON() }) }).catch(() => undefined);
    });
  }, [supported]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!supported) return <span className="hint">Notifications: on iPhone, add this page to the home screen first.</span>;

  const test = async () => {
    setNote("Sending a test…");
    try {
      const r = await api("/api/console/push/test", { method: "POST" });
      if (r.sent) setNote(`Test sent to ${r.sent} device${r.sent > 1 ? "s" : ""}. Nothing showing? Check Windows or phone notification settings for your browser.`);
      else if (r.failures?.length) setNote(`The test could not be sent: ${r.failures.map((f) => (f.status ? `${f.status} ` : "") + f.reason).join("; ")}`);
      else setNote("No device has notifications on.");
    } catch (e) { setNote((e as Error).message); }
  };
  const enable = async () => {
    setNote("");
    try {
      if ((await Notification.requestPermission()) !== "granted") { setNote("Notifications are blocked for this site: allow them in the browser's site settings."); return; }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (sub && !sameKey(sub)) { await sub.unsubscribe(); sub = null; }
      sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });
      await api("/api/console/push", { method: "POST", body: JSON.stringify({ subscription: sub.toJSON() }) });
      setOn(true);
      await test();
    } catch (e) { setNote((e as Error).message); }
  };
  const disable = async () => {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) { await api("/api/console/push", { method: "DELETE", body: JSON.stringify({ endpoint: sub.endpoint }) }); await sub.unsubscribe(); }
    setOn(false); setNote("");
  };
  return (
    <span className="notify">
      {on ? <>
        <button onClick={() => void test()}>Send test</button>
        <button onClick={() => void disable()} title="Turn off notifications on this device">🔔 On</button>
      </> : <button className="primary" onClick={() => void enable()}>Turn on notifications</button>}
      {note && <span className="hint">{note}</span>}
    </span>
  );
}
