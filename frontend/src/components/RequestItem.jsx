import { Plane, Banknote, FileText, MessageSquare } from "lucide-react";
import { StatusBadge } from "@/components/common";
import { fmtDate, fmtINR, monthLabel } from "@/lib/api";

const ICONS = { leave: Plane, advance: Banknote, payslip: FileText, other: MessageSquare };

const summary = (r) => {
  if (r.type === "leave") return [`${r.leave_type}`, `${fmtDate(r.start_date)} → ${fmtDate(r.end_date)} · ${r.days} day${r.days > 1 ? "s" : ""}`];
  if (r.type === "advance") return ["Salary Advance", `${fmtINR(r.amount)}${r.repayment ? ` · ${r.repayment}` : ""}`];
  if (r.type === "payslip") return ["Payslip Request", monthLabel(r.month)];
  return [r.subject, "Other request"];
};

export default function RequestItem({ r, children, showEmployee }) {
  const Icon = ICONS[r.type];
  const [title, sub] = summary(r);
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm hover:shadow-md transition-shadow rise" data-testid={`request-item-${r.id}`}>
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 rounded-lg bg-blue-50 text-primary grid place-items-center shrink-0"><Icon size={18} /></div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{title}</span>
            <StatusBadge status={r.status} data-testid={`request-status-${r.id}`} />
          </div>
          <div className="text-sm text-muted-foreground mt-0.5">{sub}</div>
          {showEmployee && <div className="text-sm mt-2"><span className="font-semibold">{r.employee?.name}</span> <span className="text-muted-foreground">· {r.employee?.employee_id}{r.employee?.department ? ` · ${r.employee.department}` : ""}</span></div>}
          {r.reason && <p className="text-sm mt-2 text-slate-700">{r.reason}</p>}
          {r.admin_comment && <p className="text-sm mt-2 rounded-md bg-slate-50 px-3 py-2"><span className="font-semibold">HR: </span>{r.admin_comment}</p>}
          <div className="text-xs text-muted-foreground mt-2">Submitted {fmtDate(r.created_at)}</div>
        </div>
      </div>
      {children && <div className="flex flex-wrap gap-2 mt-4 sm:pl-14">{children}</div>}
    </div>
  );
}
