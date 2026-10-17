import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, NativeSelect } from "@/components/common";
import { api, errMsg } from "@/lib/api";

const SECTIONS = [
  ["Account", [["employee_id", "Employee ID *", "text", true], ["name", "Full name *", "text", true], ["email", "Email *", "email", true], ["phone", "Phone"], ["password", "Password"]]],
  ["Job", [["department", "Department"], ["designation", "Designation"], ["joining_date", "Joining date", "date"]]],
  ["Personal", [["dob", "Date of birth", "date"], ["gender", "Gender"], ["address", "Address"]]],
  ["Bank & Statutory", [["bank_name", "Bank name"], ["bank_account", "Account number"], ["ifsc", "IFSC"], ["pan", "PAN"], ["uan", "UAN / PF No."]]],
  ["Monthly Salary (₹)", [["basic", "Basic", "number"], ["hra", "HRA", "number"], ["allowances", "Other allowances", "number"]]],
];

const blank = () => Object.fromEntries(SECTIONS.flatMap(([, fs]) => fs.map(([k, , t]) => [k, t === "number" ? 0 : ""])));

export default function EmployeeFormDialog({ open, onOpenChange, employee, onSaved }) {
  const [f, setF] = useState(blank());
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setF(employee ? { ...blank(), ...employee, password: "" } : blank());
    setActive(employee ? employee.active !== false : true);
  }, [open, employee]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const body = { ...f, active, basic: Number(f.basic) || 0, hra: Number(f.hra) || 0, allowances: Number(f.allowances) || 0, password: f.password || null };
    try {
      const r = employee ? await api.put(`/admin/employees/${employee.id}`, body) : await api.post("/admin/employees", body);
      toast.success(employee ? "Employee updated" : "Employee created");
      onSaved(r.data);
      onOpenChange(false);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="employee-form-dialog">
        <DialogHeader><DialogTitle className="font-display text-xl">{employee ? "Edit Employee" : "Add Employee"}</DialogTitle></DialogHeader>
        {employee?.source === "vendor" && <p className="text-sm rounded-md bg-blue-50 text-blue-800 px-3 py-2" data-testid="emp-form-vendor-note">This employee is synced from Vendor Portal HR. Profile, salary and Active/Inactive status changes made here will be overwritten on the next sync; edit them in the Vendor Portal instead. Password changes are kept.</p>}
        <form onSubmit={submit} className="space-y-6">
          {SECTIONS.map(([title, fields]) => (
            <fieldset key={title}>
              <legend className="text-xs uppercase tracking-widest font-semibold text-primary mb-3">{title}</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {fields.map(([k, label, type = "text", req]) => (
                  <Field key={k} label={k === "password" ? (employee ? "New password (leave blank to keep)" : "Password *") : label}>
                    <Input type={k === "password" ? "text" : type} readOnly={k === "employee_id" && employee?.source === "vendor"} required={req || (k === "password" && !employee)} minLength={k === "password" ? 6 : undefined}
                      value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} data-testid={`emp-form-${k}`} />
                  </Field>
                ))}
              </div>
            </fieldset>
          ))}
          <Field label="Status">
            <NativeSelect value={active ? "1" : "0"} onChange={(e) => setActive(e.target.value === "1")} data-testid="emp-form-active">
              <option value="1">Active</option>
              <option value="0">Inactive (cannot login)</option>
            </NativeSelect>
          </Field>
          <Button type="submit" disabled={busy} className="w-full h-11" data-testid="emp-form-submit">{busy ? "Saving…" : "Save Employee"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
