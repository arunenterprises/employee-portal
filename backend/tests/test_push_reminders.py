# Push notifications (VAPID) + punch reminder crons + new admin password + credential slip API (TEST employee only)
import os
import sys
import time
import uuid
import asyncio
import pytest
import requests
import yaml
from dotenv import dotenv_values

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ENV = dotenv_values("/app/backend/.env")
SECRET = ENV["WEBHOOK_CRON_SECRET"]
ADMIN = {"identifier": "arunenterprises2023@gmail.com", "password": "Arun2023@12"}
FAKE_P256 = "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM"
FAKE_AUTH = "tBHItJI5svbpez7KI4CCXg"


def _mongo():
    from pymongo import MongoClient
    return MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]


@pytest.fixture(scope="module")
def admin():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN)
    assert r.status_code == 200, r.text
    s = requests.Session()
    s.headers["Authorization"] = f"Bearer {r.json()['token']}"
    return s


@pytest.fixture(scope="module")
def emp(admin):
    payload = {"name": "TEST_Push Emp", "email": "test_push1@example.com", "employee_id": "TEST/EMP/000931/26-27",
               "password": "Test@12345", "department": "QA", "designation": "Tester"}
    r = admin.post(f"{BASE_URL}/api/admin/employees", json=payload)
    assert r.status_code == 200, r.text
    d = r.json()
    lr = requests.post(f"{BASE_URL}/api/auth/login", json={"identifier": payload["employee_id"], "password": "Test@12345"})
    assert lr.status_code == 200, lr.text
    s = requests.Session()
    s.headers["Authorization"] = f"Bearer {lr.json()['token']}"
    yield {"doc": d, "s": s}
    admin.delete(f"{BASE_URL}/api/admin/employees/{d['id']}")
    db = _mongo()
    db.push_subscriptions.delete_many({"endpoint": {"$regex": "TEST_"}})
    db.reminder_logs.delete_many({"run_id": {"$regex": "^TEST_"}})


def sub(ep):
    return {"endpoint": ep, "keys": {"p256dh": FAKE_P256, "auth": FAKE_AUTH}}


# --- admin password
def test_admin_new_password_ok():
    assert requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN).status_code == 200


def test_admin_old_password_fails():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"identifier": ADMIN["identifier"], "password": "WorkPulse@2026"})
    assert r.status_code in (400, 401), r.text


# --- push API
def test_public_key():
    r = requests.get(f"{BASE_URL}/api/push/public-key")
    assert r.status_code == 200
    k = r.json()["publicKey"]
    assert isinstance(k, str) and len(k) > 80


def test_subscribe_flow(emp):
    s = emp["s"]
    ep = f"https://fcm.googleapis.com/fcm/send/TEST_{uuid.uuid4().hex}"
    assert s.get(f"{BASE_URL}/api/push/status").json()["devices"] == 0
    r = s.post(f"{BASE_URL}/api/push/subscribe", json=sub(ep))
    assert r.status_code == 200 and r.json()["ok"] is True
    # idempotent upsert
    s.post(f"{BASE_URL}/api/push/subscribe", json=sub(ep))
    assert s.get(f"{BASE_URL}/api/push/status").json()["devices"] == 1
    t = s.post(f"{BASE_URL}/api/push/test", timeout=60)
    assert t.status_code == 200, t.text
    assert "sent" in t.json() and isinstance(t.json()["sent"], int)
    print("push/test with fake sub ->", t.json(), "devices after:", s.get(f"{BASE_URL}/api/push/status").json())
    r = s.post(f"{BASE_URL}/api/push/unsubscribe", json=sub(ep))
    assert r.status_code == 200
    assert s.get(f"{BASE_URL}/api/push/status").json()["devices"] == 0


@pytest.mark.parametrize("body", [
    {"endpoint": "http://fcm.googleapis.com/fcm/send/TEST_insecure_xxxxx", "keys": {"p256dh": FAKE_P256, "auth": FAKE_AUTH}},
    {"endpoint": "https://fcm.googleapis.com/fcm/send/TEST_nokeys_xxxxx", "keys": {}},
    {"endpoint": "https://fcm.googleapis.com/fcm/send/TEST_noauth_xxxxx", "keys": {"p256dh": FAKE_P256}},
])
def test_subscribe_invalid(emp, body):
    r = emp["s"].post(f"{BASE_URL}/api/push/subscribe", json=body)
    assert r.status_code in (400, 422), r.text


def test_subscribe_admin_forbidden(admin):
    r = admin.post(f"{BASE_URL}/api/push/subscribe", json=sub("https://fcm.googleapis.com/fcm/send/TEST_admin_xxxx"))
    assert r.status_code == 403


def test_push_unauth():
    assert requests.get(f"{BASE_URL}/api/push/status").status_code == 401


# --- cron endpoints
@pytest.mark.parametrize("kind", ["in", "out"])
def test_cron_requires_secret(kind):
    assert requests.post(f"{BASE_URL}/api/cron/punch-reminder-{kind}").status_code == 401
    assert requests.post(f"{BASE_URL}/api/cron/punch-reminder-{kind}", headers={"Authorization": "Bearer wrong"}).status_code == 401


def test_cron_unknown_kind():
    r = requests.post(f"{BASE_URL}/api/cron/punch-reminder-lunch", headers={"Authorization": f"Bearer {SECRET}"})
    assert r.status_code == 404


@pytest.mark.parametrize("kind", ["in", "out"])
def test_cron_accept_and_duplicate(emp, kind):
    rid = f"TEST_{kind}_{uuid.uuid4().hex[:8]}"
    h = {"Authorization": f"Bearer {SECRET}", "X-Webhook-Id": rid}
    t0 = time.time()
    r = requests.post(f"{BASE_URL}/api/cron/punch-reminder-{kind}", headers=h)
    assert r.status_code == 200 and r.json() == {"accepted": True}
    assert time.time() - t0 < 5
    time.sleep(2)
    log = _mongo().reminder_logs.find_one({"run_id": rid})
    assert log and log["kind"] == kind and "finished_at" in log
    r2 = requests.post(f"{BASE_URL}/api/cron/punch-reminder-{kind}", headers=h)
    assert r2.json().get("duplicate") is True


# --- crons.yml contract
def test_crons_yml():
    d = yaml.safe_load(open("/app/.emergent/crons.yml"))
    c = {x["name"]: x for x in d["crons"]}
    assert set(c) == {"vendor-sync-hourly", "punch-in-reminder", "punch-out-reminder"}
    assert c["punch-in-reminder"]["cron"] == "10 9 * * 1-6" and c["punch-in-reminder"]["timezone"] == "Asia/Kolkata"
    assert c["punch-out-reminder"]["cron"] == "10 18 * * 1-6" and c["punch-out-reminder"]["timezone"] == "Asia/Kolkata"
    assert c["punch-in-reminder"]["endpoint"] == "{{BASE_URL}}/api/cron/punch-reminder-in"
    assert c["punch-out-reminder"]["endpoint"] == "{{BASE_URL}}/api/cron/punch-reminder-out"
    for x in c.values():
        assert x["method"] == "POST" and x["enabled"] is True


# --- sw.js / manifest
def test_sw_and_manifest():
    sw = requests.get(f"{BASE_URL}/sw.js").text
    assert 'addEventListener("push"' in sw and 'addEventListener("notificationclick"' in sw
    m = requests.get(f"{BASE_URL}/manifest.json").json()
    assert m.get("start_url") and m.get("icons") and m.get("display") in ("standalone", "fullscreen", "minimal-ui")


# --- credential slip API on TEST employee only
def test_credential_slip_test_emp(admin, emp):
    d = emp["doc"]
    r = admin.post(f"{BASE_URL}/api/admin/credential-slips", json={"user_ids": [d["id"]]})
    assert r.status_code == 200, r.text
    s = r.json()["slips"]
    assert len(s) == 1 and s[0]["short_code"] == d["short_code"] and len(s[0]["password"]) == 8
    lr = requests.post(f"{BASE_URL}/api/auth/login", json={"identifier": d["short_code"], "password": s[0]["password"]})
    assert lr.status_code == 200
    emp["s"].headers["Authorization"] = f"Bearer {lr.json()['token']}"


# --- reminder targeting logic (method level, push_to_user patched)
def test_reminder_targeting_logic(admin):
    sys.path.insert(0, "/app/backend")
    import server
    db = _mongo()
    ids = []
    for i, tag in enumerate(["none", "in", "done", "leave"]):
        r = admin.post(f"{BASE_URL}/api/admin/employees", json={"name": f"TEST_Rem {tag}", "email": f"test_rem_{tag}@example.com",
                                                               "employee_id": f"TEST/REM/00{i}", "password": "Test@12345"})
        assert r.status_code == 200, r.text
        ids.append(r.json()["id"])
    try:
        today = server.today_str()
        for uid in ids:
            db.push_subscriptions.insert_one({"user_id": uid, "endpoint": f"https://fcm.googleapis.com/fcm/send/TEST_rem_{uid}", "keys": {"p256dh": FAKE_P256, "auth": FAKE_AUTH}})
        db.attendance.insert_one({"user_id": ids[1], "date": today, "punch_in": {"time": "x"}, "punch_out": None})
        db.attendance.insert_one({"user_id": ids[2], "date": today, "punch_in": {"time": "x"}, "punch_out": {"time": "y"}})
        db.requests.insert_one({"user_id": ids[3], "type": "leave", "status": "approved", "start_date": today, "end_date": today})
        called = {}

        async def fake(uid, payload):
            called.setdefault(payload["tag"].split("-")[1], []).append(uid)
            return 1
        orig = server.push_to_user
        server.push_to_user = fake

        async def go():
            from motor.motor_asyncio import AsyncIOMotorClient
            server.db = AsyncIOMotorClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
            await server.run_punch_reminder("in", "TEST_logic_in")
            await server.run_punch_reminder("out", "TEST_logic_out")
        try:
            asyncio.run(go())
        finally:
            server.push_to_user = orig
        assert set(called.get("in", [])) == {ids[0]}, called
        assert set(called.get("out", [])) == {ids[1]}, called
        assert db.reminder_logs.find_one({"run_id": "TEST_logic_in"})["sent"] == 1
    finally:
        for uid in ids:
            admin.delete(f"{BASE_URL}/api/admin/employees/{uid}")
        db.reminder_logs.delete_many({"run_id": {"$regex": "^TEST_"}})
        db.push_subscriptions.delete_many({"endpoint": {"$regex": "TEST_"}})
