import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, NativeSelect } from "@/components/common";
import { api, errMsg, fmtINR } from "@/lib/api";

const prevMonth = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const DEFAULT_DED = ["Provident Fund", "Professional Tax", "TDS", "Advance Recovery"].map((label) => ({ label, amount: 0 }));

const EmployeePicker = ({ employees, value, onChange, testId }) => (
  <NativeSelect required value={value} onChange={(e) => onChange(e.target.value)} data-testid={testId}>
    <option value="">Select employee</option>
    {employees.map((e) => <option key={e.id} value={e.id}>{e.employee_id} · {e.name}</option>)}
  </NativeSelect>
);

const Lines = ({ title, items, setItems, prefix }) => (
  <div>
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs uppercase tracking-widest font-semibold text-primary">{title}</span>
      <button type="button" onClick={() => setItems([...items, { label: "", amount: 0 }])} className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1" data-testid={`${prefix}-add-row`}><Plus size={12} />Add row</button>
    </div>
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="flex gap-2">
          <Input value={it.label} placeholder="Label" onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} data-testid={`${prefix}-label-${i}`} />
          <Input type="number" className="w-32" value={it.amount} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} data-testid={`${prefix}-amount-${i}`} />
          <button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} className="text-slate-400 hover:text-rose-600 px-1" aria-label="Remove"><X size={16} /></button>
        </div>
      ))}
    </div>
  </div>
);

const sum = (a) => a.reduce((s, x) => s + (Number(x.amount) || 0), 0);

export function GeneratePayslipDialog({ open, onOpenChange, employees, onSaved }) {
  const [userId, setUserId] = useState("");
  const [month, setMonth] = useState(prevMonth());
  const [days, setDays] = useState({ working_days: 30, paid_days: 30 });
  const [earn, setEarn] = useState([]);
  const [ded, setDed] = useState(DEFAULT_DED);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setUserId(""); setEarn([]); setDed(DEFAULT_DED); setMonth(prevMonth()); } }, [open]);

  const pick = (id) => {
    setUserId(id);
    const e = employees.find((x) => x.id === id);
    if (e) setEarn([{ label: "Basic Salary", amount: e.basic || 0 }, { label: "HRA", amount: e.hra || 0 }, { label: "Other Allowances", amount: e.allowances || 0 }]);
  };

  const submit = async (ev) => {
    ev.preventDefault();
    setBusy(true);
    const num = (a) => a.map((x) => ({ label: x.label, amount: Number(x.amount) || 0 }));
    try {
      await api.post("/admin/payslips/generate", { user_id: userId, month, working_days: Number(days.working_days) || 0, paid_days: Number(days.paid_days) || 0, earnings: num(earn), deductions: num(ded) });
      toast.success("Payslip generated & published");
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="generate-payslip-dialog">
        <DialogHeader><DialogTitle className="font-display text-xl">Generate Payslip</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Employee"><EmployeePicker employees={employees} value={userId} onChange={pick} testId="gen-employee-select" /></Field>
            <Field label="Month"><Input type="month" required value={month} onChange={(e) => setMonth(e.target.value)} data-testid="gen-month-input" /></Field>
            <Field label="Working days"><Input type="number" value={days.working_days} onChange={(e) => setDays({ ...days, working_days: e.target.value })} data-testid="gen-working-days" /></Field>
            <Field label="Paid days"><Input type="number" value={days.paid_days} onChange={(e) => setDays({ ...days, paid_days: e.target.value })} data-testid="gen-paid-days" /></Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Lines title="Earnings" items={earn} setItems={setEarn} prefix="earn" />
            <Lines title="Deductions" items={ded} setItems={setDed} prefix="ded" />
          </div>
          <div className="rounded-xl bg-slate-900 text-white p-4 grid grid-cols-3 gap-2 text-sm">
            <div><div className="opacity-60 text-xs">Gross</div><div className="font-mono font-semibold">{fmtINR(sum(earn))}</div></div>
            <div><div className="opacity-60 text-xs">Deductions</div><div className="font-mono font-semibold">{fmtINR(sum(ded))}</div></div>
            <div><div className="opacity-60 text-xs">Net Pay</div><div className="font-mono font-bold text-emerald-400" data-testid="gen-net-pay">{fmtINR(sum(earn) - sum(ded))}</div></div>
          </div>
          <Button type="submit" disabled={busy || !userId} className="w-full h-11" data-testid="gen-submit-btn">{busy ? "Generating…" : "Generate & Publish"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function UploadPayslipDialog({ open, onOpenChange, employees, onSaved }) {
  const [userId, setUserId] = useState("");
  const [month, setMonth] = useState(prevMonth());
  const [net, setNet] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setUserId(""); setFile(null); setNet(""); setMonth(prevMonth()); } }, [open]);

  const submit = async (ev) => {
    ev.preventDefault();
    setBusy(true);
    const fd = new FormData();
    fd.append("user_id", userId);
    fd.append("month", month);
    fd.append("net", Number(net) || 0);
    fd.append("file", file);
    try {
      await api.post("/admin/payslips/upload", fd);
      toast.success("Payslip uploaded & published");
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="upload-payslip-dialog">
        <DialogHeader><DialogTitle className="font-display text-xl">Upload Payslip PDF</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Employee"><EmployeePicker employees={employees} value={userId} onChange={setUserId} testId="upload-employee-select" /></Field>
          <Field label="Month"><Input type="month" required value={month} onChange={(e) => setMonth(e.target.value)} data-testid="upload-month-input" /></Field>
          <Field label="Net pay (₹, optional)"><Input type="number" value={net} onChange={(e) => setNet(e.target.value)} data-testid="upload-net-input" /></Field>
          <Field label="PDF file (max 4 MB)"><Input type="file" accept="application/pdf" required onChange={(e) => setFile(e.target.files?.[0] || null)} data-testid="upload-file-input" /></Field>
          <Button type="submit" disabled={busy || !userId || !file} className="w-full h-11" data-testid="upload-submit-btn">{busy ? "Uploading…" : "Upload & Publish"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
