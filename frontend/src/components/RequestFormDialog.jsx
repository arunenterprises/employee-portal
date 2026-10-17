import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, NativeSelect } from "@/components/common";
import { api, errMsg, localDate } from "@/lib/api";

const EMPTY = { leave_type: "Casual Leave", start_date: "", end_date: "", amount: "", repayment: "", month: "", punch_date: "", missed: "in", in_time: "", out_time: "", subject: "", reason: "" };
const LEAVE_TYPES = ["Casual Leave", "Sick Leave", "Earned Leave", "Half Day", "Unpaid Leave"];

export default function RequestFormDialog({ open, initialType, onOpenChange, onSaved }) {
  const [type, setType] = useState(initialType || "leave");
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [bal, setBal] = useState(null);

  useEffect(() => {
    if (open) { setType(initialType || "leave"); setF(EMPTY); }
  }, [open, initialType]);

  const balYear = (f.start_date || localDate()).slice(0, 4);
  useEffect(() => {
    if (open && type === "leave") api.get("/leave-balance", { params: { year: balYear } }).then((r) => setBal(r.data));
  }, [open, type, balYear]);
  const balType = f.leave_type === "Half Day" ? "Casual Leave" : f.leave_type;
  const row = bal?.configured ? bal.balances.find((b) => b.leave_type === balType) : null;

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
              <option value="missed_punch">Missed Punch</option>
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
              {row && (
                <div className={`rounded-lg px-3 py-2 text-sm ${row.available - row.pending > 0 ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`} data-testid="leave-available-info">
                  {balType} available: <span className="font-semibold">{row.available - row.pending}</span> day(s) of {row.allotted}{row.pending ? ` (pending ${row.pending})` : ""}{f.leave_type === "Half Day" ? " · Half Day uses 0.5 CL per day" : ""}
                </div>
              )}
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

          {type === "missed_punch" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date"><Input type="date" required max={localDate()} value={f.punch_date} onChange={set("punch_date")} data-testid="mp-date-input" /></Field>
                <Field label="Missed punch">
                  <NativeSelect value={f.missed} onChange={set("missed")} data-testid="mp-missed-select">
                    <option value="in">Punch In</option>
                    <option value="out">Punch Out</option>
                    <option value="both">Both In & Out</option>
                  </NativeSelect>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {f.missed !== "out" && <Field label="Actual In time"><Input type="time" required value={f.in_time} onChange={set("in_time")} data-testid="mp-in-time" /></Field>}
                {f.missed !== "in" && <Field label="Actual Out time"><Input type="time" required value={f.out_time} onChange={set("out_time")} data-testid="mp-out-time" /></Field>}
              </div>
            </>
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
