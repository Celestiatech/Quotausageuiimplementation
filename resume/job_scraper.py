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
        r'(?:Hiring|hiring|Looking for|looking for|We are hiring|we are hiring|Need a|need a|Join our team|join our team)\s*(?:\n)?\s*([^\n]+)',
        r'(?:Role|role|Position|position|Job Title|job title)\s*[:\-–]\s*([^\n]+)',
        r'(?:Senior|Junior|Lead|Full Stack|Frontend|Backend|Software|Web|Python|Java|React|Node)\s*(?:Developer|Engineer|Intern)\s*[^\n]{0,50}',
    ]
    for pat in patterns:
        match = re.search(pat, text, re.IGNORECASE)
        if match:
            title = match.group(1) if match.lastindex else match.group(0)
            return title.strip()[:150]
    return ""


async def scrape_jobs(keyword="developer remote", max_scrolls=30):
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

        search_url = f"https://www.linkedin.com/search/results/content/?keywords={keyword.replace(' ', '%20')}&origin=FACETED_SEARCH&sortBy=%5B%22date_posted%22%5D"
        print(f"Searching: {keyword}")
        await page.goto(search_url, timeout=60000)
        await asyncio.sleep(4)

        try:
            await page.wait_for_selector('div[role="listitem"]', timeout=20000)
            print("Results loaded!")
        except:
            print("No results found")
            await browser.close()
            return []

        for scroll_count in range(1, max_scrolls + 1):
            print(f"Scroll {scroll_count}/{max_scrolls} — {len(all_entries)} collected so far")

            # Click "see more" to expand post text
            for btn_text in ['See more', 'more']:
                btns = page.locator(f"button:has-text('{btn_text}')")
                while await btns.count() > 0:
                    try:
                        await btns.first.click()
                        await asyncio.sleep(0.3)
                    except:
                        break

            items = page.locator('div[role="listitem"]')
            count = await items.count()

            for i in range(count):
                item = items.nth(i)
                try:
                    text = await item.inner_text()
                    html = await item.inner_html()

                    # Dedup
                    text_hash = hash(text[:500])
                    if text_hash in seen_ids:
                        continue
                    seen_ids.add(text_hash)

                    # Extract email
                    emails = extract_emails(text)
                    if not emails:
                        continue  # skip posts without email

                    # Extract job title
                    job_title = extract_job_title(text)

                    # Extract author
                    author = ""
                    profile = re.search(r'/in/([^/?"]+)', html)
                    if profile:
                        name_parts = profile.group(1).split("-")
                        author = " ".join(p.capitalize() for p in name_parts if len(p) > 1)

                    # Extract time
                    time_text = ""
                    time_match = re.search(r'(\d+[hdwm]\s*ago|\b\d+[hdwm]\b)', text)
                    if time_match:
                        time_text = time_match.group(1)

                    # Get post URL
                    post_url = ""
                    link_match = re.search(r'href="(https?://www\.linkedin\.com/posts/[^"]+)"', html)
                    if link_match:
                        post_url = link_match.group(1)

                    entry = {
                        "author": author,
                        "job_title": job_title,
                        "emails": emails,
                        "time": time_text,
                        "post_url": post_url,
                        "preview": text[:300]
                    }
                    all_entries.append(entry)
                    print(f"  [EMAIL FOUND] {emails[0]} — {job_title[:50] if job_title else 'No title'}")
                except:
                    continue

            await page.mouse.wheel(0, 1200)
            await asyncio.sleep(3)

        await browser.close()

    return all_entries


if __name__ == "__main__":
    results = asyncio.run(scrape_jobs(keyword="developer remote"))

    print(f"\n{'='*60}")
    print(f"Found {len(results)} posts containing email addresses")
    print(f"{'='*60}\n")

    for i, r in enumerate(results, 1):
        emails = ", ".join(r["emails"])
        print(f"{i:2}. [{r['time']:6s}] {r['author'][:25]:25s}")
        print(f"     Title: {r['job_title'][:80]}")
        print(f"     Email: {emails}")
        print()

    # Save to CSV
    with open("jobs_with_emails.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["Author", "Job Title", "Emails", "Time", "Post URL", "Preview"])
        for r in results:
            w.writerow([r["author"], r["job_title"], ", ".join(r["emails"]), r["time"], r["post_url"], r["preview"]])

    # Save to JSON
    with open("jobs_with_emails.json", "w") as f:
        json.dump(results, f, indent=2)

    print(f"Saved to jobs_with_emails.csv and jobs_with_emails.json")
