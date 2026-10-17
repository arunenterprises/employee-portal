# Late mark + Missed Punch request tests (iteration 3). Uses only TEST_ employees.
import os
import uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN = {"identifier": "arunenterprises2023@gmail.com", "password": "WorkPulse@2026"}
SELFIE = "data:image/jpeg;base64," + "/9j/4AAQSkZJRgABAQ" * 10
TAG = uuid.uuid4().hex[:4].upper()
TZ = ZoneInfo("Asia/Kolkata")
TODAY = datetime.now(TZ).date()
D1 = (TODAY - timedelta(days=1)).isoformat()
D2 = (TODAY - timedelta(days=2)).isoformat()
D3 = (TODAY - timedelta(days=3)).isoformat()
FUT = (TODAY + timedelta(days=1)).isoformat()


def hdr(t):
    return {"Authorization": f"Bearer {t}"}


def login(identifier, password):
    return requests.post(f"{API}/auth/login", json={"identifier": identifier, "password": password})


@pytest.fixture(scope="module")
def admin():
    r = login(**ADMIN)
    assert r.status_code == 200, r.text
    return hdr(r.json()["token"])


@pytest.fixture(scope="module")
def emp(admin):
    d = {"employee_id": f"TEST_L{TAG}", "name": f"TEST_Late{TAG}", "email": f"test_l{TAG.lower()}@example.com",
         "password": "Passw0rd!", "department": "Ops", "designation": "Eng", "joining_date": "2024-01-15",
         "basic": 20000, "hra": 8000, "allowances": 2000}
    r = requests.post(f"{API}/admin/employees", json=d, headers=admin)
    assert r.status_code == 200, r.text
    e = r.json()
    tok = hdr(login(d["employee_id"], "Passw0rd!").json()["token"])
    yield e, tok
    requests.delete(f"{API}/admin/employees/{e['id']}", headers=admin)


def mp(tok, **kw):
    body = {"type": "missed_punch", "reason": "TEST_ forgot"}
    body.update(kw)
    return requests.post(f"{API}/requests", json=body, headers=tok)


class TestLate:
    def test_config(self, emp):
        r = requests.get(f"{API}/attendance/config", headers=emp[1])
        assert r.status_code == 200
        j = r.json()
        assert j["windows"]["in"] == ["00:00", "00:01"] and j["auto_submit_seconds"] == 30

    def test_punch_in_requires_latlng(self, emp):
        r = requests.post(f"{API}/attendance/punch-in", json={"selfie": SELFIE}, headers=emp[1])
        assert r.status_code == 422

    def test_late_punch_in_and_stats(self, emp, admin):
        before = requests.get(f"{API}/admin/stats", headers=admin).json()["late_today"]
        r = requests.post(f"{API}/attendance/punch-in", json={"selfie": SELFIE, "lat": 28.6, "lng": 77.2}, headers=emp[1])
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["late"] is True and j["late_minutes"] > 0
        after = requests.get(f"{API}/admin/stats", headers=admin).json()["late_today"]
        assert after == before + 1
        rows = requests.get(f"{API}/admin/attendance", params={"date": j["date"], "user_id": emp[0]["id"]}, headers=admin).json()
        assert rows[0]["late"] is True

    def test_missed_in_today_rejected_already_punched(self, emp):
        r = mp(emp[1], punch_date=TODAY.isoformat(), missed="in", in_time="09:00")
        assert r.status_code == 400, r.text


class TestMissedPunchValidation:
    def test_future(self, emp):
        assert mp(emp[1], punch_date=FUT, missed="both", in_time="09:00", out_time="18:00").status_code == 400

    def test_out_without_in(self, emp):
        r = mp(emp[1], punch_date=D1, missed="out", out_time="18:00")
        assert r.status_code == 400 and "Punch In" in r.json()["detail"]

    def test_out_le_in(self, emp):
        assert mp(emp[1], punch_date=D1, missed="both", in_time="18:00", out_time="09:00").status_code == 400
        assert mp(emp[1], punch_date=D1, missed="both", in_time="09:00", out_time="09:00").status_code == 400

    def test_bad_time_and_missing_missed(self, emp):
        assert mp(emp[1], punch_date=D1, missed="in", in_time="9am").status_code == 400
        assert mp(emp[1], punch_date=D1, in_time="09:00").status_code == 400
        assert mp(emp[1], punch_date="bad", missed="in", in_time="09:00").status_code == 400

    def test_duplicate_pending(self, emp):
        r = mp(emp[1], punch_date=D3, missed="in", in_time="09:00")
        assert r.status_code == 200, r.text
        assert mp(emp[1], punch_date=D3, missed="both", in_time="09:00", out_time="18:00").status_code == 400


class TestMissedPunchApproval:
    def test_approve_both_creates_attendance(self, emp, admin):
        r = mp(emp[1], punch_date=D1, missed="both", in_time="09:45", out_time="18:15")
        assert r.status_code == 200, r.text
        rid = r.json()["id"]
        d = requests.patch(f"{API}/admin/requests/{rid}", json={"status": "approved"}, headers=admin)
        assert d.status_code == 200 and d.json()["status"] == "approved"
        rows = requests.get(f"{API}/admin/attendance", params={"date": D1, "user_id": emp[0]["id"]}, headers=admin).json()
        assert len(rows) == 1
        a = rows[0]
        assert a["manual"] is True and a["punch_in"]["manual"] is True
        assert a["work_minutes"] == 510
        # in window end is 00:01 in test config -> 09:45 is late
        assert a["late"] is True and a["late_minutes"] == 9 * 60 + 44
        # now 'in' for same date rejected
        assert mp(emp[1], punch_date=D1, missed="in", in_time="09:00").status_code == 400
        assert mp(emp[1], punch_date=D1, missed="out", out_time="19:00").status_code == 400

    def test_approve_in_then_out(self, emp, admin):
        # D3 has pending 'in' from duplicate test -> approve it then raise out
        reqs = requests.get(f"{API}/admin/requests", params={"type": "missed_punch", "status": "pending"}, headers=admin).json()
        mine = [x for x in reqs if x["user_id"] == emp[0]["id"] and x["punch_date"] == D3]
        assert len(mine) == 1
        assert requests.patch(f"{API}/admin/requests/{mine[0]['id']}", json={"status": "approved"}, headers=admin).status_code == 200
        assert mp(emp[1], punch_date=D3, missed="out", out_time="08:00").status_code == 400
        r = mp(emp[1], punch_date=D3, missed="out", out_time="17:30")
        assert r.status_code == 200, r.text
        requests.patch(f"{API}/admin/requests/{r.json()['id']}", json={"status": "approved"}, headers=admin)
        a = requests.get(f"{API}/admin/attendance", params={"date": D3, "user_id": emp[0]["id"]}, headers=admin).json()[0]
        assert a["punch_out"]["manual"] is True and a["work_minutes"] == 510

    def test_reject_no_attendance(self, emp, admin):
        r = mp(emp[1], punch_date=D2, missed="both", in_time="09:00", out_time="18:00")
        assert r.status_code == 200
        d = requests.patch(f"{API}/admin/requests/{r.json()['id']}", json={"status": "rejected"}, headers=admin)
        assert d.json()["status"] == "rejected"
        rows = requests.get(f"{API}/admin/attendance", params={"date": D2, "user_id": emp[0]["id"]}, headers=admin).json()
        assert rows == []

    def test_today_punch_out_and_employee_list(self, emp):
        r = requests.post(f"{API}/attendance/punch-out", json={"selfie": SELFIE, "lat": 28.6, "lng": 77.2}, headers=emp[1])
        assert r.status_code == 200, r.text
        assert r.json()["late"] is True
        mine = requests.get(f"{API}/attendance", headers=emp[1]).json()
        assert len(mine) == 3

    def test_regression_leave_advance(self, emp, admin):
        r = requests.post(f"{API}/requests", json={"type": "leave", "leave_type": "casual", "start_date": D1, "end_date": D1, "reason": "x"}, headers=emp[1])
        assert r.status_code == 200 and r.json()["days"] == 1
        assert requests.patch(f"{API}/admin/requests/{r.json()['id']}", json={"status": "approved"}, headers=admin).json()["status"] == "approved"
        r = requests.post(f"{API}/requests", json={"type": "advance", "amount": 500, "reason": "x"}, headers=emp[1])
        assert r.status_code == 200
        assert requests.delete(f"{API}/requests/{r.json()['id']}", headers=emp[1]).status_code == 200
