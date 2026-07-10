import asyncio
import json
import os
import re
from playwright.async_api import async_playwright


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

        # Intercept XHR responses from LinkedIn's GraphQL endpoints
        async def handle_response(response):
            url = response.url
            if "/voyager/api/" not in url and "/graphql" not in url:
                return
            try:
                body = await response.json()
                # Walk the JSON to find post-like objects
                raw = json.dumps(body)
                # Extract activity URNs
                urns = re.findall(r'urn:li:activity:\d+', raw)
                names = re.findall(r'"miniCompanyName"\s*:\s*"([^"]+)"', raw)
                names += re.findall(r'"miniCompanyName"\s*:\s*"([^"]+)"', raw)
                # We'll collect the full JSON for processing later
                posts.append({"url": url, "data": body})
            except:
                pass

        page.on("response", handle_response)

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
            print("No results found")
            await browser.close()
            return []

        for scroll_count in range(1, max_scrolls + 1):
            print(f"Scroll {scroll_count}/{max_scrolls} — intercepting network data...")

            for btn_text in ['See more', 'more', 'Load more', 'Show more']:
                btns = page.locator(f"button:has-text('{btn_text}')")
                while await btns.count() > 0:
                    try:
                        await btns.first.click()
                        await asyncio.sleep(0.5)
                    except:
                        break

            # Extract post data from the DOM text (most reliable fallback)
            items = page.locator('div[role="listitem"]')
            count = await items.count()
            new_count = 0

            for i in range(count):
                item = items.nth(i)
                try:
                    text = await item.inner_text()
                    full_html = await item.inner_html()

                    # Get author name from profile link
                    author = ""
                    name_match = re.search(r'"actorDescription"[^}]+"text"\s*:\s*"([^"]+)"', full_html)
                    if not name_match:
                        name_match = re.search(r'"title"[^}]*"text"\s*:\s*"([^"]+)"', full_html)

                    if not author:
                        # Try extracting from anchor href
                        profile = re.search(r'/in/([^/?"]+)', full_html)
                        if profile:
                            name_parts = profile.group(1).split("-")
                            author = " ".join(p.capitalize() for p in name_parts if len(p) > 1)

                    # Better time extraction
                    time_text = ""
                    time_match = re.search(r'(\d+[hdwm])\s*[a-z]*\s*ago', text)
                    if not time_match:
                        time_match = re.search(r'"actorSubDescription"[^}]+"text"\s*:\s*"([^"]+)"', full_html)
                    if time_match:
                        time_text = time_match.group(1) if time_match.lastindex == 1 else time_match.group(0)

                    # Dedup
                    text_hash = hash(text[:500])
                    if text_hash in seen_ids:
                        continue
                    seen_ids.add(text_hash)
                    new_count += 1

                    # Get preview (first substantial line)
                    lines = [l.strip() for l in text.split("\n") if l.strip()]
                    title = ""
                    skip_words = ['feed post', 'ago', 'repost', 'like', 'comment', 'send']
                    for line in lines:
                        if not any(w in line.lower() for w in skip_words) and len(line) > 15:
                            title = line[:200]
                            break

                    # Parse hours
                    hours_ago = None
                    if time_text:
                        t = time_text.lower()
                        if 'h' in t:
                            try:
                                hours_ago = int(re.sub(r'\D', '', t.split('h')[0]))
                            except:
                                pass
                        elif 'd' in t:
                            try:
                                hours_ago = int(re.sub(r'\D', '', t.split('d')[0])) * 24
                            except:
                                pass
                        elif 'm' in t or 'min' in t:
                            hours_ago = 0
                        elif 'w' in t:
                            try:
                                hours_ago = int(re.sub(r'\D', '', t.split('w')[0])) * 168
                            except:
                                pass

                    posts.append({
                        "author": author,
                        "time": time_text,
                        "hours_ago": hours_ago,
                        "preview": title
                    })
                except:
                    continue

            # Check if we've reached old enough posts
            oldest = None
            for p in posts[-new_count:] if new_count > 0 else []:
                if p["hours_ago"] is not None and (oldest is None or p["hours_ago"] > oldest):
                    oldest = p["hours_ago"]

            if oldest is not None and oldest >= stop_after_hours:
                print(f"Found post {oldest}h old — stopping")
                break

            # Scroll
            await page.mouse.wheel(0, 1200)
            await asyncio.sleep(3)

        await browser.close()

    # Filter
    filtered = [p for p in posts if p.get("hours_ago") is None or p["hours_ago"] <= stop_after_hours]
    # Dedup by preview
    seen = set()
    unique = []
    for p in filtered:
        if p["preview"] not in seen:
            seen.add(p["preview"])
            unique.append(p)
    return unique


if __name__ == "__main__":
    keyword = "developer remote"
    posts = asyncio.run(scrape_linkedin_feed(keyword=keyword, stop_after_hours=12))
    print(f"\n=== {len(posts)} posts from last 12 hours ===\n")
    for i, p in enumerate(posts, 1):
        age = f"{p['hours_ago']}h" if p['hours_ago'] is not None else p['time']
        print(f"{i:2}. [{age:5s}] {p['author'][:35]:35s} | {p['preview'][:70]}")

    with open("linkedin_posts.json", "w") as f:
        json.dump(posts, f, indent=2)
    print(f"\nSaved to linkedin_posts.json ({len(posts)} posts)")
