# Employee Portal API regression tests: auth, employees, service records, attendance, requests, payslips, RBAC
import os
import io
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN = {"identifier": "arunenterprises2023@gmail.com", "password": "WorkPulse@2026"}
SELFIE = "data:image/jpeg;base64," + "/9j/4AAQSkZJRgABAQ" * 10
TAG = uuid.uuid4().hex[:4].upper()


def login(identifier, password):
    return requests.post(f"{API}/auth/login", json={"identifier": identifier, "password": password})


def hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def admin():
    r = login(**ADMIN)
    assert r.status_code == 200, r.text
    return hdr(r.json()["token"])


def emp_payload(n, **kw):
    d = {"employee_id": f"TEST_E{TAG}{n}", "name": f"TEST_Emp{n}", "email": f"test_e{TAG.lower()}{n}@example.com",
         "password": "Passw0rd!", "department": "Ops", "designation": "Engineer", "joining_date": "2024-01-15",
         "basic": 20000, "hra": 8000, "allowances": 2000}
    d.update(kw)
    return d


@pytest.fixture(scope="module")
def emps(admin):
    created = []
    for n in ("1", "2"):
        r = requests.post(f"{API}/admin/employees", json=emp_payload(n), headers=admin)
        assert r.status_code == 200, r.text
        created.append(r.json())
    yield created
    for e in created:
        requests.delete(f"{API}/admin/employees/{e['id']}", headers=admin)


@pytest.fixture(scope="module")
def e1tok(emps):
    r = login(emps[0]["employee_id"].lower(), "Passw0rd!")
    assert r.status_code == 200, r.text
    return hdr(r.json()["token"])


@pytest.fixture(scope="module")
def e2tok(emps):
    r = login(emps[1]["email"].upper(), "Passw0rd!")
    assert r.status_code == 200, r.text
    return hdr(r.json()["token"])


# Auth
class TestAuth:
    def test_admin_login_and_me(self, admin):
        r = requests.get(f"{API}/auth/me", headers=admin)
        assert r.status_code == 200 and r.json()["role"] == "admin"
        assert "password_hash" not in r.json()

    def test_admin_stats(self, admin):
        r = requests.get(f"{API}/admin/stats", headers=admin)
        assert r.status_code == 200
        assert set(["employees", "present_today", "pending_requests", "on_leave_today"]) <= set(r.json())

    def test_invalid_login(self):
        r = login("nobody_test@example.com", "x")
        assert r.status_code == 401

    def test_no_token(self):
        assert requests.get(f"{API}/auth/me").status_code == 401

    def test_bruteforce_429(self):
        ident = f"bf_{uuid.uuid4().hex[:6]}@example.com"
        codes = [login(ident, "wrong").status_code for _ in range(6)]
        assert codes[:5] == [401] * 5, codes
        assert codes[5] == 429, codes


# Employees + service records
class TestEmployees:
    def test_login_by_id_and_email(self, e1tok, e2tok):
        assert requests.get(f"{API}/auth/me", headers=e1tok).json()["role"] == "employee"
        assert requests.get(f"{API}/auth/me", headers=e2tok).json()["role"] == "employee"

    def test_duplicate_rejected(self, admin, emps):
        r = requests.post(f"{API}/admin/employees", json=emp_payload("1"), headers=admin)
        assert r.status_code == 400

    def test_short_password_rejected(self, admin):
        r = requests.post(f"{API}/admin/employees", json=emp_payload("9", password="123"), headers=admin)
        assert r.status_code == 400

    def test_joining_service_record(self, admin, emps):
        r = requests.get(f"{API}/admin/service-records", params={"user_id": emps[0]["id"]}, headers=admin)
        assert r.status_code == 200
        assert any(x["type"] == "joining" and x["date"] == "2024-01-15" for x in r.json())

    def test_update_employee(self, admin, emps):
        p = emp_payload("1", designation="Senior Engineer", password="")
        r = requests.put(f"{API}/admin/employees/{emps[0]['id']}", json=p, headers=admin)
        assert r.status_code == 200 and r.json()["designation"] == "Senior Engineer"
        g = requests.get(f"{API}/admin/employees/{emps[0]['id']}", headers=admin).json()
        assert g["designation"] == "Senior Engineer"
        # password unchanged
        assert login(emps[0]["employee_id"], "Passw0rd!").status_code == 200

    def test_service_record_add_delete(self, admin, emps, e1tok):
        r = requests.post(f"{API}/admin/service-records", json={"user_id": emps[0]["id"], "date": "2025-04-01", "type": "promotion", "title": "TEST_Promoted"}, headers=admin)
        assert r.status_code == 200
        rid = r.json()["id"]
        mine = requests.get(f"{API}/service-records", headers=e1tok).json()
        assert any(x["id"] == rid for x in mine)
        assert requests.delete(f"{API}/admin/service-records/{rid}", headers=admin).status_code == 200
        mine = requests.get(f"{API}/service-records", headers=e1tok).json()
        assert not any(x["id"] == rid for x in mine)

    def test_employee_forbidden_admin(self, e1tok):
        for path in ("/admin/employees", "/admin/stats", "/admin/attendance", "/admin/requests", "/admin/payslips"):
            assert requests.get(f"{API}{path}", headers=e1tok).status_code == 403, path

    def test_inactive_cannot_login(self, admin):
        r = requests.post(f"{API}/admin/employees", json=emp_payload("3", active=False), headers=admin)
        assert r.status_code == 200
        try:
            assert login(r.json()["employee_id"], "Passw0rd!").status_code == 403
        finally:
            requests.delete(f"{API}/admin/employees/{r.json()['id']}", headers=admin)


# Attendance
class TestAttendance:
    def test_punch_out_before_in(self, e2tok):
        r = requests.post(f"{API}/attendance/punch-out", json={"selfie": SELFIE}, headers=e2tok)
        assert r.status_code == 400

    def test_invalid_selfie(self, e1tok):
        r = requests.post(f"{API}/attendance/punch-in", json={"selfie": "notimage"}, headers=e1tok)
        assert r.status_code == 400

    def test_punch_flow(self, e1tok, admin, emps):
        r = requests.post(f"{API}/attendance/punch-in", json={"selfie": SELFIE, "lat": 28.6, "lng": 77.2, "accuracy": 10}, headers=e1tok)
        assert r.status_code == 200, r.text
        assert r.json()["punch_in"]["lat"] == 28.6
        assert requests.post(f"{API}/attendance/punch-in", json={"selfie": SELFIE}, headers=e1tok).status_code == 400
        r = requests.post(f"{API}/attendance/punch-out", json={"selfie": SELFIE, "lat": 28.6, "lng": 77.2}, headers=e1tok)
        assert r.status_code == 200 and isinstance(r.json()["work_minutes"], int)
        assert requests.post(f"{API}/attendance/punch-out", json={"selfie": SELFIE}, headers=e1tok).status_code == 400
        today = requests.get(f"{API}/attendance/today", headers=e1tok).json()
        assert today and today["punch_out"]
        mine = requests.get(f"{API}/attendance", headers=e1tok).json()
        assert len(mine) == 1
        alla = requests.get(f"{API}/admin/attendance", params={"date": today["date"], "user_id": emps[0]["id"]}, headers=admin).json()
        assert len(alla) == 1 and alla[0]["employee"]["employee_id"] == emps[0]["employee_id"]


# Requests
class TestRequests:
    def test_leave_validation(self, e1tok):
        r = requests.post(f"{API}/requests", json={"type": "leave", "start_date": "2026-02-10", "end_date": "2026-02-08"}, headers=e1tok)
        assert r.status_code == 400
        r = requests.post(f"{API}/requests", json={"type": "leave", "start_date": "", "end_date": ""}, headers=e1tok)
        assert r.status_code == 400

    def test_other_validations(self, e1tok):
        assert requests.post(f"{API}/requests", json={"type": "advance", "amount": 0}, headers=e1tok).status_code == 400
        assert requests.post(f"{API}/requests", json={"type": "payslip", "month": ""}, headers=e1tok).status_code == 400
        assert requests.post(f"{API}/requests", json={"type": "other", "subject": "  "}, headers=e1tok).status_code == 400

    def test_leave_approve_flow(self, e1tok, admin):
        r = requests.post(f"{API}/requests", json={"type": "leave", "leave_type": "Casual", "start_date": "2026-02-10", "end_date": "2026-02-12", "reason": "TEST"}, headers=e1tok)
        assert r.status_code == 200 and r.json()["days"] == 3 and r.json()["status"] == "pending"
        rid = r.json()["id"]
        d = requests.patch(f"{API}/admin/requests/{rid}", json={"status": "approved", "admin_comment": "OK enjoy"}, headers=admin)
        assert d.status_code == 200 and d.json()["status"] == "approved"
        mine = {x["id"]: x for x in requests.get(f"{API}/requests", headers=e1tok).json()}
        assert mine[rid]["status"] == "approved" and mine[rid]["admin_comment"] == "OK enjoy"
        # cannot decide again or cancel
        assert requests.patch(f"{API}/admin/requests/{rid}", json={"status": "rejected"}, headers=admin).status_code == 400
        assert requests.delete(f"{API}/requests/{rid}", headers=e1tok).status_code == 400
        assert requests.get(f"{API}/me/summary", headers=e1tok).json()["leave_days_year"] >= 3

    def test_advance_reject_and_cancel(self, e1tok, e2tok, admin):
        r = requests.post(f"{API}/requests", json={"type": "advance", "amount": 5000, "repayment": "2 months"}, headers=e1tok)
        assert r.status_code == 200
        d = requests.patch(f"{API}/admin/requests/{r.json()['id']}", json={"status": "rejected", "admin_comment": "No"}, headers=admin)
        assert d.json()["status"] == "rejected"
        o = requests.post(f"{API}/requests", json={"type": "other", "subject": "TEST_ID card"}, headers=e1tok).json()
        # other employee cannot cancel
        assert requests.delete(f"{API}/requests/{o['id']}", headers=e2tok).status_code == 400
        assert requests.delete(f"{API}/requests/{o['id']}", headers=e1tok).status_code == 200
        mine = [x["id"] for x in requests.get(f"{API}/requests", headers=e1tok).json()]
        assert o["id"] not in mine

    def test_admin_filters(self, admin):
        r = requests.get(f"{API}/admin/requests", params={"status": "approved", "type": "leave"}, headers=admin)
        assert r.status_code == 200 and all(x["status"] == "approved" and x["type"] == "leave" for x in r.json())


# Payslips
class TestPayslips:
    def test_generate_autoapproves_and_pdf(self, e1tok, e2tok, admin, emps):
        req = requests.post(f"{API}/requests", json={"type": "payslip", "month": "2025-12"}, headers=e1tok).json()
        body = {"user_id": emps[0]["id"], "month": "2025-12", "working_days": 26, "paid_days": 26,
                "earnings": [{"label": "Basic", "amount": 20000}, {"label": "HRA", "amount": 8000}],
                "deductions": [{"label": "PF", "amount": 1800}]}
        r = requests.post(f"{API}/admin/payslips/generate", json=body, headers=admin)
        assert r.status_code == 200, r.text
        s = r.json()
        assert s["gross"] == 28000 and s["total_deductions"] == 1800 and s["net"] == 26200
        mine = {x["id"]: x for x in requests.get(f"{API}/requests", headers=e1tok).json()}
        assert mine[req["id"]]["status"] == "approved"
        pdf = requests.get(f"{API}/payslips/{s['id']}/pdf", headers=e1tok)
        assert pdf.status_code == 200 and pdf.headers["content-type"].startswith("application/pdf") and pdf.content[:4] == b"%PDF"
        assert requests.get(f"{API}/payslips/{s['id']}/pdf", headers=e2tok).status_code in (403, 404)
        assert requests.get(f"{API}/payslips/{s['id']}/pdf", headers=admin).status_code == 200

    def test_bad_month(self, admin, emps):
        r = requests.post(f"{API}/admin/payslips/generate", json={"user_id": emps[0]["id"], "month": "12-2025", "earnings": []}, headers=admin)
        assert r.status_code == 400

    def test_upload_pdf(self, admin, emps, e2tok):
        pdfbytes = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"
        r = requests.post(f"{API}/admin/payslips/upload", data={"user_id": emps[1]["id"], "month": "2025-11", "net": "15000"},
                          files={"file": ("slip.pdf", io.BytesIO(pdfbytes), "application/pdf")}, headers=admin)
        assert r.status_code == 200, r.text
        sid = r.json()["id"]
        lst = requests.get(f"{API}/payslips", headers=e2tok).json()
        assert any(x["id"] == sid and x["kind"] == "uploaded" for x in lst)
        d = requests.get(f"{API}/payslips/{sid}/pdf", headers=e2tok)
        assert d.status_code == 200 and d.content == pdfbytes
        bad = requests.post(f"{API}/admin/payslips/upload", data={"user_id": emps[1]["id"], "month": "2025-11"},
                            files={"file": ("x.pdf", io.BytesIO(b"hello"), "application/pdf")}, headers=admin)
        assert bad.status_code == 400

    def test_summary(self, e1tok):
        r = requests.get(f"{API}/me/summary", headers=e1tok)
        assert r.status_code == 200 and r.json()["last_payslip"]["month"] == "2025-12"  # depends on generate test in same class

    def test_change_password(self, e2tok, emps):
        assert requests.post(f"{API}/auth/change-password", json={"current_password": "bad", "new_password": "NewPass1"}, headers=e2tok).status_code == 400
        assert requests.post(f"{API}/auth/change-password", json={"current_password": "Passw0rd!", "new_password": "NewPass1"}, headers=e2tok).status_code == 200
        assert login(emps[1]["employee_id"], "NewPass1").status_code == 200


# Cascade delete
def test_cascade_delete(admin):
    r = requests.post(f"{API}/admin/employees", json=emp_payload("4"), headers=admin).json()
    assert requests.delete(f"{API}/admin/employees/{r['id']}", headers=admin).status_code == 200
    assert requests.get(f"{API}/admin/employees/{r['id']}", headers=admin).status_code == 404
    assert requests.get(f"{API}/admin/service-records", params={"user_id": r["id"]}, headers=admin).json() == []
