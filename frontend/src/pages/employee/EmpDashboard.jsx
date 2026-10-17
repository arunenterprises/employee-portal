import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck2, Hourglass, Plane, Wallet, LogIn, LogOut, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, StatCard, StatusBadge, Empty } from "@/components/common";
import PunchDialog from "@/components/PunchDialog";
import { BalanceCards } from "@/components/LeaveBalance";
import { useAuth } from "@/context/AuthContext";
import { api, fmtTime, fmtLate, fmtINR, fmtHours, monthLabel, fmtDate } from "@/lib/api";

const LiveClock = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div>
      <div className="font-mono text-4xl sm:text-5xl font-semibold tracking-tight" data-testid="live-clock">{now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Kolkata" })}</div>
      <div className="text-sm text-slate-400 mt-1">{now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
    </div>
  );
};

const fmtWin = ([a, b]) => {
  const t = (s) => new Date(`2000-01-01T${s}:00`).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  return `${t(a)} – ${t(b)}`;
};

const hmNow = (cfg, now) => now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: cfg.timezone });

const inWindow = (cfg, kind, now) => {
  if (!cfg) return false;
  const hm = hmNow(cfg, now);
  const [a, b] = cfg.windows[kind];
  return hm >= a && hm <= b;
};

const canPunchIn = (cfg, now) => cfg && hmNow(cfg, now) >= cfg.windows.in[0] && hmNow(cfg, now) <= cfg.windows.out[1];
const isLateNow = (cfg, now) => cfg && hmNow(cfg, now) > cfg.windows.in[1];

const PunchCard = ({ today, cfg, onPunch }) => {
  const inT = today?.punch_in?.time;
  const outT = today?.punch_out?.time;
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);
  const canIn = canPunchIn(cfg, now);
  const canOut = inWindow(cfg, "out", now);
  return (
    <div className="rounded-2xl bg-[hsl(var(--sidebar))] text-white p-6 sm:p-8 grid-bg relative overflow-hidden rise" data-testid="punch-card">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400 font-semibold mb-6">
        <span className={`h-2.5 w-2.5 rounded-full ${inT && !outT ? "bg-emerald-400 live-dot" : "bg-slate-500"}`} />
        <span data-testid="punch-status">{!inT ? "Not punched in" : !outT ? "On duty" : "Day completed"}</span>
      </div>
      <LiveClock />
      <div className="grid grid-cols-3 gap-4 mt-8 text-sm">
        <div><div className="text-slate-400 text-xs">Punch in</div><div className="font-mono font-semibold mt-1" data-testid="today-in-time">{fmtTime(inT)}</div>{today?.late && <span className="inline-block mt-1 rounded bg-amber-400/20 text-amber-300 text-[11px] font-semibold px-1.5 py-0.5" data-testid="today-late-badge">Late {fmtLate(today.late_minutes)}</span>}</div>
        <div><div className="text-slate-400 text-xs">Punch out</div><div className="font-mono font-semibold mt-1" data-testid="today-out-time">{fmtTime(outT)}</div></div>
        <div><div className="text-slate-400 text-xs">Worked</div><div className="font-mono font-semibold mt-1">{fmtHours(today?.work_minutes)}</div></div>
      </div>
      <div className="mt-8 space-y-3">
        {!inT && <Button onClick={() => onPunch("in")} disabled={!canIn} className="h-12 px-8 bg-emerald-500 hover:bg-emerald-600 text-white text-base disabled:opacity-40" data-testid="punch-in-btn"><LogIn size={18} className="mr-2" />Punch In</Button>}
        {inT && !outT && <Button onClick={() => onPunch("out")} disabled={!canOut} className="h-12 px-8 bg-rose-500 hover:bg-rose-600 text-white text-base disabled:opacity-40" data-testid="punch-out-btn"><LogOut size={18} className="mr-2" />Punch Out</Button>}
        {outT && <div className="inline-flex items-center gap-2 text-emerald-400 font-semibold" data-testid="punch-done"><CheckCircle2 size={18} />Attendance marked for today</div>}
        {cfg && (
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-400" data-testid="punch-windows">
            <span>In time: <span className="text-slate-200 font-mono">{fmtWin(cfg.windows.in)}</span></span>
            <span>Out time: <span className="text-slate-200 font-mono">{fmtWin(cfg.windows.out)}</span></span>
          </div>
        )}
        {!inT && canIn && isLateNow(cfg, now) && <div className="text-xs text-amber-300" data-testid="punch-late-warning">In time is over — your punch will be marked Late.</div>}
        {!outT && cfg && !(inT ? canOut : canIn) && (
          <div className="text-xs text-amber-300" data-testid="punch-window-closed">
            {inT ? "Punch Out" : "Punch In"} is not open right now. Missed it? <Link to="/employee/requests" className="underline font-semibold hover:text-amber-200" data-testid="missed-punch-link">Raise a Missed Punch request</Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default function EmpDashboard() {
  const { user } = useAuth();
  const [today, setToday] = useState(null);
  const [sum, setSum] = useState(null);
  const [reqs, setReqs] = useState([]);
  const [mode, setMode] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [bal, setBal] = useState(null);

  useEffect(() => { api.get("/attendance/config").then((r) => setCfg(r.data)); }, []);

  const load = useCallback(() => {
    api.get("/attendance/today").then((r) => setToday(r.data));
    api.get("/me/summary").then((r) => setSum(r.data));
    api.get("/requests").then((r) => setReqs(r.data.slice(0, 4)));
    api.get("/leave-balance").then((r) => setBal(r.data));
  }, []);

  useEffect(() => { load(); }, [load]);
  const closePunch = useCallback(() => setMode(null), []);

  return (
    <div className="space-y-8">
      <div className="rise">
        <div className="text-xs uppercase tracking-[0.2em] font-semibold text-primary mb-2">Namaste</div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight" data-testid="welcome-name">{user?.name}</h1>
        <p className="text-muted-foreground mt-1">{[user?.designation, user?.department].filter(Boolean).join(" · ") || user?.employee_id}</p>
      </div>

      {user?.must_change_password && (
        <Link to="/employee/profile" className="block rounded-xl bg-amber-50 text-amber-800 ring-1 ring-amber-200 px-4 py-3 text-sm font-medium hover:bg-amber-100 transition-colors" data-testid="change-password-banner">
          You are using the initial password. Please change it from your Profile page.
        </Link>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2"><PunchCard today={today} cfg={cfg} onPunch={setMode} /></div>
        <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
          <StatCard icon={CalendarCheck2} label="Present this month" value={sum?.present_this_month ?? "–"} testId="stat-present" tone="bg-emerald-50 text-emerald-600" />
          <StatCard icon={Hourglass} label="Pending requests" value={sum?.pending_requests ?? "–"} testId="stat-pending" tone="bg-amber-50 text-amber-600" delay={80} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <StatCard icon={Plane} label="Leave taken this year" value={`${sum?.leave_days_year ?? 0} days`} testId="stat-leave" tone="bg-blue-50 text-blue-600" delay={120} />
        <Panel className="lg:col-span-2 rise">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">Latest payslip</div>
            <Link to="/employee/payslips" className="text-sm font-semibold text-primary hover:underline" data-testid="goto-payslips">View all</Link>
          </div>
          {sum?.last_payslip ? (
            <div className="flex items-end justify-between">
              <div className="font-display text-xl font-bold">{monthLabel(sum.last_payslip.month)}</div>
              <div className="font-mono text-2xl font-semibold text-emerald-600">{fmtINR(sum.last_payslip.net)}</div>
            </div>
          ) : <p className="text-sm text-muted-foreground flex items-center gap-2"><Wallet size={16} />No payslip published yet.</p>}
        </Panel>
      </div>

      <Panel className="rise" data-testid="dashboard-leave-balance">
        <h3 className="font-display text-lg font-semibold mb-4">Leave balance ({new Date().getFullYear()})</h3>
        <BalanceCards data={bal} />
      </Panel>

      <Panel className="rise">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-semibold">Recent requests</h3>
          <Link to="/employee/requests" className="text-sm font-semibold text-primary hover:underline inline-flex items-center gap-1" data-testid="goto-requests">New request <ArrowRight size={14} /></Link>
        </div>
        {reqs.length ? (
          <ul className="divide-y">
            {reqs.map((r) => (
              <li key={r.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0"><div className="font-medium capitalize">{r.type === "leave" ? r.leave_type : r.type === "other" ? r.subject : `${r.type} request`}</div><div className="text-xs text-muted-foreground">{fmtDate(r.created_at)}</div></div>
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        ) : <Empty text="No requests yet." />}
      </Panel>

      <PunchDialog open={!!mode} mode={mode} onClose={closePunch} onDone={load} />
    </div>
  );
}
