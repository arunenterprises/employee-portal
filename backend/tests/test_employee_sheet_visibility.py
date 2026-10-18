# Employee attendance sheet visibility toggle (admin switch) + /attendance/my-sheet
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN = {"identifier": "arunenterprises2023@gmail.com", "password": "WorkPulse@2026"}


@pytest.fixture(scope="module")
def admin_h():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def emp(admin_h):
    eid = f"TEST_SHEET_{uuid.uuid4().hex[:6]}"
    r = requests.post(f"{BASE_URL}/api/admin/employees", headers=admin_h,
                      json={"employee_id": eid, "name": "TEST Sheet Emp", "email": f"{eid.lower()}@example.com", "password": "Test@1234"})
    assert r.status_code in (200, 201), r.text
    uid = r.json().get("id")
    lr = requests.post(f"{BASE_URL}/api/auth/login", json={"identifier": eid, "password": "Test@1234"})
    assert lr.status_code == 200, lr.text
    yield {"id": uid, "h": {"Authorization": f"Bearer {lr.json()['token']}"}}
    requests.put(f"{BASE_URL}/api/admin/settings/employee-sheet", headers=admin_h, json={"enabled": False})
    requests.delete(f"{BASE_URL}/api/admin/employees/{uid}", headers=admin_h)


def test_toggle_on_persists(admin_h):
    r = requests.put(f"{BASE_URL}/api/admin/settings/employee-sheet", headers=admin_h, json={"enabled": True})
    assert r.status_code == 200 and r.json()["enabled"] is True
    g = requests.get(f"{BASE_URL}/api/admin/settings/employee-sheet", headers=admin_h)
    assert g.json()["enabled"] is True


def test_my_sheet_on(admin_h, emp):
    requests.put(f"{BASE_URL}/api/admin/settings/employee-sheet", headers=admin_h, json={"enabled": True})
    r = requests.get(f"{BASE_URL}/api/attendance/my-sheet", headers=emp["h"])
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["enabled"] is True and len(d["months"]) == 2
    m0, m1 = d["months"]
    assert m0["month"] < m1["month"]
    for m in d["months"]:
        assert isinstance(m["cells"], dict) and isinstance(m["totals"], dict) and m["days"] in (28, 29, 30, 31)
    print([m["month"] for m in d["months"]])


def test_my_sheet_off(admin_h, emp):
    requests.put(f"{BASE_URL}/api/admin/settings/employee-sheet", headers=admin_h, json={"enabled": False})
    assert requests.get(f"{BASE_URL}/api/admin/settings/employee-sheet", headers=admin_h).json()["enabled"] is False
    r = requests.get(f"{BASE_URL}/api/attendance/my-sheet", headers=emp["h"])
    assert r.status_code == 200 and r.json() == {"enabled": False, "months": []}


def test_employee_cannot_toggle(emp):
    r = requests.put(f"{BASE_URL}/api/admin/settings/employee-sheet", headers=emp["h"], json={"enabled": True})
    assert r.status_code == 403
    assert requests.get(f"{BASE_URL}/api/admin/settings/employee-sheet", headers=emp["h"]).status_code == 403


def test_unauth_and_validation(admin_h):
    assert requests.get(f"{BASE_URL}/api/attendance/my-sheet").status_code in (401, 403)
    assert requests.put(f"{BASE_URL}/api/admin/settings/employee-sheet", json={"enabled": True}).status_code in (401, 403)
    assert requests.put(f"{BASE_URL}/api/admin/settings/employee-sheet", headers=admin_h, json={}).status_code == 422


def test_admin_my_sheet_forbidden(admin_h):
    # admin is not an employee -> my-sheet should be rejected
    r = requests.get(f"{BASE_URL}/api/attendance/my-sheet", headers=admin_h)
    print(r.status_code)
    assert r.status_code in (401, 403)
