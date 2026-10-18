import { useEffect, useState } from "react";
import { Panel } from "@/components/common";
import { api, fmtTime } from "@/lib/api";

const CODES = {
  P: ["Present", "bg-emerald-100 text-emerald-800"], A: ["Absent", "bg-rose-100 text-rose-700"], L: ["Leave", "bg-amber-100 text-amber-800"],
  H: ["Half day", "bg-orange-100 text-orange-800"], W: ["Week off", "bg-slate-200 text-slate-700"], HL: ["Holiday", "bg-violet-100 text-violet-800"],
};

const MonthCard = ({ m }) => {
  const start = new Date(`${m.month}-01T00:00:00`);
  const lead = (start.getDay() + 6) % 7;
  const days = Array.from({ length: m.days }, (_, i) => String(i + 1).padStart(2, "0"));
  return (
    <Panel data-testid={`my-sheet-${m.month}`}>
      <div className="flex items-baseline justify-between mb-3">
        <div className="font-display text-lg font-bold">{start.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</div>
        <div className="text-xs text-muted-foreground">Late: <span className="font-semibold text-orange-600">{m.totals.late || 0}</span></div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground mb-1">{["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <div key={i}>{d}</div>)}</div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: lead }).map((_, i) => <div key={`x${i}`} />)}
        {days.map((d) => {
          const c = m.cells[d];
          const tip = c ? [CODES[c.code]?.[0] || c.code, c.in && `In ${fmtTime(c.in)}`, c.out && `Out ${fmtTime(c.out)}`, c.late && `Late ${c.late}m`].filter(Boolean).join(" · ") : "";
          return (
            <div key={d} title={tip} className={`relative rounded-md h-11 flex flex-col items-center justify-center ${c ? CODES[c.code]?.[1] || "bg-slate-100" : "bg-slate-50 text-slate-400"}`}>
              <span className="text-[10px] opacity-70">{Number(d)}</span>
              <span className="text-xs font-bold leading-none">{c?.code || ""}</span>
              {c?.late > 0 && <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-orange-500" />}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2 mt-4">
        {Object.entries(CODES).map(([k, [l, cls]]) => (
          <span key={k} className={`rounded px-2 py-0.5 text-xs font-semibold ${cls}`} data-testid={`my-sheet-${m.month}-total-${k}`}>{l}: {m.totals[k] || 0}</span>
        ))}
      </div>
    </Panel>
  );
};

export const MyMonthSheet = () => {
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/attendance/my-sheet").then((r) => setData(r.data)); }, []);
  if (!data?.enabled) return null;
  return (
    <div className="mb-6" data-testid="my-month-sheet">
      <div className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-3">Attendance sheet · previous & current month</div>
      <div className="grid lg:grid-cols-2 gap-4">{data.months.map((m) => <MonthCard key={m.month} m={m} />)}</div>
    </div>
  );
};
