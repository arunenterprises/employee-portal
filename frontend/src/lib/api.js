import axios from "axios";

export const TOKEN_KEY = "wp_token";

export const api = axios.create({ baseURL: `${process.env.REACT_APP_BACKEND_URL}/api` });

api.interceptors.request.use((config) => {
  const t = localStorage.getItem(TOKEN_KEY);
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (e) => {
    if (e.response?.status === 401 && !e.config.url.includes("/auth/login")) {
      localStorage.removeItem(TOKEN_KEY);
      if (window.location.pathname !== "/login") window.location.href = "/login";
    }
    return Promise.reject(e);
  }
);

export function errMsg(e) {
  const d = e?.response?.data?.detail;
  if (d == null) return e?.message || "Something went wrong. Please try again.";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x?.msg || JSON.stringify(x)).join(" ");
  return d.msg || String(d);
}

export async function downloadPayslip(id, month) {
  const r = await api.get(`/payslips/${id}/pdf`, { responseType: "blob" });
  const url = URL.createObjectURL(r.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = `payslip-${month}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const fmtINR = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

export const fmtTime = (iso) =>
  iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "—";

export const fmtLate = (m) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);

export const fmtDate = (s) =>
  s ? new Date(s.length === 10 ? `${s}T00:00:00` : s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export const monthLabel = (m) =>
  m ? new Date(`${m}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "—";

export const fmtHours = (min) => (min ? `${Math.floor(min / 60)}h ${min % 60}m` : "—");

export const localDate = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};

export const mapLink = (p) => (p?.lat != null ? `https://www.google.com/maps?q=${p.lat},${p.lng}` : null);
