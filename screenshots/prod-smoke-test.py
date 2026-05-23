"""Phase 4 smoke test against https://coach.foundos.ai (prod)."""
from playwright.sync_api import sync_playwright
import sys

PROD = "https://coach.foundos.ai"

def main():
    results = []

    def check(name, ok, detail=""):
        status = "PASS" if ok else "FAIL"
        results.append((status, name, detail))
        print(f"[{status}] {name}{(' — ' + detail) if detail else ''}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()

        # 1. /api/health returns 200
        try:
            resp = page.request.get(f"{PROD}/api/health", timeout=15000)
            check("api/health 200", resp.status == 200, f"status={resp.status}")
        except Exception as e:
            check("api/health 200", False, str(e))

        # 2. Landing page loads + has KINDO wordmark
        try:
            page.goto(PROD, wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(4000)  # past katana opening
            html = page.content()
            check("landing loads", True)
            check("KINDO wordmark on landing", "KIN" in html and "DO" in html)
            check("'Master the Path Within' headline", "Master the" in html and "Path Within" in html)
            check("Log in link in nav", 'href="/login"' in html or 'href="/signup"' in html)
            page.screenshot(path="screenshots/prod-landing.png", clip={"x":0,"y":0,"width":1440,"height":900})
        except Exception as e:
            check("landing loads", False, str(e))

        # 3. /login renders
        try:
            page.goto(f"{PROD}/login", wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(2000)
            html = page.content()
            check("/login loads", True)
            check("SENSEI role card present", "SENSEI" in html or "STUDENT" in html)
            page.screenshot(path="screenshots/prod-login.png", clip={"x":0,"y":0,"width":1440,"height":900})
        except Exception as e:
            check("/login loads", False, str(e))

        # 4. /browse coaches loads
        try:
            page.goto(f"{PROD}/browse", wait_until="networkidle", timeout=30000)
            check("/browse loads", page.url.endswith("/browse"))
        except Exception as e:
            check("/browse loads", False, str(e))

        # 5. /signup renders
        try:
            page.goto(f"{PROD}/signup", wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(1500)
            html = page.content()
            check("/signup loads", True)
            check("KINDO on signup", "KIN" in html)
        except Exception as e:
            check("/signup loads", False, str(e))

        # 6. /api/coach/leads/search returns 401 (not 500) when called unauth
        try:
            resp = page.request.post(f"{PROD}/api/coach/leads/search", data={"query":"test"}, timeout=15000)
            check("leads/search 401 unauth", resp.status == 401, f"status={resp.status}")
        except Exception as e:
            check("leads/search 401 unauth", False, str(e))

        # 7. /api/client/available-classes returns 401 unauth
        try:
            resp = page.request.get(f"{PROD}/api/client/available-classes", timeout=15000)
            check("available-classes 401 unauth", resp.status == 401, f"status={resp.status}")
        except Exception as e:
            check("available-classes 401 unauth", False, str(e))

        browser.close()

    # Summary
    print("\n" + "="*60)
    passed = sum(1 for r in results if r[0] == "PASS")
    failed = sum(1 for r in results if r[0] == "FAIL")
    print(f"RESULT: {passed} passed, {failed} failed")
    if failed:
        sys.exit(1)

if __name__ == "__main__":
    main()
