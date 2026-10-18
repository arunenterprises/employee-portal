import { useEffect, useState } from "react";
import { Printer, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { api, errMsg, fmtDate } from "@/lib/api";

const ADDRESS = "209H/1F/1, Ops Nagar, Kalindipuram, Prayagraj, UP 211011 · Toll Free: 9429694552";

const Slip = ({ s, issued }) => (
  <div className="slip border-2 border-dashed border-slate-300 rounded-xl p-5 bg-white text-slate-900 break-inside-avoid" data-testid={`slip-${s.employee_id}`}>
    <div className="flex items-center gap-3 border-b pb-3">
      <img src="/arun-logo.jpg" alt="logo" className="h-10 w-10 object-contain" />
      <div className="leading-tight">
        <div className="font-display font-bold">ARUN ENTERPRISES</div>
        <div className="text-[10px] uppercase tracking-widest text-slate-500">Employee Portal · Login Credentials</div>
      </div>
    </div>
    <div className="mt-3 text-sm"><span className="font-semibold">{s.name}</span>{(s.designation || s.department) && <span className="text-slate-500"> · {[s.designation, s.department].filter(Boolean).join(", ")}</span>}</div>
    <div className="mt-3 grid grid-cols-[110px_1fr] gap-y-1.5 text-sm">
      <span className="text-slate-500">Portal</span><span className="font-mono text-xs break-all">{window.location.origin}/login</span>
      <span className="text-slate-500">Employee Code</span><span className="font-mono font-semibold">{s.employee_id}</span>
      {s.short_code && <><span className="text-slate-500">Short Code</span><span className="font-mono font-bold text-lg tracking-wider" data-testid={`slip-short-${s.employee_id}`}>{s.short_code}</span></>}
      <span className="text-slate-500">Password</span><span className="font-mono font-bold text-lg tracking-wider" data-testid={`slip-password-${s.employee_id}`}>{s.password}</span>
    </div>
    <p className="mt-3 text-[11px] text-slate-500 leading-snug">Change this password after first login (Profile → Change password). Do not share it with anyone. Issued {fmtDate(issued)}.</p>
    <p className="mt-1 text-[10px] text-slate-400">{ADDRESS}</p>
  </div>
);

export function SlipsPreview({ data, onClose }) {
  return (
    <Dialog open={!!data} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="slips-preview-dialog">
        <DialogHeader className="no-print">
          <DialogTitle className="font-display">Credential slips ({data?.slips.length})</DialogTitle>
          <DialogDescription>New passwords are shown only now. Print and hand over, then close.</DialogDescription>
        </DialogHeader>
        <Button onClick={() => window.print()} className="no-print w-fit" data-testid="print-slips-btn"><Printer size={16} className="mr-2" />Print slips</Button>
        <div className="print-slips grid grid-cols-1 md:grid-cols-2 gap-4">
          {data?.slips.map((s) => <Slip key={s.id} s={s} issued={data.issued_at} />)}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export async function issueSlips(ids) {
  const { data } = await api.post("/admin/credential-slips", { user_ids: ids });
  return data;
}

export default function CredentialSlipsDialog({ open, onOpenChange, employees, onIssued }) {
  const [sel, setSel] = useState(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setSel(new Set(employees.filter((e) => e.must_change_password && e.portal_enabled !== false && e.active !== false).map((e) => e.id)));
  }, [open, employees]);

  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const all = sel.size === employees.length;

  const generate = async () => {
    setBusy(true);
    try { onIssued(await issueSlips([...sel])); onOpenChange(false); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="slips-select-dialog">
        <DialogHeader>
          <DialogTitle className="font-display">Print credential slips</DialogTitle>
          <DialogDescription>Select employees. Pre-selected: employees who have not changed their first password yet.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 rounded-lg bg-amber-50 text-amber-800 p-3 text-sm"><AlertTriangle size={16} className="mt-0.5 shrink-0" />Generating a slip sets a NEW password for each selected employee. Their old password stops working.</div>
        <label className="flex items-center gap-2 text-sm font-semibold border-b pb-2">
          <Checkbox checked={all} onCheckedChange={(v) => setSel(new Set(v ? employees.map((e) => e.id) : []))} data-testid="slips-select-all" />Select all ({employees.length})
        </label>
        <div className="space-y-1 max-h-72 overflow-y-auto">
          {employees.map((e) => (
            <label key={e.id} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-slate-50 text-sm cursor-pointer">
              <Checkbox checked={sel.has(e.id)} onCheckedChange={() => toggle(e.id)} data-testid={`slips-check-${e.employee_id}`} />
              <span className="flex-1 min-w-0"><span className="font-medium">{e.name}</span> <span className="text-xs text-muted-foreground font-mono">{e.employee_id}</span> {e.short_code && <span className="text-[10px] font-mono font-bold text-blue-700">{e.short_code}</span>}</span>
              {!e.must_change_password && <span className="text-[10px] text-slate-500">changed pwd</span>}
            </label>
          ))}
        </div>
        <Button onClick={generate} disabled={!sel.size || busy} data-testid="slips-generate-btn">
          {busy && <Loader2 size={16} className="mr-2 animate-spin" />}Generate {sel.size} slip(s)
        </Button>
      </DialogContent>
    </Dialog>
  );
}
