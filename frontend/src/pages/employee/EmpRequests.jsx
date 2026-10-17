import { useCallback, useEffect, useState } from "react";
import { Plane, Banknote, FileText, MessageSquare, Inbox } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader, Empty } from "@/components/common";
import RequestFormDialog from "@/components/RequestFormDialog";
import RequestItem from "@/components/RequestItem";
import { api, errMsg } from "@/lib/api";

const QUICK = [["leave", "Leave", Plane], ["advance", "Advance", Banknote], ["payslip", "Payslip", FileText], ["other", "Other", MessageSquare]];
const FILTERS = ["all", "pending", "approved", "rejected"];

export default function EmpRequests() {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("all");
  const [openType, setOpenType] = useState(null);

  const load = useCallback(() => { api.get("/requests").then((r) => setRows(r.data)); }, []);
  useEffect(() => { load(); }, [load]);

  const cancel = async (id) => {
    try { await api.delete(`/requests/${id}`); toast.success("Request cancelled"); load(); } catch (e) { toast.error(errMsg(e)); }
  };

  const shown = filter === "all" ? rows : rows.filter((r) => r.status === filter);

  return (
    <div>
      <PageHeader eyebrow="Requests" title="My requests" desc="Apply for leave, salary advance, payslip or anything else." />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {QUICK.map(([t, label, Icon], i) => (
          <button key={t} onClick={() => setOpenType(t)} data-testid={`request-${t}-btn`} style={{ animationDelay: `${i * 60}ms` }}
            className="rise rounded-xl border bg-card p-5 text-left shadow-sm hover:border-primary hover:shadow-md transition-[border-color,box-shadow] group">
            <Icon className="text-primary mb-3 group-hover:scale-110 transition-transform" size={22} />
            <div className="font-semibold">{label}</div>
            <div className="text-xs text-muted-foreground">New request</div>
          </button>
        ))}
      </div>
      <div className="flex gap-2 mb-5 overflow-x-auto">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} data-testid={`req-filter-${f}`}
            className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${filter === f ? "bg-slate-900 text-white" : "bg-white border text-slate-600 hover:text-slate-900"}`}>{f}</button>
        ))}
      </div>
      <div className="space-y-3">
        {shown.length ? shown.map((r) => (
          <RequestItem key={r.id} r={r}>
            {r.status === "pending" && <Button size="sm" variant="outline" onClick={() => cancel(r.id)} data-testid={`cancel-request-${r.id}`}>Cancel</Button>}
          </RequestItem>
        )) : <Empty icon={Inbox} text="No requests here." testId="requests-empty" />}
      </div>
      <RequestFormDialog open={!!openType} initialType={openType} onOpenChange={(o) => !o && setOpenType(null)} onSaved={load} />
    </div>
  );
}
