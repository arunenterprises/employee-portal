from io import BytesIO
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image

INK = colors.HexColor("#0F172A")
MUTED = colors.HexColor("#64748B")
LINE = colors.HexColor("#E2E8F0")
BRAND = colors.HexColor("#1D4ED8")


def money(v):
    return f"Rs. {float(v or 0):,.2f}"


def build_payslip_pdf(slip: dict, emp: dict, company: dict) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=18 * mm, bottomMargin=18 * mm)
    ss = getSampleStyleSheet()
    title = ParagraphStyle("t", parent=ss["Title"], fontSize=20, alignment=0, textColor=INK, spaceAfter=4)
    sub = ParagraphStyle("s", parent=ss["Normal"], fontSize=10, textColor=MUTED)
    month_label = datetime.strptime(slip["month"], "%Y-%m").strftime("%B %Y")

    small = ParagraphStyle("sm", parent=sub, fontSize=8.5, leading=11)
    head_text = [Paragraph(company["name"], title), Paragraph(company["address"], small), Paragraph(company["contact"], small)]
    head = Table([[Image(company["logo"], width=26 * mm, height=18.4 * mm), head_text]], colWidths=[30 * mm, 144 * mm])
    head.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                              ("LINEBELOW", (0, 0), (-1, -1), 1.2, BRAND), ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
    pay_title = ParagraphStyle("pt", parent=ss["Normal"], fontSize=12, fontName="Helvetica-Bold", textColor=INK, alignment=1)
    els = [head, Spacer(1, 6 * mm), Paragraph(f"PAYSLIP FOR THE MONTH OF {month_label.upper()}", pay_title), Spacer(1, 6 * mm)]

    g = emp.get
    info = [
        ["Employee Name", g("name", ""), "Employee ID", g("employee_id", "")],
        ["Designation", g("designation", ""), "Department", g("department", "")],
        ["Date of Joining", g("joining_date", ""), "PAN", g("pan", "")],
        ["Bank A/C", g("bank_account", ""), "UAN", g("uan", "")],
        ["Working Days", str(slip.get("working_days", 0)), "Paid Days", str(slip.get("paid_days", 0))],
    ]
    t = Table(info, colWidths=[32 * mm, 54 * mm, 30 * mm, 58 * mm])
    t.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), MUTED), ("TEXTCOLOR", (2, 0), (2, -1), MUTED),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica-Bold"), ("FONTNAME", (3, 0), (3, -1), "Helvetica-Bold"),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, LINE), ("BOTTOMPADDING", (0, 0), (-1, -1), 6), ("TOPPADDING", (0, 0), (-1, -1), 6),
    ]))
    els += [t, Spacer(1, 8 * mm)]

    earn, ded = slip.get("earnings", []), slip.get("deductions", [])
    rows = [["Earnings", "Amount", "Deductions", "Amount"]]
    for i in range(max(len(earn), len(ded))):
        e = earn[i] if i < len(earn) else None
        d = ded[i] if i < len(ded) else None
        rows.append([e["label"] if e else "", money(e["amount"]) if e else "", d["label"] if d else "", money(d["amount"]) if d else ""])
    rows.append(["Gross Earnings", money(slip.get("gross")), "Total Deductions", money(slip.get("total_deductions"))])
    t2 = Table(rows, colWidths=[52 * mm, 35 * mm, 52 * mm, 35 * mm])
    t2.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BACKGROUND", (0, 0), (-1, 0), INK), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"), ("ALIGN", (3, 0), (3, -1), "RIGHT"),
        ("LINEBELOW", (0, 1), (-1, -1), 0.5, LINE), ("LINEABOVE", (0, -1), (-1, -1), 1, INK),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6), ("TOPPADDING", (0, 0), (-1, -1), 6),
    ]))
    els += [t2, Spacer(1, 6 * mm)]

    t3 = Table([["NET PAY", money(slip.get("net"))]], colWidths=[87 * mm, 87 * mm])
    t3.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BRAND), ("TEXTCOLOR", (0, 0), (-1, -1), colors.white),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 13),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"), ("BOTTOMPADDING", (0, 0), (-1, -1), 10), ("TOPPADDING", (0, 0), (-1, -1), 10),
    ]))
    els += [t3, Spacer(1, 10 * mm), Paragraph("This is a system generated payslip and does not require a signature.", sub)]
    doc.build(els)
    return buf.getvalue()
