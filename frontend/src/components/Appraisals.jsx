import { useState } from "react";
import { Star, Trash2, Award } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, NativeSelect, Badge2, Empty } from "@/components/common";
import { api, errMsg, fmtDate, localDate } from "@/lib/api";

export const CRITERIA = ["Work Quality", "Punctuality", "Teamwork", "Communication", "Initiative", "Discipline"];
const REC = { none: "No change", increment: "Increment", promotion: "Promotion", training: "Training needed", pip: "Improvement plan" };
const GRADE_TONE = { Outstanding: "approved", "Very Good": "approved", Good: "blue", "Needs Improvement": "pending", Poor: "rejected" };

const Stars = ({ value, onChange, testId }) => (
  <div className="flex gap-0.5" data-testid={testId}>
    {[1, 2, 3, 4, 5].map((n) => (
      <button key={n} type="button" disabled={!onChange} onClick={() => onChange?.(n)} aria-label={`${n} star`} data-testid={onChange ? `${testId}-${n}` : undefined}
        className={`${onChange ? "hover:scale-110 transition-transform" : ""}`}>
        <Star size={onChange ? 20 : 14} className={n <= value ? "fill-amber-400 text-amber-400" : "text-slate-300"} />
      </button>
    ))}
  </div>
);

export function AppraisalForm({ userId, onSaved, onCancel }) {
  const [f, setF] = useState({ period: `${new Date().getFullYear() - 1}-${String(new Date().getFullYear()).slice(2)}`, review_date: localDate(), reviewer: "", strengths: "", improvements: "", remarks: "", recommendation: "none" });
  const [r, setR] = useState(Object.fromEntries(CRITERIA.map((c) => [c, 3])));
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const avg = (Object.values(r).reduce((a, b) => a + b, 0) / CRITERIA.length).toFixed(1);
  const save = async (e) => {
    e.preventDefault();
    try { await api.post("/admin/appraisals", { ...f, ratings: r, user_id: userId }); toast.success("Appraisal saved"); onSaved(); } catch (err) { toast.error(errMsg(err)); }
  };
  return (
    <form onSubmit={save} className="rounded-xl bg-slate-50 p-5 space-y-4 mb-6" data-testid="appraisal-form">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Review period"><Input required value={f.period} onChange={set("period")} className="bg-white" data-testid="ap-period" /></Field>
        <Field label="Review date"><Input type="date" required value={f.review_date} onChange={set("review_date")} className="bg-white" data-testid="ap-date" /></Field>
        <Field label="Reviewer"><Input value={f.reviewer} onChange={set("reviewer")} className="bg-white" placeholder="e.g. HR Manager" data-testid="ap-reviewer" /></Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 rounded-lg bg-white border p-4">
        {CRITERIA.map((c) => (
          <div key={c} className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">{c}</span>
            <Stars value={r[c]} onChange={(n) => setR({ ...r, [c]: n })} testId={`ap-rate-${c.split(" ")[0].toLowerCase()}`} />
          </div>
        ))}
        <div className="sm:col-span-2 text-sm font-semibold text-right">Overall: <span className="font-mono" data-testid="ap-overall">{avg}</span> / 5</div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Strengths"><Textarea rows={2} value={f.strengths} onChange={set("strengths")} className="bg-white" data-testid="ap-strengths" /></Field>
        <Field label="Areas to improve"><Textarea rows={2} value={f.improvements} onChange={set("improvements")} className="bg-white" data-testid="ap-improvements" /></Field>
        <Field label="Remarks"><Textarea rows={2} value={f.remarks} onChange={set("remarks")} className="bg-white" data-testid="ap-remarks" /></Field>
        <Field label="Recommendation"><NativeSelect value={f.recommendation} onChange={set("recommendation")} data-testid="ap-recommendation">{Object.entries(REC).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect></Field>
      </div>
      <div className="flex gap-2"><Button type="submit" data-testid="ap-submit">Save appraisal</Button><Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button></div>
    </form>
  );
}

export function AppraisalList({ items, onDelete }) {
  if (!items.length) return <Empty icon={Award} text="No performance appraisals yet." testId="appraisals-empty" />;
  return (
    <div className="space-y-4">
      {items.map((a) => (
        <div key={a.id} className="rounded-xl border p-5" data-testid={`appraisal-${a.id}`}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="font-display text-lg font-bold">{a.period}</div>
            <Badge2 tone={GRADE_TONE[a.grade]}>{a.grade}</Badge2>
            <span className="font-mono text-sm font-semibold">{a.score} / 5</span>
            {a.recommendation !== "none" && <Badge2 tone="blue">{REC[a.recommendation]}</Badge2>}
            <span className="text-xs text-muted-foreground ml-auto">{fmtDate(a.review_date)}{a.reviewer ? ` · ${a.reviewer}` : ""}</span>
            {onDelete && <button onClick={() => onDelete(a.id)} className="text-slate-400 hover:text-rose-600" aria-label="Delete" data-testid={`delete-appraisal-${a.id}`}><Trash2 size={15} /></button>}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 mt-4">
            {CRITERIA.map((c) => <div key={c} className="flex items-center justify-between gap-2 text-sm"><span className="text-slate-600">{c}</span><Stars value={a.ratings?.[c] || 0} /></div>)}
          </div>
          {(a.strengths || a.improvements || a.remarks) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 text-sm">
              {[["Strengths", a.strengths], ["Areas to improve", a.improvements], ["Remarks", a.remarks]].filter(([, v]) => v).map(([l, v]) => (
                <div key={l}><div className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">{l}</div><p className="mt-1">{v}</p></div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
