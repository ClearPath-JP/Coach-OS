from playwright.sync_api import sync_playwright
import json

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 900})

    # Capture console logs and network
    logs = []
    page.on("console", lambda msg: logs.append(f"[{msg.type}] {msg.text}"))

    # Go to signup
    page.goto('http://localhost:3001/signup', wait_until='networkidle', timeout=15000)
    page.wait_for_timeout(1000)

    # Fill in the form
    page.fill('#firstName', 'Test')
    page.fill('#lastName', 'Coach')
    page.fill('#email', f'testcoach{__import__("time").time_ns()}@test.com')
    page.fill('#password', 'TestPassword123!')
    page.fill('#confirmPassword', 'TestPassword123!')
    page.check('#acceptTerms')

    page.wait_for_timeout(500)
    page.screenshot(path='/tmp/signup_filled.png', full_page=True)

    # Listen for the signup API response
    with page.expect_response("**/api/auth/signup", timeout=15000) as resp_info:
        page.click('button[type="submit"]')

    response = resp_info.value
    body = response.json()
    print(f"Signup API status: {response.status}")
    print(f"Signup API response: {json.dumps(body, indent=2)}")

    # Wait and see where we end up
    page.wait_for_timeout(3000)
    page.screenshot(path='/tmp/after_signup.png', full_page=True)
    print(f"Final URL: {page.url}")

    # Print console logs
    for log in logs:
        print(log)

    browser.close()
