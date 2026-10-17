import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, NativeSelect } from "@/components/common";
import { api, errMsg } from "@/lib/api";

const EMPTY = { leave_type: "Casual Leave", start_date: "", end_date: "", amount: "", repayment: "", month: "", subject: "", reason: "" };
const LEAVE_TYPES = ["Casual Leave", "Sick Leave", "Earned Leave", "Half Day", "Unpaid Leave"];

export default function RequestFormDialog({ open, initialType, onOpenChange, onSaved }) {
  const [type, setType] = useState(initialType || "leave");
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setType(initialType || "leave"); setF(EMPTY); }
  }, [open, initialType]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/requests", { ...f, type, amount: Number(f.amount) || 0 });
      toast.success("Request submitted");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="request-form-dialog">
        <DialogHeader><DialogTitle className="font-display text-xl">New Request</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Request type">
            <NativeSelect value={type} onChange={(e) => setType(e.target.value)} data-testid="request-type-select">
              <option value="leave">Leave</option>
              <option value="advance">Salary Advance</option>
              <option value="payslip">Payslip</option>
              <option value="other">Other</option>
            </NativeSelect>
          </Field>

          {type === "leave" && (
            <>
              <Field label="Leave type">
                <NativeSelect value={f.leave_type} onChange={set("leave_type")} data-testid="leave-type-select">
                  {LEAVE_TYPES.map((t) => <option key={t}>{t}</option>)}
                </NativeSelect>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="From"><Input type="date" required value={f.start_date} onChange={set("start_date")} data-testid="leave-start-date" /></Field>
                <Field label="To"><Input type="date" required value={f.end_date} onChange={set("end_date")} data-testid="leave-end-date" /></Field>
              </div>
            </>
          )}

          {type === "advance" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount (₹)"><Input type="number" min="1" required value={f.amount} onChange={set("amount")} data-testid="advance-amount-input" /></Field>
              <Field label="Repayment plan"><Input placeholder="e.g. 3 monthly EMIs" value={f.repayment} onChange={set("repayment")} data-testid="advance-repayment-input" /></Field>
            </div>
          )}

          {type === "payslip" && (
            <Field label="Payslip month"><Input type="month" required value={f.month} onChange={set("month")} data-testid="payslip-month-input" /></Field>
          )}

          {type === "other" && (
            <Field label="Subject"><Input required value={f.subject} onChange={set("subject")} placeholder="e.g. Experience letter, ID card" data-testid="other-subject-input" /></Field>
          )}

          <Field label="Reason / details">
            <Textarea rows={3} value={f.reason} onChange={set("reason")} data-testid="leave-reason-input" />
          </Field>

          <Button type="submit" disabled={busy} className="w-full h-11" data-testid="submit-request-btn">{busy ? "Submitting…" : "Submit Request"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
