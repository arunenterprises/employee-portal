import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, Panel, Info, Field } from "@/components/common";
import ServiceTimeline from "@/components/ServiceTimeline";
import { useAuth } from "@/context/AuthContext";
import { api, errMsg, fmtDate, fmtINR } from "@/lib/api";

const ChangePassword = () => {
  const [f, setF] = useState({ current_password: "", new_password: "" });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/auth/change-password", f);
      toast.success("Password changed");
      setF({ current_password: "", new_password: "" });
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Current password"><Input type="password" required value={f.current_password} onChange={(e) => setF({ ...f, current_password: e.target.value })} data-testid="cp-current" /></Field>
      <Field label="New password (min 6)"><Input type="password" required minLength={6} value={f.new_password} onChange={(e) => setF({ ...f, new_password: e.target.value })} data-testid="cp-new" /></Field>
      <Button type="submit" disabled={busy} data-testid="cp-submit">Update password</Button>
    </form>
  );
};

export default function EmpProfile() {
  const { user: u } = useAuth();
  const [records, setRecords] = useState([]);

  useEffect(() => { api.get("/service-records").then((r) => setRecords(r.data)); }, []);

  const groups = [
    ["Job details", [["Employee ID", u.employee_id], ["Department", u.department], ["Designation", u.designation], ["Joining date", fmtDate(u.joining_date)]]],
    ["Personal", [["Email", u.email], ["Phone", u.phone], ["Date of birth", fmtDate(u.dob)], ["Gender", u.gender], ["Address", u.address]]],
    ["Bank & statutory", [["Bank", u.bank_name], ["Account no.", u.bank_account], ["IFSC", u.ifsc], ["PAN", u.pan], ["UAN", u.uan]]],
    ["Salary (monthly)", [["Basic", fmtINR(u.basic)], ["HRA", fmtINR(u.hra)], ["Allowances", fmtINR(u.allowances)], ["Gross", fmtINR((u.basic || 0) + (u.hra || 0) + (u.allowances || 0))]]],
  ];

  return (
    <div>
      <PageHeader eyebrow="My Profile" title={u.name} desc="Your details and service record. Contact HR to update any information." />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {groups.map(([title, items]) => (
            <Panel key={title} className="rise" data-testid={`profile-${title.split(" ")[0].toLowerCase()}`}>
              <h3 className="font-display text-lg font-semibold mb-5">{title}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">{items.map(([l, v]) => <Info key={l} label={l} value={v} />)}</div>
            </Panel>
          ))}
        </div>
        <div className="space-y-6">
          <Panel className="rise"><h3 className="font-display text-lg font-semibold mb-5">Service record</h3><ServiceTimeline records={records} /></Panel>
          <Panel className="rise"><h3 className="font-display text-lg font-semibold mb-4">Change password</h3><ChangePassword /></Panel>
        </div>
      </div>
    </div>
  );
}
