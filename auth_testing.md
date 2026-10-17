# Auth Testing Playbook

Step 1: MongoDB Verification
```
mongosh
use test_database
db.users.find({role: "admin"}).pretty()
db.users.findOne({role: "admin"}, {password_hash: 1})
```
Verify: bcrypt hash starts with `$2b$`, indexes exist on users.email (unique), users.employee_id (unique sparse), login_attempts.identifier.

Step 2: API Testing (Bearer token auth, not cookies)
```
TOKEN=$(curl -s -X POST $URL/api/auth/login -H "Content-Type: application/json" -d '{"identifier":"arunenterprises2023@gmail.com","password":"WorkPulse@2026"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
curl -H "Authorization: Bearer $TOKEN" $URL/api/auth/me
```
Login returns {token, user}. 5 failed attempts for same ip+identifier -> 429 lockout for 15 min.
