from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 900})

    # Go directly to subscribe - it will redirect to login if no auth
    page.goto('http://localhost:3001/subscribe', wait_until='networkidle', timeout=15000)
    page.wait_for_timeout(2000)
    page.screenshot(path='/tmp/subscribe_page.png', full_page=True)
    print(f"Screenshot saved. Current URL: {page.url}")

    # Also screenshot the direct subscribe page content by navigating there
    # Let's also check what the signup flow looks like
    page.goto('http://localhost:3001/signup', wait_until='networkidle', timeout=15000)
    page.wait_for_timeout(2000)
    page.screenshot(path='/tmp/signup_page.png', full_page=True)
    print(f"Signup screenshot saved. Current URL: {page.url}")

    browser.close()
