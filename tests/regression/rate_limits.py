#!/usr/bin/env python3
"""Rate-limit regression tests for the public HTTP endpoints.

Verifies that a burst of requests against /api/public/reviews,
/api/public/vetting-status and /api/public/featured is eventually rejected
with HTTP 429 plus a Retry-After header, that normal traffic still succeeds,
and that the denial is recorded in api_access_events when a service-role key
is available.

Env:
  BASE_URL (or APP_URL)      defaults to http://localhost:8080
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   optional, enables the audit check
"""
from __future__ import annotations

import os
import sys
import time
import uuid

import requests

BASE_URL = (os.environ.get("BASE_URL") or os.environ.get("APP_URL") or "http://localhost:8080").rstrip("/")
SUPA_URL = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
SERVICE = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

failures: list[str] = []
skipped: list[str] = []

# Each endpoint: path, per-window limit configured in the route, window seconds.
ENDPOINTS = [
    ("/api/public/reviews?limit=1", 60, 60),
    ("/api/public/vetting-status", 120, 60),
    ("/api/public/featured", 120, 60),
]


def check(name: str, ok: bool, detail: str = "") -> None:
    print(f"{'PASS' if ok else 'FAIL'}  {name}{' — ' + detail if detail else ''}")
    if not ok:
        failures.append(f"{name}: {detail}")


def spoofed(ip: str) -> dict:
    """A unique forwarded IP gives each test its own rate-limit bucket."""
    return {"x-forwarded-for": ip, "user-agent": "tf-rate-limit-test"}


def wait_for_headroom(path: str, headers: dict, attempts: int = 12) -> None:
    for _ in range(attempts):
        res = requests.get(f"{BASE_URL}{path}", headers=headers, timeout=20)
        if res.status_code != 429:
            return
        time.sleep(5)


def test_endpoint(path: str, limit: int, window: int) -> None:
    ip = f"203.0.113.{uuid.uuid4().int % 200 + 10}"
    headers = spoofed(ip)
    wait_for_headroom(path, headers, attempts=3)

    first = requests.get(f"{BASE_URL}{path}", headers=headers, timeout=20)
    check(
        f"{path} serves normal traffic",
        first.status_code == 200,
        f"HTTP {first.status_code}",
    )

    limited = None
    sent = 0
    for _ in range(limit + 20):
        sent += 1
        res = requests.get(f"{BASE_URL}{path}", headers=headers, timeout=20)
        if res.status_code == 429:
            limited = res
            break

    check(
        f"{path} rate limits a burst",
        limited is not None,
        f"no 429 after {sent} requests (limit {limit}/{window}s)",
    )
    if limited is not None:
        check(
            f"{path} 429 carries Retry-After",
            bool(limited.headers.get("retry-after")),
            "missing Retry-After header",
        )
        body = limited.json() if limited.headers.get("content-type", "").startswith("application/json") else {}
        check(
            f"{path} 429 body says rate_limited",
            body.get("error") == "rate_limited",
            str(body)[:120],
        )
        check(
            f"{path} limit kicks in near the configured threshold",
            sent <= limit + 5,
            f"took {sent} requests for a {limit} limit",
        )

    # A different caller must not be punished for this burst.
    other = requests.get(
        f"{BASE_URL}{path}", headers=spoofed(f"198.51.100.{uuid.uuid4().int % 200 + 10}"), timeout=20
    )
    check(
        f"{path} limits are per caller",
        other.status_code == 200,
        f"other caller got HTTP {other.status_code}",
    )


def test_denials_recorded() -> None:
    if not (SUPA_URL and SERVICE):
        skipped.append("api_access_events audit (no service-role key)")
        print("SKIP  denied events recorded in api_access_events")
        return
    res = requests.get(
        f"{SUPA_URL}/rest/v1/api_access_events",
        headers={"apikey": SERVICE, "Authorization": f"Bearer {SERVICE}"},
        params={
            "select": "endpoint,outcome,status",
            "outcome": "eq.rate_limited",
            "order": "created_at.desc",
            "limit": "20",
        },
        timeout=20,
    )
    rows = res.json() if res.ok else []
    check(
        "rate-limit denials are recorded for the admin events page",
        res.ok and len(rows) > 0,
        f"HTTP {res.status_code}, {len(rows) if res.ok else 0} rows",
    )


def test_anon_cannot_read_events() -> None:
    anon = os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("SUPABASE_PUBLISHABLE_KEY")
    if not (SUPA_URL and anon):
        skipped.append("anon read of api_access_events (no anon key)")
        print("SKIP  anonymous visitors cannot read api_access_events")
        return
    res = requests.get(
        f"{SUPA_URL}/rest/v1/api_access_events",
        headers={"apikey": anon, "Authorization": f"Bearer {anon}"},
        params={"select": "id", "limit": "1"},
        timeout=20,
    )
    rows = res.json() if res.ok else []
    check(
        "anonymous visitors cannot read denied access events",
        (not res.ok) or rows == [],
        f"HTTP {res.status_code}: {str(rows)[:120]}",
    )


def main() -> int:
    print(f"Rate-limit regression against {BASE_URL}\n")
    for path, limit, window in ENDPOINTS:
        test_endpoint(path, limit, window)
        print()
    test_denials_recorded()
    test_anon_cannot_read_events()

    print(f"\n{len(failures)} failure(s), {len(skipped)} skipped.")
    for f in failures:
        print(f" - {f}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
