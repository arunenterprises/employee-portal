# Helper: create/delete TEST_ employees for iteration-5 UI tests. Usage: python ui_setup_iter5.py create|delete
import os, sys, json, requests
API = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
t = requests.post(f"{API}/auth/login", json={"identifier": "arunenterprises2023@gmail.com", "password": "WorkPulse@2026"}).json()["token"]
H = {"Authorization": f"Bearer {t}"}
if sys.argv[1] == "create":
    d = {"employee_id": "TEST_UI5", "name": "TEST_UI Five", "email": "test_ui5@example.com", "password": "Passw0rd!",
         "department": "Ops", "designation": "Eng", "joining_date": "2024-01-15"}
    r = requests.post(f"{API}/admin/employees", json=d, headers=H)
    print(r.status_code, r.json().get("id"))
else:
    for e in requests.get(f"{API}/admin/employees", headers=H).json():
        if e["employee_id"].startswith("TEST_"):
            print("delete", e["employee_id"], requests.delete(f"{API}/admin/employees/{e['id']}", headers=H).status_code)
