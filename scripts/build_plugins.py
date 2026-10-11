#!/usr/bin/env python3
"""Build data/plugins.json for the Claude skills page.

Sources:
  data/source/directory-listings.json  - the Claude plugin directory listings (name, summary,
                                         repository, review state, surfaces, version)
  GitHub GraphQL (via `gh api graphql`) - stars, description, last push, topics, language,
                                         owner avatar, social preview image
  data/source/featured.json (optional)  - a curated list (why, install, featured, tags) merged by repo

Usage: python3 scripts/build_plugins.py [--no-github] [--refresh]   (--refresh re-queries every repo)
"""
import json
import os
import re
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data", "source", "directory-listings.json")
FEATURED = os.path.join(ROOT, "data", "source", "featured.json")
CACHE = os.path.join(ROOT, "data", "source", "github-cache.json")
OUT = os.path.join(ROOT, "data", "plugins.json")

TAG_RULES = [  # (tag, regex over name + summary + topics + path)
    ("design", r"\bdesign|ui/ux|ux\b|figma|canva|tailwind|css|frontend-design"),
    ("frontend", r"frontend|react|next\.?js|vue|svelte|angular|web app|html|browser"),
    ("code-review", r"code review|code-review|pr review|pull request|review"),
    ("testing", r"\btest|e2e|playwright|cypress|jest|pytest|qa\b"),
    ("security", r"secur|vulnerab|owasp|pentest|audit|secret"),
    ("devops", r"devops|deploy|kubernetes|k8s|docker|terraform|ci/cd|cloud|aws|gcp|azure|cloudflare|vercel|infra"),
    ("data", r"\bdata\b|sql|database|postgres|supabase|analytics|etl|pandas|spreadsheet|csv"),
    ("productivity", r"productiv|task|todo|calendar|notes?\b|planning|organi[sz]e"),
    ("docs", r"\bdocs?\b|document|readme|technical writing|api reference|context7"),
    ("git", r"\bgit\b|commit|branch|github|gitlab"),
    ("workflow", r"workflow|automation|pipeline|orchestrat|loop"),
    ("agents", r"\bagents?\b|multi-agent|subagent|swarm|team"),
    ("research", r"research|search|scrape|crawl|browse|exa\b|tavily|firecrawl"),
    ("mcp", r"\bmcp\b|model context protocol|server integration"),
    ("ai-ops", r"prompt|llm|model|rag|embedding|evals?\b|fine-?tun"),
    ("mobile", r"mobile|ios\b|android|expo|react native|flutter|swift"),
    ("marketing", r"marketing|seo|brand|content|social media|campaign|ads?\b"),
    ("finance", r"financ|equity|stock|invest|account|invoice|stripe|payment"),
    ("legal", r"legal|contract|compliance|litigation|\bip\b|patent"),
    ("memory", r"memory|remember|context management|claude\.md|knowledge base"),
    ("learning", r"learn|tutorial|teach|course|explain|onboard"),
    ("support", r"customer support|helpdesk|zendesk|intercom|ticket"),
    ("hr", r"human resources|\bhr\b|recruit|hiring|onboarding"),
    ("sales", r"\bsales\b|crm|hubspot|salesforce|lead"),
    ("bio", r"\bbio|genom|protein|clinical|health|medical"),
    ("game", r"\bgame|unity|unreal|godot"),
    ("skills", r"\bskills?\b|skill-creator"),
    ("plugin-dev", r"plugin-dev|plugin development|hook|hookify|slash command"),
]


def slugify(s):
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return s or "x"


def parse_repo(url):
    m = re.match(r"https?://github\.com/([^/]+)/([^/#?]+)", url or "")
    if not m:
        return None, None
    return m.group(1), re.sub(r"\.git$", "", m.group(2))


def parse_path(url):
    """The path inside the repo for a .../tree/<ref>/<path> URL, else ''."""
    m = re.match(r"https?://github\.com/[^/]+/[^/]+/(?:tree|blob)/[^/]+/(.+?)/?$", url or "")
    return m.group(1) if m else ""


def gh_graphql(repos):
    """repos: list of (owner, name). Returns {owner/name: data}. Batches of 100 aliases."""
    out = {}
    for i in range(0, len(repos), 100):
        batch = repos[i:i + 100]
        parts = []
        for j, (o, n) in enumerate(batch):
            parts.append(
                'r%d: repository(owner: %s, name: %s) { nameWithOwner description stargazerCount forkCount '
                'pushedAt isArchived primaryLanguage { name } openGraphImageUrl owner { avatarUrl(size: 160) } '
                'repositoryTopics(first: 8) { nodes { topic { name } } } licenseInfo { spdxId } }'
                % (j, json.dumps(o), json.dumps(n)))
        q = "query { " + " ".join(parts) + " }"
        for attempt in range(4):
            r = subprocess.run(["gh", "api", "graphql", "-f", "query=" + q], capture_output=True, text=True)
            if r.returncode == 0 or '"data"' in r.stdout:
                break
            time.sleep(3 * (attempt + 1))
        try:
            data = json.loads(r.stdout).get("data") or {}
        except json.JSONDecodeError:
            print("batch %d failed: %s" % (i, r.stderr[:200]), file=sys.stderr)
            data = {}
        for j, (o, n) in enumerate(batch):
            d = data.get("r%d" % j)
            if d:
                out["%s/%s" % (o, n)] = d
        print("github: %d/%d" % (min(i + 100, len(repos)), len(repos)), file=sys.stderr)
    return out


def main():
    use_github = "--no-github" not in sys.argv
    listings = json.load(open(SRC))
    featured = {}
    if os.path.exists(FEATURED):
        for f in json.load(open(FEATURED)):
            o, n = parse_repo(f.get("url"))
            if o:
                featured["%s/%s#%s" % (o, n, parse_path(f.get("url")))] = f

    cache = json.load(open(CACHE)) if os.path.exists(CACHE) and "--refresh" not in sys.argv else {}
    repos = []
    for it in listings:
        o, n = parse_repo((it.get("source") or {}).get("repository", {}).get("url"))
        if o and "%s/%s" % (o, n) not in cache:
            repos.append((o, n))
    for fk in featured:
        o, n = fk.split("#")[0].split("/")
        if "%s/%s" % (o, n) not in cache:
            repos.append((o, n))
    repos = sorted(set(repos))
    if use_github and repos:
        cache.update(gh_graphql(repos))
        json.dump(cache, open(CACHE, "w"), indent=0, sort_keys=True)

    items, seen, matched = [], set(), set()
    for it in listings:
        rep = (it.get("source") or {}).get("repository", {})
        url, path = rep.get("url"), rep.get("path") or ""
        o, n = parse_repo(url)
        key = "%s/%s" % (o, n) if o else None
        g = cache.get(key, {}) if key else {}
        name = it.get("name") or n or "?"
        slug = slugify(name + ("-" + path.split("/")[-1] if path and slugify(path.split("/")[-1]) != slugify(name) else ""))
        if slug in seen:
            slug = slug + "-" + slugify(key or it.get("id", ""))
        seen.add(slug)
        review = ((it.get("checks") or {}).get("review", {}).get("by") or {}).get("type")
        topics = [t["topic"]["name"] for t in (g.get("repositoryTopics") or {}).get("nodes", [])]
        text = " ".join([name, it.get("summary") or "", g.get("description") or "", " ".join(topics), path]).lower()
        tags = []
        if review == "anthropic" or o == "anthropics":
            tags.append("official")
        elif review == "partner":
            tags.append("partner")
        else:
            tags.append("community")
        for tag, rx in TAG_RULES:
            if re.search(rx, text):
                tags.append(tag)
        cur = (featured.get("%s#%s" % (key, path)) or {}) if key else {}
        for t in cur.get("tags") or []:
            if t not in tags and not (t == "community" and tags[0] != "community"):
                tags.append(t)
        matched.add("%s#%s" % (key, path))
        repo_url = ("https://github.com/%s" % key) if key else url
        tree_url = repo_url + ("/tree/HEAD/" + path if path else "")
        items.append({
            "name": name,
            "slug": slug,
            "summary": (it.get("summary") or g.get("description") or "").strip(),
            "why": cur.get("why"),
            "install": cur.get("install"),
            "featured": bool(cur.get("featured")),
            "kind": cur.get("kind") or ("mcp" if re.search(r"\bmcp\b", text) else "plugin"),
            "owner": o,
            "repo": key,
            "url": tree_url,
            "repo_url": repo_url,
            "path": path,
            "stars": g.get("stargazerCount"),
            "stars_shared": bool(path),          # the stars are the host repository's, shared by every plugin in it
            "forks": g.get("forkCount"),
            "pushed": (g.get("pushedAt") or "")[:10] or None,
            "archived": bool(g.get("isArchived")),
            "language": (g.get("primaryLanguage") or {}).get("name"),
            "license": (g.get("licenseInfo") or {}).get("spdxId"),
            "avatar": (g.get("owner") or {}).get("avatarUrl") or ("https://github.com/%s.png?size=160" % o if o else None),
            "image": g.get("openGraphImageUrl"),
            "topics": topics,
            "review": review,
            "surfaces": it.get("surfaces") or [],
            "version": (it.get("release") or {}).get("version"),
            "tags": tags[:7],
        })
    for fk, cur in featured.items():
        if fk in matched:
            continue
        key, path = fk.split("#")
        o, n = key.split("/")
        g = cache.get(key, {})
        topics = [t["topic"]["name"] for t in (g.get("repositoryTopics") or {}).get("nodes", [])]
        tags = ["official" if o == "anthropics" else "community"] + [t for t in cur.get("tags") or [] if t not in ("official", "community", "partner")]
        slug = slugify(cur.get("slug") or cur["name"])
        if slug in seen:
            slug += "-" + slugify(key)
        seen.add(slug)
        items.append({
            "name": cur["name"], "slug": slug, "summary": cur.get("summary") or g.get("description") or "",
            "why": cur.get("why"), "install": cur.get("install"), "featured": bool(cur.get("featured")),
            "kind": cur.get("kind") or "plugin", "owner": o, "repo": key, "url": cur["url"], "repo_url": "https://github.com/" + key,
            "path": path, "stars": g.get("stargazerCount"), "stars_shared": False, "forks": g.get("forkCount"),
            "pushed": (g.get("pushedAt") or "")[:10] or None, "archived": bool(g.get("isArchived")),
            "language": (g.get("primaryLanguage") or {}).get("name"), "license": (g.get("licenseInfo") or {}).get("spdxId"),
            "avatar": (g.get("owner") or {}).get("avatarUrl") or "https://github.com/%s.png?size=160" % o,
            "image": g.get("openGraphImageUrl"), "topics": topics, "review": None, "surfaces": ["claude_code"],
            "version": None, "tags": tags[:7], "curated": True,
        })
    items.sort(key=lambda x: (-(x["stars"] or -1), x["name"].lower()))
    for rank, x in enumerate(items, 1):
        x["rank"] = rank
    meta = {"generated": time.strftime("%Y-%m-%d"), "count": len(items),
            "sources": ["Claude plugin directory listings", "GitHub GraphQL API"]}
    json.dump({"meta": meta, "items": items}, open(OUT, "w"), separators=(",", ":"), ensure_ascii=False)
    print("wrote %s: %d items, %d with stars" % (OUT, len(items), sum(1 for x in items if x["stars"] is not None)))


if __name__ == "__main__":
    main()
