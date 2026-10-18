import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Monitor, Smartphone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, NativeSelect, Empty } from "@/components/common";
import { api, localDate } from "@/lib/api";

const device = (ua = "") => {
  const os = /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iOS" : /Windows/i.test(ua) ? "Windows" : /Mac OS/i.test(ua) ? "Mac" : /Linux/i.test(ua) ? "Linux" : "Unknown";
  const br = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /SamsungBrowser/.test(ua) ? "Samsung" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return { label: `${br} on ${os}`, mobile: /Android|iPhone|iPad|Mobile/i.test(ua) };
};
const dt = (iso) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—");
const ago = (iso) => { const m = Math.round((Date.now() - new Date(iso)) / 60000); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)}h ${m % 60}m ago`; };

const STATUS = { online: ["Online", "bg-emerald-100 text-emerald-800", "bg-emerald-500"], idle: ["Idle", "bg-amber-100 text-amber-800", "bg-amber-400"] };
const TYPE = { login: ["Login", "bg-emerald-100 text-emerald-800"], logout: ["Logout", "bg-slate-200 text-slate-700"], failed: ["Failed", "bg-rose-100 text-rose-700"] };

const Device = ({ ua }) => { const d = device(ua); const I = d.mobile ? Smartphone : Monitor; return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><I size={13} />{d.label}</span>; };
const Who = ({ e, fallback }) => <div><div className="font-semibold leading-tight">{e?.name || fallback || "Unknown"}</div><div className="text-[11px] font-mono text-muted-foreground">{e?.employee_id || "—"}</div></div>;

const SessionCard = ({ s }) => {
  const [l, cls, dot] = STATUS[s.status] || ["—", "bg-slate-100", "bg-slate-400"];
  return (
    <div className="rounded-xl border p-4 bg-white" data-testid={`session-${s.employee?.employee_id || s.sid}`}>
      <div className="flex items-start justify-between gap-2">
        <Who e={s.employee} />
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}><span className={`h-1.5 w-1.5 rounded-full ${dot} ${s.status === "online" ? "animate-pulse" : ""}`} />{l}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div><div className="text-muted-foreground">IP address</div><div className="font-mono font-semibold" data-testid="session-ip">{s.ip || "—"}</div></div>
        <div><div className="text-muted-foreground">Last active</div><div className="font-semibold">{ago(s.last_seen)}</div></div>
        <div><div className="text-muted-foreground">Logged in</div><div className="font-semibold">{dt(s.login_at)}</div></div>
        <div className="min-w-0"><div className="text-muted-foreground">Device</div><Device ua={s.user_agent} /></div>
      </div>
    </div>
  );
};

const LogsTable = ({ rows }) => !rows.length ? <Empty text="No login activity for this filter." testId="logs-empty" /> : (
  <div className="overflow-x-auto -mx-5 sm:-mx-6">
    <table className="w-full text-sm min-w-[720px]" data-testid="login-logs-table">
      <thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b"><th className="px-5 sm:px-6 py-2">Time</th><th className="py-2">Employee</th><th className="py-2">Event</th><th className="py-2">IP address</th><th className="py-2 pr-5">Device</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50" data-testid={`log-row-${r.id}`}>
            <td className="px-5 sm:px-6 py-2.5 whitespace-nowrap font-mono text-xs">{dt(r.at)}</td>
            <td className="py-2.5"><Who e={r.employee} fallback={r.identifier} /></td>
            <td className="py-2.5"><span className={`rounded px-2 py-0.5 text-xs font-semibold ${TYPE[r.type]?.[1]}`}>{TYPE[r.type]?.[0]}</span>{r.detail && <div className="text-[11px] text-muted-foreground mt-0.5">{r.detail}</div>}</td>
            <td className="py-2.5 font-mono text-xs">{r.ip || "—"}</td>
            <td className="py-2.5 pr-5"><Device ua={r.user_agent} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default function AdminLoginActivity() {
  const [sess, setSess] = useState(null);
  const [logs, setLogs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [f, setF] = useState({ date: localDate(), user_id: "", type: "" });

  const loadSessions = useCallback(() => { api.get("/admin/login-activity/sessions").then((r) => setSess(r.data)); }, []);
  const loadLogs = useCallback(() => {
    api.get("/admin/login-activity/logs", { params: { date: f.date || undefined, user_id: f.user_id || undefined, type: f.type || undefined } }).then((r) => setLogs(r.data));
  }, [f]);
  useEffect(() => { api.get("/admin/employees").then((r) => setEmployees(r.data)); }, []);
  useEffect(() => { loadSessions(); const t = setInterval(loadSessions, 60000); return () => clearInterval(t); }, [loadSessions]);
  useEffect(() => { loadLogs(); }, [loadLogs]);

  const online = sess?.sessions.filter((s) => s.status === "online") || [];
  const idle = sess?.sessions.filter((s) => s.status === "idle") || [];
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Security" title="Login Activity" desc={`Who is logged in right now, with IP address. Online = active in the last ${sess?.online_minutes || 15} minutes.`}
        action={<Button variant="outline" onClick={() => { loadSessions(); loadLogs(); }} data-testid="login-activity-refresh"><RefreshCw size={15} className="mr-2" />Refresh</Button>} />
      <Panel data-testid="online-panel">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <h3 className="font-display text-lg font-semibold">Logged in now</h3>
          <span className="rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-xs font-semibold" data-testid="online-count">{online.length} online</span>
          <span className="rounded-full bg-amber-100 text-amber-800 px-2.5 py-0.5 text-xs font-semibold" data-testid="idle-count">{idle.length} idle (not logged out)</span>
        </div>
        {!sess ? <div className="text-sm text-muted-foreground">Loading…</div> : !sess.sessions.length ? <Empty text="No employee is logged in right now." testId="online-empty" /> : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">{sess.sessions.map((s) => <SessionCard key={s.sid} s={s} />)}</div>
        )}
      </Panel>
      <Panel>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <h3 className="font-display text-lg font-semibold sm:mr-auto">Login / logout logs</h3>
          <Input type="date" value={f.date} onChange={set("date")} className="sm:w-44" data-testid="logs-date" />
          <NativeSelect value={f.user_id} onChange={set("user_id")} className="sm:w-56" data-testid="logs-employee">
            <option value="">All employees</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.employee_id} · {e.name}</option>)}
          </NativeSelect>
          <NativeSelect value={f.type} onChange={set("type")} className="sm:w-36" data-testid="logs-type">
            <option value="">All events</option><option value="login">Login</option><option value="logout">Logout</option><option value="failed">Failed</option>
          </NativeSelect>
          {f.date && <button onClick={() => setF({ ...f, date: "" })} className="text-sm font-semibold text-primary hover:underline" data-testid="logs-all-dates">All dates</button>}
        </div>
        <LogsTable rows={logs} />
      </Panel>
    </div>
  );
}
