# Leave balance + Performance appraisal tests (iteration 5). Uses only TEST_ employees (never apply_to_all).
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN = {"identifier": "arunenterprises2023@gmail.com", "password": "WorkPulse@2026"}
TAG = uuid.uuid4().hex[:4].upper()
YEAR = "2027"  # isolated year so no other data interferes


def hdr(t):
    return {"Authorization": f"Bearer {t}"}


def login(identifier, password):
    return requests.post(f"{API}/auth/login", json={"identifier": identifier, "password": password})


@pytest.fixture(scope="module")
def admin():
    r = login(**ADMIN)
    assert r.status_code == 200, r.text
    return hdr(r.json()["token"])


def make_emp(admin, suffix):
    d = {"employee_id": f"TEST_LB{suffix}{TAG}", "name": f"TEST_LB{suffix}{TAG}", "email": f"test_lb{suffix.lower()}{TAG.lower()}@example.com",
         "password": "Passw0rd!", "department": "Ops", "designation": "Eng", "joining_date": "2024-01-15"}
    r = requests.post(f"{API}/admin/employees", json=d, headers=admin)
    assert r.status_code == 200, r.text
    e = r.json()
    tok = hdr(login(d["employee_id"], "Passw0rd!").json()["token"])
    return e, tok


@pytest.fixture(scope="module")
def emp(admin):
    e, tok = make_emp(admin, "A")
    yield e, tok
    requests.delete(f"{API}/admin/employees/{e['id']}", headers=admin)


@pytest.fixture(scope="module")
def emp2(admin):
    e, tok = make_emp(admin, "B")
    yield e, tok
    requests.delete(f"{API}/admin/employees/{e['id']}", headers=admin)


def leave(tok, lt, s, e):
    return requests.post(f"{API}/requests", json={"type": "leave", "leave_type": lt, "start_date": s, "end_date": e, "reason": "TEST_"}, headers=tok)


def row(bal, lt):
    return next(x for x in bal["balances"] if x["leave_type"] == lt)


# --- Leave balance ---
class TestLeaveBalance:
    def test_unconfigured(self, emp):
        r = requests.get(f"{API}/leave-balance", params={"year": YEAR}, headers=emp[1])
        assert r.status_code == 200
        j = r.json()
        assert j["configured"] is False and len(j["balances"]) == 3

    def test_unconfigured_not_blocked(self, emp2, admin):
        r = leave(emp2[1], "Casual Leave", f"{YEAR}-03-01", f"{YEAR}-03-10")
        assert r.status_code == 200, r.text
        assert r.json()["days"] == 10
        requests.delete(f"{API}/requests/{r.json()['id']}", headers=emp2[1])

    def test_set_quota(self, emp, admin):
        r = requests.put(f"{API}/admin/leave-balance/{emp[0]['id']}", json={"year": YEAR, "quotas": {"Casual Leave": 5, "Sick Leave": 3, "Earned Leave": 10}}, headers=admin)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["applied_to"] == 1 and j["configured"] is True
        assert row(j, "Casual Leave")["available"] == 5
        g = requests.get(f"{API}/admin/leave-balance/{emp[0]['id']}", params={"year": YEAR}, headers=admin).json()
        assert row(g, "Earned Leave")["quota"] == 10

    def test_quota_validation(self, emp, admin):
        r = requests.put(f"{API}/admin/leave-balance/{emp[0]['id']}", json={"year": YEAR, "quotas": {"Casual Leave": -1}}, headers=admin)
        assert r.status_code == 400
        r = requests.put(f"{API}/admin/leave-balance/{emp[0]['id']}", json={"year": "27", "quotas": {}}, headers=admin)
        assert r.status_code == 422

    def test_adjust_and_delete(self, emp, admin):
        r = requests.post(f"{API}/admin/leave-balance/{emp[0]['id']}/adjust", json={"year": YEAR, "leave_type": "Sick Leave", "days": 2, "reason": "TEST_ bonus"}, headers=admin)
        assert r.status_code == 200, r.text
        j = r.json()
        assert row(j, "Sick Leave")["available"] == 5 and row(j, "Sick Leave")["adjustment"] == 2
        adj_id = j["adjustments"][0]["id"]
        assert "_id" not in j["adjustments"][0]
        r = requests.post(f"{API}/admin/leave-balance/{emp[0]['id']}/adjust", json={"year": YEAR, "leave_type": "Sick Leave", "days": 0, "reason": "x"}, headers=admin)
        assert r.status_code == 400
        r = requests.post(f"{API}/admin/leave-balance/{emp[0]['id']}/adjust", json={"year": YEAR, "leave_type": "Sick Leave", "days": 1, "reason": ""}, headers=admin)
        assert r.status_code == 422
        assert requests.delete(f"{API}/admin/leave-adjustments/{adj_id}", headers=admin).status_code == 200
        assert requests.delete(f"{API}/admin/leave-adjustments/{adj_id}", headers=admin).status_code == 404
        g = requests.get(f"{API}/admin/leave-balance/{emp[0]['id']}", params={"year": YEAR}, headers=admin).json()
        assert row(g, "Sick Leave")["available"] == 3

    def test_enforcement_flow(self, emp, admin):
        tok = emp[1]
        # CL quota 5: request 6 -> blocked
        r = leave(tok, "Casual Leave", f"{YEAR}-01-01", f"{YEAR}-01-06")
        assert r.status_code == 400 and "Insufficient Casual Leave" in r.json()["detail"]
        # request 3 ok (pending)
        r1 = leave(tok, "Casual Leave", f"{YEAR}-01-01", f"{YEAR}-01-03")
        assert r1.status_code == 200, r1.text
        # 3 more -> blocked due to pending (5-3=2)
        r = leave(tok, "Casual Leave", f"{YEAR}-02-01", f"{YEAR}-02-03")
        assert r.status_code == 400
        # half day x4 = 2 days CL -> ok
        r2 = leave(tok, "Half Day", f"{YEAR}-02-01", f"{YEAR}-02-04")
        assert r2.status_code == 200, r2.text
        assert r2.json()["days"] == 2
        b = requests.get(f"{API}/leave-balance", params={"year": YEAR}, headers=tok).json()
        assert row(b, "Casual Leave")["pending"] == 5 and row(b, "Casual Leave")["available"] == 5
        # unpaid not tracked
        r3 = leave(tok, "Unpaid Leave", f"{YEAR}-05-01", f"{YEAR}-05-30")
        assert r3.status_code == 200
        # approve first (3 days)
        a = requests.patch(f"{API}/admin/requests/{r1.json()['id']}", json={"status": "approved"}, headers=admin)
        assert a.status_code == 200, a.text
        b = requests.get(f"{API}/leave-balance", params={"year": YEAR}, headers=tok).json()
        assert row(b, "Casual Leave")["used"] == 3 and row(b, "Casual Leave")["available"] == 2
        # admin reduces CL by 1 -> available 1; approving half-day (2 days) should fail
        adj = requests.post(f"{API}/admin/leave-balance/{emp[0]['id']}/adjust", json={"year": YEAR, "leave_type": "Casual Leave", "days": -1, "reason": "TEST_ deduct"}, headers=admin)
        assert adj.status_code == 200
        a2 = requests.patch(f"{API}/admin/requests/{r2.json()['id']}", json={"status": "approved"}, headers=admin)
        assert a2.status_code == 400 and "Insufficient" in a2.json()["detail"]
        # reject works regardless
        a3 = requests.patch(f"{API}/admin/requests/{r2.json()['id']}", json={"status": "rejected"}, headers=admin)
        assert a3.status_code == 200
        b = requests.get(f"{API}/leave-balance", params={"year": YEAR}, headers=tok).json()
        assert row(b, "Casual Leave")["pending"] == 0 and row(b, "Casual Leave")["available"] == 1

    def test_employee_forbidden(self, emp):
        tok = emp[1]
        assert requests.get(f"{API}/admin/leave-balance/{emp[0]['id']}", headers=tok).status_code == 403
        assert requests.put(f"{API}/admin/leave-balance/{emp[0]['id']}", json={"year": YEAR, "quotas": {}}, headers=tok).status_code == 403
        assert requests.post(f"{API}/admin/appraisals", json={}, headers=tok).status_code in (403, 422)
        assert requests.get(f"{API}/admin/appraisals", params={"user_id": emp[0]["id"]}, headers=tok).status_code == 403

    def test_404_unknown_emp(self, admin):
        assert requests.get(f"{API}/admin/leave-balance/000000000000000000000000", headers=admin).status_code == 404


# --- Appraisals ---
RATINGS = {"Work Quality": 5, "Punctuality": 4, "Teamwork": 5, "Communication": 4, "Initiative": 5, "Discipline": 4}


class TestAppraisals:
    def test_create_list_delete(self, emp, admin):
        body = {"user_id": emp[0]["id"], "period": "TEST_FY", "review_date": "2026-01-10", "ratings": RATINGS, "reviewer": "HR", "recommendation": "increment"}
        r = requests.post(f"{API}/admin/appraisals", json=body, headers=admin)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["score"] == 4.5 and j["grade"] == "Outstanding" and "_id" not in j
        lst = requests.get(f"{API}/admin/appraisals", params={"user_id": emp[0]["id"]}, headers=admin).json()
        assert any(a["id"] == j["id"] for a in lst)
        mine = requests.get(f"{API}/appraisals", headers=emp[1]).json()
        assert any(a["id"] == j["id"] for a in mine)
        assert requests.delete(f"{API}/admin/appraisals/{j['id']}", headers=admin).status_code == 200
        assert requests.delete(f"{API}/admin/appraisals/{j['id']}", headers=admin).status_code == 404

    @pytest.mark.parametrize("vals,score,grade", [
        ([4, 4, 3, 3, 4, 3], 3.5, "Very Good"), ([3, 3, 2, 2, 3, 2], 2.5, "Good"),
        ([2, 1, 2, 1, 2, 1], 1.5, "Needs Improvement"), ([1, 1, 1, 1, 1, 2], 1.2, "Poor"), ([4, 4, 4, 4, 5, 5], 4.3, "Very Good")])
    def test_grades(self, emp, admin, vals, score, grade):
        ratings = dict(zip(RATINGS.keys(), vals))
        r = requests.post(f"{API}/admin/appraisals", json={"user_id": emp[0]["id"], "period": "TEST_G", "review_date": "2026-01-10", "ratings": ratings}, headers=admin)
        assert r.status_code == 200, r.text
        assert r.json()["score"] == score and r.json()["grade"] == grade
        requests.delete(f"{API}/admin/appraisals/{r.json()['id']}", headers=admin)

    def test_validation(self, emp, admin):
        base = {"user_id": emp[0]["id"], "period": "TEST_V", "review_date": "2026-01-10"}
        r = requests.post(f"{API}/admin/appraisals", json=base | {"ratings": {k: v for k, v in list(RATINGS.items())[:5]}}, headers=admin)
        assert r.status_code == 400
        r = requests.post(f"{API}/admin/appraisals", json=base | {"ratings": RATINGS | {"Teamwork": 6}}, headers=admin)
        assert r.status_code == 400
        r = requests.post(f"{API}/admin/appraisals", json=base | {"ratings": RATINGS | {"Teamwork": 0}}, headers=admin)
        assert r.status_code == 400
        r = requests.post(f"{API}/admin/appraisals", json=base | {"review_date": "bad", "ratings": RATINGS}, headers=admin)
        assert r.status_code == 400
        r = requests.post(f"{API}/admin/appraisals", json=base | {"period": "", "ratings": RATINGS}, headers=admin)
        assert r.status_code == 422
