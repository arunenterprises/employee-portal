import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, NativeSelect } from "@/components/common";
import { api, errMsg, fmtDate } from "@/lib/api";

export const TRACKED = ["Casual Leave", "Sick Leave", "Earned Leave"];
const SHORT = { "Casual Leave": "CL", "Sick Leave": "SL", "Earned Leave": "EL" };

export const BalanceCards = ({ data }) => {
  if (!data?.configured) return <p className="text-sm text-muted-foreground" data-testid="leave-balance-empty">Leave balance not set by HR yet.</p>;
  return (
    <div className="grid grid-cols-3 gap-3" data-testid="leave-balance-cards">
      {data.balances.map((b) => (
        <div key={b.leave_type} className="rounded-xl border bg-white p-4" data-testid={`balance-${SHORT[b.leave_type]}`}>
          <div className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground"><span className="sm:hidden">{SHORT[b.leave_type]}</span><span className="hidden sm:inline">{b.leave_type}</span></div>
          <div className="font-display text-3xl font-bold mt-1" data-testid={`balance-available-${SHORT[b.leave_type]}`}>{b.available}</div>
          <div className="text-xs text-muted-foreground mt-1">of {b.allotted}<span className="hidden sm:inline"> · used {b.used}{b.pending ? ` · pending ${b.pending}` : ""}</span></div>
          <div className="h-1.5 rounded-full bg-slate-100 mt-3 overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${b.allotted ? Math.min(100, (b.used / b.allotted) * 100) : 0}%` }} /></div>
        </div>
      ))}
    </div>
  );
};

const QuotaForm = ({ userId, year, data, onSaved }) => {
  const [q, setQ] = useState({});
  const [all, setAll] = useState(false);
  useEffect(() => { setQ(Object.fromEntries((data?.balances || []).map((b) => [b.leave_type, b.quota]))); }, [data]);
  const save = async (e) => {
    e.preventDefault();
    if (all && !window.confirm("Apply this quota to ALL employees for " + year + "? Their existing quotas will be replaced.")) return;
    try {
      const { data: d } = await api.put(`/admin/leave-balance/${userId}`, { year, quotas: q, apply_to_all: all });
      toast.success(all ? `Quota applied to ${d.applied_to} employees` : "Leave quota saved");
      onSaved(d);
    } catch (err) { toast.error(errMsg(err)); }
  };
  return (
    <form onSubmit={save} className="rounded-lg bg-slate-50 p-4 space-y-3" data-testid="leave-quota-form">
      <div className="text-xs font-semibold text-slate-600">Yearly quota ({year})</div>
      <div className="grid grid-cols-3 gap-3">
        {TRACKED.map((lt) => (
          <Field key={lt} label={SHORT[lt]}><Input type="number" min="0" step="0.5" className="bg-white" disabled={!data} value={q[lt] ?? 0} onChange={(e) => setQ({ ...q, [lt]: e.target.value })} data-testid={`quota-${SHORT[lt]}`} /></Field>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={all} onCheckedChange={(v) => setAll(!!v)} data-testid="quota-apply-all" />Apply same quota to all employees</label>
      <Button type="submit" size="sm" disabled={!data} data-testid="quota-save-btn">Save quota</Button>
    </form>
  );
};

const AdjustForm = ({ userId, year, onSaved }) => {
  const [f, setF] = useState({ leave_type: "Casual Leave", days: "", reason: "" });
  const save = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post(`/admin/leave-balance/${userId}/adjust`, { ...f, year, days: Number(f.days) });
      toast.success("Balance adjusted");
      setF({ ...f, days: "", reason: "" });
      onSaved(data);
    } catch (err) { toast.error(errMsg(err)); }
  };
  return (
    <form onSubmit={save} className="rounded-lg bg-slate-50 p-4 grid grid-cols-2 gap-3" data-testid="leave-adjust-form">
      <div className="col-span-2 text-xs font-semibold text-slate-600">Adjust balance (+ add / − deduct)</div>
      <Field label="Leave type"><NativeSelect value={f.leave_type} onChange={(e) => setF({ ...f, leave_type: e.target.value })} data-testid="adjust-type">{TRACKED.map((t) => <option key={t}>{t}</option>)}</NativeSelect></Field>
      <Field label="Days (e.g. 2 or -1)"><Input type="number" step="0.5" required className="bg-white" value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })} data-testid="adjust-days" /></Field>
      <Field label="Reason" className="col-span-2"><Input required className="bg-white" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="e.g. Carry forward from last year" data-testid="adjust-reason" /></Field>
      <div className="col-span-2"><Button type="submit" size="sm" variant="outline" data-testid="adjust-save-btn">Apply adjustment</Button></div>
    </form>
  );
};

export function LeaveBalanceAdmin({ userId }) {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [data, setData] = useState(null);
  const load = useCallback(() => { api.get(`/admin/leave-balance/${userId}`, { params: { year } }).then((r) => setData(r.data)); }, [userId, year]);
  useEffect(() => { load(); }, [load]);
  const removeAdj = async (id) => { await api.delete(`/admin/leave-adjustments/${id}`); load(); };
  return (
    <div className="space-y-4" data-testid="leave-balance-admin">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Year</span>
        <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} className="w-24 h-9" data-testid="leave-year-input" />
      </div>
      <BalanceCards data={data} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <QuotaForm userId={userId} year={year} data={data} onSaved={setData} />
        <AdjustForm userId={userId} year={year} onSaved={setData} />
      </div>
      {data?.adjustments?.length > 0 && (
        <ul className="divide-y text-sm" data-testid="adjustment-history">
          {data.adjustments.map((a) => (
            <li key={a.id} className="py-2 flex items-center gap-3">
              <span className={`font-mono font-semibold w-14 ${a.days > 0 ? "text-emerald-600" : "text-rose-600"}`}>{a.days > 0 ? "+" : ""}{a.days}</span>
              <span className="w-10 text-xs font-semibold text-slate-500">{SHORT[a.leave_type]}</span>
              <span className="flex-1 min-w-0 truncate">{a.reason}</span>
              <span className="text-xs text-muted-foreground">{fmtDate(a.created_at)}</span>
              <button onClick={() => removeAdj(a.id)} className="text-slate-400 hover:text-rose-600" aria-label="Delete" data-testid={`delete-adjustment-${a.id}`}><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
