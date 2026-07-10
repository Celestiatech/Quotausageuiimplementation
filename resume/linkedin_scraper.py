import asyncio
import json
import os
import re
from datetime import datetime, timezone
from playwright.async_api import async_playwright


def parse_linkedin_hours(time_str):
    t = time_str.lower().strip()
    if not t or t == "now":
        return 0
    if "d" in t:
        try:
            return int(re.sub(r'\D', '', t.split("d")[0])) * 24
        except:
            return None
    if "h" in t:
        try:
            return int(re.sub(r'\D', '', t.split("h")[0]))
        except:
            return None
    if "m" in t or "min" in t:
        return 0
    if "w" in t:
        try:
            return int(re.sub(r'\D', '', t.split("w")[0])) * 168
        except:
            return None
    return None


async def scrape_linkedin_feed(keyword="developer remote", stop_after_hours=12):
    posts = []
    seen_ids = set()
    max_scrolls = 30

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        ctx_opts = {"viewport": {"width": 1280, "height": 900}}
        if os.path.exists("linkedin_auth.json"):
            ctx_opts["storage_state"] = "linkedin_auth.json"
        context = await browser.new_context(**ctx_opts)
        page = await context.new_page()

        await page.goto("https://www.linkedin.com/feed/", timeout=30000)

        if "login" in page.url.lower():
            await page.goto("https://www.linkedin.com/login", timeout=30000)
            print("Log in manually in the browser window that opened...")
            print("Waiting up to 3 minutes for you to log in...")
            await page.wait_for_url("https://www.linkedin.com/feed/*", timeout=180000)
            await context.storage_state(path="linkedin_auth.json")
            print("Login saved!")

        search_url = f"https://www.linkedin.com/search/results/content/?keywords={keyword.replace(' ', '%20')}&origin=FACETED_SEARCH&sortBy=%5B%22date_posted%22%5D"
        print(f"Navigating to search...")
        await page.goto(search_url, timeout=60000)
        await asyncio.sleep(4)

        try:
            await page.wait_for_selector('div[role="listitem"]', timeout=20000)
            print("Search results loaded!")
        except:
            print("No list items found after 20s — check linkedin_debug.html")
            body = await page.inner_html('body')
            with open("linkedin_debug.html", "w") as f:
                f.write(body)
            await browser.close()
            return []

        for scroll_count in range(1, max_scrolls + 1):
            print(f"Scroll {scroll_count}/{max_scrolls} — {len(posts)} posts collected so far")

            # Click all "…more" and "See more" buttons
            for btn_text in ['See more', 'more', 'Load more', 'Show more']:
                btns = page.locator(f"button:has-text('{btn_text}')")
                while await btns.count() > 0:
                    try:
                        await btns.first.click()
                        await asyncio.sleep(0.5)
                    except:
                        break

            # Find all post items
            items = page.locator('div[role="listitem"]')
            count = await items.count()
            new_in_this_scroll = 0
            oldest_found_hours = None

            for i in range(count):
                item = items.nth(i)
                try:
                    text = await item.inner_text()
                    lines = [l.strip() for l in text.split("\n") if l.strip()]
                    if not lines:
                        continue

                    # Get full HTML for finding author/time
                    html = await item.inner_html()

                    # Dedup by text hash
                    text_hash = hash(text[:500])
                    if text_hash in seen_ids:
                        continue
                    seen_ids.add(text_hash)
                    new_in_this_scroll += 1

                    # Extract author - look for display name near profile area
                    author = ""
                    # Try to find the name in <span> elements near the author section
                    name_match = re.search(r'<span[^>]*class="[^"]*"[^>]*>([A-Z][A-Za-z\s.]+)</span>', html)
                    if name_match:
                        candidate = name_match.group(1).strip()
                        if 2 < len(candidate) < 50 and not re.search(r'\d{5,}', candidate):
                            author = candidate

                    if not author:
                        author_match = re.search(r'/in/([^/?"]+)', html)
                        if author_match:
                            author = author_match.group(1).split("-")
                            author = " ".join([w.capitalize() for w in author if len(w) > 1])

                    # Extract time via regex on full text
                    time_text = ""
                    time_match = re.search(r'(\d+\s*[hdwm]\s*ago|\b\d+[hdwm]\b|\d+\s*minutes?\s*ago|\d+\s*hours?\s*ago)', text)
                    if time_match:
                        time_text = time_match.group(1)

                    hours_ago = parse_linkedin_hours(time_text)

                    # Title/preview - first meaningful line that looks like post content
                    title = ""
                    skip_patterns = ['feed post', 'ago', 'repost', 'like', 'comment', 'send', 'kiran', 'kumar', 'saiteja']
                    for line in lines:
                        lower = line.lower()
                        if any(x in lower for x in skip_patterns):
                            continue
                        if len(line) > 15 and line != author:
                            title = line[:200]
                            break

                    posts.append({
                        "author": author,
                        "time": time_text,
                        "hours_ago": hours_ago,
                        "preview": title
                    })

                    if hours_ago is not None and (oldest_found_hours is None or hours_ago > oldest_found_hours):
                        oldest_found_hours = hours_ago
                except:
                    continue

            if oldest_found_hours is not None and oldest_found_hours >= stop_after_hours:
                print(f"Found post {oldest_found_hours}h old (>= {stop_after_hours}h cutoff) — stopping")
                break

            # Scroll using mouse wheel
            await page.mouse.wheel(0, 1200)
            await asyncio.sleep(3)

        await browser.close()

    filtered = [p for p in posts if p.get("hours_ago") is None or p["hours_ago"] <= stop_after_hours]
    return filtered


if __name__ == "__main__":
    keyword = "developer remote"
    posts = asyncio.run(scrape_linkedin_feed(keyword=keyword, stop_after_hours=12))
    print(f"\n=== {len(posts)} posts from last 12 hours ===\n")
    for i, p in enumerate(posts, 1):
        age = f"{p['hours_ago']}h" if p['hours_ago'] is not None else p['time']
        print(f"{i:2}. [{age:5s}] {p['author'][:35]:35s} | {p['preview'][:70]}")

    with open("linkedin_posts.json", "w") as f:
        json.dump(posts, f, indent=2)
    print(f"\nSaved to linkedin_posts.json")
