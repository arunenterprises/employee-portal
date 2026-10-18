# Short code feature: auto-generation on create, set/validate/uniqueness, login by short code, PWA assets
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN = {"identifier": "arunenterprises2023@gmail.com", "password": "WorkPulse@2026"}
EXIST_ID = open("/tmp/eid").read().strip()
EXIST_CODE = "TEST/EMP/000777/26-27"
EXIST_PWD = "Test@12345"


@pytest.fixture(scope="module")
def admin():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN)
    assert r.status_code == 200, r.text
    s = requests.Session()
    s.headers["Authorization"] = f"Bearer {r.json()['token']}"
    return s


@pytest.fixture(scope="module")
def new_emp(admin):
    payload = {"name": "TEST_Short Two", "email": "test_short2@example.com", "employee_id": "TEST/EMP/000888/26-27",
               "password": "Test@12345", "department": "QA", "designation": "Tester", "joining_date": ""}
    r = admin.post(f"{BASE_URL}/api/admin/employees", json=payload)
    assert r.status_code == 200, r.text
    d = r.json()
    yield d
    admin.delete(f"{BASE_URL}/api/admin/employees/{d['id']}")


def login(ident, pwd=EXIST_PWD):
    return requests.post(f"{BASE_URL}/api/auth/login", json={"identifier": ident, "password": pwd})


# --- Auto generation on create
def test_create_auto_short_code(new_emp, admin):
    assert new_emp["short_code"] == "AE0888"
    r = admin.get(f"{BASE_URL}/api/admin/employees/{new_emp['id']}")
    assert r.status_code == 200
    body = r.json()
    emp = body.get("employee", body)
    assert emp.get("short_code") == "AE0888"


# --- Existing test employee short code / login variants
def test_existing_short_code(admin):
    emps = admin.get(f"{BASE_URL}/api/admin/employees").json()
    e = next(x for x in emps if x["id"] == EXIST_ID)
    assert e["short_code"] == "TST77"


@pytest.mark.parametrize("ident", ["TST77", "tst77", " TsT77 ", EXIST_CODE, EXIST_CODE.lower()])
def test_login_variants(ident):
    r = login(ident)
    assert r.status_code == 200, r.text
    assert r.json()["user"]["employee_id"] == EXIST_CODE
    assert r.json()["user"].get("short_code") == "TST77"


def test_login_short_code_wrong_pwd():
    r = login("TST77", "wrongpass")
    assert r.status_code in (400, 401)


# --- set short code validation
@pytest.mark.parametrize("bad", ["AB12", "ABCDEFG", "AB-12", "AB 123"])
def test_set_invalid(admin, new_emp, bad):
    r = admin.put(f"{BASE_URL}/api/admin/employees/{new_emp['id']}/short-code", json={"short_code": bad})
    assert r.status_code == 400, r.text


def test_set_duplicate_short(admin, new_emp):
    r = admin.put(f"{BASE_URL}/api/admin/employees/{new_emp['id']}/short-code", json={"short_code": "TST77"})
    assert r.status_code == 409


def test_set_custom_lowercase_and_login(admin, new_emp):
    r = admin.put(f"{BASE_URL}/api/admin/employees/{new_emp['id']}/short-code", json={"short_code": "qa888x"})
    assert r.status_code == 200 and r.json()["short_code"] == "QA888X"
    lr = login("qa888x")
    assert lr.status_code == 200 and lr.json()["user"]["employee_id"] == "TEST/EMP/000888/26-27"
    # same code on itself is fine
    r = admin.put(f"{BASE_URL}/api/admin/employees/{new_emp['id']}/short-code", json={"short_code": "QA888X"})
    assert r.status_code == 200


def test_set_empty_auto(admin, new_emp):
    r = admin.put(f"{BASE_URL}/api/admin/employees/{new_emp['id']}/short-code", json={"short_code": ""})
    assert r.status_code == 200 and r.json()["short_code"] == "AE0888"
    r = admin.put(f"{BASE_URL}/api/admin/employees/{new_emp['id']}/short-code", json={})
    assert r.status_code == 200 and r.json()["short_code"] == "AE0888"


def test_set_404(admin):
    r = admin.put(f"{BASE_URL}/api/admin/employees/000000000000000000000000/short-code", json={"short_code": "ABCDE"})
    assert r.status_code == 404


def test_set_requires_admin(new_emp):
    tok = login("TST77").json()["token"]
    r = requests.put(f"{BASE_URL}/api/admin/employees/{new_emp['id']}/short-code", json={"short_code": "ABCDE"},
                     headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code in (401, 403)


def test_auth_me_has_short_code():
    tok = login("TST77").json()["token"]
    r = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 200
    me = r.json().get("user", r.json())
    assert me.get("short_code") == "TST77"


def test_random_when_taken(admin, new_emp):
    # create emp whose numeric group collides with AE0888 -> random AExxxx
    payload = {"name": "TEST_Short Three", "email": "test_short3@example.com", "employee_id": "TEST/X/0888",
               "password": "Test@12345", "department": "", "designation": "", "joining_date": ""}
    r = admin.post(f"{BASE_URL}/api/admin/employees", json=payload)
    assert r.status_code == 200, r.text
    d = r.json()
    try:
        sc = d["short_code"]
        assert sc != "AE0888" and sc.startswith("AE") and len(sc) == 6
    finally:
        admin.delete(f"{BASE_URL}/api/admin/employees/{d['id']}")


# --- PWA assets
def test_manifest():
    r = requests.get(f"{BASE_URL}/manifest.json")
    assert r.status_code == 200
    m = r.json()
    assert m["display"] == "standalone" and m["name"]
    sizes = {i["sizes"] for i in m["icons"]}
    assert {"192x192", "512x512"} <= sizes


@pytest.mark.parametrize("p", ["/icon-192.png", "/icon-512.png"])
def test_icons(p):
    r = requests.get(f"{BASE_URL}{p}")
    assert r.status_code == 200 and r.content[:8] == b"\x89PNG\r\n\x1a\n"


def test_sw_and_index():
    r = requests.get(f"{BASE_URL}/sw.js")
    assert r.status_code == 200 and "javascript" in r.headers.get("content-type", "")
    idx = requests.get(f"{BASE_URL}/").text
    assert 'rel="manifest"' in idx and "ARUN ENTERPRISES | Employee Portal" in idx


# --- short_code exposed in leave balances, attendance sheet, credential slips; leave upload by short code
def test_leave_upload_by_short_code(admin):
    csv_text = "Employee Code,CL,SL,EL\ntst77,3,2,1\n"
    r = admin.post(f"{BASE_URL}/api/admin/leave-balances/upload", data={"year": "2026"},
                   files={"file": ("lb.csv", csv_text.encode(), "text/csv")})
    assert r.status_code == 200, r.text
    assert r.json().get("updated") == 1, r.json()
    rows = admin.get(f"{BASE_URL}/api/admin/leave-balances", params={"year": "2026"}).json()
    rows = rows.get("rows", rows) if isinstance(rows, dict) else rows
    row = next(x for x in rows if x["user_id"] == EXIST_ID)
    assert row["short_code"] == "TST77"


def test_sheet_has_short_code(admin):
    d = admin.get(f"{BASE_URL}/api/admin/attendance-sheet", params={"month": "2026-01"}).json()
    row = next(x for x in d["rows"] if x["user_id"] == EXIST_ID)
    assert row["short_code"] == "TST77"


def test_slip_has_short_code(admin, new_emp):
    r = admin.post(f"{BASE_URL}/api/admin/credential-slips", json={"user_ids": [new_emp["id"]]})
    assert r.status_code == 200
    assert r.json()["slips"][0]["short_code"] == "AE0888"
