from playwright.sync_api import sync_playwright
import os

OUT = "C:/Dev/ClearPath/COACH-OS/screenshots/audit"

coach_pages = [
    ("/coach/dashboard", "coach-dashboard.png"),
    ("/coach/schedule", "coach-schedule.png"),
    ("/coach/clients", "coach-clients.png"),
    ("/coach/payments", "coach-payments.png"),
    ("/coach/videos", "coach-videos.png"),
    ("/coach/programs", "coach-programs.png"),
    ("/coach/settings", "coach-settings.png"),
    ("/coach/subscription", "coach-subscription.png"),
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(
        viewport={"width": 1440, "height": 900},
        color_scheme="dark",
    )
    page = ctx.new_page()

    # Try demo coach login
    print("Logging in as demo coach...")
    page.goto("http://localhost:3000/login", wait_until="networkidle", timeout=15000)
    page.wait_for_timeout(1000)
    page.locator('input[type="email"]').fill("coach@example.com")
    page.locator('input[type="password"]').fill("Demo123!")
    page.locator('button[type="submit"], button:has-text("Sign in")').first.click()
    page.wait_for_timeout(5000)
    print(f"  Landed on: {page.url}")

    if "/login" in page.url:
        print("  Demo coach login failed, trying to see error...")
        err = page.locator('[role="alert"]')
        if err.count() > 0:
            print(f"  Error: {err.first.text_content()}")
        browser.close()
        exit(1)

    for path, filename in coach_pages:
        url = f"http://localhost:3000{path}"
        print(f"Capturing {url} -> {filename}")
        try:
            page.goto(url, wait_until="networkidle", timeout=15000)
            page.wait_for_timeout(2500)
            final = page.url
            if "/login" in final or "/admin" in final:
                print(f"  Redirected to {final}")
                continue
            page.screenshot(path=os.path.join(OUT, filename), full_page=True)
            print(f"  OK")
        except Exception as e:
            print(f"  FAILED: {e}")

    browser.close()
    print("\nDone.")
