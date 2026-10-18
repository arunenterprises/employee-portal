import { forwardRef } from "react";

const TONES = {
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  rejected: "bg-rose-50 text-rose-700 ring-rose-200",
  present: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
};

export const Badge2 = ({ tone = "neutral", children, ...rest }) => (
  <span {...rest} className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset ${TONES[tone] || TONES.neutral}`}>{children}</span>
);

export const StatusBadge = ({ status, ...rest }) => <Badge2 tone={status} {...rest}>{status}</Badge2>;

export const PageHeader = ({ eyebrow, title, desc, action }) => (
  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 rise">
    <div>
      {eyebrow && <div className="text-xs uppercase tracking-[0.2em] font-semibold text-primary mb-2">{eyebrow}</div>}
      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">{title}</h1>
      {desc && <p className="text-sm sm:text-base text-muted-foreground mt-2">{desc}</p>}
    </div>
    {action}
  </div>
);

export const Panel = ({ className = "", children, ...rest }) => (
  <div {...rest} className={`rounded-xl border bg-card p-5 sm:p-6 shadow-sm ${className}`}>{children}</div>
);

export const StatCard = ({ icon: Icon, label, value, tone = "text-primary bg-blue-50", testId, delay = 0, compact = false, className = "" }) => compact ? (
  <Panel className={`rise hover:shadow-md transition-shadow !p-4 flex items-center gap-3 ${className}`} style={{ animationDelay: `${delay}ms` }}>
    <div className={`h-10 w-10 shrink-0 rounded-lg grid place-items-center ${tone}`}><Icon size={20} /></div>
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground leading-tight">{label}</div>
      <div className="text-2xl font-display font-bold leading-tight mt-0.5" data-testid={testId}>{value}</div>
    </div>
  </Panel>
) : (
  <Panel className="rise hover:shadow-md transition-shadow" style={{ animationDelay: `${delay}ms` }}>
    <div className={`h-10 w-10 rounded-lg grid place-items-center mb-4 ${tone}`}><Icon size={20} /></div>
    <div className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">{label}</div>
    <div className="text-2xl sm:text-3xl font-display font-bold mt-1" data-testid={testId}>{value}</div>
  </Panel>
);

export const Empty = ({ icon: Icon, text, testId }) => (
  <div className="py-14 text-center text-muted-foreground" data-testid={testId}>
    {Icon && <Icon className="mx-auto mb-3 opacity-40" size={32} />}
    <p className="text-sm">{text}</p>
  </div>
);

export const NativeSelect = forwardRef(({ className = "", children, ...props }, ref) => (
  <select ref={ref} {...props} className={`h-10 w-full rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring ${className}`}>{children}</select>
));
NativeSelect.displayName = "NativeSelect";

export const Field = ({ label, children, className = "" }) => (
  <label className={`block space-y-1.5 ${className}`}>
    <span className="text-xs font-semibold text-slate-600">{label}</span>
    {children}
  </label>
);

export const Info = ({ label, value }) => (
  <div>
    <div className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">{label}</div>
    <div className="text-sm font-medium mt-1 break-words">{value || "—"}</div>
  </div>
);
