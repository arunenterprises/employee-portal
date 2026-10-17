import { useCallback, useEffect, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Empty } from "@/components/common";
import { api, errMsg, fmtTime, localDate } from "@/lib/api";

const CODES = {
  P: ["Present", "bg-emerald-100 text-emerald-800"], A: ["Absent", "bg-rose-100 text-rose-700"], L: ["Leave", "bg-amber-100 text-amber-800"],
  H: ["Half day", "bg-orange-100 text-orange-800"], W: ["Week off", "bg-slate-200 text-slate-700"], HL: ["Holiday", "bg-violet-100 text-violet-800"],
};
const TOTAL_KEYS = ["P", "A", "L", "H"];

const tip = (c) => [CODES[c.code]?.[0] || c.code, c.in && `In ${fmtTime(c.in)}`, c.out && `Out ${fmtTime(c.out)}`, c.late && `Late ${c.late}m`, c.manual && "Missed punch (HR)", c.note, c.source === "hr" ? "From HR Management" : c.source === "portal" ? "Portal punch" : "", "Click to edit"].filter(Boolean).join(" · ");

const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

const exportCsv = (data, month, days) => {
  const head = ["Employee Code", "Name", ...days.map((d) => `${month}-${d}`), ...TOTAL_KEYS, "HL", "W", "Late Days", "Paid Days (P+L+HL+W+H/2)"];
  const lines = data.rows.map((r) => {
    const t = r.totals;
    const cnt = (k) => Object.values(r.cells).filter((c) => c?.code === k).length;
    const hl = cnt("HL"), w = cnt("W");
    const paid = (t.P || 0) + (t.L || 0) + hl + w + (t.H || 0) / 2;
    return [r.employee_id, r.name, ...days.map((d) => { const c = r.cells[d]; return c ? `${c.code}${c.late > 0 ? " (Late)" : ""}` : ""; }), ...TOTAL_KEYS.map((k) => t[k] || 0), hl, w, t.late || 0, paid];
  });
  const csv = "\ufeff" + [head, ...lines].map((row) => row.map(esc).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `attendance-sheet-${month}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
};

const EDIT_CODES = ["P", "A", "L", "H", "W", "HL"];

const CellEditor = ({ row, day, month, c, onSaved }) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState("");
  const save = async (code) => {
    setSaving(code);
    try {
      const { data } = await api.put("/admin/attendance-sheet/cell", { user_id: row.user_id, date: `${month}-${day}`, code, reason });
      if (data.hr_updated) toast.success(`${row.name} · ${Number(day)} → ${code} (updated in HR Management too)`);
      else toast.warning(`Saved here. ${data.hr_message}`);
      setOpen(false); setReason(""); onSaved();
    } catch (e) { toast.error(errMsg(e)); } finally { setSaving(""); }
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="block w-full" data-testid={`sheet-cell-${row.employee_id}-${day}`}><CellBox c={c} /></button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" data-testid="sheet-cell-editor">
        <div className="text-sm font-semibold">{row.name}</div>
        <div className="text-xs text-muted-foreground mb-2">{new Date(`${month}-${day}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", weekday: "short" })} · now {c?.code || "blank"}</div>
        <div className="grid grid-cols-3 gap-1.5 mb-2">
          {EDIT_CODES.map((k) => (
            <button key={k} type="button" disabled={!!saving} onClick={() => save(k)} data-testid={`sheet-code-${k}`}
              className={`rounded py-1.5 text-xs font-bold transition-transform hover:scale-105 disabled:opacity-50 ${CODES[k][1]} ${c?.code === k ? "ring-2 ring-slate-900" : ""}`}>
              {saving === k ? "…" : k}<div className="text-[9px] font-normal">{CODES[k][0]}</div>
            </button>
          ))}
        </div>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" className="h-8 text-xs" data-testid="sheet-cell-reason" />
        <p className="text-[10px] text-muted-foreground mt-2">Change is saved here and sent to HR Management.</p>
      </PopoverContent>
    </Popover>
  );
};

const CellBox = ({ c }) => (
  <div className={`relative h-8 rounded grid place-items-center text-[11px] font-bold hover:ring-2 hover:ring-slate-400 ${c ? CODES[c.code]?.[1] || "bg-slate-100" : ""}`}>
    {c?.code}
    {c?.late > 0 && <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-orange-500" />}
    {c?.source === "portal" && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-0.5 w-3 rounded bg-current opacity-50" />}
    {c?.source === "admin" && <span className="absolute top-0.5 left-0.5 h-1.5 w-1.5 rounded-full bg-sky-600" />}
  </div>
);

const Cell = (p) => (
  <td className="border p-0.5 min-w-[34px]" title={p.c ? tip(p.c) : "Click to set"}><CellEditor {...p} /></td>
);

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
        <Button variant="outline" onClick={() => exportCsv(data, month, days)} disabled={!data?.rows?.length} data-testid="sheet-export-btn"><Download size={15} className="mr-2" />Export Excel (CSV)</Button>
        <span className="text-xs text-muted-foreground sm:ml-auto" data-testid="sheet-last-sync">{data?.last_sync ? `Last sync ${new Date(data.last_sync).toLocaleString("en-IN")}` : "Not synced yet"} · auto every hour · portal punches update both instantly</span>
      </div>
      <div className="flex flex-wrap gap-2 mb-4 text-xs" data-testid="sheet-legend">
        {Object.entries(CODES).map(([k, [l, cls]]) => <span key={k} className={`rounded px-2 py-0.5 font-semibold ${cls}`}>{k} · {l}</span>)}
        <span className="rounded px-2 py-0.5 bg-white border inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-orange-500" />Late</span>
        <span className="rounded px-2 py-0.5 bg-white border">underline = portal punch</span>
        <span className="rounded px-2 py-0.5 bg-white border inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-sky-600" />Edited by admin · click any day to edit</span>
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
                  {days.map((d) => <Cell key={d} c={r.cells[d]} row={r} day={d} month={month} onSaved={load} />)}
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
