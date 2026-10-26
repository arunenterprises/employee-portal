import { useCallback, useEffect, useState } from "react";
import { FilePlus2, Upload, Download, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, Empty, NativeSelect, Badge2, EmpCode, empLabel } from "@/components/common";
import { GeneratePayslipDialog, UploadPayslipDialog } from "@/components/PayslipDialogs";
import { api, downloadPayslip, errMsg, fmtINR, monthLabel } from "@/lib/api";

export default function AdminPayslips() {
  const [employees, setEmployees] = useState([]);
  const [rows, setRows] = useState([]);
  const [userId, setUserId] = useState("");
  const [gen, setGen] = useState(false);
  const [up, setUp] = useState(false);

  useEffect(() => { api.get("/admin/employees").then((r) => setEmployees(r.data.filter((e) => e.active !== false))); }, []);
  const load = useCallback(() => { api.get("/admin/payslips", { params: { user_id: userId || undefined } }).then((r) => setRows(r.data)); }, [userId]);
  useEffect(() => { load(); }, [load]);

  const dl = async (p) => { try { await downloadPayslip(p.id, p.month); } catch (e) { toast.error(errMsg(e)); } };
  const remove = async (p) => { await api.delete(`/admin/payslips/${p.id}`); toast.success("Payslip deleted"); load(); };

  return (
    <div>
      <PageHeader eyebrow="Payroll" title="Payslips" desc="Generate payslips from salary details or upload a PDF. Publishing auto-approves matching payslip requests."
        action={<div className="flex gap-2">
          <Button onClick={() => setGen(true)} data-testid="generate-payslip-btn"><FilePlus2 size={16} className="mr-2" />Generate</Button>
          <Button variant="outline" onClick={() => setUp(true)} data-testid="upload-payslip-btn"><Upload size={16} className="mr-2" />Upload PDF</Button>
        </div>} />
      <Panel>
        <NativeSelect value={userId} onChange={(e) => setUserId(e.target.value)} className="sm:w-72 mb-5" data-testid="payslip-employee-filter">
          <option value="">All employees</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{empLabel(e)}</option>)}
        </NativeSelect>
        {rows.length ? (
          <div className="overflow-x-auto -mx-5 sm:-mx-6">
            <table className="rtable w-full text-sm min-w-[600px]" data-testid="payslips-table">
              <thead>
                <tr className="text-left text-xs uppercase tracking-widest text-muted-foreground border-b">
                  <th className="px-5 sm:px-6 py-3 font-semibold">Employee</th>
                  <th className="px-3 py-3 font-semibold">Month</th>
                  <th className="px-3 py-3 font-semibold">Type</th>
                  <th className="px-3 py-3 font-semibold text-right">Net pay</th>
                  <th className="px-5 sm:px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors" data-testid={`payslip-row-${p.id}`}>
                    <td className="px-5 sm:px-6 py-3"><div className="font-semibold">{p.employee?.name}</div><div className="text-xs text-muted-foreground"><EmpCode e={p.employee} /></div></td>
                    <td className="px-3 py-3 font-medium" data-label="Month">{monthLabel(p.month)}</td>
                    <td className="px-3 py-3" data-label="Type"><Badge2 tone={p.kind === "generated" ? "blue" : "neutral"}>{p.kind}</Badge2></td>
                    <td className="px-3 py-3 text-right font-mono font-semibold" data-label="Net pay">{p.net ? fmtINR(p.net) : "—"}</td>
                    <td className="rt-actions px-5 sm:px-6 py-3 text-right whitespace-nowrap" data-label="">
                      <button onClick={() => dl(p)} className="p-2 text-slate-500 hover:text-primary" aria-label="Download" data-testid={`admin-download-payslip-${p.id}`}><Download size={16} /></button>
                      <button onClick={() => remove(p)} className="p-2 text-slate-500 hover:text-rose-600" aria-label="Delete" data-testid={`admin-delete-payslip-${p.id}`}><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty icon={Wallet} text="No payslips yet." testId="admin-payslips-empty" />}
      </Panel>
      <GeneratePayslipDialog open={gen} onOpenChange={setGen} employees={employees} onSaved={load} />
      <UploadPayslipDialog open={up} onOpenChange={setUp} employees={employees} onSaved={load} />
    </div>
  );
}
