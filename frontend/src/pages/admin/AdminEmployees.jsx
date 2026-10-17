import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, Panel, Empty, Badge2 } from "@/components/common";
import EmployeeFormDialog from "@/components/EmployeeFormDialog";
import { api, fmtDate } from "@/lib/api";

export default function AdminEmployees() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(() => { api.get("/admin/employees").then((r) => setRows(r.data)); }, []);
  useEffect(() => { load(); }, [load]);

  const s = q.toLowerCase();
  const shown = rows.filter((e) => [e.name, e.employee_id, e.email, e.department, e.designation].some((v) => (v || "").toLowerCase().includes(s)));

  return (
    <div>
      <PageHeader eyebrow="People" title="Employees" desc="Create employee accounts and manage their records."
        action={<Button onClick={() => setOpen(true)} data-testid="add-employee-btn"><Plus size={16} className="mr-2" />Add employee</Button>} />
      <Panel>
        <div className="relative mb-5 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, ID, department…" className="pl-9" data-testid="employee-search-input" />
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
                  <th className="px-5 sm:px-6 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {shown.map((e) => (
                  <tr key={e.id} onClick={() => navigate(`/admin/employees/${e.id}`)} className="cursor-pointer hover:bg-slate-50 transition-colors" data-testid={`employee-row-${e.employee_id}`}>
                    <td className="px-5 sm:px-6 py-3"><div className="font-semibold">{e.name}</div><div className="text-xs text-muted-foreground font-mono">{e.employee_id} · {e.email}</div></td>
                    <td className="px-3 py-3">{e.department || "—"}</td>
                    <td className="px-3 py-3">{e.designation || "—"}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{fmtDate(e.joining_date)}</td>
                    <td className="px-5 sm:px-6 py-3"><Badge2 tone={e.active !== false ? "approved" : "rejected"}>{e.active !== false ? "Active" : "Inactive"}</Badge2></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty icon={Users} text={rows.length ? "No matching employees." : "No employees yet. Click “Add employee” to create the first account."} testId="employees-empty" />}
      </Panel>
      <EmployeeFormDialog open={open} onOpenChange={setOpen} onSaved={load} />
    </div>
  );
}
