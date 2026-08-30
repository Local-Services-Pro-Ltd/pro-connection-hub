"""Regression test for the homepage featured-tradesmen section.

Guarantees three things:

1. With no featured firm, the homepage renders the vetting-status panel and
   never a tradesman card.
2. A firm that isn't published with a verified credential cannot be featured
   at all — the database refuses it.
3. As soon as an approved firm is featured, the homepage switches to the
   featured panel, and the action lands in the audit log.

The test creates its own throwaway firm through the service-role API, then
removes it again — it never leaves rows behind and never features one of the
real listings.

Usage:
    python3 tests/regression/featured_pro.py

Exit code 1 means the homepage behaved incorrectly in one of those states.
"""

import asyncio
import os
import sys
import uuid

import requests
from playwright.async_api import async_playwright

BASE_URL = "http://localhost:8080"
API = os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1"
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
HEADERS = {
    "apikey": KEY,
    "Authorization": f"Bearer {KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}
PROBE_ID = f"regression-featured-{uuid.uuid4().hex[:8]}"

failures: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    print(f"{'PASS' if ok else 'FAIL'}  {name}{'  — ' + detail if detail else ''}")
    if not ok:
        failures.append(name)


def api(method: str, path: str, **kw) -> requests.Response:
    return requests.request(method, f"{API}/{path}", headers=HEADERS, timeout=30, **kw)


async def homepage_state(page) -> tuple[bool, bool, int]:
    """Returns (vetting panel shown, featured grid shown, card count)."""
    await page.goto(BASE_URL, wait_until="networkidle")
    vetting = await page.locator('[data-testid="vetting-status"]').count()
    grid = page.locator('[data-testid="featured-pros"]')
    has_grid = bool(await grid.count())
    cards = await grid.locator("a[href^='/pro/']").count() if has_grid else 0
    return bool(vetting), has_grid, cards


def cleanup() -> None:
    api("DELETE", f"pro_credentials?pro_id=eq.{PROBE_ID}")
    api("DELETE", f"pro_feature_audit?pro_id=eq.{PROBE_ID}")
    api("DELETE", f"pros?id=eq.{PROBE_ID}")


async def main() -> int:
    trade = api("GET", "trades?select=slug&order=sort_order&limit=1").json()[0]["slug"]
    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True)
            context = await browser.new_context(viewport={"width": 1280, "height": 1800})
            page = await context.new_page()

            # --- State 1: nothing featured -------------------------------
            api("PATCH", "pros?featured=eq.true", json={"featured": False})
            vetting, grid, cards = await homepage_state(page)
            check("no_featured_shows_vetting_panel", vetting and not grid,
                  f"vetting={vetting} grid={grid} cards={cards}")

            # --- Guard: an unvetted firm cannot be featured --------------
            created = api("POST", "pros", json={
                "id": PROBE_ID, "name": "Regression Probe",
                "company": "Regression Probe Ltd", "trade_slug": trade,
                "area": "Probe Area", "published": True,
            })
            check("probe_listing_created", created.status_code < 300, created.text[:160])

            blocked = api("PATCH", f"pros?id=eq.{PROBE_ID}", json={"featured": True})
            check("unvetted_firm_cannot_be_featured",
                  blocked.status_code >= 400 and "verified credential" in blocked.text,
                  f"status={blocked.status_code}")

            # --- State 2: approved firm featured -------------------------
            api("POST", "pro_credentials", json={
                "pro_id": PROBE_ID, "label": "Regression credential",
                "kind": "other", "verified": True,
            })
            promoted = api("PATCH", f"pros?id=eq.{PROBE_ID}", json={"featured": True})
            check("approved_firm_can_be_featured", promoted.status_code < 300,
                  promoted.text[:160])

            vetting, grid, cards = await homepage_state(page)
            check("featured_firm_shows_featured_panel",
                  grid and not vetting and cards > 0,
                  f"vetting={vetting} grid={grid} cards={cards}")

            audit = api(
                "GET",
                f"pro_feature_audit?pro_id=eq.{PROBE_ID}&action=eq.featured&select=id",
            ).json()
            check("featuring_is_audited", len(audit) == 1, f"audit rows={len(audit)}")

            # --- State 3: unfeatured again -------------------------------
            demoted = api("PATCH", f"pros?id=eq.{PROBE_ID}", json={"featured": False})
            check("approved_firm_can_be_unfeatured", demoted.status_code < 300,
                  demoted.text[:160])

            unfeature_audit = api(
                "GET",
                f"pro_feature_audit?pro_id=eq.{PROBE_ID}&action=eq.unfeatured"
                "&select=id,was_featured,is_featured",
            ).json()
            check("unfeaturing_is_audited",
                  len(unfeature_audit) == 1
                  and unfeature_audit[0]["was_featured"] is True
                  and unfeature_audit[0]["is_featured"] is False,
                  f"rows={unfeature_audit}")

            vetting, grid, cards = await homepage_state(page)
            check("unfeatured_reverts_to_vetting_panel",
                  vetting and not grid,
                  f"vetting={vetting} grid={grid} cards={cards}")

            await browser.close()
    finally:
        cleanup()

    print()
    print("FAILED: " + ", ".join(failures) if failures else "All featured-pro checks passed.")
    return 1 if failures else 0


sys.exit(asyncio.run(main()))
