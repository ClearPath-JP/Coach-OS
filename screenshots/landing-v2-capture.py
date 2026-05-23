from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1.5)
    page = ctx.new_page()

    # Landing — scroll through each section
    page.goto("http://localhost:3000/", wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(4500)  # past katana opening

    # Hero
    page.screenshot(path="screenshots/landing-v2-hero.png", clip={"x": 0, "y": 0, "width": 1440, "height": 900})

    # Scroll to How It Works
    page.evaluate("window.scrollTo(0, 900)")
    page.wait_for_timeout(900)
    page.screenshot(path="screenshots/landing-v2-howitworks.png", clip={"x": 0, "y": 0, "width": 1440, "height": 900})

    # Scroll to Features
    page.evaluate("window.scrollTo(0, 1700)")
    page.wait_for_timeout(900)
    page.screenshot(path="screenshots/landing-v2-features.png", clip={"x": 0, "y": 0, "width": 1440, "height": 900})

    # Scroll to Coaches
    page.evaluate("window.scrollTo(0, 2600)")
    page.wait_for_timeout(900)
    page.screenshot(path="screenshots/landing-v2-coaches.png", clip={"x": 0, "y": 0, "width": 1440, "height": 900})

    # Scroll to Pricing
    page.evaluate("window.scrollTo(0, 3500)")
    page.wait_for_timeout(900)
    page.screenshot(path="screenshots/landing-v2-pricing.png", clip={"x": 0, "y": 0, "width": 1440, "height": 900})

    # Scroll to CTA + Footer
    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    page.wait_for_timeout(900)
    page.screenshot(path="screenshots/landing-v2-cta-footer.png", clip={"x": 0, "y": 0, "width": 1440, "height": 900})

    # Login page — verify amber accent still good
    page.goto("http://localhost:3000/login", wait_until="networkidle", timeout=20000)
    page.wait_for_timeout(1500)
    page.screenshot(path="screenshots/login-v2-after.png", clip={"x": 0, "y": 0, "width": 1440, "height": 900})

    print("Captured all")
    browser.close()
