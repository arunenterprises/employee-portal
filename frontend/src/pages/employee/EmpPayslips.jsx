import { useEffect, useState } from "react";
import { Download, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, Empty, Badge2 } from "@/components/common";
import { api, downloadPayslip, errMsg, fmtINR, monthLabel } from "@/lib/api";

export default function EmpPayslips() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get("/payslips").then((r) => setRows(r.data)); }, []);

  const dl = async (p) => {
    try { await downloadPayslip(p.id, p.month); } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div>
      <PageHeader eyebrow="Payslips" title="My payslips" desc="Download your monthly salary slips as PDF." />
      {rows.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((p, i) => (
            <Panel key={p.id} className="rise hover:shadow-md transition-shadow" style={{ animationDelay: `${i * 50}ms` }} data-testid={`payslip-card-${p.id}`}>
              <div className="flex items-center justify-between">
                <div className="font-display text-lg font-bold">{monthLabel(p.month)}</div>
                <Badge2 tone={p.kind === "generated" ? "blue" : "neutral"}>{p.kind}</Badge2>
              </div>
              <div className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mt-5">Net pay</div>
              <div className="font-mono text-2xl font-semibold text-emerald-600">{p.net ? fmtINR(p.net) : "—"}</div>
              {p.kind === "generated" && <div className="text-xs text-muted-foreground mt-1">Gross {fmtINR(p.gross)} · Deductions {fmtINR(p.total_deductions)}</div>}
              <Button onClick={() => dl(p)} variant="outline" className="w-full mt-5" data-testid={`download-payslip-btn-${p.id}`}><Download size={16} className="mr-2" />Download PDF</Button>
            </Panel>
          ))}
        </div>
      ) : <Panel><Empty icon={Wallet} text="No payslips published yet. You can request one from Requests." testId="payslips-empty" /></Panel>}
    </div>
  );
}
