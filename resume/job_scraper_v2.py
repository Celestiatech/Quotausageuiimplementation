import asyncio
import json
import os
import re
import csv
from playwright.async_api import async_playwright

EMAIL_REGEX = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'


def extract_emails(text):
    return list(set(re.findall(EMAIL_REGEX, text)))


def extract_job_title(text):
    patterns = [
        r'(?:Hiring|hiring|Looking for|looking for|We are hiring)\s*(?:\n)?\s*([^\n]{10,100})',
        r'(?:Role|role|Position|position|Job Title|job title)\s*[:\-–]\s*([^\n]{10,100})',
        r'(?:Senior|Junior|Lead|Full Stack|Frontend|Backend|Software|Web|Python|Java|React|Node|MERN|DevOps)\s*(?:Developer|Engineer|Intern|Architect)\s*[^\n]{0,50}',
    ]
    for pat in patterns:
        match = re.search(pat, text, re.IGNORECASE)
        if match:
            title = match.group(1) if match.lastindex else match.group(0)
            return title.strip()[:150]
    for line in text.split("\n"):
        if any(w in line.lower() for w in ['developer', 'engineer', 'intern', 'hiring']):
            return line.strip()[:150]
    return ""


async def scrape_feed(keyword="developer remote", stop_after_hours=12):
    """Scrape LinkedIn feed for posts containing the keyword."""
    all_entries = []
    seen_ids = set()

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
            print("Log in manually in the browser...")
            await page.wait_for_url("https://www.linkedin.com/feed/*", timeout=180000)
            await context.storage_state(path="linkedin_auth.json")
            print("Login saved!")

        # Method 1: Search page (gets ~12 results)
        print(f"\n--- Method 1: Content Search ---")
        search_url = f"https://www.linkedin.com/search/results/content/?keywords={keyword.replace(' ', '%20')}&origin=FACETED_SEARCH&sortBy=%5B%22date_posted%22%5D"
        await page.goto(search_url, timeout=60000)
        await asyncio.sleep(4)
        await collect_posts(page, all_entries, seen_ids)
        print(f"  Content search: {len(all_entries)} posts with emails")

        # Method 2: Try different search keywords to get more results
        current_kw = keyword
        variants = [kw for kw in [
            "developer remote hiring",
            "remote developer job",
            "hiring remote developer",
            "software engineer remote",
            "full stack developer remote",
        ] if kw != current_kw]
        for v in variants:
            print(f"\n--- Search '{v}' ---")
            search_url = f"https://www.linkedin.com/search/results/content/?keywords={v.replace(' ', '%20')}&origin=FACETED_SEARCH&sortBy=%5B%22date_posted%22%5D"
            await page.goto(search_url, timeout=60000)
            await asyncio.sleep(4)
            new = await collect_posts(page, all_entries, seen_ids)
            print(f"  '{v}': {new} new posts with emails (total: {len(all_entries)})")

        await browser.close()

    # Filter by time
    filtered = []
    for e in all_entries:
        hours = None
        t = e["time"].lower()
        if "h" in t:
            try:
                hours = int(re.sub(r'\D', '', t.split("h")[0]))
            except:
                pass
        elif "d" in t:
            try:
                hours = int(re.sub(r'\D', '', t.split("d")[0])) * 24
            except:
                pass
        elif "m" in t or "min" in t:
            hours = 0
        elif "w" in t:
            try:
                hours = int(re.sub(r'\D', '', t.split("w")[0])) * 168
            except:
                pass
        if hours is None or hours <= stop_after_hours:
            filtered.append(e)
    return filtered


async def collect_posts(page, all_entries, seen_ids):
    """Collect posts with emails from the current page."""
    new_count = 0

    # Expand collapsed text
    for btn_text in ['See more', '…more', 'more']:
        btns = page.locator(f"button:has-text('{btn_text}')")
        while await btns.count() > 0:
            try:
                await btns.first.click()
                await asyncio.sleep(0.3)
            except:
                break

    items = page.locator('div[role="listitem"], .feed-shared-update-v2, article')
    count = await items.count()

    for i in range(count):
        item = items.nth(i)
        try:
            text = await item.inner_text()
            text_hash = hash(text[:500])
            if text_hash in seen_ids:
                continue
            seen_ids.add(text_hash)

            emails = extract_emails(text)
            if not emails:
                continue

            html = await item.inner_html()
            job_title = extract_job_title(text)

            author = ""
            profile = re.search(r'/in/([^/?"]+)', html)
            if profile:
                name_parts = profile.group(1).split("-")
                author = " ".join(p.capitalize() for p in name_parts if len(p) > 1)

            time_text = ""
            time_match = re.search(r'(\d+[hdwm]\s*ago|\b\d+[hdwm]\b)', text)
            if time_match:
                time_text = time_match.group(1)

            all_entries.append({
                "author": author,
                "job_title": job_title,
                "emails": emails,
                "time": time_text,
                "preview": text[:300]
            })
            new_count += 1
        except:
            continue

    return new_count


if __name__ == "__main__":
    import sys
    keyword = sys.argv[1] if len(sys.argv) > 1 else "developer remote"

    print(f"\n{'='*60}")
    print(f" SCRAPING LINKEDIN FOR: '{keyword}'")
    print(f"{'='*60}\n")

    results = asyncio.run(scrape_feed(keyword=keyword))

    print(f"\n{'='*60}")
    print(f" TOTAL: {len(results)} POSTS WITH EMAILS")
    print(f"{'='*60}\n")

    for i, r in enumerate(results, 1):
        print(f"{i:3}. [{r['time']:6s}] {', '.join(r['emails']):35s} | {r['job_title'][:60]}")

    # Save
    filename = f"jobs_{keyword.replace(' ', '_')}.csv"
    with open(filename, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["Author", "Job Title", "Emails", "Time", "Preview"])
        for r in results:
            w.writerow([r["author"], r["job_title"], ", ".join(r["emails"]), r["time"], r["preview"]])

    json_filename = f"jobs_{keyword.replace(' ', '_')}.json"
    with open(json_filename, "w") as f:
        json.dump(results, f, indent=2)

    print(f"\nSaved to {filename} and {json_filename}")
