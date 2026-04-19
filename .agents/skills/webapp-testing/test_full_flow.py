from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 900})

    # Go to signup
    page.goto('http://localhost:3001/signup', wait_until='networkidle', timeout=15000)
    page.wait_for_timeout(1000)

    # Fill in the form
    unique = str(time.time_ns())[-8:]
    page.fill('#firstName', 'Test')
    page.fill('#lastName', 'Coach')
    page.fill('#email', f'testcoach{unique}@test.com')
    page.fill('#password', 'TestPassword123!')
    page.fill('#confirmPassword', 'TestPassword123!')
    page.check('#acceptTerms')

    # Submit and wait for navigation
    page.click('button[type="submit"]')
    page.wait_for_timeout(5000)
    page.screenshot(path='/tmp/after_signup_nav.png', full_page=True)
    print(f"After signup URL: {page.url}")

    # If we're on subscribe, great. If on signup still, navigate manually
    if '/subscribe' not in page.url:
        page.goto('http://localhost:3001/subscribe', wait_until='networkidle', timeout=15000)
        page.wait_for_timeout(3000)
        page.screenshot(path='/tmp/subscribe_direct.png', full_page=True)
        print(f"Direct subscribe URL: {page.url}")

    browser.close()
