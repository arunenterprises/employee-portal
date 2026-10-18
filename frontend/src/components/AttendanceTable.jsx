import { useState } from "react";
import { MapPin, CalendarX2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmpCode } from "@/components/common";
import { fmtDate, fmtTime, fmtHours, fmtLate, mapLink } from "@/lib/api";

const PunchCell = ({ p, onView, late }) => {
  if (!p) return <span className="text-muted-foreground">—</span>;
  const link = mapLink(p);
  return (
    <div className="flex items-center gap-3">
      {p.selfie && <button onClick={() => onView(p.selfie)} className="shrink-0"><img src={p.selfie} alt="selfie" className="h-10 w-10 rounded-md object-cover ring-1 ring-slate-200 hover:ring-primary transition" /></button>}
      <div>
        <div className="font-mono text-sm font-semibold">{fmtTime(p.time)}{late && <span className="ml-1.5 rounded bg-amber-100 text-amber-800 text-[10px] font-sans font-semibold px-1.5 py-0.5" data-testid="late-badge">Late {fmtLate(late)}</span>}</div>
        {p.manual ? <span className="text-xs text-blue-700" data-testid="manual-punch-tag">Missed punch · HR approved</span>
          : link ? <a href={link} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1"><MapPin size={11} />Map</a>
          : <span className="text-xs text-amber-600">No GPS</span>}
      </div>
    </div>
  );
};

export default function AttendanceTable({ rows, showEmployee }) {
  const [view, setView] = useState(null);
  if (!rows.length) return <Empty icon={CalendarX2} text="No attendance records found." testId="attendance-empty" />;
  return (
    <>
      <div className="overflow-x-auto -mx-5 sm:-mx-6">
        <table className="rtable w-full text-sm min-w-[620px]" data-testid="attendance-table">
          <thead>
            <tr className="text-left text-xs uppercase tracking-widest text-muted-foreground border-b">
              {showEmployee && <th className="px-5 sm:px-6 py-3 font-semibold">Employee</th>}
              <th className="px-5 sm:px-6 py-3 font-semibold">Date</th>
              <th className="px-3 py-3 font-semibold">Punch in</th>
              <th className="px-3 py-3 font-semibold">Punch out</th>
              <th className="px-5 sm:px-6 py-3 font-semibold text-right">Hours</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50 transition-colors" data-testid={`attendance-row-${r.id}`}>
                {showEmployee && <td className="px-5 sm:px-6 py-3"><div className="font-semibold">{r.employee?.name || "—"}</div><div className="text-xs text-muted-foreground"><EmpCode e={r.employee} /></div></td>}
                <td className="px-5 sm:px-6 py-3 font-medium whitespace-nowrap" data-label="Date">{fmtDate(r.date)}</td>
                <td className="px-3 py-3" data-label="Punch in"><PunchCell p={r.punch_in} onView={setView} late={r.late ? r.late_minutes : 0} /></td>
                <td className="px-3 py-3" data-label="Punch out"><PunchCell p={r.punch_out} onView={setView} /></td>
                <td className="px-5 sm:px-6 py-3 text-right font-mono" data-label="Hours">{fmtHours(r.work_minutes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-w-sm" data-testid="selfie-view-dialog">
          <DialogHeader><DialogTitle>Selfie</DialogTitle></DialogHeader>
          {view && <img src={view} alt="selfie" className="w-full rounded-lg" />}
        </DialogContent>
      </Dialog>
    </>
  );
}
