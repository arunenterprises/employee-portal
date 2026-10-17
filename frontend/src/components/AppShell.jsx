import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const initials = (n = "") => n.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

const Brand = ({ area }) => (
  <div className="flex items-center gap-3">
    <img src="/arun-logo.jpg" alt="Arun Enterprises logo" className="h-10 w-10 rounded-lg object-contain p-0.5 bg-white shrink-0" data-testid="shell-logo" />
    <div className="leading-tight">
      <div className="font-display font-bold text-lg tracking-tight">ARUN ENTERPRISES</div>
      <div className="text-[10px] uppercase tracking-[0.2em] opacity-60">{area}</div>
    </div>
  </div>
);

export default function AppShell({ nav, area }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const doLogout = () => { logout(); navigate("/login"); };

  return (
    <div className="min-h-screen bg-background">
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 flex-col bg-[hsl(var(--sidebar))] text-slate-100 grid-bg">
        <div className="px-6 py-7"><Brand area={area} /></div>
        <nav className="flex-1 px-3 space-y-1">
          {nav.map(({ key, to, label, icon: Icon, end }) => (
            <NavLink key={key} to={to} end={end} data-testid={`nav-${key}`}
              className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? "bg-primary text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}>
              <Icon size={18} />{label}
            </NavLink>
          ))}
        </nav>
        <div className="m-3 rounded-xl bg-white/5 border border-white/10 p-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-slate-700 grid place-items-center text-xs font-bold">{initials(user?.name)}</div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate" data-testid="nav-user-name">{user?.name}</div>
            <div className="text-xs text-slate-400 truncate">{user?.employee_id || user?.email}</div>
          </div>
          <button onClick={doLogout} data-testid="nav-logout-btn" className="p-2 rounded-md text-slate-300 hover:text-white hover:bg-white/10 transition-colors" aria-label="Logout"><LogOut size={16} /></button>
        </div>
      </aside>

      <header className="md:hidden sticky top-0 z-30 bg-[hsl(var(--sidebar))] text-white px-4 py-3 flex items-center justify-between">
        <Brand area={area} />
        <button onClick={doLogout} data-testid="mobile-logout-btn" className="p-2 rounded-md hover:bg-white/10" aria-label="Logout"><LogOut size={18} /></button>
      </header>

      <main className="md:pl-64 pb-24 md:pb-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-10"><Outlet /></div>
      </main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t grid grid-cols-5">
        {nav.map(({ key, to, label, icon: Icon, end }) => (
          <NavLink key={key} to={to} end={end} data-testid={`mnav-${key}`}
            className={({ isActive }) => `flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${isActive ? "text-primary" : "text-slate-500"}`}>
            <Icon size={20} />{label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
