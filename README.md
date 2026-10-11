# brunofitas.github.io

Personal site. Static HTML, no build step; GitHub Pages serves the root.

- `index.html`, `about.html`, `contact.html`, `skills.html`
- `assets/style.css`, `assets/site.js`
- `data/plugins.json`: every entry of the Claude plugin directory with GitHub stars, avatar,
  social image, topics and tags, ranked by stars. Built by `scripts/build_plugins.py` from
  `data/source/directory-listings.json` (the directory listings) and the GitHub GraphQL API
  (`gh` CLI), merged with the curated `data/source/featured.json`.
- `.github/workflows/refresh-stars.yml`: rebuilds `data/plugins.json` daily with fresh stars.

Rebuild locally: `python3 scripts/build_plugins.py --refresh` (needs `gh auth login`).
