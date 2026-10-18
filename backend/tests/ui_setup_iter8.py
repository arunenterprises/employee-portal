# UI setup/teardown for iteration 8 (leave balance manager). Usage: python ui_setup_iter8.py setup|teardown
import os, sys, json, requests
API = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
tok = requests.post(f"{API}/auth/login", json={"identifier": "arunenterprises2023@gmail.com", "password": "WorkPulse@2026"}).json()["token"]
H = {"Authorization": f"Bearer {tok}"}
CODE = "TEST_UILB8"
if sys.argv[1] == "setup":
    r = requests.post(f"{API}/admin/employees", json={"employee_id": CODE, "name": "TEST UI LB8", "email": "test_uilb8@example.com", "password": "Passw0rd!"}, headers=H)
    e = r.json()
    requests.put(f"{API}/admin/leave-balance/{e['id']}", json={"year": "2026", "quotas": {"Casual Leave": 5, "Sick Leave": 3, "Earned Leave": 10}}, headers=H)
    et = requests.post(f"{API}/auth/login", json={"identifier": CODE, "password": "Passw0rd!"}).json()["token"]
    rq = requests.post(f"{API}/requests", json={"type": "leave", "leave_type": "Casual Leave", "start_date": "2026-11-02", "end_date": "2026-11-04", "reason": "TEST ui"}, headers={"Authorization": f"Bearer {et}"}).json()
    requests.put(f"{API}/admin/leave-balance/{e['id']}", json={"year": "2026", "quotas": {"Casual Leave": 2, "Sick Leave": 3, "Earned Leave": 10}}, headers=H)
    print(json.dumps({"uid": e["id"], "req": rq["id"]}))
else:
    for e in requests.get(f"{API}/admin/employees", headers=H).json():
        if e["employee_id"].startswith("TEST_"):
            print(e["employee_id"], requests.delete(f"{API}/admin/employees/{e['id']}", headers=H).status_code)
