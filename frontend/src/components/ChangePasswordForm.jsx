import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/common";
import { useAuth } from "@/context/AuthContext";
import { api, errMsg } from "@/lib/api";

export default function ChangePasswordForm({ onDone }) {
  const { user, setUser } = useAuth();
  const [f, setF] = useState({ current_password: "", new_password: "" });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/auth/change-password", f);
      toast.success("Password changed");
      setUser({ ...user, must_change_password: false });
      setF({ current_password: "", new_password: "" });
      onDone?.();
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
}
