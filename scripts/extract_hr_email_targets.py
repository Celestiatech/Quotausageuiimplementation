#!/usr/bin/env python3
"""
Build HR email targets from an existing contacts CSV.

Input columns expected:
name,category,address,lat,lon,phone,email,website,...

Output:
- verified_hr_emails.csv   (public emails from source file)
- guessed_hr_emails.csv    (alias guesses from company domain)
"""

from __future__ import annotations

import argparse
import csv
from urllib.parse import urlparse

ALIASES = [
    "hr",
    "careers",
    "jobs",
    "talent",
    "recruitment",
    "recruiter",
    "hiring",
    "people",
    "peopleops",
    "workwithus",
]


def domain_from_url(url: str) -> str:
    if not url:
        return ""
    try:
        p = urlparse(url if url.startswith(("http://", "https://")) else f"https://{url}")
        host = (p.netloc or "").lower().strip()
        if host.startswith("www."):
            host = host[4:]
        return host
    except Exception:
        return ""


def is_company_row(category: str) -> bool:
    c = (category or "").lower()
    return c.startswith("office:company") or c.startswith("office:it") or c.startswith("office:consulting")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--verified-output", default="verified_hr_emails.csv")
    parser.add_argument("--guessed-output", default="guessed_hr_emails.csv")
    args = parser.parse_args()

    verified = []
    guessed = []
    seen_verified = set()
    seen_guessed = set()

    with open(args.input, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = (row.get("name") or "").strip()
            category = (row.get("category") or "").strip()
            website = (row.get("website") or "").strip()
            phone = (row.get("phone") or "").strip()
            email = (row.get("email") or "").strip()
            if not is_company_row(category):
                continue

            domain = domain_from_url(website)

            if email:
                key = email.lower()
                if key not in seen_verified:
                    seen_verified.add(key)
                    verified.append(
                        {
                            "company": name,
                            "email": email,
                            "phone": phone,
                            "website": website,
                            "domain": domain,
                            "source": "public_listing",
                        }
                    )

            if domain:
                for alias in ALIASES:
                    guess = f"{alias}@{domain}"
                    key = guess.lower()
                    if key not in seen_guessed:
                        seen_guessed.add(key)
                        guessed.append(
                            {
                                "company": name,
                                "guessed_email": guess,
                                "website": website,
                                "domain": domain,
                                "note": "guess_only_verify_before_contact",
                            }
                        )

    with open(args.verified_output, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(
            f,
            fieldnames=["company", "email", "phone", "website", "domain", "source"],
        )
        w.writeheader()
        w.writerows(verified)

    with open(args.guessed_output, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(
            f,
            fieldnames=["company", "guessed_email", "website", "domain", "note"],
        )
        w.writeheader()
        w.writerows(guessed)

    print(f"Verified: {len(verified)} -> {args.verified_output}")
    print(f"Guessed: {len(guessed)} -> {args.guessed_output}")


if __name__ == "__main__":
    main()
