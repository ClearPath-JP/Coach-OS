from playwright.sync_api import sync_playwright

errors = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})

    page.on("console", lambda msg: errors.append(f"[{msg.type}] {msg.text}") if msg.type in ("error", "warning") else None)
    page.on("pageerror", lambda err: errors.append(f"[PAGE ERROR] {err.message}"))

    page.goto("http://localhost:3001/login", wait_until="domcontentloaded", timeout=30000)
    page.wait_for_timeout(4000)

    page.screenshot(path="/tmp/login-screenshot.png", full_page=True)
    print("Screenshot saved to /tmp/login-screenshot.png")

    title = page.title()
    print(f"Page title: {title}")

    body_bg = page.evaluate("getComputedStyle(document.body).backgroundColor")
    print(f"Body background: {body_bg}")

    html_theme = page.evaluate("document.documentElement.getAttribute('data-theme')")
    print(f"data-theme: {html_theme}")

    h1_count = page.locator("h1").count()
    print(f"H1 elements: {h1_count}")
    if h1_count > 0:
        print(f"H1 text: {page.locator('h1').first.text_content()}")

    form_count = page.locator("form").count()
    print(f"Form elements: {form_count}")

    input_count = page.locator("input").count()
    print(f"Input elements: {input_count}")

    visible_text = page.locator("body").inner_text()
    print(f"Visible text (first 500): {visible_text[:500]}")

    if errors:
        print("\n--- Console errors/warnings ---")
        for e in errors[:20]:
            print(e)
    else:
        print("\nNo console errors.")

    browser.close()
