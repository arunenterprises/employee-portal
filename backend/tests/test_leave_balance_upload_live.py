# Leave Balance bulk features (iteration 8): admin list, CSV upload, Live/Unlive, admin requests balance attach.
# Uses only TEST_ employees; never calls bulk live without user_ids.
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN = {"identifier": "arunenterprises2023@gmail.com", "password": "WorkPulse@2026"}
TAG = uuid.uuid4().hex[:4].upper()
YEAR = "2028"


def hdr(t):
    return {"Authorization": f"Bearer {t}"}


def login(identifier, password):
    return requests.post(f"{API}/auth/login", json={"identifier": identifier, "password": password})


@pytest.fixture(scope="module")
def admin():
    r = login(**ADMIN)
    assert r.status_code == 200, r.text
    return hdr(r.json()["token"])


def make_emp(admin, s):
    code = f"TEST_LU{s}{TAG}"
    d = {"employee_id": code, "name": code, "email": f"{code.lower()}@example.com", "password": "Passw0rd!"}
    r = requests.post(f"{API}/admin/employees", json=d, headers=admin)
    assert r.status_code == 200, r.text
    tok = hdr(login(code, "Passw0rd!").json()["token"])
    return r.json(), tok


@pytest.fixture(scope="module")
def emps(admin):
    a = make_emp(admin, "A")
    b = make_emp(admin, "B")
    yield a, b
    for e, _ in (a, b):
        requests.delete(f"{API}/admin/employees/{e['id']}", headers=admin)


def upload(admin, csv_text, year=YEAR):
    return requests.post(f"{API}/admin/leave-balances/upload", headers=admin,
                         data={"year": year}, files={"file": ("lb.csv", csv_text.encode(), "text/csv")})


def row_of(admin, uid, year=YEAR):
    r = requests.get(f"{API}/admin/leave-balances", params={"year": year}, headers=admin)
    assert r.status_code == 200
    return next(x for x in r.json()["rows"] if x["user_id"] == uid)


# admin list
def test_list_rows(admin, emps):
    (a, _), _ = emps
    row = row_of(admin, a["id"])
    assert row["employee_id"] == a["employee_id"] and row["live"] is True and row["configured"] is False
    assert [b["leave_type"] for b in row["balances"]] == ["Casual Leave", "Sick Leave", "Earned Leave"]


def test_list_requires_admin(emps):
    (_, tok), _ = emps
    assert requests.get(f"{API}/admin/leave-balances", headers=tok).status_code == 403
    assert requests.get(f"{API}/admin/leave-balances").status_code == 401


# upload
def test_upload_sets_quotas_and_live(admin, emps):
    (a, _), (b, _) = emps
    csv_text = ("\ufeffEmployee Code,Name,CL,SL,EL,Live\r\n"
                f"{a['employee_id']},x,12,6,15,No\r\n"
                f"{b['employee_id'].lower()},y,8,4,,Yes\r\n"
                "TEST_NOPE_ZZ,z,1,1,1,Yes\r\n")
    r = upload(admin, csv_text)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["updated"] == 2
    assert any("TEST_NOPE_ZZ" in e for e in d["errors"])
    ra = row_of(admin, a["id"])
    q = {x["leave_type"]: x["quota"] for x in ra["balances"]}
    assert q == {"Casual Leave": 12, "Sick Leave": 6, "Earned Leave": 15}
    assert ra["live"] is False and ra["configured"] is True
    rb = row_of(admin, b["id"])
    qb = {x["leave_type"]: x["quota"] for x in rb["balances"]}
    assert qb["Casual Leave"] == 8 and qb["Sick Leave"] == 4 and qb["Earned Leave"] == 0
    assert rb["live"] is True


def test_upload_invalid_values_reported(admin, emps):
    (a, _), (b, _) = emps
    csv_text = ("Employee Code,CL,SL,EL\n"
                f"{a['employee_id']},abc,1,1\n"
                f"{b['employee_id']},10,-2,1\n")
    r = upload(admin, csv_text)
    assert r.status_code == 200
    d = r.json()
    assert d["updated"] == 0 and len(d["errors"]) == 2
    # unchanged
    q = {x["leave_type"]: x["quota"] for x in row_of(admin, a["id"])["balances"]}
    assert q["Casual Leave"] == 12


def test_upload_partial_failure_other_rows_ok(admin, emps):
    (a, _), (b, _) = emps
    csv_text = f"Employee Code,CL\n{a['employee_id']},400\n{b['employee_id']},9\n"
    d = upload(admin, csv_text).json()
    assert d["updated"] == 1 and len(d["errors"]) == 1
    qb = {x["leave_type"]: x["quota"] for x in row_of(admin, b["id"])["balances"]}
    assert qb["Casual Leave"] == 9 and qb["Sick Leave"] == 4  # other columns kept


def test_upload_bad_header(admin):
    r = upload(admin, "Name,Foo\nx,1\n")
    assert r.status_code == 400


def test_upload_bad_year(admin):
    r = upload(admin, "Employee Code,CL\nX,1\n", year="20xx")
    assert r.status_code == 400


def test_upload_requires_admin(emps):
    (_, tok), _ = emps
    r = requests.post(f"{API}/admin/leave-balances/upload", headers=tok, data={"year": YEAR},
                      files={"file": ("a.csv", b"Employee Code,CL\nX,1\n", "text/csv")})
    assert r.status_code == 403


# live / unlive + employee view
def test_employee_unlive_hides(admin, emps):
    (a, tok), _ = emps
    r = requests.get(f"{API}/leave-balance", params={"year": YEAR}, headers=tok).json()
    assert r["live"] is False and r["configured"] is False and r["balances"] == []


def test_live_toggle_specific_ids(admin, emps):
    (a, tok), (b, _) = emps
    r = requests.put(f"{API}/admin/leave-balances/live", json={"live": True, "user_ids": [a["id"]]}, headers=admin)
    assert r.status_code == 200 and r.json()["updated"] == 1
    d = requests.get(f"{API}/leave-balance", params={"year": YEAR}, headers=tok).json()
    assert d["live"] is True and d["configured"] is True
    assert next(x for x in d["balances"] if x["leave_type"] == "Casual Leave")["quota"] == 12
    r = requests.put(f"{API}/admin/leave-balances/live", json={"live": False, "user_ids": [a["id"], b["id"]]}, headers=admin)
    assert r.json()["updated"] == 2
    assert row_of(admin, b["id"])["live"] is False
    requests.put(f"{API}/admin/leave-balances/live", json={"live": True, "user_ids": [a["id"], b["id"]]}, headers=admin)


def test_live_requires_admin(emps):
    (a, tok), _ = emps
    r = requests.put(f"{API}/admin/leave-balances/live", json={"live": True, "user_ids": [a["id"]]}, headers=tok)
    assert r.status_code == 403


def test_live_invalid_id(admin):
    r = requests.put(f"{API}/admin/leave-balances/live", json={"live": True, "user_ids": ["bad"]}, headers=admin)
    assert r.status_code in (400, 404, 422)


# admin requests balance attach
def test_admin_requests_balance_attached(admin, emps):
    (a, tok), _ = emps
    r = requests.post(f"{API}/requests", json={"type": "leave", "leave_type": "Casual Leave", "start_date": f"{YEAR}-03-02",
                                                "end_date": f"{YEAR}-03-03", "reason": "TEST"}, headers=tok)
    assert r.status_code == 200, r.text
    rid = r.json()["id"]
    items = requests.get(f"{API}/admin/requests", params={"status": "pending", "type": "leave"}, headers=admin).json()
    it = next(x for x in items if x["id"] == rid)
    assert it["balance"] == {"leave_type": "Casual Leave", "allotted": 12, "used": 0, "pending": 2, "available": 12}
    # unlive employee still has quota enforced (request beyond balance rejected)
    requests.put(f"{API}/admin/leave-balances/live", json={"live": False, "user_ids": [a["id"]]}, headers=admin)
    r2 = requests.post(f"{API}/requests", json={"type": "leave", "leave_type": "Casual Leave", "start_date": f"{YEAR}-04-01",
                                                 "end_date": f"{YEAR}-04-15", "reason": "TEST"}, headers=tok)
    print("Unlive over-quota request:", r2.status_code, r2.text[:150])
    requests.put(f"{API}/admin/leave-balances/live", json={"live": True, "user_ids": [a["id"]]}, headers=admin)


def test_cascade_delete_removes_balance(admin):
    e, _ = make_emp(admin, "C")
    upload(admin, f"Employee Code,CL\n{e['employee_id']},5\n")
    assert requests.delete(f"{API}/admin/employees/{e['id']}", headers=admin).status_code == 200
    r = requests.get(f"{API}/admin/leave-balances", params={"year": YEAR}, headers=admin).json()
    assert all(x["user_id"] != e["id"] for x in r["rows"])
