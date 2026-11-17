"""Browser regression checks for password visibility and reset confirmation hints."""
import asyncio
import base64
import json
import os
import sys
import time
from playwright.async_api import async_playwright

APP = os.environ.get("APP_URL", "http://localhost:8080").rstrip("/")
failures = []


def check(name, condition, detail=""):
    if condition:
        print("PASS", name)
    else:
        failures.append(name)
        print("FAIL", name, detail)


def jwt_segment(value):
    raw = json.dumps(value, separators=(",", ":")).encode()
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


async def main():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()
        await page.goto(f"{APP}/signin", wait_until="networkidle")
        password = page.get_by_label("Password", exact=True)
        toggle = page.get_by_role("button", name="Show password")

        check("password starts hidden", await password.get_attribute("type") == "password")
        check("toggle cannot submit", await toggle.get_attribute("type") == "button")
        check("toggle starts unpressed", await toggle.get_attribute("aria-pressed") == "false")
        check("minimum length preserved", await password.get_attribute("minlength") == "8")
        check("required preserved", await password.get_attribute("required") is not None)
        check(
            "sign-in autocomplete preserved",
            await password.get_attribute("autocomplete") == "current-password",
        )
        await page.evaluate(
            "document.querySelector('form').addEventListener('submit', event => {"
            " window.passwordToggleSubmitted = true; event.preventDefault(); })"
        )

        for theme in ("light", "dim", "dark"):
            await page.evaluate(
                "theme => { localStorage.setItem('tf-theme', theme);"
                " document.documentElement.dataset.theme = theme;"
                " document.documentElement.style.colorScheme = theme === 'light' ? 'light' : 'dark'; }",
                theme,
            )
            await toggle.click()
            check(f"{theme}: toggle reveals password", await password.get_attribute("type") == "text")
            hide = page.get_by_role("button", name="Hide password")
            check(f"{theme}: pressed state updates", await hide.get_attribute("aria-pressed") == "true")
            colour = await hide.evaluate("element => getComputedStyle(element).color")
            check(f"{theme}: toggle has a theme colour", bool(colour) and colour != "rgba(0, 0, 0, 0)", colour)
            await hide.click()
            check(f"{theme}: toggle hides password", await password.get_attribute("type") == "password")

        check(
            "toggle never submits the form",
            not await page.evaluate("Boolean(window.passwordToggleSubmitted)"),
        )
        await toggle.focus()
        await page.keyboard.press("Enter")
        check("toggle works from the keyboard", await password.get_attribute("type") == "text")
        ring = await page.get_by_role("button", name="Hide password").evaluate(
            "element => getComputedStyle(element).boxShadow"
        )
        check("keyboard focus has a visible ring", ring != "none", ring)
        await page.get_by_role("button", name="Hide password").click()
        await page.get_by_role("button", name="No account? Create one").click()
        check(
            "sign-up autocomplete preserved",
            await password.get_attribute("autocomplete") == "new-password",
        )

        now = int(time.time())
        user_id = "00000000-0000-4000-8000-000000000001"
        user = {
            "id": user_id,
            "aud": "authenticated",
            "role": "authenticated",
            "email": "password-ui@example.test",
            "app_metadata": {"provider": "email"},
            "user_metadata": {},
            "created_at": "2026-01-01T00:00:00Z",
        }
        token = ".".join(
            (
                jwt_segment({"alg": "HS256", "typ": "JWT"}),
                jwt_segment({"sub": user_id, "exp": now + 3600}),
                "regression-signature",
            )
        )

        async def recovery_user(route):
            await route.fulfill(status=200, content_type="application/json", body=json.dumps(user))

        # The UI test uses a synthetic recovery session; no real account is contacted.
        await page.route("**/auth/v1/user**", recovery_user)
        await page.goto(
            f"{APP}/reset-password#access_token={token}&refresh_token=regression-refresh"
            f"&expires_in=3600&expires_at={now + 3600}&token_type=bearer&type=recovery",
            wait_until="networkidle",
        )
        try:
            await page.get_by_label("New password", exact=True).wait_for(timeout=10000)
        except Exception:
            check("recovery form opens with a test recovery token", False, await page.locator("body").inner_text())
            await browser.close()
            print(f"{len(failures)} failed")
            sys.exit(1)

        new_password = page.get_by_label("New password", exact=True)
        confirmation = page.get_by_label("Confirm password", exact=True)
        check("two independent reset toggles", await page.get_by_role("button", name="Show password").count() == 2)
        await new_password.fill("eightchars")
        check("match hint waits for confirmation", await page.get_by_text("Passwords don't match yet").count() == 0)
        await confirmation.fill("different")
        mismatch = page.get_by_text("Passwords don't match yet", exact=True)
        await mismatch.wait_for()
        check("mismatch hint appears", await mismatch.count() == 1)
        check(
            "mismatch hint uses muted colour",
            "text-muted-foreground" in (await mismatch.get_attribute("class")),
        )
        await confirmation.fill("eightchars")
        match = page.get_by_text("Passwords match", exact=True)
        await match.wait_for()
        check("match hint appears", await match.count() == 1)
        check("match hint uses success colour", "text-success" in (await match.get_attribute("class")))
        check("match hint includes a check icon", await match.locator("svg").count() == 1)

        reset_toggles = page.get_by_role("button", name="Show password")
        await reset_toggles.nth(0).click()
        check("new password reveals independently", await new_password.get_attribute("type") == "text")
        check("confirmation stays hidden", await confirmation.get_attribute("type") == "password")
        await page.locator("#confirm-password + button").click()
        check("confirmation reveals independently", await confirmation.get_attribute("type") == "text")
        await browser.close()

    print(f"{len(failures)} failed")
    sys.exit(1 if failures else 0)


asyncio.run(main())
