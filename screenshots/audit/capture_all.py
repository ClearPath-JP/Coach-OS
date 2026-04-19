from playwright.sync_api import sync_playwright
import os

OUT = "C:/Dev/ClearPath/COACH-OS/screenshots/audit"

# Public pages (no auth needed)
public_pages = [
    ("/login", "login.png"),
    ("/signup", "signup.png"),
    ("/subscribe", "subscribe.png"),
    ("/client-login", "client-login.png"),
]

# Coach pages (need auth)
coach_pages = [
    ("/coach/schedule", "coach-schedule.png"),
    ("/coach/clients", "coach-clients.png"),
    ("/coach/payments", "coach-payments.png"),
    ("/coach/videos", "coach-videos.png"),
    ("/coach/programs", "coach-programs.png"),
    ("/coach/settings", "coach-settings.png"),
    ("/coach/subscription", "coach-subscription.png"),
    ("/coach/dashboard", "coach-dashboard.png"),
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(
        viewport={"width": 1440, "height": 900},
        color_scheme="dark",
    )
    page = ctx.new_page()

    # Capture public pages
    for path, filename in public_pages:
        url = f"http://localhost:3000{path}"
        print(f"Capturing {url} -> {filename}")
        try:
            page.goto(url, wait_until="networkidle", timeout=15000)
            page.wait_for_timeout(1500)
            page.screenshot(path=os.path.join(OUT, filename), full_page=True)
            print(f"  OK")
        except Exception as e:
            print(f"  FAILED: {e}")

    # Login to get coach pages
    print("\nLogging in...")
    page.goto("http://localhost:3000/login", wait_until="networkidle", timeout=15000)
    page.wait_for_timeout(1000)

    # Try filling the form
    inputs = page.locator('input').all()
    print(f"  Found {len(inputs)} inputs")
    for inp in inputs:
        input_type = inp.get_attribute('type') or ''
        input_name = inp.get_attribute('name') or ''
        placeholder = inp.get_attribute('placeholder') or ''
        print(f"    type={input_type} name={input_name} placeholder={placeholder}")

    # Fill email
    email_sel = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]')
    if email_sel.count() > 0:
        email_sel.first.fill("jpotesta15@outlook.com")
        print("  Filled email")

    # Fill password
    pw_sel = page.locator('input[type="password"], input[name="password"]')
    if pw_sel.count() > 0:
        pw_sel.first.fill("admin123")
        print("  Filled password")

    # Click submit
    btn = page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")')
    if btn.count() > 0:
        btn.first.click()
        print("  Clicked submit")

    page.wait_for_timeout(4000)
    print(f"  After login URL: {page.url}")

    # Capture coach pages
    for path, filename in coach_pages:
        url = f"http://localhost:3000{path}"
        print(f"Capturing {url} -> {filename}")
        try:
            page.goto(url, wait_until="networkidle", timeout=15000)
            page.wait_for_timeout(2000)
            final_url = page.url
            if "/login" in final_url:
                print(f"  REDIRECTED to login - skipping")
                page.screenshot(path=os.path.join(OUT, filename), full_page=True)
                continue
            page.screenshot(path=os.path.join(OUT, filename), full_page=True)
            print(f"  OK (at {final_url})")
        except Exception as e:
            print(f"  FAILED: {e}")

    browser.close()
    print("\nDone.")
