import { fmtINR } from "@/lib/api";

const Row = ({ label, value, strong, testId }) => (
  <div className={`flex items-center justify-between py-2.5 ${strong ? "font-semibold" : ""}`} data-testid={testId}>
    <span className={strong ? "" : "text-slate-600"}>{label}</span>
    <span className="font-mono">{fmtINR(value)}</span>
  </div>
);

export default function SalaryBreakup({ e, wide }) {
  const split = e.da != null || e.special != null || e.bonus != null;
  const items = split
    ? [["Basic Salary", e.basic], ["HRA", e.hra], ["Dearness Allowance (DA)", e.da], ["Special Allowance", e.special], ["Bonus", e.bonus]]
    : [["Basic Salary", e.basic], ["HRA", e.hra], ["Other Allowances", e.allowances]];
  const gross = items.reduce((s, [, v]) => s + (v || 0), 0);
  return (
    <div data-testid="salary-breakup" className={wide ? "grid md:grid-cols-[1fr_300px] gap-6 items-start" : ""}>
      <div>
      <div className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground mb-1">Monthly earnings</div>
      <div className="divide-y text-sm">
        {items.map(([l, v]) => <Row key={l} label={l} value={v} />)}
      </div>
      </div>
      <div>
      <div className={`${wide ? "" : "mt-3"} rounded-lg bg-slate-900 text-white px-4 py-3 text-sm`}>
        <div className="flex justify-between font-semibold"><span>Gross / month</span><span className="font-mono text-emerald-400" data-testid="salary-gross-month">{fmtINR(gross)}</span></div>
        <div className="flex justify-between text-slate-300 mt-1"><span>Gross / year</span><span className="font-mono">{fmtINR(gross * 12)}</span></div>
        {e.ctc_annual > 0 && <div className="flex justify-between text-slate-300 mt-1"><span>CTC (annual, as per record)</span><span className="font-mono">{fmtINR(e.ctc_annual)}</span></div>}
      </div>
      <p className="text-xs text-muted-foreground mt-3">Deductions (PF, ESIC, Prof. Tax, TDS) are applied at payslip generation.</p>
      </div>
    </div>
  );
}
