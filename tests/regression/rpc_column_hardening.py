"""Regression tests for the RPC + column hardening (migration 0041).

Checks:
1. Anonymous callers cannot execute set_question_ai.
2. answer_question rejects anonymous callers, no longer accepts a
   caller-supplied user id, and (when a signed-in token is supplied) derives
   the firm from the caller's own session.
3. Anonymous callers cannot read private columns on pros / projects, while
   the public columns still load.

Usage: python3 tests/regression/rpc_column_hardening.py
Env: SUPABASE_URL (or VITE_SUPABASE_URL), SUPABASE_PUBLISHABLE_KEY (or
VITE_SUPABASE_PUBLISHABLE_KEY). Optional TEST_USER_ACCESS_TOKEN: a signed-in
user who owns no published firm -> must get not_a_published_pro.
"""

import os
import sys
import uuid

import requests

URL = (os.environ.get("SUPABASE_URL") or os.environ["VITE_SUPABASE_URL"]).rstrip("/")
ANON = os.environ.get("SUPABASE_PUBLISHABLE_KEY") or os.environ["VITE_SUPABASE_PUBLISHABLE_KEY"]
REST = f"{URL}/rest/v1"
H = {"apikey": ANON, "Content-Type": "application/json"}

failures: list[str] = []
passes = 0


def check(name: str, ok: bool, detail: str = "") -> None:
    global passes
    if ok:
        passes += 1
        print(f"PASS {name}")
    else:
        failures.append(name)
        print(f"FAIL {name} {detail}")


def rpc(fn: str, body: dict, headers: dict = H) -> requests.Response:
    return requests.post(f"{REST}/rpc/{fn}", json=body, headers=headers, timeout=20)


# 1. set_question_ai
r = rpc("set_question_ai", {"p_question_id": str(uuid.uuid4()), "p_answer": "pwned"})
check("anon cannot call set_question_ai", r.status_code in (401, 403, 404), f"{r.status_code} {r.text[:200]}")

# 2. answer_question
r = rpc("answer_question", {"p_question_id": str(uuid.uuid4()), "p_body": "x" * 30})
check("anon cannot call answer_question", r.status_code in (401, 403, 404), f"{r.status_code} {r.text[:200]}")
r = rpc("answer_question", {"p_question_id": str(uuid.uuid4()), "p_user_id": str(uuid.uuid4()), "p_body": "x" * 30})
check("answer_question no longer accepts p_user_id", r.status_code in (401, 403, 404), f"{r.status_code} {r.text[:200]}")

token = os.environ.get("TEST_USER_ACCESS_TOKEN")
if token:
    auth_h = {**H, "Authorization": f"Bearer {token}"}
    r = rpc("answer_question", {"p_question_id": str(uuid.uuid4()), "p_body": "x" * 30}, auth_h)
    check("answer_question uses caller's own pro", "not_a_published_pro" in r.text or "question_not_available" in r.text, f"{r.status_code} {r.text[:200]}")
else:
    print("SKIP signed-in answer_question check (no TEST_USER_ACCESS_TOKEN)")

# 3. column exposure
PRIVATE = {
    "pros": ["contact_email", "subscription_ref", "subscription_status", "subscription_provider", "current_period_end", "user_id"],
    "projects": ["contact_email", "contact_name", "reviewer_note", "reviewed_by", "user_id", "notify_applications"],
}
for table, cols in PRIVATE.items():
    for col in cols:
        r = requests.get(f"{REST}/{table}", params={"select": col, "limit": 1}, headers=H, timeout=20)
        check(f"anon cannot read {table}.{col}", r.status_code in (401, 403), f"{r.status_code} {r.text[:120]}")
    r = requests.get(f"{REST}/{table}", params={"select": "*", "limit": 1}, headers=H, timeout=20)
    check(f"anon select * on {table} is refused", r.status_code in (401, 403), f"{r.status_code}")

r = requests.get(f"{REST}/pros", params={"select": "id,company,rating", "published": "eq.true", "limit": 1}, headers=H, timeout=20)
check("public pros columns still readable", r.status_code == 200, f"{r.status_code} {r.text[:120]}")
r = requests.get(f"{REST}/projects", params={"select": "id,title,status", "limit": 1}, headers=H, timeout=20)
check("public projects columns still readable", r.status_code == 200, f"{r.status_code} {r.text[:120]}")

print(f"\n{passes} passed, {len(failures)} failed")
sys.exit(1 if failures else 0)
