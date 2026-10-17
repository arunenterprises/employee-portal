import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, UserCheck, Hourglass, Plane, ArrowRight, AlarmClock } from "lucide-react";
import { PageHeader, Panel, StatCard, Empty } from "@/components/common";
import RequestItem from "@/components/RequestItem";
import AttendanceTable from "@/components/AttendanceTable";
import { api, fmtDate } from "@/lib/api";

export default function AdminDashboard() {
  const [s, setS] = useState(null);
  const [reqs, setReqs] = useState([]);
  const [att, setAtt] = useState([]);

  useEffect(() => {
    api.get("/admin/stats").then((r) => {
      setS(r.data);
      api.get("/admin/attendance", { params: { date: r.data.today } }).then((a) => setAtt(a.data));
    });
    api.get("/admin/requests", { params: { status: "pending" } }).then((r) => setReqs(r.data.slice(0, 4)));
  }, []);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="HR Overview" title="Dashboard" desc={s ? `Today · ${fmtDate(s.today)}` : ""} />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={Users} label="Active employees" value={s?.employees ?? "–"} testId="stat-employees" />
        <StatCard icon={UserCheck} label="Present today" value={s?.present_today ?? "–"} testId="stat-present-today" tone="bg-emerald-50 text-emerald-600" delay={60} />
        <StatCard icon={AlarmClock} label="Late today" value={s?.late_today ?? "–"} testId="stat-late-today" tone="bg-orange-50 text-orange-600" delay={90} />
        <StatCard icon={Hourglass} label="Pending requests" value={s?.pending_requests ?? "–"} testId="stat-pending-requests" tone="bg-amber-50 text-amber-600" delay={120} />
        <StatCard icon={Plane} label="On leave today" value={s?.on_leave_today ?? "–"} testId="stat-on-leave" tone="bg-rose-50 text-rose-600" delay={180} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">Pending approvals</h3>
            <Link to="/admin/requests" className="text-sm font-semibold text-primary hover:underline inline-flex items-center gap-1" data-testid="goto-admin-requests">All <ArrowRight size={14} /></Link>
          </div>
          {reqs.length ? reqs.map((r) => <RequestItem key={r.id} r={r} showEmployee />) : <Panel><Empty text="All caught up." /></Panel>}
        </div>
        <Panel className="lg:col-span-3">
          <h3 className="font-display text-lg font-semibold mb-4">Today's attendance</h3>
          <AttendanceTable rows={att} showEmployee />
        </Panel>
      </div>
    </div>
  );
}
