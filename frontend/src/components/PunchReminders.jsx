import { useEffect, useState } from "react";
import { BellRing, BellOff, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/common";
import { api, errMsg } from "@/lib/api";

const toBytes = (v) => {
  const b64 = (v + "=".repeat((4 - (v.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
};
const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export const PunchReminders = () => {
  const [state, setState] = useState("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supported()) { setState("unsupported"); return; }
    if (Notification.permission === "denied") { setState("denied"); return; }
    navigator.serviceWorker.ready.then((r) => r.pushManager.getSubscription()).then((s) => setState(s ? "on" : "off")).catch(() => setState("off"));
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState(perm === "denied" ? "denied" : "off"); toast.error("Notification permission not given"); return; }
      const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      const { data } = await api.get("/push/public-key");
      const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(data.publicKey) }));
      await api.post("/push/subscribe", sub.toJSON());
      setState("on");
      toast.success("Punch reminders ON for this phone");
    } catch (e) { toast.error(errMsg(e) || e.message); } finally { setBusy(false); }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) { await api.post("/push/unsubscribe", sub.toJSON()); await sub.unsubscribe(); }
      setState("off");
      toast.success("Punch reminders OFF");
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  const test = async () => {
    try {
      const { data } = await api.post("/push/test");
      data.sent ? toast.success("Test notification sent") : toast.error("Could not send. Turn reminders off and on again.");
    } catch (e) { toast.error(errMsg(e)); }
  };

  const on = state === "on";
  return (
    <Panel className={`rise flex flex-col sm:flex-row sm:items-center gap-4 ${on ? "border-emerald-200 bg-emerald-50/40" : ""}`} data-testid="punch-reminders">
      <div className={`h-11 w-11 rounded-xl grid place-items-center shrink-0 ${on ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{on ? <BellRing size={20} /> : <BellOff size={20} />}</div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold">Punch reminders</div>
        <div className="text-sm text-muted-foreground" data-testid="punch-reminders-status">
          {state === "unsupported" ? "This browser does not support notifications. Install the app from Chrome (⋮ → Install app)."
            : state === "denied" ? "Notifications are blocked. Allow them in phone Settings → Apps → Chrome → Notifications."
            : on ? "ON · reminder at 9:10 AM to Punch In and 6:10 PM to Punch Out (Mon–Sat), only if you haven't punched."
            : "Get a phone notification at 9:10 AM and 6:10 PM if you forget to punch."}
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        {on && <Button variant="outline" size="sm" onClick={test} data-testid="punch-reminders-test"><Send size={14} className="mr-1.5" />Test</Button>}
        {on ? <Button variant="outline" size="sm" disabled={busy} onClick={disable} data-testid="punch-reminders-off">Turn off</Button>
          : <Button size="sm" disabled={busy || state === "unsupported" || state === "denied" || state === "loading"} onClick={enable} className="bg-emerald-600 hover:bg-emerald-700" data-testid="punch-reminders-on"><BellRing size={14} className="mr-1.5" />Turn on reminders</Button>}
      </div>
    </Panel>
  );
};
