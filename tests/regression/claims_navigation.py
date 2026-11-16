"""Browser checks for the simplified header and public listing-claim search.
Run with the app on localhost:8080. Search fixture names are supplied by the
isolated database fixture setup and removed after the test run."""
import asyncio, os, sys
from playwright.async_api import async_playwright

APP = os.environ.get("APP_URL", "http://localhost:8080").rstrip("/")
failures: list[str] = []
passes = 0

def check(name: str, ok: bool, detail: str = "") -> None:
    global passes
    if ok:
        passes += 1
        print("PASS", name)
    else:
        failures.append(name)
        print("FAIL", name, detail)

async def main() -> None:
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()
        errors: list[str] = []
        page.on("pageerror", lambda error: errors.append(str(error)))

        for width in (1024, 1280, 1440):
            await page.set_viewport_size({"width": width, "height": 1000})
            await page.goto(f"{APP}/join", wait_until="networkidle")
            dimensions = await page.evaluate("""() => ({
              viewport: window.innerWidth,
              page: document.documentElement.scrollWidth,
              header: document.querySelector('header')?.getBoundingClientRect().right ?? 0,
            })""")
            check(f"header has no overflow at {width}px", dimensions["page"] <= dimensions["viewport"] and dimensions["header"] <= dimensions["viewport"], str(dimensions))
            check(f"trade join/claim action visible at {width}px", await page.get_by_role("link", name="For trades: Join or claim").is_visible())

        await page.get_by_role("button", name="More").focus()
        await page.keyboard.press("Enter")
        check("More opens from the keyboard", await page.get_by_role("menu").is_visible())
        check("More contains Project board", await page.get_by_role("menuitem", name="Project board").is_visible())
        await page.keyboard.press("Escape")
        await page.get_by_role("menu").wait_for(state="hidden")
        check("More closes with Escape", not await page.get_by_role("menu").is_visible())
        check("appearance controls left the header", await page.locator("header").get_by_label("Switch to dark theme").count() + await page.locator("header").get_by_label("Switch to light theme").count() == 0)

        results = await page.evaluate("""async () => {
          const module = await import('/src/lib/claims.functions.ts');
          return module.searchClaimableListings({ data: { query: 'ZZ Claim Fixture' } });
        }""")
        check("claim search returns at most 10 results", isinstance(results, list) and len(results) <= 10, str(results))
        check("claim search returns only public fields", all(set(row) == {"id", "company", "trade", "area"} for row in results), str(results))
        companies = [row["company"] for row in results]
        check("claim search returns eligible unowned published listing", "ZZ Claim Fixture Eligible" in companies, str(companies))
        check("claim search excludes owned listing", "ZZ Claim Fixture Owned" not in companies, str(companies))
        check("claim search excludes unpublished listing", "ZZ Claim Fixture Hidden" not in companies, str(companies))
        check("claim search exposes no contact fields", all(not any(key in row for key in ("email", "phone", "contact_email", "user_id")) for row in results), str(results))

        try:
            await page.evaluate("""async () => {
              const module = await import('/src/lib/claims.functions.ts');
              return module.searchClaimableListings({ data: { query: 'zz' } });
            }""")
            check("claim search enforces minimum 3 characters", False)
        except Exception:
            check("claim search enforces minimum 3 characters", True)

        await page.get_by_label("Business name or postcode").fill("ZZ Claim Fixture")
        await page.get_by_role("button", name="Search", exact=True).click()
        claim_link = page.get_by_role("link", name="Claim this listing")
        await claim_link.wait_for()
        check("on-page search displays the eligible result", await claim_link.count() == 1 and await page.get_by_text("ZZ Claim Fixture Eligible", exact=True).is_visible())
        await claim_link.click()
        await page.wait_for_url("**/claim/zz-claim-fixture-eligible")
        check("claim page shows the selected listing", await page.get_by_text("ZZ Claim Fixture Eligible", exact=True).is_visible())
        create_account = page.get_by_role("button", name="Create account")
        await create_account.wait_for()
        check("claim page asks for email sign-in or account creation", await create_account.is_visible() and await page.get_by_role("button", name="Already have an account? Sign in").is_visible())
        check("claim form stays unavailable before sign-in", await page.get_by_label("I confirm I'm authorised to manage this business's listing.").count() == 0)

        await page.set_viewport_size({"width": 390, "height": 844})
        await page.goto(f"{APP}/join", wait_until="networkidle")
        mobile_width = await page.evaluate("document.documentElement.scrollWidth")
        check("join has no horizontal overflow at 390px", mobile_width <= 390, str(mobile_width))
        await page.get_by_role("button", name="Open menu").click()
        post = page.locator("header").get_by_role("link", name="Post a job", exact=True)
        trade = page.locator("header").get_by_role("link", name="For trades: Join or claim")
        first_nav = page.locator("header").get_by_role("link", name="Find a tradesman", exact=True)
        action_widths = [await item.evaluate("el => Math.abs(el.getBoundingClientRect().width - el.parentElement.getBoundingClientRect().width) < 2") for item in (post, trade)]
        check("mobile actions are full width", all(action_widths), str(action_widths))
        check("mobile actions precede navigation links", await post.evaluate("(el, other) => el.getBoundingClientRect().bottom < other.getBoundingClientRect().top", await first_nav.element_handle()) and await trade.evaluate("(el, other) => el.getBoundingClientRect().bottom < other.getBoundingClientRect().top", await first_nav.element_handle()))
        check("no browser runtime errors", not errors, str(errors))
        await browser.close()

    print(f"{passes} passed, {len(failures)} failed")
    if failures:
        sys.exit(1)

asyncio.run(main())
