"""Visual regression for hero overlays and focal crops.

Captures the hero band of /trades, /areas, /for-tradesmen and /post-job in
Light and Dark themes, at desktop and mobile widths, and diffs each shot
against a stored baseline.

Usage:
    python3 tests/visual/hero_regression.py --update   # write/refresh baselines
    python3 tests/visual/hero_regression.py            # compare against them

Exit code 1 means at least one hero drifted beyond the pixel threshold.
"""

import argparse
import asyncio
import sys
from pathlib import Path

from PIL import Image, ImageChops
from playwright.async_api import async_playwright

BASE_URL = "http://localhost:8080"
PAGES = ["/trades", "/areas", "/for-tradesmen", "/post-job"]
THEMES = ["light", "dark"]
VIEWPORTS = {"desktop": (1280, 900), "mobile": (390, 844)}
# Fraction of pixels allowed to differ before a shot counts as a regression.
THRESHOLD = 0.005

ROOT = Path(__file__).parent
BASELINE = ROOT / "baseline"
CURRENT = ROOT / "current"
DIFFS = ROOT / "diffs"


def shot_name(path: str, theme: str, device: str) -> str:
    slug = path.strip("/").replace("/", "-") or "home"
    return f"{slug}__{theme}__{device}.png"


def diff_ratio(a: Path, b: Path, out: Path) -> float:
    img_a = Image.open(a).convert("RGB")
    img_b = Image.open(b).convert("RGB")
    if img_a.size != img_b.size:
        return 1.0
    delta = ImageChops.difference(img_a, img_b)
    changed = sum(1 for px in delta.getdata() if max(px) > 12)
    out.parent.mkdir(parents=True, exist_ok=True)
    delta.save(out)
    return changed / (img_a.size[0] * img_a.size[1])


async def capture(target: Path) -> None:
    target.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        for device, (w, h) in VIEWPORTS.items():
            context = await browser.new_context(viewport={"width": w, "height": h})
            page = await context.new_page()
            for theme in THEMES:
                for path in PAGES:
                    await page.goto(f"{BASE_URL}{path}", wait_until="networkidle")
                    await page.evaluate(
                        "t => { localStorage.setItem('tf-theme', t);"
                        "document.documentElement.dataset.theme = t; }",
                        theme,
                    )
                    await page.wait_for_timeout(400)
                    hero = page.locator("h1").first
                    band = hero.locator(
                        "xpath=ancestor::div[contains(@class,'overflow-hidden')][1]"
                    )
                    await band.screenshot(
                        path=str(target / shot_name(path, theme, device))
                    )
            await context.close()
        await browser.close()


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--update", action="store_true", help="refresh baselines")
    args = ap.parse_args()

    if args.update:
        await capture(BASELINE)
        print(f"baselines written to {BASELINE}")
        return 0

    if not BASELINE.exists():
        print("no baselines yet — run with --update first")
        return 1

    await capture(CURRENT)
    failures = []
    for shot in sorted(BASELINE.glob("*.png")):
        current = CURRENT / shot.name
        if not current.exists():
            failures.append((shot.name, 1.0))
            continue
        ratio = diff_ratio(shot, current, DIFFS / shot.name)
        status = "FAIL" if ratio > THRESHOLD else "ok"
        print(f"{status:4}  {shot.name}  {ratio * 100:.3f}% changed")
        if ratio > THRESHOLD:
            failures.append((shot.name, ratio))

    if failures:
        print(f"\n{len(failures)} hero(s) regressed — see {DIFFS}")
        return 1
    print("\nall heroes match baseline")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
