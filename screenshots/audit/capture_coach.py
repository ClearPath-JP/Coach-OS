from playwright.sync_api import sync_playwright
import os

OUT = "C:/Dev/ClearPath/COACH-OS/screenshots/audit"

# Coach pages to capture after login
coach_pages = [
    ("/coach/schedule", "schedule.png"),
    ("/coach/clients", "clients.png"),
    ("/coach/payments", "payments.png"),
    ("/coach/videos", "videos.png"),
    ("/coach/programs", "programs.png"),
    ("/coach/settings", "settings.png"),
    ("/coach/subscription", "subscription.png"),
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
    page.goto("http://localhost:3000/auth/login", wait_until="networkidle", timeout=15000)
    page.wait_for_timeout(1000)

    # Fill login form
    email_input = page.locator('input[type="email"], input[name="email"]')
    if email_input.count() > 0:
        email_input.fill("jpotesta15@outlook.com")

    password_input = page.locator('input[type="password"], input[name="password"]')
    if password_input.count() > 0:
        password_input.fill("admin123")

    # Submit
    submit = page.locator('button[type="submit"]')
    if submit.count() > 0:
        submit.click()

    page.wait_for_timeout(3000)
    print(f"  After login, URL: {page.url}")

    # Capture each coach page
    for path, filename in coach_pages:
        url = f"http://localhost:3000{path}"
        print(f"Capturing {url} -> {filename}")
        try:
            page.goto(url, wait_until="networkidle", timeout=15000)
            page.wait_for_timeout(2000)
            page.screenshot(path=os.path.join(OUT, filename), full_page=True)
            print(f"  OK: {filename}")
        except Exception as e:
            print(f"  FAILED: {e}")

    browser.close()
    print("Done.")
