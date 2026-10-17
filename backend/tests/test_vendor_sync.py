# Vendor Portal HR sync tests (read-only for real AE/EMP employees; writes only on TEST_ data)
import os
import re
import time
import uuid
import zlib
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
SECRET = os.environ.get("WEBHOOK_CRON_SECRET")
REAL_ID = "AE/EMP/000005/26-27"
REAL_PWD = "26011985"
TAG = uuid.uuid4().hex[:4].upper()


def hdr(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def admin():
    r = requests.post(f"{API}/auth/login", json={"identifier": "arunenterprises2023@gmail.com", "password": "WorkPulse@2026"})
    assert r.status_code == 200
    return r.json()["token"]


def vendor_emps(tok):
    r = requests.get(f"{API}/admin/employees", headers=hdr(tok))
    assert r.status_code == 200
    return [e for e in r.json() if e.get("source") == "vendor"]


# --- manual sync + idempotency ---
class TestManualSync:
    def test_sync_now_and_no_duplicates(self, admin):
        before = vendor_emps(admin)
        t0 = time.time()
        r = requests.post(f"{API}/admin/vendor-sync", headers=hdr(admin), timeout=150)
        print("sync took", round(time.time() - t0, 1), "s", r.text[:300])
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "success", d
        assert {"created", "updated", "attendance_months_pushed"} <= set(d["result"])
        after = vendor_emps(admin)
        assert len(after) == 9, [e["employee_id"] for e in after]
        if before:
            assert len(after) == len(before)
            assert d["result"]["created"] == 0
        for e in after:
            assert re.match(r"^AE/EMP/\d{6}/\d{2}-\d{2}$", e["employee_id"]), e["employee_id"]
            assert "password_hash" not in e and "_id" not in e
        ids = [e["employee_id"] for e in after]
        assert len(ids) == len(set(ids))

    def test_status(self, admin):
        r = requests.get(f"{API}/admin/vendor-sync/status", headers=hdr(admin))
        assert r.status_code == 200
        d = r.json()
        assert d["status"] in ("success", "running", "failed") and "started_at" in d and "id" in d and "_id" not in d

    def test_status_requires_admin(self):
        assert requests.get(f"{API}/admin/vendor-sync/status").status_code in (401, 403)
        assert requests.post(f"{API}/admin/vendor-sync").status_code in (401, 403)

    def test_real_employee_details(self, admin):
        e = next(x for x in vendor_emps(admin) if x["employee_id"] == REAL_ID)
        assert e["department"] == "Operations"
        assert e["designation"] == "Sr. Operation Manager"
        assert e["bank_name"] == "Central Bank of India"
        assert e.get("vendor_id")


# --- cron endpoint auth + dedupe ---
class TestCron:
    def test_no_auth(self):
        assert requests.post(f"{API}/cron/vendor-sync").status_code == 401

    def test_wrong_bearer(self):
        assert requests.post(f"{API}/cron/vendor-sync", headers={"Authorization": "Bearer nope"}).status_code == 401

    def test_valid_and_duplicate(self, admin):
        rid = f"TEST_run_{TAG}"
        h = {"Authorization": f"Bearer {SECRET}", "X-Webhook-Id": rid}
        r = requests.post(f"{API}/cron/vendor-sync", headers=h)
        assert r.status_code == 200 and r.json() == {"accepted": True}
        time.sleep(1)
        r2 = requests.post(f"{API}/cron/vendor-sync", headers=h)
        assert r2.status_code == 200 and r2.json().get("duplicate") is True
        # wait for background run to finish, then no duplicates
        for _ in range(30):
            s = requests.get(f"{API}/admin/vendor-sync/status", headers=hdr(admin)).json()
            if s.get("status") != "running":
                break
            time.sleep(2)
        print("cron status", s.get("status"), s.get("trigger"), s.get("result"), s.get("error"))
        assert s["status"] == "success"
        assert len(vendor_emps(admin)) == 9


# --- real synced employee login (read-only) ---
class TestRealLogin:
    @pytest.mark.parametrize("ident", [REAL_ID, REAL_ID.lower()])
    def test_login(self, ident):
        r = requests.post(f"{API}/auth/login", json={"identifier": ident, "password": REAL_PWD})
        assert r.status_code == 200, r.text
        u = r.json()["user"]
        assert u["employee_id"] == REAL_ID and u["role"] == "employee"
        assert u.get("must_change_password") is True
        assert u["department"] == "Operations"


# --- payslip PDF header for TEST_ employee ---
def _pdf_text(b: bytes) -> str:
    out = []
    for m in re.finditer(rb"stream\r?\n(.*?)\r?\nendstream", b, re.S):
        s = m.group(1)
        try:
            s = zlib.decompress(s)
        except Exception:
            try:
                import base64
                s = zlib.decompress(base64.a85decode(s.strip(), adobe=True))
            except Exception:
                pass
        out.append(s.decode("latin-1", "ignore"))
    return "\n".join(out)


def test_payslip_pdf_header(admin):
    p = {"employee_id": f"TEST_V{TAG}", "name": f"TEST_Vend{TAG}", "email": f"test_v{TAG.lower()}@example.com",
         "password": "Passw0rd!", "basic": 20000, "hra": 5000, "allowances": 1000}
    r = requests.post(f"{API}/admin/employees", headers=hdr(admin), json=p)
    assert r.status_code in (200, 201), r.text
    uid = r.json()["id"]
    try:
        g = requests.post(f"{API}/admin/payslips/generate", headers=hdr(admin),
                          json={"user_id": uid, "month": "2026-01", "working_days": 26, "paid_days": 26,
                                "earnings": [{"label": "Basic", "amount": 20000}], "deductions": [{"label": "PF", "amount": 1800}]})
        assert g.status_code in (200, 201), g.text
        sid = g.json()["id"]
        pdf = requests.get(f"{API}/payslips/{sid}/pdf", headers=hdr(admin))
        assert pdf.status_code == 200 and pdf.content[:4] == b"%PDF"
        import io
        from pypdf import PdfReader
        rd = PdfReader(io.BytesIO(pdf.content))
        txt = "\n".join(p.extract_text() for p in rd.pages)
        print(txt[:600])
        assert "ARUN ENTERPRISES" in txt
        assert "209H/1F/1, Ops Nagar, Kalindipuram, Prayagraj" in txt
        assert len(rd.pages[0].images) >= 1  # logo
    finally:
        requests.delete(f"{API}/admin/employees/{uid}", headers=hdr(admin))
