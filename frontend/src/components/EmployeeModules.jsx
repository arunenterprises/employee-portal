import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Empty, Badge2 } from "@/components/common";
import { AppraisalForm, AppraisalList } from "@/components/Appraisals";
import AttendanceTable from "@/components/AttendanceTable";
import RequestItem from "@/components/RequestItem";
import { api, downloadPayslip, errMsg, fmtINR, fmtHours, localDate, monthLabel } from "@/lib/api";

export function AppraisalsModule({ userId }) {
  const [items, setItems] = useState([]);
  const [adding, setAdding] = useState(false);
  const load = useCallback(() => { api.get("/admin/appraisals", { params: { user_id: userId } }).then((r) => setItems(r.data)); }, [userId]);
  useEffect(() => { load(); }, [load]);
  return (
    <div data-testid="module-appraisals">
      {!adding && <Button size="sm" variant="outline" className="mb-5" onClick={() => setAdding(true)} data-testid="sb-add-appraisal-btn">+ New appraisal</Button>}
      {adding && <AppraisalForm userId={userId} onSaved={() => { load(); setAdding(false); }} onCancel={() => setAdding(false)} />}
      <AppraisalList items={items} onDelete={async (id) => { await api.delete(`/admin/appraisals/${id}`); load(); }} />
    </div>
  );
}

export function AttendanceModule({ userId }) {
  const [month, setMonth] = useState(localDate().slice(0, 7));
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get("/admin/attendance", { params: { user_id: userId, month } }).then((r) => setRows(r.data)); }, [userId, month]);
  const late = rows.filter((r) => r.late).length;
  return (
    <div data-testid="module-attendance">
      <div className="flex flex-wrap items-center gap-4 mb-4 text-sm">
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" data-testid="module-att-month" />
        <span>Present: <b>{rows.length}</b></span><span>Late: <b className="text-amber-600">{late}</b></span>
        <span>Hours: <b>{fmtHours(rows.reduce((s, r) => s + (r.work_minutes || 0), 0))}</b></span>
      </div>
      <AttendanceTable rows={rows} />
    </div>
  );
}

export function RequestsModule({ userId }) {
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get("/admin/requests").then((r) => setRows(r.data.filter((x) => x.user_id === userId))); }, [userId]);
  return (
    <div className="space-y-3" data-testid="module-requests">
      {rows.length ? rows.map((r) => <RequestItem key={r.id} r={r} />) : <Empty text="No requests from this employee." />}
      {rows.some((r) => r.status === "pending") && <p className="text-xs text-muted-foreground">Approve / reject pending requests from the Requests tab.</p>}
    </div>
  );
}

export function PayslipsModule({ userId }) {
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get("/admin/payslips", { params: { user_id: userId } }).then((r) => setRows(r.data)); }, [userId]);
  const dl = async (p) => { try { await downloadPayslip(p.id, p.month); } catch (e) { toast.error(errMsg(e)); } };
  if (!rows.length) return <Empty text="No payslips published for this employee." testId="module-payslips-empty" />;
  return (
    <div className="divide-y" data-testid="module-payslips">
      {rows.map((p) => (
        <div key={p.id} className="py-3 flex items-center gap-4">
          <div className="flex-1 font-medium">{monthLabel(p.month)}</div>
          <Badge2 tone={p.kind === "generated" ? "blue" : "neutral"}>{p.kind}</Badge2>
          <div className="font-mono font-semibold w-28 text-right">{p.net ? fmtINR(p.net) : "—"}</div>
          <button onClick={() => dl(p)} className="p-2 text-slate-500 hover:text-primary" aria-label="Download" data-testid={`module-download-payslip-${p.id}`}><Download size={16} /></button>
        </div>
      ))}
    </div>
  );
}
