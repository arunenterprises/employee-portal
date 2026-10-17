import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Empty } from "@/components/common";
import { api, errMsg, fmtTime, localDate } from "@/lib/api";

const CODES = {
  P: ["Present", "bg-emerald-100 text-emerald-800"], A: ["Absent", "bg-rose-100 text-rose-700"], L: ["Leave", "bg-amber-100 text-amber-800"],
  H: ["Half day", "bg-orange-100 text-orange-800"], W: ["Week off", "bg-slate-200 text-slate-700"], HL: ["Holiday", "bg-violet-100 text-violet-800"],
};
const TOTAL_KEYS = ["P", "A", "L", "H"];

const tip = (c) => [CODES[c.code]?.[0] || c.code, c.in && `In ${fmtTime(c.in)}`, c.out && `Out ${fmtTime(c.out)}`, c.late && `Late ${c.late}m`, c.manual && "Missed punch (HR)", c.note, c.source === "hr" ? "From HR Management" : c.source === "portal" ? "Portal punch" : ""].filter(Boolean).join(" · ");

const Cell = ({ c }) => {
  if (!c) return <td className="border px-0 py-0 h-9 min-w-[34px]" />;
  return (
    <td className="border p-0.5 min-w-[34px]" title={tip(c)}>
      <div className={`relative h-8 rounded grid place-items-center text-[11px] font-bold ${CODES[c.code]?.[1] || "bg-slate-100"}`}>
        {c.code}
        {c.late > 0 && <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-orange-500" />}
        {c.source === "portal" && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-0.5 w-3 rounded bg-current opacity-50" />}
      </div>
    </td>
  );
};

export default function AttendanceSheet() {
  const [month, setMonth] = useState(localDate().slice(0, 7));
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { api.get("/admin/attendance-sheet", { params: { month } }).then((r) => setData(r.data)); }, [month]);
  useEffect(() => { load(); }, [load]);

  const pull = async () => {
    setBusy(true);
    try {
      const { data: d } = await api.post("/admin/vendor-sync");
      if (d.status === "success") toast.success(`Pulled ${d.result.attendance_months_pulled} attendance month(s) from HR Management`);
      else toast.error(d.error || d.detail || "Sync failed");
      load();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  const days = Array.from({ length: data?.days || 0 }, (_, i) => String(i + 1).padStart(2, "0"));
  const dow = (dd) => new Date(`${month}-${dd}T00:00:00`).toLocaleDateString("en-IN", { weekday: "narrow" });

  return (
    <div data-testid="attendance-sheet">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="sm:w-48" data-testid="sheet-month" />
        <Button variant="outline" onClick={pull} disabled={busy} data-testid="sheet-pull-btn"><RefreshCw size={15} className={`mr-2 ${busy ? "animate-spin" : ""}`} />{busy ? "Pulling…" : "Pull from HR Management"}</Button>
        <span className="text-xs text-muted-foreground sm:ml-auto" data-testid="sheet-last-sync">{data?.last_sync ? `Last sync ${new Date(data.last_sync).toLocaleString("en-IN")}` : "Not synced yet"} · auto every hour · portal punches update both instantly</span>
      </div>
      <div className="flex flex-wrap gap-2 mb-4 text-xs" data-testid="sheet-legend">
        {Object.entries(CODES).map(([k, [l, cls]]) => <span key={k} className={`rounded px-2 py-0.5 font-semibold ${cls}`}>{k} · {l}</span>)}
        <span className="rounded px-2 py-0.5 bg-white border inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-orange-500" />Late</span>
        <span className="rounded px-2 py-0.5 bg-white border">underline = portal punch</span>
      </div>
      {!data ? <div className="text-muted-foreground text-sm">Loading…</div> : !data.rows.length ? <Empty text="No employees." /> : (
        <div className="overflow-x-auto -mx-5 sm:-mx-6 px-5 sm:px-6">
          <table className="border-collapse text-sm" data-testid="sheet-table">
            <thead>
              <tr className="text-[11px] text-muted-foreground">
                <th className="sticky left-0 z-10 bg-white border px-3 py-2 text-left min-w-[190px]">Employee</th>
                {days.map((d) => <th key={d} className="border px-1 py-1 font-semibold"><div>{Number(d)}</div><div className="font-normal">{dow(d)}</div></th>)}
                {TOTAL_KEYS.map((k) => <th key={k} className="border px-2 py-1 bg-slate-50">{k}</th>)}
                <th className="border px-2 py-1 bg-slate-50">Late</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.user_id} data-testid={`sheet-row-${r.employee_id}`}>
                  <td className="sticky left-0 z-10 bg-white border px-3 py-1.5"><div className="font-semibold leading-tight">{r.name}</div><div className="text-[10px] font-mono text-muted-foreground">{r.employee_id}</div></td>
                  {days.map((d) => <Cell key={d} c={r.cells[d]} />)}
                  {TOTAL_KEYS.map((k) => <td key={k} className="border px-2 text-center font-mono font-semibold bg-slate-50">{r.totals[k] || 0}</td>)}
                  <td className="border px-2 text-center font-mono font-semibold bg-slate-50 text-orange-600">{r.totals.late || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
