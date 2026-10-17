import { Trash2, History } from "lucide-react";
import { Badge2, Empty } from "@/components/common";
import { fmtDate } from "@/lib/api";

const TONE = { joining: "blue", promotion: "approved", increment: "approved", transfer: "pending", appraisal: "blue", award: "approved", training: "neutral", other: "neutral" };

export default function ServiceTimeline({ records, onDelete }) {
  if (!records.length) return <Empty icon={History} text="No service records yet." testId="service-empty" />;
  return (
    <ol className="relative border-l-2 border-slate-200 ml-2 space-y-6" data-testid="service-timeline">
      {records.map((r) => (
        <li key={r.id} className="pl-6 relative" data-testid={`service-record-${r.id}`}>
          <span className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-white border-4 border-primary" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{fmtDate(r.date)}</span>
            <Badge2 tone={TONE[r.type]}>{r.type}</Badge2>
            {onDelete && (
              <button onClick={() => onDelete(r.id)} data-testid={`delete-service-${r.id}`} className="ml-auto text-slate-400 hover:text-rose-600 transition-colors" aria-label="Delete"><Trash2 size={15} /></button>
            )}
          </div>
          <div className="font-semibold mt-1">{r.title}</div>
          {r.notes && <p className="text-sm text-muted-foreground mt-0.5">{r.notes}</p>}
        </li>
      ))}
    </ol>
  );
}
