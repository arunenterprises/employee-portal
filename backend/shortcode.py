import re
import secrets

ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
SHORT_RE = re.compile(r"^[A-Z0-9]{5,6}$")


async def short_code_taken(db, code: str, exclude_id=None) -> bool:
    q = {"$or": [{"short_code": code}, {"employee_id": code}]}
    if exclude_id is not None:
        q["_id"] = {"$ne": exclude_id}
    return bool(await db.users.find_one(q, {"_id": 1}))


async def make_short_code(db, employee_id: str, exclude_id=None) -> str:
    groups = re.findall(r"\d+", employee_id or "")
    if groups:
        n = int(max(groups, key=len))
        cand = f"AE{n:04d}" if n < 10000 else f"A{n:05d}" if n < 100000 else ""
        if cand and not await short_code_taken(db, cand, exclude_id):
            return cand
    while True:
        cand = "AE" + "".join(secrets.choice(ALPHABET) for _ in range(4))
        if not await short_code_taken(db, cand, exclude_id):
            return cand
