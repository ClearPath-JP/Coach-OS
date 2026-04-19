from playwright.sync_api import sync_playwright
import os

OUT = "C:/Dev/ClearPath/COACH-OS/screenshots/audit"

admin_pages = [
    ("/admin/overview", "admin-overview.png"),
    ("/admin/coaches", "admin-coaches.png"),
    ("/admin/audit", "admin-audit.png"),
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(
        viewport={"width": 1440, "height": 900},
        color_scheme="dark",
    )
    page = ctx.new_page()

    # Login
    print("Logging in...")
    page.goto("http://localhost:3000/login", wait_until="networkidle", timeout=15000)
    page.wait_for_timeout(1000)
    page.locator('input[type="email"]').fill("jpotesta15@outlook.com")
    page.locator('input[type="password"]').fill("Joshua1223046!")
    page.locator('button[type="submit"], button:has-text("Sign in")').first.click()
    page.wait_for_timeout(5000)
    print(f"  Landed on: {page.url}")

    # Admin pages
    for path, filename in admin_pages:
        url = f"http://localhost:3000{path}"
        print(f"Capturing {url} -> {filename}")
        try:
            page.goto(url, wait_until="networkidle", timeout=15000)
            page.wait_for_timeout(2000)
            # Full-page screenshot with scroll
            page.screenshot(path=os.path.join(OUT, filename), full_page=True)
            print(f"  OK")
        except Exception as e:
            print(f"  FAILED: {e}")

    # Now try coach pages by navigating directly (admin might have access)
    coach_pages = [
        ("/coach/schedule", "coach-schedule.png"),
        ("/coach/clients", "coach-clients.png"),
        ("/coach/videos", "coach-videos.png"),
        ("/coach/settings", "coach-settings.png"),
        ("/coach/subscription", "coach-subscription.png"),
    ]

    for path, filename in coach_pages:
        url = f"http://localhost:3000{path}"
        print(f"Trying {url} -> {filename}")
        try:
            page.goto(url, wait_until="networkidle", timeout=10000)
            page.wait_for_timeout(2000)
            final = page.url
            print(f"  Ended at: {final}")
            page.screenshot(path=os.path.join(OUT, filename), full_page=True)
        except Exception as e:
            print(f"  FAILED: {e}")

    # Also capture onboarding page (public)
    page2 = ctx.new_page()
    page2.goto("http://localhost:3000/onboarding", wait_until="networkidle", timeout=15000)
    page2.wait_for_timeout(1500)
    page2.screenshot(path=os.path.join(OUT, "onboarding.png"), full_page=True)
    print(f"Onboarding: {page2.url}")

    browser.close()
    print("\nDone.")
