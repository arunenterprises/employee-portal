import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, MapPin, Loader2, ShieldAlert, CheckCircle2, XCircle, RotateCcw, Clock } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api, errMsg } from "@/lib/api";

const AUTO_SECONDS = 30;

const snap = (v) => {
  const scale = Math.min(1, 320 / v.videoWidth);
  const c = document.createElement("canvas");
  c.width = Math.round(v.videoWidth * scale);
  c.height = Math.round(v.videoHeight * scale);
  c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.6);
};

const Perm = ({ ok, label, icon: Icon, testId }) => (
  <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${ok === true ? "bg-emerald-50 text-emerald-800" : ok === false ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"}`} data-testid={testId}>
    <Icon size={15} />{label}
    <span className="ml-auto">{ok === true ? <CheckCircle2 size={16} /> : ok === false ? <XCircle size={16} /> : <Loader2 size={16} className="animate-spin" />}</span>
  </div>
);

const useClock = (on) => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    if (!on) return undefined;
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [on]);
  return now;
};

export default function PunchDialog({ open, mode, onClose, onDone }) {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [cam, setCam] = useState(null);
  const [loc, setLoc] = useState(null);
  const [locOk, setLocOk] = useState(null);
  const [left, setLeft] = useState(AUTO_SECONDS);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const submitted = useRef(false);
  const now = useClock(open);
  const ready = cam === true && locOk === true;

  useEffect(() => {
    if (!open) return undefined;
    let s = null;
    submitted.current = false;
    setCam(null); setLocOk(null); setLoc(null); setLeft(AUTO_SECONDS);
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: "user" } })
      .then((st) => { s = st; setStream(st); setCam(true); })
      .catch(() => setCam(false));
    if (!navigator.mediaDevices) setCam(false);
    navigator.geolocation
      ? navigator.geolocation.getCurrentPosition(
          (p) => { setLoc({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }); setLocOk(true); },
          () => setLocOk(false),
          { enableHighAccuracy: true, timeout: 20000 })
      : setLocOk(false);
    return () => { s?.getTracks().forEach((t) => t.stop()); setStream(null); };
  }, [open, attempt]);

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  const submit = useCallback(async () => {
    const v = videoRef.current;
    if (submitted.current || !v?.videoWidth || !loc) return;
    submitted.current = true;
    setBusy(true);
    try {
      await api.post(`/attendance/punch-${mode}`, { selfie: snap(v), ...loc });
      toast.success(mode === "in" ? "Punch In submitted" : "Punch Out submitted");
      onDone();
      onClose();
    } catch (e) {
      toast.error(errMsg(e));
      onClose();
    } finally {
      setBusy(false);
    }
  }, [loc, mode, onClose, onDone]);

  useEffect(() => {
    if (!open || !ready) return undefined;
    if (left <= 0) { submit(); return undefined; }
    const t = setTimeout(() => setLeft((x) => x - 1), 1000);
    return () => clearTimeout(t);
  }, [open, ready, left, submit]);

  const denied = cam === false || locOk === false;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-md" data-testid="punch-selfie-modal" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Punch {mode === "in" ? "In" : "Out"}</DialogTitle>
          <DialogDescription>Front camera and location permission are required.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          <Perm ok={cam} label="Front Camera" icon={Camera} testId="perm-camera" />
          <Perm ok={locOk} label="Location" icon={MapPin} testId="perm-location" />
        </div>

        <div className="aspect-[4/3] rounded-xl overflow-hidden bg-slate-900 relative grid place-items-center">
          {stream ? <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover -scale-x-100" />
            : <div className="text-slate-400 text-sm px-6 text-center">{cam === false ? "Camera permission denied" : "Starting front camera…"}</div>}
          {ready && (
            <div className="absolute top-3 right-3 h-14 w-14 rounded-full bg-black/60 text-white grid place-items-center font-mono text-xl font-semibold ring-2 ring-emerald-400" data-testid="punch-countdown">{left}</div>
          )}
        </div>

        <div className="rounded-lg border bg-slate-50 px-4 py-3" data-testid="punch-time-view">
          <div className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground flex items-center gap-1"><Clock size={12} />Punch time (auto, not editable)</div>
          <div className="font-mono text-2xl font-semibold mt-1">{now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</div>
          <div className="text-xs text-muted-foreground">{now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
          {loc && <div className="font-mono text-xs text-emerald-700 mt-1" data-testid="gps-status">GPS {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)} (±{Math.round(loc.accuracy)}m)</div>}
        </div>

        {denied ? (
          <div className="rounded-lg bg-rose-50 text-rose-800 p-3 text-sm space-y-2" data-testid="permission-required">
            <div className="flex items-center gap-2 font-semibold"><ShieldAlert size={16} />Permission Required</div>
            <p>Allow Camera and Location for this site from browser settings (lock icon in address bar), then retry.</p>
            <Button size="sm" variant="outline" onClick={() => setAttempt((a) => a + 1)} data-testid="permission-retry-btn"><RotateCcw size={14} className="mr-1" />Retry</Button>
          </div>
        ) : (
          <Button onClick={submit} disabled={!ready || busy} data-testid="confirm-punch-btn" className="w-full h-11">
            {busy && <Loader2 size={16} className="mr-2 animate-spin" />}
            {busy ? "Submitting…" : ready ? `Submit now (auto-submit in ${left}s)` : "Waiting for permissions…"}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
