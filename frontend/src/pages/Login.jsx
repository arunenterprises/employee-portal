import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Camera, MapPin, FileCheck2, Loader2, Building2, Phone, Mail } from "lucide-react";
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

const COMPANY = {
  name: "ARUN ENTERPRISES",
  address: "[Company Address, City, State - PIN]",
  phone: "[+91 XXXXX XXXXX]",
  email: "arunenterprises2023@gmail.com",
};

const CompanyCard = ({ compact }) => (
  <div className="rise" data-testid="login-company-card">
    <div className="flex items-center gap-4">
      <div className={`${compact ? "h-11 w-11" : "h-14 w-14"} rounded-xl bg-primary grid place-items-center shrink-0 ring-4 ring-primary/20`}><Building2 size={compact ? 22 : 28} /></div>
      <div>
        <div className={`font-display font-extrabold tracking-tight leading-none ${compact ? "text-xl" : "text-2xl"}`} data-testid="login-company-name">{COMPANY.name}</div>
        <div className="text-[10px] uppercase tracking-[0.25em] text-blue-300 font-semibold mt-1.5">Employee & HR Portal</div>
      </div>
    </div>
    <div className={`mt-5 pt-4 border-t border-white/10 grid gap-2.5 text-sm text-slate-300 ${compact ? "" : "max-w-sm"}`}>
      <div className="flex items-start gap-2.5" data-testid="login-company-address"><MapPin size={15} className="mt-0.5 shrink-0 text-blue-300" />{COMPANY.address}</div>
      <a href={`tel:${COMPANY.phone}`} className="flex items-center gap-2.5 hover:text-white transition-colors" data-testid="login-company-phone"><Phone size={15} className="shrink-0 text-blue-300" />{COMPANY.phone}</a>
      <a href={`mailto:${COMPANY.email}`} className="flex items-center gap-2.5 hover:text-white transition-colors break-all" data-testid="login-company-email"><Mail size={15} className="shrink-0 text-blue-300" />{COMPANY.email}</a>
    </div>
  </div>
);

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
        <CompanyCard />
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
          <div className="lg:hidden rounded-2xl bg-[hsl(var(--sidebar))] text-white p-5 grid-bg"><CompanyCard compact /></div>
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
