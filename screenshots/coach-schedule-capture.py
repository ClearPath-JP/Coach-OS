from playwright.sync_api import sync_playwright
import json

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1.5)
    page = ctx.new_page()

    # Direct API login to set the session cookie
    page.goto("http://localhost:3000/login", wait_until="networkidle", timeout=20000)
    page.wait_for_timeout(800)

    # Use the page's fetch to log in (preserves cookies)
    result = page.evaluate("""async () => {
        const r = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email: 'demo@clearpath.com', password: 'Demo1234!', intent: 'coach' })
        });
        return { status: r.status, body: await r.json() };
    }""")
    print("Login result:", json.dumps(result))

    # Navigate to schedule
    page.goto("http://localhost:3000/coach/schedule", wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(3500)
    page.screenshot(path="screenshots/coach-schedule-current.png", full_page=False)
    page.screenshot(path="screenshots/coach-schedule-full.png", full_page=True)

    # Dashboard
    page.goto("http://localhost:3000/coach/dashboard", wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(2500)
    page.screenshot(path="screenshots/coach-dashboard-current.png", full_page=False)

    # Clients
    page.goto("http://localhost:3000/coach/clients", wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(2500)
    page.screenshot(path="screenshots/coach-clients-current.png", full_page=False)

    print("Captured coach screens")
    browser.close()
