"""Regression checks for owner-approved public trust rules.

1. No public directory, match, profile or sitemap result exposes one of the
   invented @example.co.uk firm listings retained unpublished for testing.
2. A firm with no stored public reviews renders "New", never a numeric rating
   or a zero-review count, and has no aggregateRating structured data.

Usage: python3 tests/regression/public_trust.py
Env: SUPABASE_URL (or VITE_SUPABASE_URL), SUPABASE_PUBLISHABLE_KEY (or
VITE_SUPABASE_PUBLISHABLE_KEY). Optional APP_URL (default http://localhost:8080).
"""

import json
import os
import sys

import requests
from bs4 import BeautifulSoup

URL = (os.environ.get("SUPABASE_URL") or os.environ["VITE_SUPABASE_URL"]).rstrip("/")
ANON = os.environ.get("SUPABASE_PUBLISHABLE_KEY") or os.environ["VITE_SUPABASE_PUBLISHABLE_KEY"]
APP = os.environ.get("APP_URL", "http://localhost:8080").rstrip("/")
REST = f"{URL}/rest/v1"
H = {"apikey": ANON, "Content-Type": "application/json"}

# IDs of the rows whose contact_email ends @example.co.uk. They remain in the
# database unpublished for testing; no public surface may return any of them.
INVENTED = {
    "abbey-wood-building-co",
    "apex-roofing-kent",
    "bexley-carpentry-and-joinery",
    "birmingham-roof-care",
    "blackheath-removals-ltd",
    "bristol-bathroom-fitters",
    "bromley-garden-landscapes",
    "brum-plumbing-co",
    "catford-brickwork",
    "charlton-pest-solutions",
    "dartford-handyman-hub",
    "eltham-plastering-pros",
    "erith-emergency-locksmiths",
    "fine-finish-decorators",
    "green-thumb-gardens",
    "greenwich-electrical-services",
    "handy-andy-services",
    "heath-and-sons-painters",
    "leeds-heating-and-gas",
    "lewisham-tiling-studio",
    "manchester-master-builders",
    "mosaic-bathroom-tiling",
    "northern-lights-electrical",
    "oakwood-carpentry",
    "plumstead-plumbing-and-heating-ltd",
    "plumstead-property-repairs",
    "quick-flow-plumbers",
    "riverside-heating-engineers",
    "smooth-walls-plastering",
    "voltage-electrical",
    "welling-domestic-cleaners",
    "west-country-builders",
    "woolwich-roofing-specialists",
    "yorkshire-joinery",
}

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


def get(path: str, **kwargs) -> requests.Response:
    return requests.get(f"{REST}/{path}", headers=H, timeout=20, **kwargs)


# Public directory query used by the app.
r = get(
    "pros",
    params={"select": "id,company,rating,review_count", "published": "eq.true"},
)
check("published directory query loads", r.status_code == 200, f"{r.status_code} {r.text[:160]}")
pros = r.json() if r.status_code == 200 else []
public_ids = {p["id"] for p in pros}
check("directory contains no invented firms", public_ids.isdisjoint(INVENTED), str(public_ids & INVENTED))
check("four real firms remain published", len(public_ids) == 4, str(sorted(public_ids)))

# Matching must apply the same published filter for every trade.
r = get("trades", params={"select": "slug", "order": "sort_order"})
trades = [row["slug"] for row in r.json()] if r.status_code == 200 else []
matched_ids: set[str] = set()
for trade in trades:
    response = requests.post(
        f"{REST}/rpc/match_pros",
        headers=H,
        json={"p_trade": trade, "p_limit": 100},
        timeout=20,
    )
    check(f"matching loads for {trade}", response.status_code == 200, f"{response.status_code} {response.text[:120]}")
    if response.status_code == 200:
        matched_ids.update(row["pro_id"] for row in response.json())
check("matching contains no invented firms", matched_ids.isdisjoint(INVENTED), str(matched_ids & INVENTED))

# Direct profile routes must not revive an unpublished listing.
r = requests.get(f"{APP}/pro/abbey-wood-building-co", timeout=30)
check(
    "hidden direct profile is unavailable",
    "Abbey Wood Building Co" not in r.text,
    f"HTTP {r.status_code}",
)

# Sitemap is generated from published rows only.
r = requests.get(f"{APP}/sitemap.xml", timeout=30)
sitemap_hits = sorted(pro_id for pro_id in INVENTED if f"/pro/{pro_id}" in r.text)
check("sitemap contains no invented firms", r.status_code == 200 and not sitemap_hits, str(sitemap_hits))

# Zero stored reviews: use the public review view itself, not the denormalised
# pros.review_count value, then inspect both rendered HTML and JSON-LD.
r = get("reviews_public", params={"select": "pro_id"})
stored_review_ids = {row["pro_id"] for row in r.json()} if r.status_code == 200 else set()
zero_review_pros = [p for p in pros if p["id"] not in stored_review_ids]
check("real zero-review firms are present for rendering checks", len(zero_review_pros) == 4, str(len(zero_review_pros)))

directory = requests.get(f"{APP}/directory", timeout=30)
directory_text = BeautifulSoup(directory.text, "html.parser").get_text(" ", strip=True)
check("directory renders no zero-review counts", "0 reviews" not in directory_text and "0 review" not in directory_text)

for pro in zero_review_pros:
    response = requests.get(f"{APP}/pro/{pro['id']}", timeout=30)
    soup = BeautifulSoup(response.text, "html.parser")
    text = soup.get_text(" ", strip=True)
    check(f"{pro['id']} renders New", "New" in text, f"HTTP {response.status_code}")
    check(
        f"{pro['id']} renders no rating or zero-review count",
        "(0 reviews)" not in text and "0.0" not in text and "min reply" not in text,
    )
    schemas = []
    for tag in soup.find_all("script", attrs={"type": "application/ld+json"}):
        try:
            schemas.append(json.loads(tag.string or "{}"))
        except json.JSONDecodeError:
            pass
    check(
        f"{pro['id']} emits no aggregateRating",
        all("aggregateRating" not in schema for schema in schemas if isinstance(schema, dict)),
    )

print(f"\n{passes} passed, {len(failures)} failed")
sys.exit(1 if failures else 0)
