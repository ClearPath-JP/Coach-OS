"""Render the Dojo Arcade ad creatives + OG image + app icons to PNG.

Each `.frame[data-name]` in ads.html is screenshotted at its native CSS size
(device_scale_factor=1 so 1080px element -> 1080px PNG, icons exact).

Run:  python marketing/ads/render-ads.py
Needs: playwright (already used by screenshots/*.py) + `playwright install chromium`.
"""
from playwright.sync_api import sync_playwright
import pathlib
import re

HERE = pathlib.Path(__file__).parent
URL = (HERE / "ads.html").as_uri()


def safe_name(raw: str | None) -> str:
    """Keep only slug chars so a data-name can never escape this folder."""
    return re.sub(r"[^a-zA-Z0-9_-]", "", raw or "")


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(device_scale_factor=1)
        page.goto(URL)
        page.wait_for_load_state("networkidle")
        # make sure the web fonts are actually painted before we snapshot
        page.evaluate("document.fonts.ready")
        page.wait_for_timeout(1000)

        frames = page.query_selector_all(".frame")
        print(f"found {len(frames)} frames")
        for f in frames:
            name = safe_name(f.get_attribute("data-name"))
            if not name:
                print("skipped frame with no usable data-name")
                continue
            path = HERE / f"{name}.png"
            try:
                f.screenshot(path=str(path))
                print("saved", path.name)
            except Exception as exc:  # don't let one frame kill the batch
                print("FAILED", name, exc)

        browser.close()


if __name__ == "__main__":
    main()
