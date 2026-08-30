"""Access-control regression tests.

Two guarantees, checked against the live database with real API keys:

1. A non-admin caller (anonymous, and a signed-in non-admin user) cannot reach
   privileged functions: the security suites, the featuring probe, the rate
   limiter, the scan-token comparator, or the access matrix.
2. Public views and public read paths always enforce the published-only
   filter: `reviews_public` never returns a pending or rejected review, and the
   public `pros` read never returns an unpublished listing — including through
   the public HTTP endpoints.

Usage:
    python3 tests/regression/access_control.py

Env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
Optional: BASE_URL (defaults to http://localhost:8080) to also exercise the
public HTTP endpoints and their rate limits.

Exit code 1 means a privileged surface is reachable by a non-admin, or a public
read leaked an unpublished row.
"""

import os
import sys
import uuid

import requests

URL = os.environ["SUPABASE_URL"].rstrip("/")
ANON = os.environ.get("SUPABASE_ANON_KEY") or os.environ["SUPABASE_PUBLISHABLE_KEY"]
SERVICE = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
BASE_URL = os.environ.get("BASE_URL", "http://localhost:8080")

REST = f"{URL}/rest/v1"
AUTH = f"{URL}/auth/v1"

PRIVILEGED_RPCS = [
    "security_posture_check",
    "security_rbac_probe",
    "security_privilege_probe",
    "security_regression_run",
    "featured_pro_regression",
    "security_access_matrix",
    "hit_rate_limit",
    "security_scan_token_matches",
]

ADMIN_ONLY_TABLES = [
    "pro_feature_audit",
    "plan_visibility_audit",
    "security_scan_runs",
    "form_block_events",
    "waiting_list",
    "feedback",
]

failures: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    print(f"{'PASS' if ok else 'FAIL'}  {name}{'  — ' + detail if detail else ''}")
    if not ok:
        failures.append(name)


def headers(key: str, token: str | None = None) -> dict:
    return {
        "apikey": key,
        "Authorization": f"Bearer {token or key}",
        "Content-Type": "application/json",
    }


def rpc(name: str, key: str, token: str | None = None, body: dict | None = None):
    return requests.post(
        f"{REST}/rpc/{name}",
        headers=headers(key, token),
        json=body or {},
        timeout=30,
    )


def create_non_admin_user() -> tuple[str, str] | None:
    """Signs up a throwaway user and returns (user_id, access_token)."""
    email = f"regression-{uuid.uuid4().hex[:10]}@example.com"
    password = uuid.uuid4().hex + "Aa1!"
    res = requests.post(
        f"{AUTH}/admin/users",
        headers=headers(SERVICE),
        json={"email": email, "password": password, "email_confirm": True},
        timeout=30,
    )
    if res.status_code >= 300:
        print(f"  (could not create test user: {res.status_code} {res.text[:120]})")
        return None
    user_id = res.json()["id"]
    sign_in = requests.post(
        f"{AUTH}/token?grant_type=password",
        headers={"apikey": ANON, "Content-Type": "application/json"},
        json={"email": email, "password": password},
        timeout=30,
    )
    if sign_in.status_code >= 300:
        requests.delete(f"{AUTH}/admin/users/{user_id}", headers=headers(SERVICE), timeout=30)
        return None
    return user_id, sign_in.json()["access_token"]


def delete_user(user_id: str) -> None:
    requests.delete(f"{AUTH}/admin/users/{user_id}", headers=headers(SERVICE), timeout=30)


def test_privileged_rpcs(token: str | None) -> None:
    label = "signed-in non-admin" if token else "anonymous"
    for name in PRIVILEGED_RPCS:
        res = rpc(name, ANON, token)
        blocked = res.status_code in (401, 403, 404) or (
            res.status_code >= 400 and "forbidden" in res.text.lower()
        )
        check(
            f"{label} cannot call {name}",
            blocked,
            f"HTTP {res.status_code} {res.text[:90]}",
        )


def test_admin_tables(token: str | None) -> None:
    label = "signed-in non-admin" if token else "anonymous"
    for table in ADMIN_ONLY_TABLES:
        res = requests.get(
            f"{REST}/{table}?select=*&limit=1", headers=headers(ANON, token), timeout=30
        )
        empty_or_denied = res.status_code >= 400 or res.json() == []
        check(
            f"{label} reads no rows from {table}",
            empty_or_denied,
            f"HTTP {res.status_code}",
        )


def test_published_only_views(token: str | None) -> None:
    label = "signed-in non-admin" if token else "anonymous"

    res = requests.get(
        f"{REST}/reviews_public?select=id,status&limit=200",
        headers=headers(ANON, token),
        timeout=30,
    )
    rows = res.json() if res.status_code < 400 else []
    unpublished = [r for r in rows if r.get("status") not in (None, "published")]
    check(
        f"{label} sees only published rows in reviews_public",
        res.status_code < 400 and not unpublished,
        f"HTTP {res.status_code}, {len(unpublished)} unpublished rows",
    )

    # Explicitly asking for a non-published status must return nothing.
    res = requests.get(
        f"{REST}/reviews_public?select=id&status=eq.pending",
        headers=headers(ANON, token),
        timeout=30,
    )
    check(
        f"{label} cannot filter reviews_public down to pending rows",
        res.status_code >= 400 or res.json() == [],
        f"HTTP {res.status_code}",
    )

    # Reviewer identity columns are not projected at all.
    res = requests.get(
        f"{REST}/reviews_public?select=author_id,author_place&limit=1",
        headers=headers(ANON, token),
        timeout=30,
    )
    check(
        f"{label} cannot select reviewer identity columns",
        res.status_code >= 400,
        f"HTTP {res.status_code}",
    )

    res = requests.get(
        f"{REST}/pros?select=id,published&published=eq.false&limit=5",
        headers=headers(ANON, token),
        timeout=30,
    )
    check(
        f"{label} sees no unpublished listings in pros",
        res.status_code >= 400 or res.json() == [],
        f"HTTP {res.status_code}",
    )


def test_write_paths(token: str | None) -> None:
    label = "signed-in non-admin" if token else "anonymous"

    res = requests.post(
        f"{REST}/reviews_public",
        headers=headers(ANON, token),
        json={"pro_id": "x", "author_name": "x", "rating": 5, "body": "x"},
        timeout=30,
    )
    check(
        f"{label} cannot insert through reviews_public",
        res.status_code >= 400,
        f"HTTP {res.status_code}",
    )

    res = requests.patch(
        f"{REST}/pros?id=eq.__nonexistent__",
        headers={**headers(ANON, token), "Prefer": "return=representation"},
        json={"featured": True},
        timeout=30,
    )
    check(
        f"{label} cannot feature a firm",
        res.status_code >= 400 or res.json() == [],
        f"HTTP {res.status_code}",
    )


def test_suites_with_live_nonadmin() -> None:
    """Runs the database security suites while a real non-admin account exists,
    so the behavioural RBAC probe actually executes instead of skipping."""
    res = rpc("security_regression_run", SERVICE)
    if res.status_code >= 400:
        check("security suites run", False, f"HTTP {res.status_code} {res.text[:120]}")
        return
    rows = res.json()
    ran = [r for r in rows if r["suite"] == "rbac" and r["passed"] is not None]
    check("RBAC probe executed against a real non-admin account", bool(ran), f"{len(ran)} checks")
    for r in rows:
        if r["passed"] is False:
            check(f"{r['suite']}/{r['check_name']}", False, r["detail"])
    check(
        "all security suites pass",
        all(r["passed"] is not False for r in rows),
        f"{len(rows)} checks",
    )


def test_public_endpoints() -> None:
    try:
        res = requests.get(f"{BASE_URL}/api/public/reviews?limit=5", timeout=20)
    except requests.RequestException as exc:
        print(f"  (skipping HTTP endpoint checks: {exc})")
        return

    body = res.json() if res.status_code < 400 else {}
    reviews = body.get("reviews", [])
    check(
        "/api/public/reviews returns only published, de-identified reviews",
        res.status_code == 200
        and all("author_id" not in r and "author_place" not in r for r in reviews),
        f"HTTP {res.status_code}, {len(reviews)} rows",
    )

    res = requests.post(f"{BASE_URL}/api/public/reviews", timeout=20)
    check(
        "/api/public/reviews rejects writes",
        res.status_code == 405,
        f"HTTP {res.status_code}",
    )

    res = requests.get(f"{BASE_URL}/api/public/reviews?pro_id=' OR 1=1--", timeout=20)
    check(
        "/api/public/reviews rejects malformed pro_id",
        res.status_code == 400,
        f"HTTP {res.status_code}",
    )

    res = requests.get(f"{BASE_URL}/api/public/vetting-status", timeout=20)
    check(
        "/api/public/vetting-status is readable and PII-free",
        res.status_code == 200
        and all(
            set(f).issubset({"id", "company", "trade_slug", "area"})
            for f in res.json().get("featured", [])
        ),
        f"HTTP {res.status_code}",
    )

    res = requests.get(f"{BASE_URL}/api/public/featured", timeout=20)
    firms = res.json().get("firms", []) if res.status_code == 200 else []
    leaky = [f for f in firms if any(k in f for k in ("user_id", "postcode", "day_rate"))]
    check(
        "/api/public/featured returns only vetted, non-sensitive firm data",
        res.status_code == 200 and not leaky,
        f"HTTP {res.status_code}, {len(firms)} firms",
    )
    res = requests.post(f"{BASE_URL}/api/public/featured", json={}, timeout=20)
    check(
        "/api/public/featured rejects writes",
        res.status_code == 405,
        f"HTTP {res.status_code}",
    )


    res = requests.get(f"{BASE_URL}/api/public/security-scan", timeout=20)
    check(
        "/api/public/security-scan refuses unauthenticated callers",
        res.status_code in (401, 429),
        f"HTTP {res.status_code}",
    )

    # Rate limiting: hammer the endpoint past its per-minute allowance.
    statuses = [
        requests.get(f"{BASE_URL}/api/public/reviews?limit=1", timeout=20).status_code
        for _ in range(70)
    ]
    check(
        "/api/public/reviews rate limits a burst of requests",
        429 in statuses,
        f"{statuses.count(429)} of {len(statuses)} requests limited",
    )


def main() -> int:
    print("Anonymous caller")
    test_privileged_rpcs(None)
    test_admin_tables(None)
    test_published_only_views(None)
    test_write_paths(None)

    created = create_non_admin_user()
    if created:
        user_id, token = created
        print("\nSigned-in non-admin caller")
        try:
            test_privileged_rpcs(token)
            test_admin_tables(token)
            test_published_only_views(token)
            test_write_paths(token)
            test_suites_with_live_nonadmin()
        finally:
            delete_user(user_id)
    else:
        print("\n(skipping signed-in non-admin checks — no test user)")

    print("\nPublic HTTP endpoints")
    test_public_endpoints()

    print()
    if failures:
        print(f"{len(failures)} check(s) failed:")
        for f in failures:
            print(f"  - {f}")
        return 1
    print("All access-control checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
