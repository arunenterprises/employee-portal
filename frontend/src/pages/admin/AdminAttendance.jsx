import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { PageHeader, Panel, NativeSelect } from "@/components/common";
import AttendanceTable from "@/components/AttendanceTable";
import AttendanceSheet from "@/components/AttendanceSheet";
import { SheetVisibilityToggle } from "@/components/SheetVisibilityToggle";
import { api, localDate } from "@/lib/api";

export default function AdminAttendance() {
  const [date, setDate] = useState(localDate());
  const [userId, setUserId] = useState("");
  const [employees, setEmployees] = useState([]);
  const [rows, setRows] = useState([]);
  const [view, setView] = useState("sheet");

  useEffect(() => { api.get("/admin/employees").then((r) => setEmployees(r.data)); }, []);
  useEffect(() => {
    const params = { user_id: userId || undefined };
    if (date) params.date = date;
    api.get("/admin/attendance", { params }).then((r) => setRows(r.data));
  }, [date, userId]);

  return (
    <div>
      <PageHeader eyebrow="Monitoring" title="Attendance" desc="Monthly sheet linked with HR Management, plus daily punches with selfie and GPS." action={<SheetVisibilityToggle />} />
      <div className="flex gap-1 rounded-xl border bg-white p-1 mb-5 w-fit" data-testid="attendance-view-tabs">
        {[["sheet", "Monthly sheet"], ["daily", "Daily punches"]].map(([k, l]) => (
          <button key={k} onClick={() => setView(k)} data-testid={`att-view-${k}`} className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${view === k ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{l}</button>
        ))}
      </div>
      {view === "sheet" && <Panel><AttendanceSheet /></Panel>}
      {view === "daily" && <Panel>
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="sm:w-48" data-testid="admin-att-date" />
          <NativeSelect value={userId} onChange={(e) => setUserId(e.target.value)} className="sm:w-64" data-testid="admin-att-employee">
            <option value="">All employees</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.employee_id} · {e.name}</option>)}
          </NativeSelect>
          {date && <button onClick={() => setDate("")} className="text-sm font-semibold text-primary hover:underline" data-testid="admin-att-all-dates">Show all dates</button>}
        </div>
        <div className="text-xs text-muted-foreground mb-3" data-testid="admin-att-count">{rows.length} record(s)</div>
        <AttendanceTable rows={rows} showEmployee />
      </Panel>}
    </div>
  );
}
