#!/usr/bin/env python3
"""냉장고 파먹기 화면 자체 점검 (헤드리스 Chromium · 390×844 / 360×640)

    pip install playwright && playwright install chromium
    python3 tools/verify.py

- 콘솔 오류 0건, 가로 넘침 0건을 확인합니다.
- 원터치 조합 → 결과, 2탭 임박, 장보기 메모 피드백, 광고 → 상세까지 실제로 눌러 봅니다.
- 실패가 있으면 종료 코드 1.
"""
import json
import os
import sys
import tempfile

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = "file://" + os.path.join(ROOT, "index.html")


def overflow(page):
    return page.evaluate("""() => {
        const d = document.documentElement;
        const wide = [];
        document.querySelectorAll('body *').forEach(el => {
            const s = getComputedStyle(el);
            if (s.position === 'fixed' || s.position === 'absolute') return;
            const b = el.getBoundingClientRect();
            if (b.width && (b.right > d.clientWidth + 0.6 || b.left < -0.6)) wide.push(el.className.toString().slice(0, 40));
        });
        return {doc: d.scrollWidth, client: d.clientWidth, wide: wide.slice(0, 5)};
    }""")


def main():
    shots = tempfile.mkdtemp(prefix="fridge-shots-")
    result = {"errors": [], "views": {}, "shots": shots}
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for w, h in [(390, 844), (360, 640)]:
            page = browser.new_page(viewport={"width": w, "height": h}, device_scale_factor=2)
            page.on("console", lambda m: result["errors"].append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: result["errors"].append(str(e)))
            page.goto(APP)
            page.wait_for_timeout(400)

            key = f"{w}x{h}"
            result["views"][key] = {"home": overflow(page),
                                    "tiles": page.eval_on_selector_all(".item", "e => e.length"),
                                    "combos": page.eval_on_selector_all("[data-combo]", "e => e.map(x => x.textContent.trim())")}

            page.click("[data-combo]")
            page.wait_for_timeout(900)
            result["views"][key]["combo"] = {
                "sel": page.evaluate("() => window.FridgeApp.state.sel"),
                "cards": page.eval_on_selector_all("[data-card]", "e => e.length"),
                "readyBadges": page.eval_on_selector_all(".card .badge--now", "e => e.length"),
                "sub": page.evaluate("() => document.getElementById('resultsSub').textContent"),
                "overflow": overflow(page),
            }
            page.screenshot(path=os.path.join(shots, f"combo-{key}.png"))

            page.evaluate("() => { const s = window.FridgeApp.state; s.sel = []; s.hot = []; window.FridgeApp.renderFridge(); window.FridgeApp.refresh(); }")
            page.wait_for_timeout(200)
            page.click("#ing-kimchi")
            page.wait_for_timeout(180)
            page.click("#ing-kimchi")
            page.wait_for_timeout(320)
            result["views"][key]["hot"] = {"hot": page.evaluate("() => window.FridgeApp.state.hot"),
                                           "tiles": page.eval_on_selector_all(".item.is-hot", "e => e.length")}

            page.click(".chip--miss")
            page.wait_for_timeout(150)
            result["views"][key]["memo"] = {"fabPop": page.evaluate("() => document.getElementById('memoFab').className"),
                                            "memo": page.evaluate("() => window.FridgeApp.state.memo.length")}
            page.screenshot(path=os.path.join(shots, f"memo-{key}.png"))
            page.close()

        page = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        page.on("pageerror", lambda e: result["errors"].append(str(e)))
        page.goto(APP)
        page.wait_for_timeout(400)
        page.evaluate("() => { const s = window.FridgeApp.state; s.sel = ['rice','kimchi','pa','egg','onion']; window.FridgeApp.renderFridge(); window.FridgeApp.refresh(); }")
        page.wait_for_timeout(300)
        page.evaluate("() => window.FridgeApp.openAdNotice('kimchi-fried-rice')")
        page.wait_for_timeout(300)
        page.click("#adConfirm")
        page.wait_for_timeout(4300)
        result["detail"] = {"open": page.evaluate("() => !document.getElementById('detail').hidden"),
                            "title": page.evaluate("() => document.getElementById('detailTitle').textContent"),
                            "overflow": overflow(page)}
        page.screenshot(path=os.path.join(shots, "recipe.png"))
        browser.close()

    ok = (not result["errors"]
          and all(v["home"]["wide"] == [] for v in result["views"].values())
          and all(v["combo"]["overflow"]["wide"] == [] for v in result["views"].values())
          and all(v["combo"]["readyBadges"] >= 1 for v in result["views"].values())
          and result["detail"]["open"])
    result["pass"] = ok
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
