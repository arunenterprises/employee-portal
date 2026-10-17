# Iteration 4: admin reset-password, portal live/unlive access, media (photo/signature), admin password change
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_EMAIL = "arunenterprises2023@gmail.com"
ADMIN_PWD = "WorkPulse@2026"
PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="


def login(ident, pwd):
    return requests.post(f"{BASE_URL}/api/auth/login", json={"identifier": ident, "password": pwd})


def H(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def admin_token():
    r = login(ADMIN_EMAIL, ADMIN_PWD)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def test_emp(admin_token):
    suf = uuid.uuid4().hex[:6].upper()
    body = {"employee_id": f"TEST_AM{suf}", "name": f"TEST_ Access {suf}", "email": f"test_am{suf.lower()}@example.com", "password": "InitPass1"}
    r = requests.post(f"{BASE_URL}/api/admin/employees", json=body, headers=H(admin_token))
    assert r.status_code == 200, r.text
    emp = r.json()
    yield emp
    requests.delete(f"{BASE_URL}/api/admin/employees/{emp['id']}", headers=H(admin_token))


# Reset password
class TestResetPassword:
    def test_reset_and_login(self, admin_token, test_emp):
        r = requests.post(f"{BASE_URL}/api/admin/employees/{test_emp['id']}/reset-password", json={"new_password": "Reset123"}, headers=H(admin_token))
        assert r.status_code == 200 and r.json()["ok"] is True
        assert login(test_emp["employee_id"], "InitPass1").status_code == 401
        r = login(test_emp["employee_id"], "Reset123")
        assert r.status_code == 200
        assert r.json()["user"]["must_change_password"] is True
        assert "password_hash" not in r.json()["user"]

    def test_reset_short_password(self, admin_token, test_emp):
        r = requests.post(f"{BASE_URL}/api/admin/employees/{test_emp['id']}/reset-password", json={"new_password": "abc"}, headers=H(admin_token))
        assert r.status_code == 422

    def test_reset_404(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/admin/employees/000000000000000000000000/reset-password", json={"new_password": "Reset123"}, headers=H(admin_token))
        assert r.status_code == 404

    def test_employee_change_password_clears_flag(self, test_emp):
        t = login(test_emp["employee_id"], "Reset123").json()["token"]
        r = requests.post(f"{BASE_URL}/api/auth/change-password", json={"current_password": "Reset123", "new_password": "Final123"}, headers=H(t))
        assert r.status_code == 200
        r = login(test_emp["employee_id"], "Final123")
        assert r.status_code == 200 and r.json()["user"]["must_change_password"] is False
        r = requests.post(f"{BASE_URL}/api/auth/change-password", json={"current_password": "wrong", "new_password": "Final999"}, headers=H(t))
        assert r.status_code == 400


# Portal access live/unlive
class TestAccess:
    def test_disable_enable(self, admin_token, test_emp):
        t = login(test_emp["employee_id"], "Final123").json()["token"]
        assert requests.get(f"{BASE_URL}/api/auth/me", headers=H(t)).status_code == 200
        r = requests.patch(f"{BASE_URL}/api/admin/employees/{test_emp['id']}/access", json={"enabled": False}, headers=H(admin_token))
        assert r.status_code == 200 and r.json()["portal_enabled"] is False
        r = login(test_emp["employee_id"], "Final123")
        assert r.status_code == 403 and "portal access is disabled" in r.json()["detail"].lower()
        assert requests.get(f"{BASE_URL}/api/auth/me", headers=H(t)).status_code == 401
        g = requests.get(f"{BASE_URL}/api/admin/employees/{test_emp['id']}", headers=H(admin_token)).json()
        assert g["portal_enabled"] is False
        r = requests.patch(f"{BASE_URL}/api/admin/employees/{test_emp['id']}/access", json={"enabled": True}, headers=H(admin_token))
        assert r.status_code == 200 and r.json()["portal_enabled"] is True
        assert login(test_emp["employee_id"], "Final123").status_code == 200
        assert requests.get(f"{BASE_URL}/api/auth/me", headers=H(t)).status_code == 200

    def test_access_invalid_body(self, admin_token, test_emp):
        r = requests.patch(f"{BASE_URL}/api/admin/employees/{test_emp['id']}/access", json={}, headers=H(admin_token))
        assert r.status_code == 422


# Media
class TestMedia:
    def test_upload_and_get(self, admin_token, test_emp):
        r = requests.get(f"{BASE_URL}/api/admin/employees/{test_emp['id']}/media", headers=H(admin_token))
        assert r.status_code == 200 and r.json()["photo"] is None
        r = requests.post(f"{BASE_URL}/api/admin/employees/{test_emp['id']}/media", json={"photo": PNG, "signature": PNG}, headers=H(admin_token))
        assert r.status_code == 200 and r.json()["photo"] == PNG and r.json()["source"] == "admin"
        r = requests.get(f"{BASE_URL}/api/admin/employees/{test_emp['id']}/media", headers=H(admin_token))
        assert r.json()["signature"] == PNG

    def test_invalid_media(self, admin_token, test_emp):
        for body in ({"photo": "hello"}, {"signature": "data:text/plain;base64,aGk="}, {}, {"photo": "data:image/png;base64," + "A" * 900000}):
            r = requests.post(f"{BASE_URL}/api/admin/employees/{test_emp['id']}/media", json=body, headers=H(admin_token))
            assert r.status_code == 400, body.keys()

    def test_me_media_and_forbidden(self, test_emp):
        t = login(test_emp["employee_id"], "Final123").json()["token"]
        r = requests.get(f"{BASE_URL}/api/me/media", headers=H(t))
        assert r.status_code == 200 and r.json()["photo"] == PNG
        assert requests.get(f"{BASE_URL}/api/admin/employees/{test_emp['id']}/media", headers=H(t)).status_code == 403
        assert requests.post(f"{BASE_URL}/api/admin/employees/{test_emp['id']}/media", json={"photo": PNG}, headers=H(t)).status_code == 403
        assert requests.patch(f"{BASE_URL}/api/admin/employees/{test_emp['id']}/access", json={"enabled": False}, headers=H(t)).status_code == 403
        assert requests.post(f"{BASE_URL}/api/admin/employees/{test_emp['id']}/reset-password", json={"new_password": "xxxxxx"}, headers=H(t)).status_code == 403

    def test_admin_me_media_forbidden(self, admin_token):
        assert requests.get(f"{BASE_URL}/api/me/media", headers=H(admin_token)).status_code == 403

    def test_real_employee_media_view(self, admin_token):
        emps = requests.get(f"{BASE_URL}/api/admin/employees", headers=H(admin_token)).json()
        real = next((e for e in emps if e.get("employee_id") == "AE/EMP/000005/26-27"), None)
        if not real:
            pytest.skip("real employee not present")
        r = requests.get(f"{BASE_URL}/api/admin/employees/{real['id']}/media", headers=H(admin_token))
        assert r.status_code == 200
        d = r.json()
        print("real media source:", d.get("source"), "photo:", bool(d.get("photo")), "sig:", bool(d.get("signature")))
        assert d.get("photo", "").startswith("data:image/")
