import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { PageHeader, Panel } from "@/components/common";
import AttendanceTable from "@/components/AttendanceTable";
import { api, fmtHours, localDate } from "@/lib/api";

export default function EmpAttendance() {
  const [month, setMonth] = useState(localDate().slice(0, 7));
  const [rows, setRows] = useState([]);

  useEffect(() => { api.get("/attendance", { params: { month } }).then((r) => setRows(r.data)); }, [month]);

  const total = rows.reduce((s, r) => s + (r.work_minutes || 0), 0);

  return (
    <div>
      <PageHeader eyebrow="Attendance" title="My attendance" desc="Daily punch history with selfie and location."
        action={<Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44 bg-white" data-testid="attendance-month-filter" />} />
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Panel><div className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">Days present</div><div className="font-display text-3xl font-bold mt-1" data-testid="att-days">{rows.length}</div></Panel>
        <Panel><div className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">Total hours</div><div className="font-display text-3xl font-bold mt-1">{fmtHours(total)}</div></Panel>
      </div>
      <Panel><AttendanceTable rows={rows} /></Panel>
    </div>
  );
}
