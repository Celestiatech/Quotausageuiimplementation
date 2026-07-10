import asyncio
import json
import os
import re
import csv
import smtplib
import time
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from playwright.async_api import async_playwright

# ============================================================
# EDIT THESE WITH YOUR INFO BEFORE RUNNING
# ============================================================
CANDIDATE_NAME = "Your Name"
CANDIDATE_EMAIL = "your.email@gmail.com"
CANDIDATE_PHONE = ""
# Gmail App Password (NOT your regular password)
# Get one at: https://myaccount.google.com/apppasswords
GMAIL_APP_PASSWORD = ""
# ============================================================

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


def send_email(to_email, job_title):
    subject = f"Application for {job_title}" if job_title else "Job Application"
    body = f"""Dear Hiring Team,

I am writing to express my interest in the {job_title} position.

Please find my resume attached. I look forward to the opportunity to discuss how my skills align with your needs.

Best regards,
{CANDIDATE_NAME}
{CANDIDATE_EMAIL}
{CANDIDATE_PHONE}
"""
    msg = MIMEMultipart()
    msg["From"] = CANDIDATE_EMAIL
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))

    try:
        server = smtplib.SMTP("smtp.gmail.com", 587)
        server.starttls()
        server.login(CANDIDATE_EMAIL, GMAIL_APP_PASSWORD)
        server.send_message(msg)
        server.quit()
        return True
    except Exception as e:
        print(f"    FAILED: {e}")
        return False


async def scrape_jobs(keyword="developer remote", stop_after_hours=12, max_scrolls=100):
    all_entries = []
    seen_ids = set()
    no_new_count = 0

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
        await asyncio.sleep(5)

        try:
            await page.wait_for_selector('div[role="listitem"]', timeout=20000)
        except:
            print("No results found")
            await browser.close()
            return []

        for scroll_count in range(1, max_scrolls + 1):
            # Expand collapsed text
            for btn_text in ['See more', '…more', 'more']:
                btns = page.locator(f"button:has-text('{btn_text}')")
                while await btns.count() > 0:
                    try:
                        await btns.first.click()
                        await asyncio.sleep(0.3)
                    except:
                        break

            items = page.locator('div[role="listitem"]')
            count = await items.count()
            new_count = 0

            for i in range(count):
                item = items.nth(i)
                try:
                    text = await item.inner_text()
                    text_hash = hash(text[:500])
                    if text_hash in seen_ids:
                        continue
                    seen_ids.add(text_hash)
                    new_count += 1

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
                    print(f"  [{time_text:6s}] {emails[0]:30s} | {job_title[:50]}")
                except:
                    continue

            if new_count == 0:
                no_new_count += 1
            else:
                no_new_count = 0

            if no_new_count >= 5:
                print(f"No new posts after {no_new_count} scrolls — stopping at scroll {scroll_count}")
                break

            # Scroll to bottom of lazy column
            await page.evaluate("""
                const col = document.querySelector('[data-testid="lazy-column"]') ||
                            document.querySelector('main');
                if (col) col.scrollTop = col.scrollHeight;
                window.scrollTo(0, document.body.scrollHeight);
            """)
            await asyncio.sleep(3)

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


if __name__ == "__main__":
    print(f"\n{'='*60}")
    print(" LINKEDIN JOB SCRAPER + AUTO EMAIL")
    print(f"{'='*60}")

    keyword = input("Search keyword (default: developer remote): ").strip() or "developer remote"
    hours = input("Max age of posts in hours (default: 12): ").strip() or "12"

    print(f"\n--- Scraping LinkedIn for '{keyword}' (last {hours}h) ---\n")
    results = asyncio.run(scrape_jobs(keyword=keyword, stop_after_hours=int(hours)))

    print(f"\n{'='*60}")
    print(f" FOUND {len(results)} POSTS WITH EMAILS")
    print(f"{'='*60}\n")

    for i, r in enumerate(results, 1):
        print(f"{i:3}. [{r['time']:6s}] {', '.join(r['emails']):35s} | {r['job_title'][:60]}")

    # Save to files
    with open("jobs_with_emails.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["Author", "Job Title", "Emails", "Time", "Preview"])
        for r in results:
            w.writerow([r["author"], r["job_title"], ", ".join(r["emails"]), r["time"], r["preview"]])
    with open("jobs_with_emails.json", "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nSaved to jobs_with_emails.csv ({len(results)} entries)")

    # Auto-send option
    if results and GMAIL_APP_PASSWORD:
        print(f"\n--- SENDING APPLICATIONS TO {len(results)} POSTS ---\n")
        sent = 0
        for r in results:
            for email in r["emails"]:
                title = r["job_title"] or "Developer Position"
                print(f"Sending to {email} — Subject: Application for {title}...", end=" ")
                if send_email(email, title):
                    sent += 1
                    print("OK")
                else:
                    print("FAILED")
                time.sleep(3)
        print(f"\nSent: {sent} emails")
    elif results and not GMAIL_APP_PASSWORD:
        print(f"\nSet GMAIL_APP_PASSWORD at the top of the script to auto-send emails.")
        print(f"Get one at: https://myaccount.google.com/apppasswords")
