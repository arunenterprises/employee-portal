from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import re
import base64
import logging
from datetime import datetime, timezone, timedelta, date as date_cls
from typing import Optional, List, Literal
from zoneinfo import ZoneInfo

import bcrypt
import jwt
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, UploadFile, File, Form
from fastapi.responses import Response
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

from payslip_pdf import build_payslip_pdf
from vendor_sync import run_sync
import asyncio
import hmac

client = AsyncIOMotorClient(os.environ['MONGO_URL'], tz_aware=True)
db = client[os.environ['DB_NAME']]
TZ = ZoneInfo(os.environ['APP_TIMEZONE'])
JWT_ALG = "HS256"

app = FastAPI()
api = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')


# ---------- helpers ----------
def now_utc():
    return datetime.now(timezone.utc)


def today_str():
    return datetime.now(TZ).strftime("%Y-%m-%d")


def ser(doc):
    if doc is None:
        return None
    out = {}
    for k, v in doc.items():
        if k in ("password_hash", "pdf_b64"):
            continue
        if k == "_id":
            out["id"] = str(v)
        elif isinstance(v, ObjectId):
            out[k] = str(v)
        elif isinstance(v, datetime):
            out[k] = v.isoformat()
        else:
            out[k] = v
    return out


def oid(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=404, detail="Not found")


def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def verify_password(p: str, h: str) -> bool:
    return bcrypt.checkpw(p.encode(), h.encode())


def make_token(user_id: str, role: str) -> str:
    payload = {"sub": user_id, "role": role, "type": "access", "exp": now_utc() + timedelta(hours=12)}
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALG)


async def current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else None
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"_id": oid(payload["sub"])})
    if not user or not user.get("active", True):
        raise HTTPException(status_code=401, detail="User not found")
    return ser(user)


async def admin_user(user: dict = Depends(current_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def employee_user(user: dict = Depends(current_user)) -> dict:
    if user["role"] != "employee":
        raise HTTPException(status_code=403, detail="Employee access required")
    return user


async def employee_map(ids) -> dict:
    ids = [oid(i) for i in set(ids) if i]
    docs = await db.users.find({"_id": {"$in": ids}}, {"name": 1, "employee_id": 1, "department": 1, "designation": 1}).to_list(5000)
    return {str(d["_id"]): {"name": d.get("name"), "employee_id": d.get("employee_id"), "department": d.get("department"), "designation": d.get("designation")} for d in docs}


async def attach_employee(items: List[dict]) -> List[dict]:
    m = await employee_map([i.get("user_id") for i in items])
    for i in items:
        i["employee"] = m.get(i.get("user_id"))
    return items


# ---------- auth ----------
class LoginIn(BaseModel):
    identifier: str
    password: str


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)


@api.post("/auth/login")
async def login(body: LoginIn, request: Request):
    ident = body.identifier.strip()
    key = ident.lower()
    att = await db.login_attempts.find_one({"identifier": key})
    locked = att and att.get("count", 0) >= 5 and att["last"] > now_utc() - timedelta(minutes=15)
    if locked:
        raise HTTPException(status_code=429, detail="Too many failed attempts. Try again in 15 minutes.")
    user = await db.users.find_one({"$or": [{"email": ident.lower()}, {"employee_id": ident.upper()}]})
    if not user or not verify_password(body.password, user["password_hash"]):
        expired = att and att["last"] <= now_utc() - timedelta(minutes=15)
        if expired:
            await db.login_attempts.update_one({"identifier": key}, {"$set": {"count": 1, "last": now_utc()}})
        else:
            await db.login_attempts.update_one({"identifier": key}, {"$inc": {"count": 1}, "$set": {"last": now_utc()}}, upsert=True)
        raise HTTPException(status_code=401, detail="Invalid email/employee ID or password")
    if not user.get("active", True):
        raise HTTPException(status_code=403, detail="Your account is inactive. Contact HR.")
    await db.login_attempts.delete_one({"identifier": key})
    return {"token": make_token(str(user["_id"]), user["role"]), "user": ser(user)}


@api.get("/auth/me")
async def me(user: dict = Depends(current_user)):
    return user


@api.post("/auth/change-password")
async def change_password(body: ChangePasswordIn, user: dict = Depends(current_user)):
    doc = await db.users.find_one({"_id": oid(user["id"])})
    if not verify_password(body.current_password, doc["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    await db.users.update_one({"_id": doc["_id"]}, {"$set": {"password_hash": hash_password(body.new_password), "must_change_password": False}})
    return {"ok": True}


# ---------- employees (admin) ----------
class EmployeeIn(BaseModel):
    employee_id: str
    name: str
    email: str
    password: Optional[str] = None
    phone: str = ""
    department: str = ""
    designation: str = ""
    joining_date: str = ""
    dob: str = ""
    gender: str = ""
    address: str = ""
    bank_name: str = ""
    bank_account: str = ""
    ifsc: str = ""
    pan: str = ""
    uan: str = ""
    basic: float = 0
    hra: float = 0
    allowances: float = 0
    active: bool = True


async def check_unique(email: str, emp_id: str, exclude: Optional[ObjectId] = None):
    if not emp_id or "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="Valid Employee ID and email are required")
    q = {"$or": [{"email": email}, {"employee_id": emp_id}]}
    if exclude:
        q["_id"] = {"$ne": exclude}
    if await db.users.find_one(q):
        raise HTTPException(status_code=400, detail="Email or Employee ID already exists")


@api.get("/admin/employees")
async def list_employees(admin: dict = Depends(admin_user)):
    docs = await db.users.find({"role": "employee"}).sort("employee_id", 1).to_list(5000)
    return [ser(d) for d in docs]


@api.post("/admin/employees")
async def create_employee(body: EmployeeIn, admin: dict = Depends(admin_user)):
    data = body.model_dump()
    data["email"] = data["email"].strip().lower()
    data["employee_id"] = data["employee_id"].strip().upper()
    data["name"] = data["name"].strip()
    if not data["name"]:
        raise HTTPException(status_code=400, detail="Name is required")
    pwd = data.pop("password")
    if not pwd or len(pwd) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    await check_unique(data["email"], data["employee_id"])
    data.update({"role": "employee", "password_hash": hash_password(pwd), "created_at": now_utc()})
    res = await db.users.insert_one(data)
    if data["joining_date"]:
        await db.service_records.insert_one({
            "user_id": str(res.inserted_id), "date": data["joining_date"], "type": "joining",
            "title": f"Joined as {data['designation'] or 'Employee'}", "notes": data["department"], "created_at": now_utc(),
        })
    return ser(await db.users.find_one({"_id": res.inserted_id}))


@api.get("/admin/employees/{emp_id}")
async def get_employee(emp_id: str, admin: dict = Depends(admin_user)):
    doc = await db.users.find_one({"_id": oid(emp_id), "role": "employee"})
    if not doc:
        raise HTTPException(status_code=404, detail="Employee not found")
    return ser(doc)


@api.put("/admin/employees/{emp_id}")
async def update_employee(emp_id: str, body: EmployeeIn, admin: dict = Depends(admin_user)):
    _id = oid(emp_id)
    if not await db.users.find_one({"_id": _id, "role": "employee"}):
        raise HTTPException(status_code=404, detail="Employee not found")
    data = body.model_dump()
    data["email"] = data["email"].strip().lower()
    data["employee_id"] = data["employee_id"].strip().upper()
    pwd = data.pop("password")
    await check_unique(data["email"], data["employee_id"], exclude=_id)
    if pwd:
        if len(pwd) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
        data["password_hash"] = hash_password(pwd)
    await db.users.update_one({"_id": _id}, {"$set": data})
    return ser(await db.users.find_one({"_id": _id}))


@api.delete("/admin/employees/{emp_id}")
async def delete_employee(emp_id: str, admin: dict = Depends(admin_user)):
    res = await db.users.delete_one({"_id": oid(emp_id), "role": "employee"})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Employee not found")
    for col in (db.service_records, db.attendance, db.requests, db.payslips):
        await col.delete_many({"user_id": emp_id})
    return {"ok": True}


# ---------- service records ----------
class ServiceRecordIn(BaseModel):
    user_id: str
    date: str
    type: Literal["joining", "promotion", "transfer", "appraisal", "increment", "training", "award", "other"]
    title: str
    notes: str = ""


@api.get("/service-records")
async def my_service_records(user: dict = Depends(employee_user)):
    docs = await db.service_records.find({"user_id": user["id"]}).sort("date", -1).to_list(500)
    return [ser(d) for d in docs]


@api.get("/admin/service-records")
async def admin_service_records(user_id: str, admin: dict = Depends(admin_user)):
    docs = await db.service_records.find({"user_id": user_id}).sort("date", -1).to_list(500)
    return [ser(d) for d in docs]


@api.post("/admin/service-records")
async def add_service_record(body: ServiceRecordIn, admin: dict = Depends(admin_user)):
    if not await db.users.find_one({"_id": oid(body.user_id), "role": "employee"}):
        raise HTTPException(status_code=404, detail="Employee not found")
    data = body.model_dump() | {"created_at": now_utc()}
    res = await db.service_records.insert_one(data)
    return ser(await db.service_records.find_one({"_id": res.inserted_id}))


@api.delete("/admin/service-records/{rec_id}")
async def delete_service_record(rec_id: str, admin: dict = Depends(admin_user)):
    res = await db.service_records.delete_one({"_id": oid(rec_id)})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Record not found")
    return {"ok": True}


# ---------- attendance ----------
class PunchIn(BaseModel):
    selfie: str
    lat: float
    lng: float
    accuracy: Optional[float] = None


def punch_windows() -> dict:
    return {"in": os.environ["PUNCH_IN_WINDOW"].split("-"), "out": os.environ["PUNCH_OUT_WINDOW"].split("-")}


def check_window(kind: str):
    start, end = punch_windows()[kind]
    now = datetime.now(TZ).strftime("%H:%M")
    if not (start <= now <= end):
        label = "Punch In" if kind == "in" else "Punch Out"
        tip = " Please raise a Missed Punch request." if now > end else ""
        raise HTTPException(status_code=400, detail=f"{label} is allowed only between {start} and {end}.{tip}")


def mins(hm: str) -> int:
    h, m = hm.split(":")
    return int(h) * 60 + int(m)


def late_info(hm: str) -> dict:
    late = max(0, mins(hm) - mins(punch_windows()["in"][1]))
    return {"late": late > 0, "late_minutes": late}


def ist_iso(d: str, hm: str) -> str:
    return datetime.fromisoformat(f"{d}T{hm}:00").replace(tzinfo=TZ).astimezone(timezone.utc).isoformat()


def punch_payload(body: PunchIn) -> dict:
    if not body.selfie.startswith("data:image/") or len(body.selfie) > 200_000:
        raise HTTPException(status_code=400, detail="Invalid selfie image")
    return {"time": now_utc().isoformat(), "selfie": body.selfie, "lat": body.lat, "lng": body.lng, "accuracy": body.accuracy}


@api.get("/attendance/config")
async def attendance_config(user: dict = Depends(current_user)):
    return {"windows": punch_windows(), "server_time": now_utc().isoformat(), "timezone": os.environ["APP_TIMEZONE"], "auto_submit_seconds": 30}


@api.get("/attendance/today")
async def attendance_today(user: dict = Depends(employee_user)):
    return ser(await db.attendance.find_one({"user_id": user["id"], "date": today_str()}))


@api.post("/attendance/punch-in")
async def punch_in(body: PunchIn, user: dict = Depends(employee_user)):
    today = today_str()
    if await db.attendance.find_one({"user_id": user["id"], "date": today}):
        raise HTTPException(status_code=400, detail="Already punched in today")
    now_hm = datetime.now(TZ).strftime("%H:%M")
    w = punch_windows()
    if now_hm < w["in"][0]:
        raise HTTPException(status_code=400, detail=f"Punch In opens at {w['in'][0]}")
    if now_hm > w["out"][1]:
        raise HTTPException(status_code=400, detail="Punch In is closed for today. Please raise a Missed Punch request.")
    res = await db.attendance.insert_one({"user_id": user["id"], "date": today, "punch_in": punch_payload(body), "punch_out": None, "work_minutes": 0, **late_info(now_hm), "created_at": now_utc()})
    return ser(await db.attendance.find_one({"_id": res.inserted_id}))


@api.post("/attendance/punch-out")
async def punch_out(body: PunchIn, user: dict = Depends(employee_user)):
    rec = await db.attendance.find_one({"user_id": user["id"], "date": today_str()})
    if not rec:
        raise HTTPException(status_code=400, detail="Please punch in first")
    if rec.get("punch_out"):
        raise HTTPException(status_code=400, detail="Already punched out today")
    check_window("out")
    out = punch_payload(body)
    minutes = int((datetime.fromisoformat(out["time"]) - datetime.fromisoformat(rec["punch_in"]["time"])).total_seconds() // 60)
    await db.attendance.update_one({"_id": rec["_id"]}, {"$set": {"punch_out": out, "work_minutes": minutes}})
    return ser(await db.attendance.find_one({"_id": rec["_id"]}))


@api.get("/attendance")
async def my_attendance(month: Optional[str] = None, user: dict = Depends(employee_user)):
    q = {"user_id": user["id"]}
    if month:
        q["date"] = {"$regex": f"^{month}"}
    docs = await db.attendance.find(q).sort("date", -1).to_list(400)
    return [ser(d) for d in docs]


@api.get("/admin/attendance")
async def admin_attendance(date: Optional[str] = None, month: Optional[str] = None, user_id: Optional[str] = None, admin: dict = Depends(admin_user)):
    q = {}
    if date:
        q["date"] = date
    elif month:
        q["date"] = {"$regex": f"^{month}"}
    if user_id:
        q["user_id"] = user_id
    docs = await db.attendance.find(q).sort([("date", -1), ("created_at", -1)]).to_list(300)
    return await attach_employee([ser(d) for d in docs])


# ---------- requests ----------
class RequestIn(BaseModel):
    type: Literal["leave", "advance", "payslip", "missed_punch", "other"]
    leave_type: str = ""
    start_date: str = ""
    end_date: str = ""
    amount: float = 0
    repayment: str = ""
    month: str = ""
    punch_date: str = ""
    missed: Literal["in", "out", "both", ""] = ""
    in_time: str = ""
    out_time: str = ""
    subject: str = ""
    reason: str = ""


HM_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


async def validate_missed_punch(body: RequestIn, user_id: str):
    try:
        d = date_cls.fromisoformat(body.punch_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Select a valid date")
    if d.isoformat() > today_str():
        raise HTTPException(status_code=400, detail="Date cannot be in the future")
    if not body.missed:
        raise HTTPException(status_code=400, detail="Select which punch was missed")
    need_in, need_out = body.missed in ("in", "both"), body.missed in ("out", "both")
    if (need_in and not HM_RE.match(body.in_time)) or (need_out and not HM_RE.match(body.out_time)):
        raise HTTPException(status_code=400, detail="Enter valid time (HH:MM)")
    rec = await db.attendance.find_one({"user_id": user_id, "date": body.punch_date})
    if need_in and rec and rec.get("punch_in"):
        raise HTTPException(status_code=400, detail="Punch In already exists for this date")
    if need_out and rec and rec.get("punch_out"):
        raise HTTPException(status_code=400, detail="Punch Out already exists for this date")
    if body.missed == "out" and not (rec and rec.get("punch_in")):
        raise HTTPException(status_code=400, detail="No Punch In on this date. Select 'Both In & Out'.")
    in_hm = body.in_time if need_in else datetime.fromisoformat(rec["punch_in"]["time"]).astimezone(TZ).strftime("%H:%M")
    if need_out and body.out_time <= in_hm:
        raise HTTPException(status_code=400, detail="Out time must be after In time")
    if await db.requests.find_one({"user_id": user_id, "type": "missed_punch", "punch_date": body.punch_date, "status": "pending"}):
        raise HTTPException(status_code=400, detail="A Missed Punch request for this date is already pending")


async def apply_missed_punch(r: dict):
    rec = await db.attendance.find_one({"user_id": r["user_id"], "date": r["punch_date"]}) or {}
    manual = lambda hm: {"time": ist_iso(r["punch_date"], hm), "selfie": None, "lat": None, "lng": None, "accuracy": None, "manual": True}
    upd = {"manual": True}
    if r["missed"] in ("in", "both") and not rec.get("punch_in"):
        upd["punch_in"] = manual(r["in_time"])
        upd.update(late_info(r["in_time"]))
    if r["missed"] in ("out", "both") and not rec.get("punch_out"):
        upd["punch_out"] = manual(r["out_time"])
    pin, pout = upd.get("punch_in") or rec.get("punch_in"), upd.get("punch_out") or rec.get("punch_out")
    if pin and pout:
        upd["work_minutes"] = max(0, int((datetime.fromisoformat(pout["time"]) - datetime.fromisoformat(pin["time"])).total_seconds() // 60))
    if rec:
        await db.attendance.update_one({"_id": rec["_id"]}, {"$set": upd})
    else:
        await db.attendance.insert_one({"user_id": r["user_id"], "date": r["punch_date"], "punch_out": None, "work_minutes": 0, "created_at": now_utc(), **upd})


class DecisionIn(BaseModel):
    status: Literal["approved", "rejected"]
    admin_comment: str = ""


@api.post("/requests")
async def create_request(body: RequestIn, user: dict = Depends(employee_user)):
    data = body.model_dump()
    if body.type == "leave":
        try:
            s, e = date_cls.fromisoformat(body.start_date), date_cls.fromisoformat(body.end_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Valid start and end dates are required")
        if e < s:
            raise HTTPException(status_code=400, detail="End date cannot be before start date")
        data["days"] = (e - s).days + 1
    elif body.type == "advance" and body.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")
    elif body.type == "payslip":
        valid_month(body.month)
    elif body.type == "missed_punch":
        await validate_missed_punch(body, user["id"])
    elif body.type == "other" and not body.subject.strip():
        raise HTTPException(status_code=400, detail="Subject is required")
    data.update({"user_id": user["id"], "status": "pending", "admin_comment": "", "created_at": now_utc(), "decided_at": None})
    res = await db.requests.insert_one(data)
    return ser(await db.requests.find_one({"_id": res.inserted_id}))


@api.get("/requests")
async def my_requests(user: dict = Depends(employee_user)):
    docs = await db.requests.find({"user_id": user["id"]}).sort("created_at", -1).to_list(1000)
    return [ser(d) for d in docs]


@api.delete("/requests/{req_id}")
async def cancel_request(req_id: str, user: dict = Depends(employee_user)):
    res = await db.requests.delete_one({"_id": oid(req_id), "user_id": user["id"], "status": "pending"})
    if not res.deleted_count:
        raise HTTPException(status_code=400, detail="Only pending requests can be cancelled")
    return {"ok": True}


@api.get("/admin/requests")
async def admin_requests(status: Optional[str] = None, type: Optional[str] = None, admin: dict = Depends(admin_user)):
    q = {}
    if status:
        q["status"] = status
    if type:
        q["type"] = type
    docs = await db.requests.find(q).sort("created_at", -1).to_list(2000)
    return await attach_employee([ser(d) for d in docs])


@api.patch("/admin/requests/{req_id}")
async def decide_request(req_id: str, body: DecisionIn, admin: dict = Depends(admin_user)):
    req = await db.requests.find_one({"_id": oid(req_id), "status": "pending"})
    if not req:
        raise HTTPException(status_code=400, detail="Request not found or already decided")
    if body.status == "approved" and req["type"] == "missed_punch":
        await apply_missed_punch(req)
    await db.requests.update_one(
        {"_id": req["_id"]},
        {"$set": {"status": body.status, "admin_comment": body.admin_comment, "decided_at": now_utc()}},
    )
    return ser(await db.requests.find_one({"_id": req["_id"]}))


# ---------- payslips ----------
class LineItem(BaseModel):
    label: str
    amount: float = 0


class PayslipGenIn(BaseModel):
    user_id: str
    month: str
    working_days: float = 0
    paid_days: float = 0
    earnings: List[LineItem]
    deductions: List[LineItem] = []


def valid_month(m: str):
    try:
        datetime.strptime(m, "%Y-%m")
    except ValueError:
        raise HTTPException(status_code=400, detail="Month must be YYYY-MM")


async def publish_payslip(user_id: str, month: str, data: dict):
    await db.payslips.delete_many({"user_id": user_id, "month": month})
    data.update({"user_id": user_id, "month": month, "created_at": now_utc()})
    res = await db.payslips.insert_one(data)
    await db.requests.update_many(
        {"user_id": user_id, "type": "payslip", "month": month, "status": "pending"},
        {"$set": {"status": "approved", "admin_comment": "Payslip published", "decided_at": now_utc()}},
    )
    return ser(await db.payslips.find_one({"_id": res.inserted_id}))


@api.post("/admin/payslips/generate")
async def generate_payslip(body: PayslipGenIn, admin: dict = Depends(admin_user)):
    valid_month(body.month)
    if not await db.users.find_one({"_id": oid(body.user_id), "role": "employee"}):
        raise HTTPException(status_code=404, detail="Employee not found")
    earnings = [i.model_dump() for i in body.earnings if i.label.strip()]
    deductions = [i.model_dump() for i in body.deductions if i.label.strip()]
    gross = round(sum(i["amount"] for i in earnings), 2)
    total_ded = round(sum(i["amount"] for i in deductions), 2)
    return await publish_payslip(body.user_id, body.month, {
        "kind": "generated", "working_days": body.working_days, "paid_days": body.paid_days,
        "earnings": earnings, "deductions": deductions, "gross": gross, "total_deductions": total_ded, "net": round(gross - total_ded, 2),
    })


@api.post("/admin/payslips/upload")
async def upload_payslip(user_id: str = Form(...), month: str = Form(...), net: float = Form(0), file: UploadFile = File(...), admin: dict = Depends(admin_user)):
    valid_month(month)
    if not await db.users.find_one({"_id": oid(user_id), "role": "employee"}):
        raise HTTPException(status_code=404, detail="Employee not found")
    content = await file.read()
    if not content.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    if len(content) > 4 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="PDF must be under 4 MB")
    return await publish_payslip(user_id, month, {
        "kind": "uploaded", "file_name": file.filename, "pdf_b64": base64.b64encode(content).decode(), "net": net,
    })


@api.get("/payslips")
async def my_payslips(user: dict = Depends(employee_user)):
    docs = await db.payslips.find({"user_id": user["id"]}, {"pdf_b64": 0}).sort("month", -1).to_list(500)
    return [ser(d) for d in docs]


@api.get("/admin/payslips")
async def admin_payslips(user_id: Optional[str] = None, month: Optional[str] = None, admin: dict = Depends(admin_user)):
    q = {}
    if user_id:
        q["user_id"] = user_id
    if month:
        q["month"] = month
    docs = await db.payslips.find(q, {"pdf_b64": 0}).sort("month", -1).to_list(2000)
    return await attach_employee([ser(d) for d in docs])


@api.get("/payslips/{slip_id}/pdf")
async def payslip_pdf(slip_id: str, user: dict = Depends(current_user)):
    slip = await db.payslips.find_one({"_id": oid(slip_id)})
    if not slip or (user["role"] != "admin" and slip["user_id"] != user["id"]):
        raise HTTPException(status_code=404, detail="Payslip not found")
    if slip["kind"] == "uploaded":
        content = base64.b64decode(slip["pdf_b64"])
    else:
        emp = await db.users.find_one({"_id": oid(slip["user_id"])}) or {}
        company = {"name": os.environ["COMPANY_NAME"], "address": os.environ["COMPANY_ADDRESS"], "contact": os.environ["COMPANY_CONTACT"], "logo": str(ROOT_DIR / os.environ["COMPANY_LOGO"])}
        content = build_payslip_pdf(slip, emp, company)
    return Response(content=content, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="payslip-{slip["month"]}.pdf"'})


@api.delete("/admin/payslips/{slip_id}")
async def delete_payslip(slip_id: str, admin: dict = Depends(admin_user)):
    res = await db.payslips.delete_one({"_id": oid(slip_id)})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Payslip not found")
    return {"ok": True}


# ---------- dashboards ----------
@api.get("/admin/stats")
async def admin_stats(admin: dict = Depends(admin_user)):
    today = today_str()
    return {
        "employees": await db.users.count_documents({"role": "employee", "active": True}),
        "present_today": await db.attendance.count_documents({"date": today}),
        "late_today": await db.attendance.count_documents({"date": today, "late": True}),
        "pending_requests": await db.requests.count_documents({"status": "pending"}),
        "on_leave_today": await db.requests.count_documents({"type": "leave", "status": "approved", "start_date": {"$lte": today}, "end_date": {"$gte": today}}),
        "today": today,
    }


@api.get("/me/summary")
async def my_summary(user: dict = Depends(employee_user)):
    today = today_str()
    leaves = await db.requests.find({"user_id": user["id"], "type": "leave", "status": "approved", "start_date": {"$regex": f"^{today[:4]}"}}).to_list(500)
    last = await db.payslips.find_one({"user_id": user["id"]}, {"pdf_b64": 0}, sort=[("month", -1)])
    return {
        "present_this_month": await db.attendance.count_documents({"user_id": user["id"], "date": {"$regex": f"^{today[:7]}"}}),
        "pending_requests": await db.requests.count_documents({"user_id": user["id"], "status": "pending"}),
        "leave_days_year": sum(l.get("days", 0) for l in leaves),
        "last_payslip": ser(last),
        "today": today,
    }


# ---------- vendor portal sync ----------
_bg_tasks = set()

@api.post("/admin/vendor-sync")
async def vendor_sync_now(admin: dict = Depends(admin_user)):
    return await run_sync(db, hash_password, datetime.now(TZ).date(), "manual")


@api.get("/admin/vendor-sync/status")
async def vendor_sync_status(admin: dict = Depends(admin_user)):
    return ser(await db.sync_logs.find_one({}, sort=[("started_at", -1)]))


@api.post("/cron/vendor-sync")
async def cron_vendor_sync(request: Request):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer ") or not hmac.compare_digest(auth[7:], os.environ["WEBHOOK_CRON_SECRET"]):
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        body = await request.json()
    except Exception:
        body = {}
    if body is not None and not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Invalid body")
    run_id = request.headers.get("X-Webhook-Id") or (body or {}).get("run_id")
    if run_id and await db.sync_logs.find_one({"run_id": run_id}):
        return {"accepted": True, "duplicate": True}
    task = asyncio.create_task(run_sync(db, hash_password, datetime.now(TZ).date(), "cron", run_id))
    _bg_tasks.add(task)
    task.add_done_callback(_bg_tasks.discard)
    return {"accepted": True}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ['CORS_ORIGINS'].split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("employee_id", unique=True, sparse=True)
    await db.login_attempts.create_index("identifier")
    await db.attendance.create_index([("user_id", 1), ("date", 1)], unique=True)
    await db.requests.create_index([("user_id", 1), ("created_at", -1)])
    await db.payslips.create_index([("user_id", 1), ("month", -1)])
    await db.users.create_index("vendor_id", sparse=True)
    await db.sync_logs.create_index([("started_at", -1)])
    email, pwd = os.environ["ADMIN_EMAIL"].lower(), os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": email})
    if existing is None:
        await db.users.insert_one({"email": email, "password_hash": hash_password(pwd), "name": "Admin", "role": "admin", "active": True, "created_at": now_utc()})
    elif not verify_password(pwd, existing["password_hash"]):
        await db.users.update_one({"_id": existing["_id"]}, {"$set": {"password_hash": hash_password(pwd)}})


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
