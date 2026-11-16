"""End-to-end checks for /join: meta, sitemap, tiles, required-only submit,
consent rejection and honeypot block. Cleans up the test application it creates."""
import asyncio, os, re, sys, time, requests
from playwright.async_api import async_playwright

APP = os.environ.get("APP_URL", "http://localhost:8080").rstrip("/")
fails, passes = [], 0
def check(name, ok, detail=""):
    global passes
    if ok: passes += 1; print("PASS", name)
    else: fails.append(name); print("FAIL", name, detail)

def solve(q):
    m = re.search(r"(\d+)\s*([+\-−×x*])\s*(\d+)", q)
    a, op, b = int(m.group(1)), m.group(2), int(m.group(3))
    return str(a + b if op == "+" else a - b if op in "-−" else a * b)

async def fill(page, email, consent=True, honeypot=""):
    await page.goto(f"{APP}/join", wait_until="networkidle")
    await page.get_by_label("Sole trader").check()
    await page.get_by_label("Business or trading name").fill("Join Test Plumbing")
    sel = page.get_by_label("Your main trade")
    await sel.select_option(index=1)
    await page.get_by_label("Postcode you work from").fill("SE18 7JH")
    await page.get_by_label("What work do you do?").fill("Boiler repairs and bathrooms across south-east London for 10 years.")
    await page.get_by_label("Your full name").fill("Test Applicant")
    await page.get_by_label("Email", exact=True).fill(email)
    for _ in range(40):
        q = await page.locator("span[aria-live=polite]").inner_text()
        if q and "Loading" not in q: break
        await page.wait_for_timeout(250)
    await page.get_by_label(q).fill(solve(q))
    if honeypot:
        await page.locator("input[tabindex='-1']").first.fill(honeypot)
    cb = page.locator("input[type=checkbox]")
    if consent: await cb.check()
    else: await cb.evaluate("el => el.removeAttribute('required')")
    await page.get_by_role("button", name="Send application").click()

async def main():
    html = requests.get(f"{APP}/join", timeout=30).text
    title = re.search(r"<title>(.*?)</title>", html, re.S).group(1)
    check("unique /join title", "Join TradesmanFinder" in title, title)
    check("/join meta description", 'name="description"' in html and "5 working days" in html)
    check("/join canonical", 'rel="canonical" href="https://tradesmanfinder.org/join"' in html)
    claim_title = re.search(r"<title>(.*?)</title>", requests.get(f"{APP}/claim", timeout=30).text, re.S).group(1)
    check("/join title differs from /claim", claim_title != title)
    check("/join in sitemap", "https://tradesmanfinder.org/join<" in requests.get(f"{APP}/sitemap.xml", timeout=30).text)
    for v in ["Free", "50% off", "£0", "30 days", "notice before anything is charged"]:
        check(f"tile {v} renders", v in html)

    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        page = await (await b.new_context(viewport={"width": 1280, "height": 1800})).new_page()
        stamp = int(time.time())
        await fill(page, f"join-consent-{stamp}@example.com", consent=False)
        await page.wait_for_timeout(2500)
        alert = await page.locator("[role=alert]").all_inner_texts()
        check("missing consent rejected", any("declaration" in a for a in alert), str(alert))

        await fill(page, f"join-hp-{stamp}@example.com", honeypot="http://spam.example")
        await page.wait_for_timeout(2500)
        alert = await page.locator("[role=alert]").all_inner_texts()
        check("honeypot blocked", any("went wrong" in a for a in alert) and not await page.get_by_text("we've got your application").count(), str(alert))

        email = f"join-ok-{stamp}@example.com"
        await fill(page, email)
        await page.get_by_text("Thanks — we've got your application.").wait_for(timeout=15000)
        body = await page.locator("[role=status]").inner_text()
        check("required-only submission succeeds", "5 working days" in body and email in body, body)
        await b.close()
    print(f"JOIN_EMAIL={email}")
    print(f"{passes} passed, {len(fails)} failed")
    sys.exit(1 if fails else 0)

asyncio.run(main())
