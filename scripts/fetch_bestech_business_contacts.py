#!/usr/bin/env python3
"""
Fetch public business contacts near a location (default: Bestech Business Tower, Gurugram)
using OpenStreetMap (Nominatim + Overpass), then optionally enrich from public websites.

⚠️ Use responsibly:
- Collect only public business contact data.
- Respect privacy laws, platform terms, and anti-spam regulations.
- Do not send unsolicited bulk spam.

Usage examples:
  python scripts/fetch_bestech_business_contacts.py
  python scripts/fetch_bestech_business_contacts.py --radius 5000 --crawl-websites
  python scripts/fetch_bestech_business_contacts.py --place "Bestech Business Tower, Gurugram" --output contacts.csv
"""

from __future__ import annotations

import argparse
import csv
import re
import time
from dataclasses import dataclass
from html import unescape
from typing import Dict, Iterable, List, Optional, Set, Tuple
from urllib.parse import urljoin

import requests

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.openstreetmap.ru/api/interpreter",
]

# Basic regexes for public contact extraction
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
PHONE_RE = re.compile(r"(?:\+?\d[\d\s().\-]{7,}\d)")

USER_AGENT = "AutoApplyCV-ContactsFetcher/1.0 (contact: support@autoapplycv.in)"


@dataclass
class BusinessContact:
    name: str
    category: str
    address: str
    lat: float
    lon: float
    osm_type: str
    osm_id: int
    phone: str = ""
    email: str = ""
    website: str = ""
    phone_source: str = ""
    email_source: str = ""


def clean_text(value: str) -> str:
    value = unescape(value or "").strip()
    return re.sub(r"\s+", " ", value)


def normalize_website(url: str) -> str:
    url = (url or "").strip()
    if not url:
        return ""
    if not url.startswith(("http://", "https://")):
        return f"https://{url}"
    return url


def geocode_place(place: str) -> Tuple[float, float, str]:
    params = {
        "q": place,
        "format": "jsonv2",
        "limit": 1,
    }
    headers = {"User-Agent": USER_AGENT}
    r = requests.get(NOMINATIM_URL, params=params, headers=headers, timeout=30)
    r.raise_for_status()
    data = r.json()
    if not data:
        raise RuntimeError(f"Could not geocode place: {place}")

    first = data[0]
    lat = float(first["lat"])
    lon = float(first["lon"])
    label = first.get("display_name", place)
    return lat, lon, label


def build_overpass_query(lat: float, lon: float, radius_m: int) -> str:
    # Pull likely business features around point
    return f"""
[out:json][timeout:60];
(
  node(around:{radius_m},{lat},{lon})[office];
  way(around:{radius_m},{lat},{lon})[office];
  relation(around:{radius_m},{lat},{lon})[office];

  node(around:{radius_m},{lat},{lon})[shop];
  way(around:{radius_m},{lat},{lon})[shop];
  relation(around:{radius_m},{lat},{lon})[shop];

  node(around:{radius_m},{lat},{lon})[amenity~"restaurant|cafe|bank|pharmacy|clinic|hospital|school|college|university|coworking_space|dentist|doctors"];
  way(around:{radius_m},{lat},{lon})[amenity~"restaurant|cafe|bank|pharmacy|clinic|hospital|school|college|university|coworking_space|dentist|doctors"];
  relation(around:{radius_m},{lat},{lon})[amenity~"restaurant|cafe|bank|pharmacy|clinic|hospital|school|college|university|coworking_space|dentist|doctors"];
);
out center tags;
""".strip()


def format_address(tags: Dict[str, str]) -> str:
    parts = [
        tags.get("addr:housenumber", ""),
        tags.get("addr:street", ""),
        tags.get("addr:suburb", ""),
        tags.get("addr:city", ""),
        tags.get("addr:state", ""),
        tags.get("addr:postcode", ""),
    ]
    full = ", ".join([p for p in parts if p])
    return clean_text(full)


def category_from_tags(tags: Dict[str, str]) -> str:
    if tags.get("office"):
        return f"office:{tags['office']}"
    if tags.get("shop"):
        return f"shop:{tags['shop']}"
    if tags.get("amenity"):
        return f"amenity:{tags['amenity']}"
    return "unknown"


def extract_osm_contacts(tags: Dict[str, str]) -> Tuple[str, str, str]:
    phone = tags.get("phone") or tags.get("contact:phone") or ""
    email = tags.get("email") or tags.get("contact:email") or ""
    website = tags.get("website") or tags.get("contact:website") or ""
    return clean_text(phone), clean_text(email), normalize_website(website)


def fetch_overpass_contacts(lat: float, lon: float, radius_m: int, limit: int) -> List[BusinessContact]:
    query = build_overpass_query(lat, lon, radius_m)
    headers = {"User-Agent": USER_AGENT}
    data = None
    last_error: Optional[Exception] = None

    for endpoint in OVERPASS_URLS:
        try:
            r = requests.post(endpoint, data={"data": query}, headers=headers, timeout=120)
            r.raise_for_status()
            data = r.json()
            break
        except requests.RequestException as err:
            last_error = err
            time.sleep(1.2)

    if data is None:
        raise RuntimeError(f"All Overpass endpoints failed. Last error: {last_error}")

    rows: List[BusinessContact] = []
    seen_keys: Set[Tuple[str, str]] = set()

    for el in data.get("elements", []):
        tags = el.get("tags", {})
        name = clean_text(tags.get("name", ""))
        if not name:
            continue

        lat_v = el.get("lat") or el.get("center", {}).get("lat")
        lon_v = el.get("lon") or el.get("center", {}).get("lon")
        if lat_v is None or lon_v is None:
            continue

        phone, email, website = extract_osm_contacts(tags)
        category = category_from_tags(tags)
        address = format_address(tags)

        key = (name.lower(), address.lower())
        if key in seen_keys:
            continue
        seen_keys.add(key)

        row = BusinessContact(
            name=name,
            category=category,
            address=address,
            lat=float(lat_v),
            lon=float(lon_v),
            osm_type=el.get("type", ""),
            osm_id=int(el.get("id", 0)),
            phone=phone,
            email=email,
            website=website,
            phone_source="osm" if phone else "",
            email_source="osm" if email else "",
        )
        rows.append(row)
        if len(rows) >= limit:
            break

    return rows


def strip_html_text(html: str) -> str:
    html = re.sub(r"(?is)<script.*?>.*?</script>", " ", html)
    html = re.sub(r"(?is)<style.*?>.*?</style>", " ", html)
    html = re.sub(r"(?is)<[^>]+>", " ", html)
    return clean_text(html)


def extract_contacts_from_html(base_url: str, html: str) -> Tuple[List[str], List[str], List[str]]:
    text = strip_html_text(html)

    emails = sorted(set(EMAIL_RE.findall(text)))
    phones = sorted(set([clean_text(p) for p in PHONE_RE.findall(text)]))

    # Find candidate contact links
    links = []
    for href in re.findall(r'href=["\']([^"\']+)["\']', html, flags=re.I):
        if href.startswith("mailto:"):
            emails.append(href.replace("mailto:", "").split("?")[0].strip())
            continue
        low = href.lower()
        if any(k in low for k in ["contact", "about", "team", "careers", "support"]):
            links.append(urljoin(base_url, href))

    emails = sorted(set([e for e in emails if ".png" not in e and ".jpg" not in e]))
    phones = sorted(set(phones))
    links = sorted(set(links))
    return emails, phones, links


def enrich_from_website(row: BusinessContact, pause_s: float = 0.8) -> BusinessContact:
    if not row.website:
        return row

    headers = {"User-Agent": USER_AGENT}
    visited: Set[str] = set()
    queue: List[str] = [row.website]

    all_emails: Set[str] = set([row.email] if row.email else [])
    all_phones: Set[str] = set([row.phone] if row.phone else [])

    # Crawl a few pages max to stay polite
    while queue and len(visited) < 4:
        url = queue.pop(0)
        if url in visited:
            continue
        visited.add(url)

        try:
            resp = requests.get(url, headers=headers, timeout=20)
            if "text/html" not in resp.headers.get("content-type", ""):
                continue
            html = resp.text
            emails, phones, links = extract_contacts_from_html(url, html)
            all_emails.update(emails)
            all_phones.update(phones)

            # Add likely contact pages
            for lnk in links[:3]:
                if lnk not in visited and lnk not in queue:
                    queue.append(lnk)

            # early stop if already got both
            if all_emails and all_phones:
                break

            time.sleep(pause_s)
        except requests.RequestException:
            continue

    if all_emails and not row.email:
        row.email = sorted(all_emails)[0]
        row.email_source = "website"
    if all_phones and not row.phone:
        row.phone = sorted(all_phones)[0]
        row.phone_source = "website"

    return row


def write_csv(rows: Iterable[BusinessContact], output_path: str) -> None:
    fields = [
        "name",
        "category",
        "address",
        "lat",
        "lon",
        "phone",
        "email",
        "website",
        "phone_source",
        "email_source",
        "osm_type",
        "osm_id",
    ]
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for r in rows:
            writer.writerow(
                {
                    "name": r.name,
                    "category": r.category,
                    "address": r.address,
                    "lat": r.lat,
                    "lon": r.lon,
                    "phone": r.phone,
                    "email": r.email,
                    "website": r.website,
                    "phone_source": r.phone_source,
                    "email_source": r.email_source,
                    "osm_type": r.osm_type,
                    "osm_id": r.osm_id,
                }
            )


def print_summary(rows: List[BusinessContact], output: str) -> None:
    with_email = sum(1 for r in rows if r.email)
    with_phone = sum(1 for r in rows if r.phone)
    with_both = sum(1 for r in rows if r.email and r.phone)

    print("\nDone ✅")
    print(f"Total companies saved: {len(rows)}")
    print(f"With email: {with_email}")
    print(f"With phone: {with_phone}")
    print(f"With both: {with_both}")
    print(f"CSV: {output}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch public business contacts near a place")
    parser.add_argument(
        "--lat",
        type=float,
        default=None,
        help="Latitude for search center (if provided with --lon, geocoding is skipped)",
    )
    parser.add_argument(
        "--lon",
        type=float,
        default=None,
        help="Longitude for search center (if provided with --lat, geocoding is skipped)",
    )
    parser.add_argument(
        "--place",
        default="Bestech Business Tower, Gurugram",
        help="Place name/address to center the search",
    )
    parser.add_argument(
        "--radius",
        type=int,
        default=3500,
        help="Search radius in meters (default: 3500)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=500,
        help="Max companies to collect (default: 500)",
    )
    parser.add_argument(
        "--crawl-websites",
        action="store_true",
        help="Try extracting missing email/phone from public website/contact pages",
    )
    parser.add_argument(
        "--output",
        default="bestech_business_contacts.csv",
        help="Output CSV file path",
    )
    args = parser.parse_args()

    if args.lat is not None and args.lon is not None:
        lat, lon = float(args.lat), float(args.lon)
        label = f"Manual coordinates ({lat}, {lon})"
        print("Using manual coordinates")
    else:
        print(f"Geocoding: {args.place}")
        lat, lon, label = geocode_place(args.place)

    print(f"Center: {label}")
    print(f"Coordinates: {lat:.6f}, {lon:.6f}")

    print(f"\nFetching businesses within {args.radius}m...")
    rows = fetch_overpass_contacts(lat=lat, lon=lon, radius_m=args.radius, limit=args.limit)
    print(f"Found {len(rows)} businesses")

    if args.crawl_websites and rows:
        print("\nEnriching from websites (public pages only)...")
        for idx, row in enumerate(rows, 1):
            if row.website and (not row.email or not row.phone):
                rows[idx - 1] = enrich_from_website(row)
            if idx % 25 == 0:
                print(f"Processed {idx}/{len(rows)}")
                time.sleep(1.0)

    write_csv(rows, args.output)
    print_summary(rows, args.output)


if __name__ == "__main__":
    main()
