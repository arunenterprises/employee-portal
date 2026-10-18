# Login activity feature: sessions, login/logout/failed logs with IP, admin endpoints, auth regressions
import os
import time
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN = {"identifier": "arunenterprises2023@gmail.com", "password": "WorkPulse@2026"}
PWD = "TestPass@123"
IST = timezone(timedelta(hours=5, minutes=30))


def today():
    return datetime.now(IST).strftime("%Y-%m-%d")


@pytest.fixture(scope="module")
def admin_h():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def _mk_emp(admin_h, suffix):
    eid = f"TEST_LA{suffix}{uuid.uuid4().hex[:4].upper()}"
    r = requests.post(f"{BASE_URL}/api/admin/employees", headers=admin_h,
                      json={"employee_id": eid, "name": f"TEST LoginAct {suffix}", "email": f"{eid.lower()}@test.com", "password": PWD})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def emps(admin_h):
    created = {k: _mk_emp(admin_h, k) for k in ("A", "B", "C", "D")}
    yield created
    for e in created.values():
        requests.delete(f"{BASE_URL}/api/admin/employees/{e['id']}", headers=admin_h)


def login(ident, pwd=PWD, ip=None, ua="pytest-agent/1.0"):
    h = {"User-Agent": ua}
    if ip:
        h["X-Forwarded-For"] = ip
    return requests.post(f"{BASE_URL}/api/auth/login", json={"identifier": ident, "password": pwd}, headers=h)


def logs(admin_h, **params):
    r = requests.get(f"{BASE_URL}/api/admin/login-activity/logs", headers=admin_h, params=params)
    assert r.status_code == 200, r.text
    return r.json()


def sessions(admin_h):
    r = requests.get(f"{BASE_URL}/api/admin/login-activity/sessions", headers=admin_h)
    assert r.status_code == 200, r.text
    return r.json()


class TestLoginActivity:
    def test_login_creates_session_and_log(self, admin_h, emps):
        e = emps["A"]
        r = login(e["employee_id"], ua="Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 pytest")
        assert r.status_code == 200
        tok = r.json()["token"]
        me = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {tok}"})
        assert me.status_code == 200 and me.json().get("sid")
        s = sessions(admin_h)
        assert s["online_minutes"] == 15
        mine = [x for x in s["sessions"] if x["user_id"] == e["id"]]
        assert len(mine) == 1
        m = mine[0]
        assert m["status"] == "online"
        assert m["ip"], "ip empty"
        assert "pytest" in m["user_agent"]
        assert m["employee"]["employee_id"] == e["employee_id"] and m["employee"]["name"] == e["name"]
        assert m["login_at"] and m["last_seen"] and m["logout_at"] is None
        print("session ip:", m["ip"])
        lg = logs(admin_h, user_id=e["id"], type="login", date=today())
        assert len(lg) == 1 and lg[0]["ip"] and lg[0]["type"] == "login"
        assert lg[0]["employee"]["employee_id"] == e["employee_id"]

    def test_wrong_password_failed_log(self, admin_h, emps):
        e = emps["B"]
        r = login(e["employee_id"], pwd="nope-wrong")
        assert r.status_code == 401
        lg = logs(admin_h, user_id=e["id"], type="failed")
        assert len(lg) >= 1 and lg[0]["detail"] == "Wrong password" and lg[0]["ip"]

    def test_unknown_user_failed_log(self, admin_h):
        ident = f"TEST_NOUSER_{uuid.uuid4().hex[:6]}"
        assert login(ident, pwd="xxxxxx").status_code == 401
        lg = [x for x in logs(admin_h, type="failed", date=today()) if x["identifier"] == ident]
        assert len(lg) == 1 and lg[0]["detail"] == "Unknown user" and lg[0]["user_id"] is None

    def test_logout_ends_session(self, admin_h, emps):
        e = emps["C"]
        tok = login(e["employee_id"]).json()["token"]
        h = {"Authorization": f"Bearer {tok}"}
        assert any(x["user_id"] == e["id"] for x in sessions(admin_h)["sessions"])
        r = requests.post(f"{BASE_URL}/api/auth/logout", headers=h)
        assert r.status_code == 200 and r.json()["ok"] is True
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=h)
        assert me.status_code == 401
        assert not any(x["user_id"] == e["id"] for x in sessions(admin_h)["sessions"])
        lo = logs(admin_h, user_id=e["id"], type="logout")
        assert len(lo) == 1 and lo[0]["ip"]
        # second logout with same token -> 401
        assert requests.post(f"{BASE_URL}/api/auth/logout", headers=h).status_code == 401

    def test_logs_filters(self, admin_h, emps):
        e = emps["A"]
        all_e = logs(admin_h, user_id=e["id"])
        assert all(x["user_id"] == e["id"] for x in all_e)
        for t in ("login", "logout", "failed"):
            assert all(x["type"] == t for x in logs(admin_h, type=t, date=today()))
        assert logs(admin_h, date="2000-01-01") == []
        r = requests.get(f"{BASE_URL}/api/admin/login-activity/logs", headers=admin_h, params={"date": "bad"})
        assert r.status_code == 400
        # admin logs excluded
        assert all(x.get("identifier", "").lower() != ADMIN["identifier"] for x in logs(admin_h, date=today()))

    def test_employee_forbidden(self, emps):
        tok = login(emps["A"]["employee_id"]).json()["token"]
        h = {"Authorization": f"Bearer {tok}"}
        assert requests.get(f"{BASE_URL}/api/admin/login-activity/sessions", headers=h).status_code == 403
        assert requests.get(f"{BASE_URL}/api/admin/login-activity/logs", headers=h).status_code == 403
        assert requests.get(f"{BASE_URL}/api/admin/login-activity/logs").status_code == 401

    def test_admin_session_not_listed(self, admin_h):
        assert all(x["role"] == "employee" for x in sessions(admin_h)["sessions"])


class TestAuthRegression:
    def test_portal_disabled_blocked(self, admin_h, emps):
        e = emps["D"]
        tok = login(e["employee_id"]).json()["token"]
        r = requests.patch(f"{BASE_URL}/api/admin/employees/{e['id']}/access", headers=admin_h, json={"enabled": False})
        assert r.status_code == 200
        assert login(e["employee_id"]).status_code == 403
        assert requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {tok}"}).status_code == 401
        fl = logs(admin_h, user_id=e["id"], type="failed")
        assert fl[0]["detail"] == "Portal access disabled"
        # report: does the session still appear in Logged in now?
        still = [x for x in sessions(admin_h)["sessions"] if x["user_id"] == e["id"]]
        print("disabled employee still listed in sessions:", len(still))
        requests.patch(f"{BASE_URL}/api/admin/employees/{e['id']}/access", headers=admin_h, json={"enabled": True})

    def test_inactive_blocked(self, admin_h, emps):
        e = emps["D"]
        r = requests.put(f"{BASE_URL}/api/admin/employees/{e['id']}", headers=admin_h,
                         json={"employee_id": e["employee_id"], "name": e["name"], "email": e["email"], "active": False})
        assert r.status_code == 200
        assert login(e["employee_id"]).status_code == 403
        assert logs(admin_h, user_id=e["id"], type="failed")[0]["detail"] == "Account inactive"
        requests.put(f"{BASE_URL}/api/admin/employees/{e['id']}", headers=admin_h,
                     json={"employee_id": e["employee_id"], "name": e["name"], "email": e["email"], "active": True})

    def test_lockout_after_5(self, admin_h, emps):
        e = emps["B"]
        for _ in range(5):
            login(e["employee_id"], pwd="bad-pass")
        r = login(e["employee_id"])
        assert r.status_code == 429
        fl = logs(admin_h, user_id=e["id"], type="failed")
        assert fl[0]["detail"].startswith("Locked")
        # unlock by admin reset
        requests.post(f"{BASE_URL}/api/admin/employees/{e['id']}/reset-password", headers=admin_h, json={"new_password": PWD})
        assert login(e["employee_id"]).status_code == 200

    def test_admin_login_and_me(self, admin_h):
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=admin_h)
        assert me.status_code == 200 and me.json()["role"] == "admin"

    def test_deleted_employee_session_orphan(self, admin_h):
        e = _mk_emp(admin_h, "X")
        assert login(e["employee_id"]).status_code == 200
        requests.delete(f"{BASE_URL}/api/admin/employees/{e['id']}", headers=admin_h)
        orphan = [x for x in sessions(admin_h)["sessions"] if x["user_id"] == e["id"]]
        print("orphan sessions after delete:", orphan)
        assert not orphan, "Deleted employee's session still listed in Logged in now (employee=None)"
