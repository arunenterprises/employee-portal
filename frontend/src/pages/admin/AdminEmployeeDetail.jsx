import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PageHeader, Panel, Info, Field, NativeSelect, Badge2 } from "@/components/common";
import EmployeeFormDialog from "@/components/EmployeeFormDialog";
import ServiceTimeline from "@/components/ServiceTimeline";
import { api, errMsg, fmtDate, fmtINR, localDate } from "@/lib/api";

const TYPES = ["promotion", "transfer", "increment", "appraisal", "training", "award", "joining", "other"];

const AddRecord = ({ userId, onAdded }) => {
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
    <form onSubmit={submit} className="space-y-3 mb-6 rounded-lg bg-slate-50 p-4" data-testid="add-service-form">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date"><Input type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className="bg-white" data-testid="sr-date" /></Field>
        <Field label="Type"><NativeSelect value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} data-testid="sr-type">{TYPES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}</NativeSelect></Field>
      </div>
      <Field label="Title"><Input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Promoted to Senior Executive" className="bg-white" data-testid="sr-title" /></Field>
      <Field label="Notes"><Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} className="bg-white" data-testid="sr-notes" /></Field>
      <Button type="submit" size="sm" data-testid="sr-submit">Add record</Button>
    </form>
  );
};

export default function AdminEmployeeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [e, setE] = useState(null);
  const [records, setRecords] = useState([]);
  const [edit, setEdit] = useState(false);
  const [del, setDel] = useState(false);

  const loadRecords = useCallback(() => { api.get("/admin/service-records", { params: { user_id: id } }).then((r) => setRecords(r.data)); }, [id]);
  useEffect(() => {
    api.get(`/admin/employees/${id}`).then((r) => setE(r.data)).catch(() => navigate("/admin/employees"));
    loadRecords();
  }, [id, navigate, loadRecords]);

  const removeRecord = async (rid) => { await api.delete(`/admin/service-records/${rid}`); loadRecords(); };
  const removeEmployee = async () => {
    try { await api.delete(`/admin/employees/${id}`); toast.success("Employee deleted"); navigate("/admin/employees"); } catch (err) { toast.error(errMsg(err)); }
  };

  if (!e) return <div className="text-muted-foreground">Loading…</div>;

  const info = [["Employee ID", e.employee_id], ["Email", e.email], ["Phone", e.phone], ["Department", e.department], ["Designation", e.designation], ["Joining date", fmtDate(e.joining_date)],
    ["Date of birth", fmtDate(e.dob)], ["Gender", e.gender], ["Address", e.address], ["Bank", e.bank_name], ["Account no.", e.bank_account], ["IFSC", e.ifsc], ["PAN", e.pan], ["UAN", e.uan],
    ["Basic", fmtINR(e.basic)], ["HRA", fmtINR(e.hra)], ["Allowances", fmtINR(e.allowances)]];

  return (
    <div>
      <Link to="/admin/employees" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4" data-testid="back-to-employees"><ArrowLeft size={14} />Employees</Link>
      <PageHeader eyebrow={e.employee_id} title={e.name}
        action={<div className="flex gap-2">
          <Button variant="outline" onClick={() => setEdit(true)} data-testid="edit-employee-btn"><Pencil size={15} className="mr-2" />Edit</Button>
          <Button variant="outline" onClick={() => setDel(true)} className="text-rose-600 hover:text-rose-700 hover:bg-rose-50" data-testid="delete-employee-btn"><Trash2 size={15} className="mr-2" />Delete</Button>
        </div>} />
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Panel className="lg:col-span-3" data-testid="employee-detail-info">
          <div className="flex items-center justify-between mb-5"><h3 className="font-display text-lg font-semibold">Details</h3><Badge2 tone={e.active !== false ? "approved" : "rejected"}>{e.active !== false ? "Active" : "Inactive"}</Badge2></div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">{info.map(([l, v]) => <Info key={l} label={l} value={v} />)}</div>
        </Panel>
        <Panel className="lg:col-span-2">
          <h3 className="font-display text-lg font-semibold mb-4">Service record</h3>
          <AddRecord userId={id} onAdded={loadRecords} />
          <ServiceTimeline records={records} onDelete={removeRecord} />
        </Panel>
      </div>
      <EmployeeFormDialog open={edit} onOpenChange={setEdit} employee={e} onSaved={setE} />
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
