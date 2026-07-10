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
    for pat in [
        r'(?:Hiring|hiring|Looking for|looking for|We are hiring)\s*(?:\n)?\s*([^\n]{10,100})',
        r'(?:Role|role|Position|position|Job Title|job title)\s*[:\-–]\s*([^\n]{10,100})',
        r'(Senior|Junior|Lead|Full Stack|Frontend|Backend|Software|Web|Python|Java|React|Node|MERN|DevOps)\s*(Developer|Engineer|Intern|Architect)\s*[^\n]{0,50}',
    ]:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            return m.group(0).strip()[:150]
    for line in text.split("\n"):
        if any(w in line.lower() for w in ['developer', 'engineer', 'intern', 'hiring', 'remote']):
            return line.strip()[:150]
    return ""


async def scrape(keyword="developer remote"):
    all_entries = []
    seen_ids = set()

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        ctx_opts = {"viewport": {"width": 1280, "height": 900}}
        if os.path.exists("linkedin_auth.json"):
            ctx_opts["storage_state"] = "linkedin_auth.json"
        context = await browser.new_context(**ctx_opts)
        page = await context.new_page()

        # Login if needed
        await page.goto("https://www.linkedin.com/feed/", timeout=30000)
        if "login" in page.url.lower():
            await page.goto("https://www.linkedin.com/login", timeout=30000)
            print("Log in in the browser window...")
            await page.wait_for_url("https://www.linkedin.com/feed/*", timeout=180000)
            await context.storage_state(path="linkedin_auth.json")

        # Open search results
        url = f"https://www.linkedin.com/search/results/content/?keywords={keyword.replace(' ', '%20')}&origin=FACETED_SEARCH&sortBy=%5B%22date_posted%22%5D"
        print(f"Searching: {keyword}")
        await page.goto(url, timeout=60000)
        await asyncio.sleep(5)

        try:
            await page.wait_for_selector('div[role="listitem"]', timeout=15000)
        except:
            print("No results")
            await browser.close()
            return []

        # Expand all "see more" buttons
        for txt in ['See more', '…more', 'more']:
            try:
                while await page.locator(f"button:has-text('{txt}')").count() > 0:
                    await page.locator(f"button:has-text('{txt}')").first.click()
                    await asyncio.sleep(0.3)
            except:
                pass

        # Collect all visible posts
        items = page.locator('div[role="listitem"]')
        count = await items.count()
        for i in range(count):
            try:
                item = items.nth(i)
                text = await item.inner_text()
                h = hash(text[:500])
                if h in seen_ids:
                    continue
                seen_ids.add(h)

                emails = extract_emails(text)
                if not emails:
                    continue

                html = await item.inner_html()
                job_title = extract_job_title(text)
                author = ""
                prof = re.search(r'/in/([^/?"]+)', html)
                if prof:
                    author = " ".join(p.capitalize() for p in prof.group(1).split("-") if len(p) > 1)
                time_text = ""
                tm = re.search(r'(\d+\s*[hdwm]\s*ago|\b\d+[hdwm]\b)', text)
                if tm:
                    time_text = tm.group(1)

                all_entries.append({
                    "author": author,
                    "job_title": job_title,
                    "emails": emails,
                    "time": time_text,
                    "preview": text[:300]
                })
            except:
                continue

        print(f"  Page 1: {len(all_entries)} emails found")

        # Try scrolling 3 times
        for s in range(3):
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await asyncio.sleep(3)

            # Expand any new "see more" buttons
            for txt in ['See more', '…more', 'more']:
                try:
                    while await page.locator(f"button:has-text('{txt}')").count() > 0:
                        await page.locator(f"button:has-text('{txt}')").first.click()
                        await asyncio.sleep(0.3)
                except:
                    pass

            before = len(all_entries)
            items = page.locator('div[role="listitem"]')
            count = await items.count()
            for i in range(count):
                try:
                    item = items.nth(i)
                    text = await item.inner_text()
                    h = hash(text[:500])
                    if h in seen_ids:
                        continue
                    seen_ids.add(h)
                    emails = extract_emails(text)
                    if not emails:
                        continue
                    html = await item.inner_html()
                    job_title = extract_job_title(text)
                    author = ""
                    prof = re.search(r'/in/([^/?"]+)', html)
                    if prof:
                        author = " ".join(p.capitalize() for p in prof.group(1).split("-") if len(p) > 1)
                    time_text = ""
                    tm = re.search(r'(\d+\s*[hdwm]\s*ago|\b\d+[hdwm]\b)', text)
                    if tm:
                        time_text = tm.group(1)
                    all_entries.append({
                        "author": author,
                        "job_title": job_title,
                        "emails": emails,
                        "time": time_text,
                        "preview": text[:300]
                    })
                except:
                    continue
            new_c = len(all_entries) - before
            print(f"  Scroll {s+1}: +{new_c} new (total: {len(all_entries)})")
            if new_c == 0:
                break

        await browser.close()
    return all_entries


if __name__ == "__main__":
    import sys
    keyword = sys.argv[1] if len(sys.argv) > 1 else "developer remote"

    print(f"\nSearching LinkedIn for: '{keyword}'")
    results = asyncio.run(scrape(keyword=keyword))

    print(f"\n=== {len(results)} POSTS WITH EMAILS ===\n")
    for i, r in enumerate(results, 1):
        print(f"{i:3}. [{r['time']:6s}] {', '.join(r['emails']):35s} | {r['job_title'][:60]}")

    filename = f"jobs_{keyword.replace(' ', '_')}.csv"
    with open(filename, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["Author", "Job Title", "Emails", "Time", "Preview"])
        for r in results:
            w.writerow([r["author"], r["job_title"], ", ".join(r["emails"]), r["time"], r["preview"]])
    print(f"\nSaved to {filename}")
