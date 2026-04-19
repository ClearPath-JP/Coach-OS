from playwright.sync_api import sync_playwright
import os

OUT = "C:/Dev/ClearPath/COACH-OS/screenshots/audit"

pages = [
    ("/auth/login", "login.png"),
    ("/auth/signup", "signup.png"),
    ("/subscribe", "subscribe.png"),
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(
        viewport={"width": 1440, "height": 900},
        color_scheme="dark",
    )
    page = ctx.new_page()

    for path, filename in pages:
        url = f"http://localhost:3000{path}"
        print(f"Capturing {url} -> {filename}")
        try:
            page.goto(url, wait_until="networkidle", timeout=15000)
            page.wait_for_timeout(1500)
            page.screenshot(path=os.path.join(OUT, filename), full_page=True)
            print(f"  OK: {filename}")
        except Exception as e:
            print(f"  FAILED: {e}")

    browser.close()
    print("Done.")
