import { useState } from "react";
import { Hash, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, errMsg } from "@/lib/api";

export const ShortCodeControl = ({ employee, onChange }) => {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async (value) => {
    setBusy(true);
    try {
      const { data } = await api.put(`/admin/employees/${employee.id}/short-code`, { short_code: value });
      toast.success(`Short code set: ${data.short_code}`);
      onChange({ ...employee, short_code: data.short_code });
      setOpen(false);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => { setCode(employee.short_code || ""); setOpen(true); }} data-testid="short-code-btn">
        <Hash size={14} className="mr-2" />{employee.short_code ? `Short code ${employee.short_code}` : "Generate short code"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm" data-testid="short-code-dialog">
          <DialogHeader>
            <DialogTitle className="font-display">Short code</DialogTitle>
            <DialogDescription>{employee.name} · <span className="font-mono">{employee.employee_id}</span>. The employee can log in with this short code instead of the full employee code.</DialogDescription>
          </DialogHeader>
          <Input value={code} maxLength={6} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} placeholder="e.g. AE0005" className="font-mono text-lg tracking-widest" data-testid="short-code-input" />
          <p className="text-xs text-muted-foreground">5 or 6 letters/numbers. Must be unique.</p>
          <div className="flex gap-2">
            <Button variant="outline" disabled={busy} onClick={() => save("")} data-testid="short-code-auto-btn"><Wand2 size={14} className="mr-2" />Auto generate</Button>
            <Button className="flex-1" disabled={busy || code.length < 5} onClick={() => save(code)} data-testid="short-code-save-btn">Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
