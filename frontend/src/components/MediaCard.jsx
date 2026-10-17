import { useState } from "react";
import { ImageOff, Upload } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const readImage = (file) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => {
    const scale = Math.min(1, 600 / img.width);
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(img.src);
    resolve(c.toDataURL("image/jpeg", 0.8));
  };
  img.onerror = reject;
  img.src = URL.createObjectURL(file);
});

const Slot = ({ label, src, kind, onView, onUpload }) => (
  <div>
    <div className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground mb-2">{label}</div>
    <button type="button" disabled={!src} onClick={() => onView({ label, src })} data-testid={`media-${kind}-preview`}
      className={`w-full rounded-xl border bg-slate-50 grid place-items-center overflow-hidden transition-shadow ${kind === "photo" ? "aspect-[3/4]" : "aspect-[3/1]"} ${src ? "hover:shadow-md cursor-zoom-in" : ""}`}>
      {src ? <img src={src} alt={label} className="w-full h-full object-contain" /> : <span className="text-xs text-muted-foreground flex flex-col items-center gap-1"><ImageOff size={20} />Not available</span>}
    </button>
    {onUpload && (
      <label className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary cursor-pointer hover:underline">
        <Upload size={12} />Upload {label.toLowerCase()}
        <input type="file" accept="image/*" className="hidden" data-testid={`media-${kind}-upload`}
          onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { onUpload(kind, await readImage(f)); } catch { toast.error("Could not read image"); } e.target.value = ""; }} />
      </label>
    )}
  </div>
);

export default function MediaCard({ media, onUpload, stacked }) {
  const [view, setView] = useState(null);
  return (
    <div data-testid="employee-media-card">
      <div className={`grid gap-4 items-start ${stacked ? "grid-cols-2 md:grid-cols-1" : "grid-cols-2"}`}>
        <Slot label="Photo" kind="photo" src={media?.photo} onView={setView} onUpload={onUpload} />
        <Slot label="Signature" kind="signature" src={media?.signature} onView={setView} onUpload={onUpload} />
      </div>
      {media?.source === "vendor" && <p className="text-xs text-muted-foreground mt-3">As per Vendor Portal HR record.</p>}
      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-w-lg" data-testid="media-view-dialog">
          <DialogHeader><DialogTitle>{view?.label}</DialogTitle></DialogHeader>
          {view && <img src={view.src} alt={view.label} className="w-full max-h-[70vh] object-contain rounded-lg bg-slate-50" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
