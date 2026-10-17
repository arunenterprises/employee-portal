import { useCallback, useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, NativeSelect, Empty, Info } from "@/components/common";
import ServiceTimeline from "@/components/ServiceTimeline";
import { LeaveBalanceAdmin } from "@/components/LeaveBalance";
import { AppraisalForm, AppraisalList } from "@/components/Appraisals";
import { AddRecord } from "@/pages/admin/AdminEmployeeDetail";
import { api, fmtDate } from "@/lib/api";

const Section = ({ title, action, children, testId }) => (
  <Panel data-testid={testId}>
    <div className="flex items-center justify-between mb-5"><h3 className="font-display text-lg font-semibold">{title}</h3>{action}</div>
    {children}
  </Panel>
);

const BookBody = ({ emp }) => {
  const [records, setRecords] = useState([]);
  const [apps, setApps] = useState([]);
  const [addRec, setAddRec] = useState(false);
  const [addAp, setAddAp] = useState(false);
  const loadRec = useCallback(() => { api.get("/admin/service-records", { params: { user_id: emp.id } }).then((r) => setRecords(r.data)); }, [emp.id]);
  const loadAp = useCallback(() => { api.get("/admin/appraisals", { params: { user_id: emp.id } }).then((r) => setApps(r.data)); }, [emp.id]);
  useEffect(() => { loadRec(); loadAp(); setAddRec(false); setAddAp(false); }, [loadRec, loadAp]);

  return (
    <div className="space-y-6">
      <Panel className="grid grid-cols-2 md:grid-cols-5 gap-5" data-testid="service-book-header">
        <Info label="Employee" value={emp.name} />
        <Info label="Employee Code" value={emp.employee_id} />
        <Info label="Designation" value={emp.designation} />
        <Info label="Department" value={emp.department} />
        <Info label="Joining date" value={fmtDate(emp.joining_date)} />
      </Panel>
      <Section title="Service book entries" testId="sb-service-section"
        action={!addRec && <Button size="sm" variant="outline" onClick={() => setAddRec(true)} data-testid="sb-add-record-btn">+ Add entry</Button>}>
        {addRec && <AddRecord userId={emp.id} onAdded={() => { loadRec(); setAddRec(false); }} onCancel={() => setAddRec(false)} />}
        <ServiceTimeline records={records} onDelete={async (id) => { await api.delete(`/admin/service-records/${id}`); loadRec(); }} />
      </Section>
      <Section title="Performance appraisals" testId="sb-appraisal-section"
        action={!addAp && <Button size="sm" variant="outline" onClick={() => setAddAp(true)} data-testid="sb-add-appraisal-btn">+ New appraisal</Button>}>
        {addAp && <AppraisalForm userId={emp.id} onSaved={() => { loadAp(); setAddAp(false); }} onCancel={() => setAddAp(false)} />}
        <AppraisalList items={apps} onDelete={async (id) => { await api.delete(`/admin/appraisals/${id}`); loadAp(); }} />
      </Section>
      <Section title="Leave balance" testId="sb-leave-section"><LeaveBalanceAdmin userId={emp.id} /></Section>
    </div>
  );
};

export default function AdminServiceBook() {
  const [params, setParams] = useSearchParams();
  const [employees, setEmployees] = useState([]);
  const id = params.get("id") || "";
  useEffect(() => { api.get("/admin/employees").then((r) => setEmployees(r.data)); }, []);
  const emp = employees.find((e) => e.id === id);

  return (
    <div>
      <PageHeader eyebrow="HR Records" title="Service Book" desc="Service history, performance appraisals and leave balance of each employee."
        action={<NativeSelect value={id} onChange={(e) => setParams(e.target.value ? { id: e.target.value } : {})} className="sm:w-80 bg-white" data-testid="sb-employee-select">
          <option value="">Select employee</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.employee_id} · {e.name}</option>)}
        </NativeSelect>} />
      {emp ? <BookBody emp={emp} /> : <Panel><Empty icon={BookOpen} text="Select an employee to open their service book." testId="sb-empty" /></Panel>}
      {emp && <Link to={`/admin/employees/${emp.id}`} className="inline-block mt-6 text-sm font-semibold text-primary hover:underline">Open full employee profile →</Link>}
    </div>
  );
}
