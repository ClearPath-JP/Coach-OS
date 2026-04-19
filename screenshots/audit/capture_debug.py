from playwright.sync_api import sync_playwright
import os

OUT = "C:/Dev/ClearPath/COACH-OS/screenshots/audit"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(
        viewport={"width": 1440, "height": 900},
        color_scheme="dark",
    )
    page = ctx.new_page()

    # Capture console messages
    messages = []
    page.on("console", lambda msg: messages.append(f"[{msg.type}] {msg.text}"))

    # Go to login
    page.goto("http://localhost:3000/login", wait_until="networkidle", timeout=15000)
    page.wait_for_timeout(1000)

    # Fill and submit
    page.locator('input[type="email"]').fill("jpotesta15@outlook.com")
    page.locator('input[type="password"]').fill("admin123")
    page.screenshot(path=os.path.join(OUT, "login-filled.png"), full_page=True)

    # Click sign in
    page.locator('button[type="submit"], button:has-text("Sign in")').first.click()
    page.wait_for_timeout(4000)

    # Screenshot after attempt
    page.screenshot(path=os.path.join(OUT, "login-after.png"), full_page=True)
    print(f"After login URL: {page.url}")

    # Print any errors visible on page
    error_el = page.locator('[role="alert"], .error, [class*="error"]')
    if error_el.count() > 0:
        for i in range(error_el.count()):
            print(f"Error text: {error_el.nth(i).text_content()}")

    for msg in messages:
        if "error" in msg.lower() or "fail" in msg.lower():
            print(f"Console: {msg}")

    browser.close()
