import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2, KeyRound } from "lucide-react";
import MediaCard from "@/components/MediaCard";
import { ResetPasswordDialog, AccessSwitch } from "@/components/EmployeeAccess";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PageHeader, Panel, Info, Field, NativeSelect, Badge2 } from "@/components/common";
import EmployeeFormDialog from "@/components/EmployeeFormDialog";
import ServiceTimeline from "@/components/ServiceTimeline";
import SalaryBreakup from "@/components/SalaryBreakup";
import { api, errMsg, fmtDate, localDate } from "@/lib/api";

const TYPES = ["promotion", "transfer", "increment", "appraisal", "training", "award", "joining", "other"];

const AddRecord = ({ userId, onAdded, onCancel }) => {
  const [f, setF] = useState({ date: localDate(), type: "promotion", title: "", notes: "" });
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/admin/service-records", { ...f, user_id: userId });
      toast.success("Service record added");
      setF({ ...f, title: "", notes: "" });
      onAdded();
    } catch (err) { toast.error(errMsg(err)); }
  };
  return (
    <form onSubmit={submit} className="mb-6 rounded-lg bg-slate-50 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[160px_160px_1fr_1fr_auto] gap-3 items-end" data-testid="add-service-form">
      <Field label="Date"><Input type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className="bg-white" data-testid="sr-date" /></Field>
      <Field label="Type"><NativeSelect value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} data-testid="sr-type">{TYPES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}</NativeSelect></Field>
      <Field label="Title"><Input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Promoted to Senior Executive" className="bg-white" data-testid="sr-title" /></Field>
      <Field label="Notes"><Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} className="bg-white" data-testid="sr-notes" /></Field>
      <div className="flex gap-2">
        <Button type="submit" data-testid="sr-submit">Save</Button>
        <Button type="button" variant="ghost" onClick={onCancel} data-testid="sr-cancel">Cancel</Button>
      </div>
    </form>
  );
};

export default function AdminEmployeeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [e, setE] = useState(null);
  const [records, setRecords] = useState([]);
  const [edit, setEdit] = useState(false);
  const [adding, setAdding] = useState(false);
  const [del, setDel] = useState(false);
  const [reset, setReset] = useState(false);
  const [media, setMedia] = useState(null);

  const loadRecords = useCallback(() => { api.get("/admin/service-records", { params: { user_id: id } }).then((r) => setRecords(r.data)); }, [id]);
  useEffect(() => {
    api.get(`/admin/employees/${id}`).then((r) => setE(r.data)).catch(() => navigate("/admin/employees"));
    api.get(`/admin/employees/${id}/media`).then((r) => setMedia(r.data));
    loadRecords();
  }, [id, navigate, loadRecords]);

  const uploadMedia = async (kind, dataUrl) => {
    try { const { data } = await api.post(`/admin/employees/${id}/media`, { [kind]: dataUrl }); setMedia(data); toast.success(`${kind === "photo" ? "Photo" : "Signature"} updated`); } catch (err) { toast.error(errMsg(err)); }
  };

  const removeRecord = async (rid) => { await api.delete(`/admin/service-records/${rid}`); loadRecords(); };
  const removeEmployee = async () => {
    try { await api.delete(`/admin/employees/${id}`); toast.success("Employee deleted"); navigate("/admin/employees"); } catch (err) { toast.error(errMsg(err)); }
  };

  if (!e) return <div className="text-muted-foreground">Loading…</div>;

  const groups = [
    ["Job", [["Employee ID", e.employee_id], ["Department", e.department], ["Designation", e.designation], ["Joining date", fmtDate(e.joining_date)], ["Location", e.location], ["Project site", e.project_site], ["Reporting manager", e.reporting_manager]]],
    ["Personal & contact", [["Email", e.email], ["Phone", e.phone], ["Date of birth", fmtDate(e.dob)], ["Gender", e.gender], ["Father's name", e.father_name], ["Address", e.address]]],
    ["Bank & statutory", [["Bank", e.bank_name], ["Account no.", e.bank_account], ["IFSC", e.ifsc], ["PAN", e.pan], ["UAN / PF", e.uan]]],
  ];

  const Group = ({ title, items }) => (
    <section>
      <h4 className="text-xs uppercase tracking-widest font-semibold text-primary mb-3">{title}</h4>
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-4">{items.filter(([, v]) => v !== undefined).map(([l, v]) => <Info key={l} label={l} value={v} />)}</div>
    </section>
  );

  return (
    <div>
      <Link to="/admin/employees" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4" data-testid="back-to-employees"><ArrowLeft size={14} />Employees</Link>
      <PageHeader eyebrow={e.employee_id} title={e.name}
        action={<div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border bg-white px-3 h-10 inline-flex items-center gap-2 text-sm" data-testid="portal-access-control">Portal <AccessSwitch employee={e} onChange={setE} showLabel /></span>
          <Button variant="outline" onClick={() => setReset(true)} data-testid="reset-password-btn"><KeyRound size={15} className="mr-2" />Reset password</Button>
          <Button variant="outline" onClick={() => setEdit(true)} data-testid="edit-employee-btn"><Pencil size={15} className="mr-2" />Edit</Button>
          <Button variant="outline" onClick={() => setDel(true)} className="text-rose-600 hover:text-rose-700 hover:bg-rose-50" data-testid="delete-employee-btn"><Trash2 size={15} className="mr-2" />Delete</Button>
        </div>} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Panel className="lg:col-span-2" data-testid="employee-detail-info">
          <div className="flex items-center justify-between mb-6"><h3 className="font-display text-lg font-semibold">Employee profile</h3><Badge2 tone={e.active !== false ? "approved" : "rejected"}>{e.active !== false ? "Active" : "Inactive"}</Badge2></div>
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-1 min-w-0 space-y-7">{groups.map(([t, items]) => <Group key={t} title={t} items={items} />)}</div>
            <div className="md:w-48 shrink-0 md:border-l md:pl-6"><MediaCard media={media} onUpload={uploadMedia} stacked /></div>
          </div>
        </Panel>
        <Panel className="self-start">
          <h3 className="font-display text-lg font-semibold mb-4">Salary breakup</h3>
          <SalaryBreakup e={e} />
        </Panel>
        <Panel className="lg:col-span-3" data-testid="service-record-panel">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display text-lg font-semibold">Service record</h3>
            {!adding && <Button size="sm" variant="outline" onClick={() => setAdding(true)} data-testid="sr-open-form">+ Add record</Button>}
          </div>
          {adding && <AddRecord userId={id} onAdded={() => { loadRecords(); setAdding(false); }} onCancel={() => setAdding(false)} />}
          <ServiceTimeline records={records} onDelete={removeRecord} />
        </Panel>
      </div>
      <EmployeeFormDialog open={edit} onOpenChange={setEdit} employee={e} onSaved={setE} />
      <ResetPasswordDialog open={reset} onOpenChange={setReset} employee={e} />
      <AlertDialog open={del} onOpenChange={setDel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {e.name}?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the employee and all their attendance, requests, payslips and service records. To only block login, set status to Inactive instead.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-delete-employee">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={removeEmployee} className="bg-rose-600 hover:bg-rose-700" data-testid="confirm-delete-employee">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
