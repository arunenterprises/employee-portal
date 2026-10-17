import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { PageHeader, Panel, NativeSelect, Empty } from "@/components/common";
import { EmployeeRecord } from "@/pages/admin/AdminEmployeeDetail";
import { api } from "@/lib/api";

export default function AdminServiceBook() {
  const [params, setParams] = useSearchParams();
  const [employees, setEmployees] = useState([]);
  const id = params.get("id") || "";
  useEffect(() => { api.get("/admin/employees").then((r) => setEmployees(r.data)); }, []);

  return (
    <div>
      <PageHeader eyebrow="HR Records · Admin only" title="Service Book" desc="Complete employee record: profile, salary, leave, service history, appraisals, attendance, requests and payslips."
        action={<NativeSelect value={id} onChange={(e) => setParams(e.target.value ? { id: e.target.value } : {})} className="sm:w-80 bg-white" data-testid="sb-employee-select">
          <option value="">Select employee</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.employee_id} · {e.name}</option>)}
        </NativeSelect>} />
      {id ? <EmployeeRecord key={id} id={id} embedded /> : <Panel><Empty icon={BookOpen} text="Select an employee to open their service book." testId="sb-empty" /></Panel>}
    </div>
  );
}
