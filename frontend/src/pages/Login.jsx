import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Fingerprint, Camera, MapPin, FileCheck2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/common";
import { useAuth } from "@/context/AuthContext";
import { errMsg } from "@/lib/api";

const FEATURES = [
  [Camera, "Selfie attendance", "Punch in & out with a photo"],
  [MapPin, "GPS verified", "Location saved with every punch"],
  [FileCheck2, "Requests & payslips", "Leave, advance, payslip — all in one place"],
];

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={user.role === "admin" ? "/admin" : "/employee"} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const u = await login(identifier, password);
      navigate(u.role === "admin" ? "/admin" : "/employee");
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr]">
      <section className="hidden lg:flex flex-col justify-between bg-[hsl(var(--sidebar))] text-white p-14 grid-bg">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary grid place-items-center"><Fingerprint size={22} /></div>
          <span className="font-display font-bold text-xl">WorkPulse</span>
        </div>
        <div className="max-w-md">
          <div className="text-xs uppercase tracking-[0.25em] text-blue-300 font-semibold mb-4">Employee Self-Service</div>
          <h1 className="text-5xl font-extrabold tracking-tight leading-[1.05]">Your work life,<br />one tap away.</h1>
          <ul className="mt-10 space-y-5">
            {FEATURES.map(([Icon, t, d], i) => (
              <li key={t} className="flex gap-4 rise" style={{ animationDelay: `${i * 90}ms` }}>
                <div className="h-10 w-10 rounded-lg bg-white/10 grid place-items-center shrink-0"><Icon size={18} /></div>
                <div><div className="font-semibold">{t}</div><div className="text-sm text-slate-400">{d}</div></div>
              </li>
            ))}
          </ul>
        </div>
        <div className="text-xs text-slate-500">Secure access for employees & HR</div>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-12">
        <form onSubmit={submit} className="w-full max-w-sm space-y-6 rise" data-testid="login-form">
          <div className="lg:hidden flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-lg bg-primary grid place-items-center text-white"><Fingerprint size={22} /></div>
            <span className="font-display font-bold text-xl">WorkPulse</span>
          </div>
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">Sign in</h2>
            <p className="text-sm text-muted-foreground mt-2">Use your email or Employee ID provided by HR.</p>
          </div>
          <Field label="Email or Employee ID">
            <Input required value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="EMP001 or you@company.com" className="h-11" data-testid="login-email-input" />
          </Field>
          <Field label="Password">
            <Input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" data-testid="login-password-input" />
          </Field>
          {error && <div className="text-sm text-rose-700 bg-rose-50 rounded-md px-3 py-2" data-testid="login-error">{error}</div>}
          <Button type="submit" disabled={busy} className="w-full h-11 text-base" data-testid="login-submit-button">
            {busy && <Loader2 size={16} className="mr-2 animate-spin" />}Sign in
          </Button>
          <p className="text-xs text-muted-foreground">Forgot password? Contact your HR / admin to reset it.</p>
        </form>
      </section>
    </div>
  );
}
