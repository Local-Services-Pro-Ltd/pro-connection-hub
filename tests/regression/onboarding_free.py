"""Live database and rendered-page checks for free onboarding."""

import os
import sys

import requests
from bs4 import BeautifulSoup

URL = (os.environ.get("SUPABASE_URL") or os.environ["VITE_SUPABASE_URL"]).rstrip("/")
ANON = os.environ.get("SUPABASE_PUBLISHABLE_KEY") or os.environ["VITE_SUPABASE_PUBLISHABLE_KEY"]
APP = os.environ.get("APP_URL", "http://localhost:8080").rstrip("/")
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


r = requests.get(
    f"{REST}/pros",
    headers=H,
    params={"select": "id", "published": "eq.true"},
    timeout=20,
)
check("published firms load for entitlement checks", r.status_code == 200, r.text[:160])
firm_ids = [row["id"] for row in r.json()] if r.status_code == 200 else []
check("four approved firms are covered", len(firm_ids) == 4, str(firm_ids))

for firm_id in firm_ids:
    response = requests.post(
        f"{REST}/rpc/pro_plan_entitlements",
        headers=H,
        json={"p_pro_id": firm_id, "p_onboarding_free": True},
        timeout=20,
    )
    rows = response.json() if response.status_code == 200 else []
    expected = {
        "has_access": True,
        "matched_job_limit": None,
        "trade_category_limit": 3,
        "postcode_area_limit": 10,
        "priority_ranking": True,
        "photo_portfolio": True,
    }
    check(
        f"{firm_id} has database-enforced Trade-tier free access",
        response.status_code == 200 and rows == [expected],
        f"{response.status_code} {response.text[:240]}",
    )

page = requests.get(f"{APP}/for-tradesmen", timeout=30)
soup = BeautifulSoup(page.text, "html.parser")
text = " ".join(soup.get_text(" ", strip=True).split())
check("pricing leads with free onboarding and no card", "Free while we onboard trades — no card needed." in text)
check("pricing labels future prices", "Prices after onboarding" in text)
for plan, price in (("Starter", "£29"), ("Trade", "£79"), ("Contractor", "£129")):
    check(f"{plan} future price is {price} per month", plan in text and f"{price} /month" in text, text[:200])
founding = "Join during onboarding and get 50% off for your first 12 months once charging starts. We'll email you at least 30 days before anything is charged, and you can leave any time."
check("pricing shows the full founding-firm offer", founding in text)
check("pricing exposes no checkout action", "Choose Starter" not in text and "Choose Trade" not in text and "Choose Contractor" not in text and "Subscribe" not in text)
check("pricing uses free application actions", text.count("Apply free") == 3, str(text.count("Apply free")))

terms = requests.get(f"{APP}/terms", timeout=30)
terms_text = " ".join(BeautifulSoup(terms.text, "html.parser").get_text(" ", strip=True).split())
check("trader terms include free onboarding", "Free onboarding period" in terms_text and founding in terms_text)

print(f"\n{passes} passed, {len(failures)} failed")
sys.exit(1 if failures else 0)
