import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Field } from "@/components/common";
import { api, errMsg } from "@/lib/api";

export function ResetPasswordDialog({ open, onOpenChange, employee }) {
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setPwd(""); }, [open]);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/admin/employees/${employee.id}/reset-password`, { new_password: pwd });
      toast.success(`Password reset for ${employee.name}`);
      onOpenChange(false);
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" data-testid="reset-password-dialog">
        <DialogHeader>
          <DialogTitle className="font-display">Reset password</DialogTitle>
          <DialogDescription>{employee?.name} ({employee?.employee_id}) will be asked to change it after login.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="New password (min 6)"><Input required minLength={6} value={pwd} onChange={(e) => setPwd(e.target.value)} data-testid="reset-password-input" /></Field>
          <Button type="submit" disabled={busy} className="w-full" data-testid="reset-password-submit">{busy ? "Saving…" : "Reset password"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AccessSwitch({ employee, onChange, showLabel }) {
  const live = employee.portal_enabled !== false;
  const toggle = async (v) => {
    try {
      const { data } = await api.patch(`/admin/employees/${employee.id}/access`, { enabled: v });
      toast.success(`${employee.name} is now ${v ? "Live" : "Unlive"} on portal`);
      onChange(data);
    } catch (err) { toast.error(errMsg(err)); }
  };
  return (
    <span className="inline-flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <Switch checked={live} onCheckedChange={toggle} data-testid={`portal-switch-${employee.employee_id}`} />
      {showLabel && <span className={`text-sm font-semibold ${live ? "text-emerald-600" : "text-rose-600"}`}>{live ? "Live" : "Unlive"}</span>}
    </span>
  );
}
