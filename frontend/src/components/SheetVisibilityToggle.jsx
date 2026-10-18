import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { api, errMsg } from "@/lib/api";

export const SheetVisibilityToggle = () => {
  const [on, setOn] = useState(null);
  useEffect(() => { api.get("/admin/settings/employee-sheet").then((r) => setOn(r.data.enabled)); }, []);
  const change = async (v) => {
    try {
      await api.put("/admin/settings/employee-sheet", { enabled: v });
      setOn(v);
      toast.success(v ? "Employees can now see their previous + current month attendance" : "Attendance sheet hidden from employees");
    } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <label className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 cursor-pointer transition-colors ${on ? "bg-emerald-50 border-emerald-200" : "bg-white"}`} data-testid="employee-sheet-toggle">
      {on ? <Eye size={16} className="text-emerald-700" /> : <EyeOff size={16} className="text-slate-500" />}
      <div className="leading-tight">
        <div className="text-sm font-semibold">Show attendance to employees</div>
        <div className="text-[11px] text-muted-foreground" data-testid="employee-sheet-toggle-status">{on === null ? "…" : on ? "ON · previous + current month visible" : "OFF · hidden in employee portal"}</div>
      </div>
      <Switch checked={!!on} disabled={on === null} onCheckedChange={change} data-testid="employee-sheet-switch" />
    </label>
  );
};
