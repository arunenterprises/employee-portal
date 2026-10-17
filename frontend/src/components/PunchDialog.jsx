import { useEffect, useRef, useState } from "react";
import { Camera, MapPin, RotateCcw, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api, errMsg } from "@/lib/api";

const toJpeg = (source, w, h) => {
  const scale = Math.min(1, 320 / w);
  const c = document.createElement("canvas");
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  c.getContext("2d").drawImage(source, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.6);
};

export default function PunchDialog({ open, mode, onClose, onDone }) {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [selfie, setSelfie] = useState(null);
  const [camErr, setCamErr] = useState("");
  const [loc, setLoc] = useState(null);
  const [locErr, setLocErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let s = null;
    setSelfie(null); setLoc(null); setLocErr(""); setCamErr("");
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: "user" } })
      .then((st) => { s = st; setStream(st); })
      .catch(() => setCamErr("Camera not available. Please upload a photo instead."));
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => setLoc({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
        () => setLocErr("Location permission denied or unavailable."),
        { enableHighAccuracy: true, timeout: 15000 }
      );
    } else {
      setLocErr("Location not supported on this device.");
    }
    return () => { s?.getTracks().forEach((t) => t.stop()); setStream(null); };
  }, [open]);

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream, selfie]);

  const capture = () => {
    const v = videoRef.current;
    if (!v?.videoWidth) return;
    setSelfie(toJpeg(v, v.videoWidth, v.videoHeight));
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const img = new Image();
    img.onload = () => { setSelfie(toJpeg(img, img.width, img.height)); URL.revokeObjectURL(img.src); };
    img.src = URL.createObjectURL(f);
  };

  const confirm = async () => {
    setBusy(true);
    try {
      await api.post(`/attendance/punch-${mode}`, { selfie, ...(loc || {}) });
      toast.success(mode === "in" ? "Punched in successfully" : "Punched out successfully");
      onDone();
      onClose();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" data-testid="punch-selfie-modal">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Punch {mode === "in" ? "In" : "Out"}</DialogTitle>
          <DialogDescription>Take a selfie and confirm your location.</DialogDescription>
        </DialogHeader>

        <div className="aspect-[4/3] rounded-xl overflow-hidden bg-slate-900 relative grid place-items-center">
          {selfie ? (
            <img src={selfie} alt="Selfie" className="w-full h-full object-cover" data-testid="selfie-preview" />
          ) : stream ? (
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover -scale-x-100" />
          ) : (
            <div className="text-slate-400 text-sm px-6 text-center">{camErr || "Starting camera…"}</div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {!selfie && stream && <Button onClick={capture} data-testid="capture-selfie-btn" className="flex-1"><Camera size={16} className="mr-2" />Capture</Button>}
          {selfie && <Button variant="outline" onClick={() => setSelfie(null)} data-testid="retake-selfie-btn" className="flex-1"><RotateCcw size={16} className="mr-2" />Retake</Button>}
          {!selfie && (
            <label className="flex-1 inline-flex items-center justify-center h-10 rounded-md border text-sm font-medium cursor-pointer hover:bg-slate-50">
              <Upload size={16} className="mr-2" />Upload photo
              <input type="file" accept="image/*" capture="user" className="hidden" onChange={onFile} data-testid="selfie-file-input" />
            </label>
          )}
        </div>

        <div className={`flex items-start gap-2 rounded-lg p-3 text-sm ${loc ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`} data-testid="gps-status">
          <MapPin size={16} className="mt-0.5 shrink-0" />
          {loc ? <span className="font-mono text-xs">Location verified · {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)} (±{Math.round(loc.accuracy)}m)</span>
            : <span>{locErr || "Fetching GPS location…"}</span>}
        </div>

        <Button onClick={confirm} disabled={!selfie || busy} data-testid="confirm-punch-btn" className="w-full h-11">
          {busy && <Loader2 size={16} className="mr-2 animate-spin" />}Confirm Punch {mode === "in" ? "In" : "Out"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
