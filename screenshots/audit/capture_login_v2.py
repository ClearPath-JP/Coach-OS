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

    page.goto("http://localhost:3000/login", wait_until="networkidle", timeout=15000)
    page.wait_for_timeout(2000)
    page.screenshot(path=os.path.join(OUT, "login-v2.png"), full_page=True)
    print("OK: login-v2.png")

    # Also capture signup
    page.goto("http://localhost:3000/signup", wait_until="networkidle", timeout=15000)
    page.wait_for_timeout(2000)
    page.screenshot(path=os.path.join(OUT, "signup-v2.png"), full_page=True)
    print("OK: signup-v2.png")

    browser.close()
