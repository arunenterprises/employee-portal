# WorkPulse – Employee Portal + HR Admin

## Original problem statement
"jese apne vendor portal banaya hai thik usi tarah employee portal bhi bana dijiye taki hamara employee bhi apna detals aur service's record dekh sake aur apni attendence phi punch karsake aur jo bhi uski request hai usko wo full fill kar sake request main jese leave ,advance,payslip etc."

User choices: separate new portal; admin creates employee accounts (login with email or Employee ID + password); punch in/out with time + GPS + selfie; Admin/HR approves/rejects requests; payslip generated from salary details (PDF) OR admin uploads PDF.

## Architecture
- FastAPI (`backend/server.py`, `payslip_pdf.py` via reportlab) + MongoDB (users, service_records, attendance, requests, payslips, login_attempts)
- JWT Bearer auth (12h), bcrypt, brute-force lockout (5 fails / 15 min per identifier), admin seeded from .env
- React + shadcn, routes `/login`, `/employee/*`, `/admin/*`; selfies stored as small base64 JPEG; uploaded PDFs stored base64 (≤4MB)

## Personas
- Employee: views profile/service record, punches attendance, raises requests, downloads payslips
- Admin/HR: manages employees, service records, attendance verification, approvals, payroll

## Implemented (2026-10-17)
- Login (email/Employee ID), change password
- Employee: dashboard with live clock + punch card, stats, latest payslip; selfie+GPS punch dialog (camera or upload fallback); attendance history by month; profile + service timeline; requests (leave/advance/payslip/other) with cancel & status filters; payslip list + PDF download
- Admin: dashboard stats, employees CRUD (active/inactive), service records add/delete, attendance monitor with selfie viewer + map links, request approve/reject with comment, payslip generate (earnings/deductions) & PDF upload; publishing auto-approves matching payslip requests
- Tested: iteration_1 (backend 26/27 → brute-force fixed, frontend 100%)

## Backlog
- P1: Leave balance/quotas per type; mobile card layout for attendance table; set company name (COMPANY_NAME env, currently placeholder)
- P1: Attendance monthly report export (CSV/Excel)
- P2: Office geofence check on punch; forgot-password via email; selfie served via separate endpoint for large data

## Next tasks
- Replace `[Your Company Name]` in backend/.env COMPANY_NAME
