import { useEffect, useState } from "react";
import { PageHeader, Panel, Info } from "@/components/common";
import ServiceTimeline from "@/components/ServiceTimeline";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import MediaCard from "@/components/MediaCard";
import { AppraisalList } from "@/components/Appraisals";
import { useAuth } from "@/context/AuthContext";
import { api, fmtDate, fmtINR } from "@/lib/api";

export default function EmpProfile() {
  const { user: u } = useAuth();
  const [records, setRecords] = useState([]);
  const [media, setMedia] = useState(null);
  const [apps, setApps] = useState([]);

  useEffect(() => {
    api.get("/service-records").then((r) => setRecords(r.data));
    api.get("/me/media").then((r) => setMedia(r.data));
    api.get("/appraisals").then((r) => setApps(r.data));
  }, []);

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
          <Panel className="rise" data-testid="profile-appraisals"><h3 className="font-display text-lg font-semibold mb-5">Performance appraisals</h3><AppraisalList items={apps} /></Panel>
        </div>
        <div className="space-y-6">
          <Panel className="rise"><h3 className="font-display text-lg font-semibold mb-4">Photo & signature</h3><MediaCard media={media} /></Panel>
          <Panel className="rise"><h3 className="font-display text-lg font-semibold mb-5">Service record</h3><ServiceTimeline records={records} /></Panel>
          <Panel className="rise"><h3 className="font-display text-lg font-semibold mb-4">Change password</h3><ChangePasswordForm /></Panel>
        </div>
      </div>
    </div>
  );
}
