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

## Implemented (2026-10-17, iteration 2)
- Branding: ARUN ENTERPRISES logo/name in sidebar, login page redesigned like vendor portal (address, toll free, email, web), payslip PDF header with logo + address
- Vendor Portal link (https://arunenterprises.online/api): employees pulled from vendor HR keyed on empCode (= employee_id, primary key; vendor_id stored); attendance punches + approved leaves pushed back into vendor monthly attendance docs (att_{empId}_{YYYYMM}; P only fills empty/A days, leaves CL/SL/EL/LWP/HL fill empty days). Admin "Sync now" button + hourly cron (.emergent/crons.yml -> /api/cron/vendor-sync)
- Synced employees: initial password = DOB DDMMYYYY (else mobile); change-password banner
- Tested: iteration_2 backend 37/37, frontend 100%

## Implemented (2026-10-17, iteration 3)
- Punch screen: Front Camera + Location permission mandatory (Permission Required + Retry), non-editable live punch time + GPS, 30s countdown then auto capture & submit (manual "Submit now" also)
- Punch windows enforced on server (IST): In 09:10-09:30, Out 18:10-18:30 (backend/.env PUNCH_IN_WINDOW / PUNCH_OUT_WINDOW); dashboard shows windows and disables button outside window

## Implemented (2026-10-17, iteration 4)
- Late Mark: punch-in allowed from in-start until out-window end; after in-window end -> late=true + late_minutes; badges on employee dashboard/attendance tables, "Late today" admin stat; pushed to vendor as "P" + extra `late` {day: minutes} field (vendor UI has no Late code)
- Missed Punch request (in/out/both, date, actual times) with validations; HR approve creates/updates attendance as manual punch (tagged "Missed punch · HR approved"), late computed
- Vendor push leave codes corrected to vendor grid codes: L (leave), H (half day)

## Implemented (2026-10-17, iteration 5)
- Admin: reset employee password (dialog; employee must change after login), Live/Unlive portal access switch (portal_enabled, independent of vendor HR status; blocks login + existing sessions)
- Admin self password change (key icon in sidebar/mobile header); in-app password persists across restarts (password_set_in_app); recovery via ADMIN_FORCE_RESET="true" in backend/.env + restart
- Employee photo & signature (employee_media collection) synced from vendor photoUrl/signatureUrl; preview + zoom on admin detail and employee profile; admin upload (PNG/JPEG/WEBP, base64 validated)
- Tested: iteration_4 backend 11/11, frontend 100%

## Implemented (2026-10-17, iteration 6)
- Admin employee detail layout: profile panel (photo/signature column + Job / Personal & contact / Bank & statutory groups), Salary breakup panel (Basic, HRA, DA, Special, Bonus, gross month/year, CTC if present), full-width Service record with collapsible add form
- Vendor sync now stores da, special, bonus, ctc_annual separately

## Implemented (2026-10-17, iteration 7)
- Employee detail redesign: dark hero card (photo, name, code, badges, actions, quick facts), profile + salary breakup in left column, sticky service record on right
- Credential slips: POST /api/admin/credential-slips sets a new random 8-char password per selected employee (must_change_password) and returns slips once; bulk dialog on Employees page (pre-selects employees who never changed password) + single "Print slip" on detail page; print CSS prints only slips (logo, company, portal URL, code, password, instructions)

## Implemented (2026-10-17, iteration 8)
- Leave balance: yearly quota per employee (CL/SL/EL) with optional apply-to-all (confirm), +/- adjustments with reason & history; available = quota + adjustments - approved; Half Day = 0.5 CL; enforced on request & approval only when configured; employee sees cards on dashboard + availability in leave form
- Service Book admin tab (/admin/service-book): employee picker, header summary, service entries, performance appraisals (6 criteria 1-5 stars, score, grade, recommendation), leave balance; employee sees appraisals on Profile
- Tested: iteration_5 backend 15/15, frontend 100%

## Implemented (2026-10-17, iteration 9)
- Employee record redesign (shared EmployeeRecord used by /admin/employees/:id and Service Book tab): hero (photo, name, badges) + separate action toolbar (Portal Live/Unlive, Edit details, Reset password, Print slip, Delete) + facts row; tabs: Profile, Salary & Leave, Service Book, Appraisals, Attendance (month, present/late/hours), Requests, Payslips

## Implemented (2026-10-17, iteration 10)
- Attendance monthly sheet (Admin > Attendance > Monthly sheet): employees x days grid merging HR Management (vendor) attendance (pulled into vendor_attendance during sync) + portal punches + approved leaves; codes P/A/L/H/W/HL, late dot, portal-punch marker, totals; "Pull from HR Management" button
- Instant push: portal punch-in/out and approved leave/missed-punch of vendor-linked employees push immediately to vendor (background), hourly sync as fallback

## Implemented (2026-10-17, iteration 11)
- Monthly sheet "Export Excel (CSV)" button: UTF-8 BOM CSV (attendance-sheet-YYYY-MM.csv) with Employee Code, Name, per-day codes (Late suffix), P/A/L/H/HL/W totals, Late Days, Paid Days = P+L+HL+W+H/2

## Backlog
- P1: Leave balance/quotas per type; mobile card layout for attendance table; set company name (COMPANY_NAME env, currently placeholder)
- P1: Attendance monthly report export (CSV/Excel)
- P2: Office geofence check on punch; forgot-password via email; selfie served via separate endpoint for large data

## Next tasks
- Replace `[Your Company Name]` in backend/.env COMPANY_NAME
