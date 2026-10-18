import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Users, RefreshCw, Printer, Hash } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, Panel, Empty, Badge2, EmpCode } from "@/components/common";
import EmployeeFormDialog from "@/components/EmployeeFormDialog";
import { AccessSwitch } from "@/components/EmployeeAccess";
import CredentialSlipsDialog, { SlipsPreview } from "@/components/CredentialSlips";
import { api, errMsg, fmtDate } from "@/lib/api";

const SyncBar = ({ onDone }) => {
  const [last, setLast] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get("/admin/vendor-sync/status").then((r) => setLast(r.data)); }, []);
  const sync = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/admin/vendor-sync");
      if (data.status === "success") toast.success(`Synced: ${data.result.created} new, ${data.result.updated} updated, ${data.result.attendance_months_pushed} attendance month(s) sent`);
      else toast.error(data.error || data.detail || "Sync failed");
      api.get("/admin/vendor-sync/status").then((r) => setLast(r.data));
      onDone();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Panel className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3" data-testid="vendor-sync-bar">
      <div>
        <div className="font-semibold">Vendor Portal HR link</div>
        <div className="text-sm text-muted-foreground" data-testid="vendor-sync-status">
          Employees come from Vendor Portal (Employee Code = primary key); attendance is sent back. Auto-sync every hour.
          {last && <> Last sync: {new Date(last.started_at).toLocaleString("en-IN")} · <span className={last.status === "success" ? "text-emerald-600" : "text-rose-600"}>{last.status}</span></>}
        </div>
      </div>
      <Button variant="outline" onClick={sync} disabled={busy} data-testid="vendor-sync-btn"><RefreshCw size={15} className={`mr-2 ${busy ? "animate-spin" : ""}`} />{busy ? "Syncing…" : "Sync now"}</Button>
    </Panel>
  );
};

export default function AdminEmployees() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [slipsOpen, setSlipsOpen] = useState(false);
  const [slips, setSlips] = useState(null);
  const navigate = useNavigate();

  const load = useCallback(() => { api.get("/admin/employees").then((r) => setRows(r.data)); }, []);
  useEffect(() => { load(); }, [load]);

  const s = q.toLowerCase();
  const shown = rows.filter((e) => [e.name, e.employee_id, e.short_code, e.email, e.department, e.designation].some((v) => (v || "").toLowerCase().includes(s)));
  const missing = rows.filter((e) => !e.short_code).length;
  const genCodes = async () => {
    try {
      const { data } = await api.post("/admin/employees/short-codes/generate", { overwrite: false });
      toast.success(`Short code generated for ${data.generated} employee(s)`);
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div>
      <PageHeader eyebrow="People" title="Employees" desc="Create employee accounts and manage their records."
        action={<div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={genCodes} disabled={!missing} data-testid="generate-short-codes-btn"><Hash size={16} className="mr-2" />{missing ? `Generate short codes (${missing})` : "All have short codes"}</Button>
          <Button variant="outline" onClick={() => setSlipsOpen(true)} data-testid="credential-slips-btn"><Printer size={16} className="mr-2" />Credential slips</Button>
          <Button onClick={() => setOpen(true)} data-testid="add-employee-btn"><Plus size={16} className="mr-2" />Add employee</Button>
        </div>} />
      <SyncBar onDone={load} />
      <Panel>
        <div className="relative mb-5 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, ID, short code, department…" className="pl-9" data-testid="employee-search-input" />
        </div>
        {shown.length ? (
          <div className="overflow-x-auto -mx-5 sm:-mx-6">
            <table className="w-full text-sm min-w-[640px]" data-testid="employees-table">
              <thead>
                <tr className="text-left text-xs uppercase tracking-widest text-muted-foreground border-b">
                  <th className="px-5 sm:px-6 py-3 font-semibold">Employee</th>
                  <th className="px-3 py-3 font-semibold">Department</th>
                  <th className="px-3 py-3 font-semibold">Designation</th>
                  <th className="px-3 py-3 font-semibold">Joined</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-5 sm:px-6 py-3 font-semibold">Portal Live</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {shown.map((e) => (
                  <tr key={e.id} onClick={() => navigate(`/admin/employees/${e.id}`)} className="cursor-pointer hover:bg-slate-50 transition-colors" data-testid={`employee-row-${e.employee_id}`}>
                    <td className="px-5 sm:px-6 py-3"><div className="font-semibold">{e.name}</div><div className="text-xs text-muted-foreground mt-0.5"><EmpCode e={e} />{e.source === "vendor" && <span className="ml-2 text-primary">· Vendor HR</span>}</div></td>
                    <td className="px-3 py-3">{e.department || "—"}</td>
                    <td className="px-3 py-3">{e.designation || "—"}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{fmtDate(e.joining_date)}</td>
                    <td className="px-3 py-3"><Badge2 tone={e.active !== false ? "approved" : "rejected"}>{e.active !== false ? "Active" : "Inactive"}</Badge2></td>
                    <td className="px-5 sm:px-6 py-3"><AccessSwitch employee={e} onChange={(u) => setRows((rs) => rs.map((x) => (x.id === u.id ? u : x)))} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty icon={Users} text={rows.length ? "No matching employees." : "No employees yet. Click “Add employee” to create the first account."} testId="employees-empty" />}
      </Panel>
      <EmployeeFormDialog open={open} onOpenChange={setOpen} onSaved={load} />
      <CredentialSlipsDialog open={slipsOpen} onOpenChange={setSlipsOpen} employees={rows} onIssued={(d) => { setSlips(d); load(); }} />
      <SlipsPreview data={slips} onClose={() => setSlips(null)} />
    </div>
  );
}
