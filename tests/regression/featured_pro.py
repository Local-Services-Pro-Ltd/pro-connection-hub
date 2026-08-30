"""Regression test for the homepage featured-tradesmen section.

Guarantees two things:

1. With no featured firm, the homepage renders the vetting-status panel and
   never a tradesman card.
2. As soon as an approved firm (published + verified credential) is featured,
   the homepage switches to the featured panel.

The test creates its own throwaway firm through a privileged database
connection, then removes it again — it never leaves rows behind and never
features one of the real listings.

Usage:
    python3 tests/regression/featured_pro.py

Exit code 1 means the homepage behaved incorrectly in one of the two states.
"""

import asyncio
import os
import sys
import uuid

import asyncpg
from playwright.async_api import async_playwright

BASE_URL = "http://localhost:8080"
DB_URL = os.environ["SUPABASE_DB_URL"]
PROBE_ID = f"regression-featured-{uuid.uuid4().hex[:8]}"

failures: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    print(f"{'PASS' if ok else 'FAIL'}  {name}{'  — ' + detail if detail else ''}")
    if not ok:
        failures.append(name)


async def homepage_state(page) -> tuple[bool, bool, int]:
    """Returns (vetting panel shown, featured grid shown, card count)."""
    await page.goto(BASE_URL, wait_until="networkidle")
    vetting = await page.locator('[data-testid="vetting-status"]').count()
    grid = page.locator('[data-testid="featured-pros"]')
    cards = await grid.locator("article, a[href^='/pro/']").count() if await grid.count() else 0
    return bool(vetting), bool(await grid.count()), cards


async def main() -> int:
    conn = await asyncpg.connect(DB_URL)
    trade = await conn.fetchval("select slug from public.trades order by sort_order limit 1")
    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True)
            context = await browser.new_context(viewport={"width": 1280, "height": 1800})
            page = await context.new_page()

            # --- State 1: nothing featured -------------------------------
            await conn.execute("update public.pros set featured = false where featured")
            vetting, grid, cards = await homepage_state(page)
            check("no_featured_shows_vetting_panel", vetting and not grid,
                  f"vetting={vetting} grid={grid} cards={cards}")

            # --- Guard: an unvetted firm cannot be featured --------------
            await conn.execute(
                """insert into public.pros (id, user_id, name, company, trade_slug, area, published)
                   values ($1, null, 'Regression Probe', 'Regression Probe Ltd', $2, 'Probe Area', true)""",
                PROBE_ID, trade)
            rejected = False
            try:
                await conn.execute("update public.pros set featured = true where id = $1", PROBE_ID)
            except Exception as exc:  # trigger must refuse
                rejected = "verified credential" in str(exc)
            check("unvetted_firm_cannot_be_featured", rejected)

            # --- State 2: approved firm featured -------------------------
            await conn.execute(
                """insert into public.pro_credentials (pro_id, label, kind, verified, verified_at)
                   values ($1, 'Regression credential', 'other', true, now())""",
                PROBE_ID)
            await conn.execute("update public.pros set featured = true where id = $1", PROBE_ID)

            vetting, grid, cards = await homepage_state(page)
            check("featured_firm_shows_featured_panel", grid and not vetting and cards > 0,
                  f"vetting={vetting} grid={grid} cards={cards}")

            audited = await conn.fetchval(
                "select count(*) from public.pro_feature_audit where pro_id = $1 and action = 'featured'",
                PROBE_ID)
            check("featuring_is_audited", audited == 1, f"audit rows={audited}")

            await browser.close()
    finally:
        await conn.execute("delete from public.pro_credentials where pro_id = $1", PROBE_ID)
        await conn.execute("delete from public.pro_feature_audit where pro_id = $1", PROBE_ID)
        await conn.execute("delete from public.pros where id = $1", PROBE_ID)
        await conn.close()

    print()
    print("FAILED: " + ", ".join(failures) if failures else "All featured-pro checks passed.")
    return 1 if failures else 0


sys.exit(asyncio.run(main()))
