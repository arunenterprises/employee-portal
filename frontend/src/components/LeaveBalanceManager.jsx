import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, Download, Eye, EyeOff, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty } from "@/components/common";
import { LeaveBalanceAdmin, TRACKED } from "@/components/LeaveBalance";
import { api, errMsg } from "@/lib/api";

const SHORT = { "Casual Leave": "CL", "Sick Leave": "SL", "Earned Leave": "EL" };

const downloadTemplate = (rows, year) => {
  const head = ["Employee Code", "Name", "CL", "SL", "EL", "Live"];
  const lines = rows.map((r) => [r.employee_id, r.name, ...TRACKED.map((lt) => r.balances.find((b) => b.leave_type === lt)?.quota ?? 0), r.live ? "Yes" : "No"]);
  const csv = "\ufeff" + [head, ...lines].map((l) => l.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `leave-balance-${year}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
};

const BalCell = ({ b }) => (
  <td className="py-2.5 px-2 text-center">
    <div className="font-display font-bold">{b.available}</div>
    <div className="text-[10px] text-muted-foreground">of {b.allotted}{b.pending ? ` · ${b.pending} pend.` : ""}</div>
  </td>
);

const Row = ({ r, onLive, onEdit }) => (
  <tr className="border-b last:border-0 hover:bg-slate-50" data-testid={`lb-row-${r.employee_id}`}>
    <td className="px-5 sm:px-6 py-2.5"><div className="font-semibold leading-tight">{r.name}</div><div className="text-[11px] font-mono text-muted-foreground">{r.employee_id}</div></td>
    {r.configured ? TRACKED.map((lt) => <BalCell key={lt} b={r.balances.find((b) => b.leave_type === lt)} />) : <td colSpan={3} className="text-center text-xs text-muted-foreground">Not set</td>}
    <td className="py-2.5 px-2">
      <label className="inline-flex items-center gap-2 cursor-pointer">
        <Switch checked={r.live} onCheckedChange={(v) => onLive([r.user_id], v)} data-testid={`lb-live-${r.employee_id}`} />
        <span className={`text-xs font-semibold ${r.live ? "text-emerald-700" : "text-slate-500"}`}>{r.live ? "Live" : "Unlive"}</span>
      </label>
    </td>
    <td className="py-2.5 pr-5 text-right"><Button size="sm" variant="outline" onClick={() => onEdit(r)} data-testid={`lb-edit-${r.employee_id}`}><Pencil size={13} className="mr-1" />Edit</Button></td>
  </tr>
);

export default function LeaveBalanceManager() {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [data, setData] = useState(null);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const load = useCallback(() => { api.get("/admin/leave-balances", { params: { year } }).then((r) => setData(r.data)); }, [year]);
  useEffect(() => { load(); }, [load]);

  const setLive = async (ids, live) => {
    if (!ids && !window.confirm(`${live ? "Show" : "Hide"} leave balance for ALL ${data?.rows?.length || 0} employees?`)) return;
    try {
      const { data: d } = await api.put("/admin/leave-balances/live", { live, user_ids: ids });
      toast.success(`${d.updated} employee(s): leave balance ${live ? "Live (visible)" : "Unlive (hidden)"}`);
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const fd = new FormData();
    fd.append("year", year);
    fd.append("file", file);
    setBusy(true);
    try {
      const { data: d } = await api.post("/admin/leave-balances/upload", fd);
      toast.success(`Leave balance uploaded for ${d.updated} employee(s)`);
      d.errors.slice(0, 5).forEach((m) => toast.warning(m));
      load();
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };

  const rows = data?.rows || [];
  const liveCount = rows.filter((r) => r.live).length;

  return (
    <div data-testid="leave-balance-manager">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
        <div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">Year</span><Input type="number" value={year} onChange={(e) => setYear(e.target.value)} className="w-24 h-9" data-testid="lb-year" /></div>
        <div className="flex flex-wrap gap-2 lg:ml-auto">
          <Button variant="outline" size="sm" onClick={() => downloadTemplate(rows, year)} disabled={!rows.length} data-testid="lb-template-btn"><Download size={14} className="mr-1.5" />Download sheet / template</Button>
          <Button size="sm" onClick={() => fileRef.current?.click()} disabled={busy} data-testid="lb-upload-btn"><Upload size={14} className="mr-1.5" />{busy ? "Uploading…" : "Upload CSV"}</Button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={upload} data-testid="lb-upload-input" />
          <Button variant="outline" size="sm" onClick={() => setLive(null, true)} data-testid="lb-all-live"><Eye size={14} className="mr-1.5" />All Live</Button>
          <Button variant="outline" size="sm" onClick={() => setLive(null, false)} data-testid="lb-all-unlive"><EyeOff size={14} className="mr-1.5" />All Unlive</Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-4" data-testid="lb-help">
        Upload: download the sheet, fill <b>CL, SL, EL</b> (yearly quota) and <b>Live</b> (Yes/No) for each Employee Code, then upload it. <b>Live</b> = employee sees the balance on dashboard and in the leave request form. <b>Unlive</b> = hidden from the employee. {rows.length > 0 && <span className="font-semibold text-slate-700" data-testid="lb-live-count">{liveCount}/{rows.length} live</span>}
      </p>
      {!data ? <div className="text-sm text-muted-foreground">Loading…</div> : !rows.length ? <Empty text="No employees." /> : (
        <div className="overflow-x-auto -mx-5 sm:-mx-6">
          <table className="w-full text-sm min-w-[640px]" data-testid="lb-table">
            <thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b">
              <th className="px-5 sm:px-6 py-2">Employee</th>{TRACKED.map((lt) => <th key={lt} className="py-2 px-2 text-center">{SHORT[lt]} <span className="normal-case font-normal">avail.</span></th>)}<th className="py-2 px-2">Show to employee</th><th className="py-2 pr-5" />
            </tr></thead>
            <tbody>{rows.map((r) => <Row key={r.user_id} r={r} onLive={setLive} onEdit={setEdit} />)}</tbody>
          </table>
        </div>
      )}
      <Dialog open={!!edit} onOpenChange={(o) => { if (!o) { setEdit(null); load(); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="lb-edit-dialog">
          <DialogHeader><DialogTitle className="font-display">Leave balance · {edit?.name} <span className="font-mono text-sm text-muted-foreground">{edit?.employee_id}</span></DialogTitle></DialogHeader>
          {edit && <LeaveBalanceAdmin userId={edit.user_id} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
