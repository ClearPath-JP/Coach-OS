"""Verify mobile responsiveness at 375px against prod."""
from playwright.sync_api import sync_playwright
import json

PROD = "https://coach.foundos.ai"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(
        viewport={"width": 375, "height": 812},
        device_scale_factor=2,
        is_mobile=True,
        has_touch=True,
        user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    )
    page = ctx.new_page()

    # Public landing at 375px
    page.goto(PROD, wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(4500)
    page.screenshot(path="screenshots/prod-mobile-landing.png", full_page=False)
    print("Landing captured at 375x812")

    # Try to verify dashboard requires login (would 401/redirect)
    resp = page.goto(f"{PROD}/coach/dashboard", wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(2000)
    print(f"Dashboard request: status={resp.status if resp else 'none'}, final_url={page.url}")
    page.screenshot(path="screenshots/prod-mobile-dashboard-attempt.png", full_page=False)

    # Inspect DOM for sidebar
    sidebar_visible = page.evaluate("""() => {
        const candidates = document.querySelectorAll('aside, [class*="sidebar"], [class*="Sidebar"]');
        const visible = [];
        candidates.forEach(el => {
            const r = el.getBoundingClientRect();
            const cs = window.getComputedStyle(el);
            if (r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden') {
                visible.push({
                    tag: el.tagName,
                    classes: el.className.toString().substring(0, 100),
                    width: Math.round(r.width),
                    left: Math.round(r.left),
                });
            }
        });
        return { count: visible.length, items: visible.slice(0, 5) };
    }""")
    print("Visible sidebar-ish elements at 375px:", json.dumps(sidebar_visible, indent=2))

    browser.close()
print("done")
