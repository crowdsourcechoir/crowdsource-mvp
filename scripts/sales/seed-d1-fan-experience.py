#!/usr/bin/env python3
"""
Find Kyle Hoob-comparable marketing / fan-experience / creative / game-presentation
contacts on official athletics staff directories, Hunter-find missing emails, and
seed them into the production approval queue.

Never invents emails. Hunter Email Finder: 1 credit only when an email is found.

Usage:
  python3 scripts/sales/seed-d1-fan-experience.py --plan
  python3 scripts/sales/seed-d1-fan-experience.py --conferences "ACC,Big Ten"
  python3 scripts/sales/seed-d1-fan-experience.py --limit 5
"""
from __future__ import annotations

import argparse
import html as htmlmod
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

UA = "CrowdsourceChoirSalesResearchBot/0.1 (+https://app.crowdsourcechoir.com)"
SEED_URL = "https://app.crowdsourcechoir.com/api/sales/organizations/seed-with-contacts"
CREDITS_URL = "https://app.crowdsourcechoir.com/api/sales/enrichment/credits"
HUNTER_FINDER = "https://api.hunter.io/v2/email-finder"
QUEUE_URL = "https://app.crowdsourcechoir.com/api/sales/queue?status=pending"

ROOT = Path(__file__).resolve().parent
SCHOOLS_PATH = ROOT / "d1-fan-experience-schools.json"
PROGRESS_PATH = Path("/tmp/d1-fan-experience-progress.json")
LOG_PATH = Path("/opt/cursor/artifacts/d1-fan-experience-seed.log")

TITLE_KEEP = re.compile(
    r"(marketing|fan\s*(experience|engagement|entertainment)|creative\s*services|"
    r"game[\s-]*(presentation|entertainment|day)|gameday|"
    r"brand\s*(and|&)?\s*(marketing|creative)|promotions)",
    re.I,
)
TITLE_DROP = re.compile(
    r"(head\s+coach|assistant\s+coach|volunteer\s+coach|graduate\s+assistant|\bintern\b|"
    r"video\s+producer|graphic\s+designer|content\s+producer|photographer|"
    r"sports\s+information|communications\b|media\s+relations|"
    r"compliance|academic|development|fundraising|ticket|"
    r"equipment|trainer|physician|nutrition|facilities|"
    r"business\s+office|human\s+resources)",
    re.I,
)
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
NAME_RE = re.compile(r"^[A-Z][A-Za-z''.\-]+(?:\s+[A-Z][A-Za-z''.\-]+){1,3}$")

ROLE_BLURB = (
    "Marketing / fan-experience / creative seat comparable to Gonzaga’s Kyle Hoob "
    "(Assistant AD, Marketing & Creative Services) — doorway for a participatory "
    "game-day moment and season-long fan creation, not a coach or SID."
)


def http_get(url: str, timeout: int = 25) -> tuple[int, str]:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html,application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return res.status, res.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace") if e.fp else ""
        return e.code, body
    except Exception as e:
        return 0, str(e)


def http_json(url: str, payload: dict | None = None, timeout: int = 120) -> tuple[int, dict]:
    data = None
    headers = {"User-Agent": UA, "Accept": "application/json"}
    if payload is not None:
        data = json.dumps(payload).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            raw = res.read().decode("utf-8", "replace")
            return res.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace") if e.fp else ""
        try:
            body = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            body = {"error": raw[:400]}
        return e.code, body
    except Exception as e:
        return 0, {"error": str(e)}


def unescape(s: str) -> str:
    return htmlmod.unescape(re.sub(r"\s+", " ", s)).strip()


def looks_like_person(name: str) -> bool:
    n = unescape(name)
    if not NAME_RE.match(n):
        return False
    if re.search(r"(Athletics|Department|Office|Staff|Marketing$)", n):
        return False
    return True


def split_name(full: str) -> tuple[str, str]:
    parts = full.strip().split()
    return parts[0], parts[-1]


def extract_people(html: str) -> list[dict]:
    try:
        return _extract_people(html)
    except Exception:
        return []


def _extract_people(html: str) -> list[dict]:
    people: list[dict] = []
    seen: set[str] = set()

    def add(name: str, title: str, email: str | None) -> None:
        name, title = unescape(name), unescape(title)
        key = re.sub(r"\s+", " ", name).strip().lower()
        if key in seen or not looks_like_person(name) or not title:
            return
        seen.add(key)
        people.append({"fullName": re.sub(r"\s+", " ", name).strip(), "roleTitle": title, "email": email.lower() if email else None})

    # Sidearm person-details cards (split on card root so email stays with the right person)
    parts = re.split(r's-person-details__root', html)
    for block in parts[1:]:
        name_m = re.search(r'aria-label="([^"]+?) full bio"', block, re.I) or re.search(
            r's-person-details__personal-single-line-person-link[^>]*>\s*([^<]{3,80})\s*<',
            block,
            re.I,
        )
        title_m = re.search(r's-person-details__position[^>]*>\s*<div>([^<]{3,140})</div>', block, re.I) or re.search(
            r's-person-details__position[^>]*>\s*([^<]{3,140})\s*<',
            block,
            re.I,
        )
        if not name_m or not title_m:
            continue
        mail_m = re.search(r"mailto:([^\"'?]+)", block, re.I)
        emails = [e.lower() for e in EMAIL_RE.findall(block)]
        email = (mail_m.group(1) if mail_m else (emails[0] if emails else None))
        add(name_m.group(1), title_m.group(1), email)

    # Sidearm table view: name cell, title cell, mailto cell
    for m in re.finditer(
        r">([A-Z][A-Za-z''.\-]+(?:\s+[A-Z][A-Za-z''.\-]+){1,3})</span></a>"
        r"[\s\S]{0,400}?>((?:Assistant |Associate |Senior |Deputy |Executive )?"
        r"(?:Athletic Director|Athletics Director|A\.?D\.?|Director|Coordinator|Manager|Specialist)[^<]{0,90})",
        html,
    ):
        name, title = m.group(1), m.group(2)
        chunk = html[m.start() : m.end() + 1200]
        mail_m = re.search(r"mailto:([^\"'?]+)", chunk, re.I)
        add(name, title, mail_m.group(1) if mail_m else None)

    # NextGen table: name … <p>title</p> … mailto (phone cell may sit between title and email)
    for m in re.finditer(
        r">\s*([A-Z][A-Za-z''.\-]+(?:\s+[A-Z][A-Za-z''.\-]+){1,3})\s*(?:<!--[\s\S]*?-->)?\s*</a>"
        r"[\s\S]{0,280}?staff-directory-table-member-position__position"
        r"[\s\S]{0,160}?<p[^>]*>([^<]{3,140})</p>"
        r"[\s\S]{0,900}?mailto:([^\"'?]+)",
        html,
        re.I,
    ):
        add(m.group(1), m.group(2), m.group(3))

    # Legacy Sidearm staff table rows
    for m in re.finditer(
        r"<tr[^>]*sidearm-staff-member[\s\S]{0,2500}?</tr>",
        html,
        re.I,
    ):
        block = m.group(0)
        name_m = re.search(r"<a[^>]*>\s*([A-Z][A-Za-z''.\-]+(?:\s+[A-Z][A-Za-z''.\-]+){1,3})\s*</a>", block)
        title_m = re.search(r"col-staff_title[^>]*>\s*([^<]{3,140})\s*<", block, re.I)
        if not title_m:
            title_m = re.search(r'sidearm-staff-member-title[^>]*>([^<]{3,140})<', block, re.I)
        email = None
        mail_m = re.search(r"mailto:([^\"'?]+)", block, re.I)
        if mail_m:
            email = mail_m.group(1)
        else:
            fh = re.search(r'firstHalf\s*=\s*"([^"]+)"', block)
            sh = re.search(r'secondHalf\s*=\s*"([^"]+)"', block)
            if fh and sh:
                email = f"{fh.group(1)}@{sh.group(1)}"
        if name_m and title_m:
            add(name_m.group(1), title_m.group(1), email)

    return people


def is_hoob_comparable(title: str) -> bool:
    if re.search(r"(graduate\s+assistant|\bintern\b|video\s+producer|graphic\s+designer|content\s+producer)", title, re.I):
        return False
    if not TITLE_KEEP.search(title):
        return False
    if TITLE_DROP.search(title) and not re.search(r"(marketing|fan|creative|game)", title, re.I):
        return False
    return True


def fetch_staff(site: str) -> tuple[str, list[dict]]:
    site = site.rstrip("/")
    paths = ["/staff-directory", "/staff-directory/", "/sports/staff-directory"]
    last_url = site + "/staff-directory"
    last_html = ""
    for path in paths:
        url = site + path
        last_url = url
        status, html = http_get(url)
        if status == 200 and len(html) > 5000:
            last_html = html
            people = extract_people(html)
            if people:
                return url, people
    if last_html:
        return last_url, extract_people(last_html)
    return last_url, []


def hunter_find(first: str, last: str, domain: str, api_key: str) -> dict:
    q = urllib.parse.urlencode(
        {"domain": domain, "first_name": first, "last_name": last, "api_key": api_key}
    )
    status, body = http_json(f"{HUNTER_FINDER}?{q}")
    if status != 200:
        return {"status": "error", "email": None, "error": f"HTTP {status} {body}"}
    email = ((body.get("data") or {}).get("email")) if isinstance(body, dict) else None
    return {"status": "found" if email else "not_found", "email": email, "error": None}


def credits() -> dict:
    _, body = http_json(CREDITS_URL)
    return body


def queued_org_names() -> set[str]:
    _, body = http_json(QUEUE_URL)
    names = set()
    for it in body.get("items") or []:
        n = ((it.get("organization") or {}).get("name") or "").strip().lower()
        if n:
            names.add(n)
    return names


def load_progress() -> dict:
    if PROGRESS_PATH.exists():
        return json.loads(PROGRESS_PATH.read_text())
    return {"schools": {}}


def save_progress(p: dict) -> None:
    PROGRESS_PATH.write_text(json.dumps(p, indent=2))


def seed_org(school: dict, conference: str, contacts: list[dict]) -> dict:
    payload = {
        "name": school["name"],
        "websiteUrl": school["site"],
        "locationCity": school.get("city"),
        "locationRegion": school.get("region"),
        "locationCountry": "US",
        "organizationTypeKey": "university",
        "contacts": contacts,
        "runPipeline": False,
        "forceManualQueue": True,
        "opportunityTypeKey": "fan_engagement_initiative",
        "manualQueueTitle": f"{school['name']} — game-day participation / Song Garden",
        "manualQueueDescription": (
            f"{conference} athletics. Doorway contacts in marketing / fan experience / creative "
            "services / game presentation (Kyle Hoob comparable). Hunter Email Finder or official "
            "staff-directory emails only — none invented."
        ),
        "manualEventName": "Game-day fan experience / participatory anthem",
    }
    status, body = http_json(SEED_URL, payload, timeout=180)
    return {"http": status, **(body if isinstance(body, dict) else {"error": body})}


def process_school(school: dict, conference: str, api_key: str, queued: set[str], dry: bool) -> dict:
    name = school["name"]
    if school.get("skipIfQueued") and name.strip().lower() in queued:
        return {"name": name, "status": "skipped_already_queued", "contacts": []}

    url, people = fetch_staff(school["site"])
    comparable = [p for p in people if is_hoob_comparable(p["roleTitle"])]
    # Prefer AAD / Director over coordinator; keep up to 5
    def rank(p):
        t = p["roleTitle"].lower()
        if "assistant athletic director" in t or "associate athletic director" in t or re.search(r"\baad\b", t):
            return 0
        if "executive director" in t or "senior director" in t:
            return 1
        if t.startswith("director") or "director of" in t:
            return 2
        return 3

    comparable.sort(key=rank)
    comparable = comparable[:5]

    hunter_calls = 0
    found = 0
    misses = 0
    ready = []
    for p in comparable:
        email = p.get("email")
        source = "staff_directory"
        if email and any(email.endswith("@" + d) or email.endswith("." + d) for d in ["edu", "com", "org", "net"]):
            pass
        else:
            first, last = split_name(p["fullName"])
            domains = [school["emailDomain"], *(school.get("altEmailDomains") or [])]
            # also try registrable athletics host if it isn't a sidearm CDN
            host = urllib.parse.urlparse(school["site"]).hostname or ""
            host = host.replace("www.", "")
            if host and host not in domains:
                domains.append(host)
            email = None
            for domain in domains:
                hunter_calls += 1
                result = hunter_find(first, last, domain, api_key)
                if result["status"] == "found" and result["email"]:
                    email = result["email"].lower()
                    source = f"hunter:{domain}"
                    found += 1
                    break
                if result["status"] == "not_found":
                    misses += 1
                time.sleep(0.15)
        if not email:
            continue
        ready.append(
            {
                "fullName": p["fullName"],
                "email": email,
                "roleTitle": p["roleTitle"],
                "roleCategory": "marketing",
                "roleDescription": ROLE_BLURB,
                "source": source,
            }
        )

    out = {
        "name": name,
        "conference": conference,
        "staffUrl": url,
        "peopleParsed": len(people),
        "comparable": len(comparable),
        "ready": len(ready),
        "hunterCalls": hunter_calls,
        "hunterFound": found,
        "hunterMiss": misses,
        "contacts": ready,
        "status": "ready" if ready else ("no_comparable" if not comparable else "no_email"),
    }
    if ready and not dry:
        seed = seed_org(school, conference, [{k: c[k] for k in ("fullName", "email", "roleTitle", "roleCategory", "roleDescription")} for c in ready])
        out["seed"] = {
            "http": seed.get("http"),
            "organizationId": seed.get("organizationId"),
            "queueItemId": (seed.get("manualEnqueue") or {}).get("queueItemId"),
            "error": seed.get("error"),
            "contactsCreated": seed.get("contactsCreated"),
        }
        out["status"] = "seeded" if seed.get("http") == 200 else f"seed_failed:{seed.get('error')}"
    return out


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--conferences", default="", help="Comma-separated conference keys")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--plan", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--resume", action="store_true")
    args = parser.parse_args()

    catalog = json.loads(SCHOOLS_PATH.read_text())
    wanted = [c.strip() for c in args.conferences.split(",") if c.strip()]
    schools: list[tuple[str, dict]] = []
    for conf, rows in catalog["conferences"].items():
        if wanted and conf not in wanted:
            continue
        for row in rows:
            schools.append((conf, row))
    if args.limit:
        schools = schools[: args.limit]

    print(f"schools={len(schools)} conferences={wanted or 'ALL'}")
    if args.plan:
        by = {}
        for conf, row in schools:
            by.setdefault(conf, 0)
            by[conf] += 1
        for conf, n in by.items():
            print(f"  {conf}: {n}")
        print("total", len(schools))
        return 0

    api_key = (os.environ.get("HUNTER_API_KEY") or "").strip()
    if not api_key:
        print("MISSING: HUNTER_API_KEY", file=sys.stderr)
        return 1

    before = credits()
    print("credits_before", json.dumps({k: before.get(k) for k in ("creditsUsed", "creditsAvailable", "resetDate", "planName")}))
    queued = queued_org_names()
    progress = load_progress() if args.resume else {"schools": {}}

    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    results = []
    for i, (conf, school) in enumerate(schools, 1):
        key = school["name"]
        if args.resume and progress.get("schools", {}).get(key, {}).get("status") in ("seeded", "skipped_already_queued"):
            print(f"[{i}/{len(schools)}] skip {key}")
            continue
        print(f"[{i}/{len(schools)}] {conf} {key} …", flush=True)
        row = process_school(school, conf, api_key, queued, args.dry_run)
        results.append(row)
        progress.setdefault("schools", {})[key] = row
        save_progress(progress)
        names = ", ".join(f"{c['fullName']} <{c['email']}>" for c in row.get("contacts") or [])
        print(f"    {row['status']} parsed={row.get('peopleParsed')} comparable={row.get('comparable')} ready={row.get('ready')} hunter={row.get('hunterFound')}/{row.get('hunterCalls')} {names}", flush=True)

    after = credits()
    summary = {
        "before": before,
        "after": after,
        "deltaUsed": (after.get("creditsUsed") or 0) - (before.get("creditsUsed") or 0),
        "seeded": sum(1 for r in results if r.get("status") == "seeded"),
        "ready_contacts": sum(r.get("ready") or 0 for r in results),
        "results": results,
    }
    LOG_PATH.write_text(json.dumps(summary, indent=2))
    print("credits_after", json.dumps({k: after.get(k) for k in ("creditsUsed", "creditsAvailable", "resetDate")}))
    print("delta_used", summary["deltaUsed"], "seeded_orgs", summary["seeded"], "contacts", summary["ready_contacts"])
    print("wrote", LOG_PATH)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
