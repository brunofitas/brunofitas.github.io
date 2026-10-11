/* brunofitas.github.io v2: theme, home board, skills page (rail filters, search, rank) */
(function () {
  var root = document.documentElement;
  function apply(t) { if (t) root.setAttribute("data-theme", t); else root.removeAttribute("data-theme"); }
  try { apply(localStorage.getItem("theme")); } catch (e) {}
  var btn = document.querySelector(".theme-btn");
  if (btn) btn.addEventListener("click", function () {
    var dark = root.getAttribute("data-theme") === "dark" ||
      (!root.getAttribute("data-theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
    var next = dark ? "light" : "dark";
    apply(next);
    try { localStorage.setItem("theme", next); } catch (e) {}
  });
})();

var TAG_LABEL = {
  "official": "Official (Anthropic)", "partner": "Partner", "community": "Community", "design": "Design", "frontend": "Frontend",
  "code-review": "Code review", "testing": "Testing", "security": "Security", "devops": "DevOps and cloud", "data": "Data",
  "productivity": "Productivity", "docs": "Docs", "git": "Git and GitHub", "workflow": "Workflow", "agents": "Agents",
  "research": "Research and search", "mcp": "MCP servers", "ai-ops": "LLM tooling", "mobile": "Mobile", "marketing": "Marketing",
  "finance": "Finance", "legal": "Legal", "memory": "Memory", "learning": "Learning", "support": "Customer support",
  "hr": "HR", "sales": "Sales", "bio": "Bio and health", "game": "Games", "skills": "Skills", "plugin-dev": "Plugin development",
  "web": "Web", "automation": "Automation"
};
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function fmt(n) { if (n == null) return null; return n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k" : String(n); }

/* home: the live top list */
(function () {
  var board = document.getElementById("board");
  if (!board) return;
  fetch("data/plugins.json").then(function (r) { return r.json(); }).then(function (d) {
    var items = d.items || [];
    var top = items.filter(function (x) { return !x.stars_shared; }).slice(0, 8);
    board.innerHTML = top.map(function (x) {
      return '<li><a href="' + esc(x.url) + '" target="_blank" rel="noopener"><span class="n">' + x.rank + '</span>' +
        '<img class="av" loading="lazy" src="' + esc(x.avatar) + '" alt="" width="36" height="36">' +
        '<span><span class="name">' + esc(x.name) + '</span><br><span class="sub">' + esc(x.repo) + '</span></span>' +
        '<span class="st">' + fmt(x.stars) + "</span></a></li>";
    }).join("");
    var has = function (t) { return items.filter(function (x) { return (x.tags || []).indexOf(t) >= 0; }).length; };
    var set = function (id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };
    set("f-all", items.length); set("f-official", has("official")); set("f-community", has("community")); set("f-mcp", has("mcp"));
    set("board-date", "updated " + (d.meta && d.meta.generated || ""));
  }).catch(function () { board.innerHTML = '<li class="small" style="padding:16px">The list could not be loaded.</li>'; });
})();

/* skills page */
(function () {
  var grid = document.getElementById("plugins");
  if (!grid) return;
  var featuredEl = document.getElementById("featured");
  var facetsEl = document.getElementById("facets");
  var countEl = document.getElementById("count");
  var activeEl = document.getElementById("active");
  var searchEl = document.getElementById("search");
  var moreBtn = document.getElementById("more");
  var sortEl = document.getElementById("sort");
  var clearBtn = document.getElementById("clear");
  var rail = document.getElementById("rail");
  var filterBtn = document.getElementById("filter-btn");
  var backdrop = document.getElementById("backdrop");
  var PAGE = 48, all = [], active = new Set(), query = "", shown = 0, sort = "stars", current = [];

  function card(x) {
    var tags = (x.tags || []).map(function (t) { return '<button type="button" data-tag="' + esc(t) + '">' + esc(TAG_LABEL[t] || t) + "</button>"; }).join("");
    var custom = x.image && x.image.indexOf("repository-images") >= 0;   // a social preview the author set; GitHub's auto card repeats the name
    var cover = custom
      ? '<a class="cover" href="' + esc(x.url) + '" target="_blank" rel="noopener" tabindex="-1"><img loading="lazy" decoding="async" src="' + esc(x.image) + '" alt="" onerror="this.parentNode.classList.add(\'empty\');this.src=\'' + esc(x.avatar || "") + '\';this.onerror=null"><span class="rank"><sup>#</sup>' + x.rank + "</span></a>"
      : '<div class="cover empty"><img loading="lazy" src="' + esc(x.avatar || "") + '" alt=""><span class="rank"><sup>#</sup>' + x.rank + "</span></div>";
    var install = x.install ? '<div class="install"><span>' + esc(x.install) + '</span><button type="button" data-copy="' + esc(x.install) + '">Copy</button></div>' : "";
    var stars = x.stars != null ? '<span class="stars">' + fmt(x.stars) + "</span>" + (x.stars_shared ? '<span class="shared">repo total</span>' : "") : '<span class="shared">no star data</span>';
    var official = (x.tags || []).indexOf("official") >= 0;
    return '<article class="card">' + cover +
      '<div class="body"><h3><a href="' + esc(x.url) + '" target="_blank" rel="noopener">' +
      (x.avatar ? '<img class="avatar" loading="lazy" src="' + esc(x.avatar) + '" alt="" width="22" height="22">' : "") + esc(x.name) + "</a></h3>" +
      '<div class="owner">' + esc(x.repo || x.owner || "") + (x.version ? ", v" + esc(x.version) : "") + "</div>" +
      '<p class="summary">' + esc(x.summary) + "</p>" +
      (x.why ? '<p class="why">' + esc(x.why) + "</p>" : "") + install +
      '<div class="tags">' + tags + "</div></div>" +
      '<div class="foot">' + stars + (x.pushed ? "<span>" + esc(x.pushed) + "</span>" : "") + (x.archived ? '<span class="warn">archived</span>' : "") +
      '<span class="kind' + (official ? " official" : "") + '">' + esc(official ? "official" : x.kind) + "</span></div></article>";
  }
  function matches(x) {
    for (var t of active) if ((x.tags || []).indexOf(t) < 0) return false;
    if (!query) return true;
    var hay = (x.name + " " + (x.summary || "") + " " + (x.repo || "") + " " + (x.topics || []).join(" ") + " " + (x.tags || []).join(" ")).toLowerCase();
    return query.split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; });
  }
  function sorted(list) {
    var l = list.slice();
    if (sort === "stars") l.sort(function (a, b) { return (b.stars || -1) - (a.stars || -1) || a.name.localeCompare(b.name); });
    else if (sort === "updated") l.sort(function (a, b) { return (b.pushed || "").localeCompare(a.pushed || "") || (b.stars || 0) - (a.stars || 0); });
    else l.sort(function (a, b) { return a.name.localeCompare(b.name); });
    return l;
  }
  function render(reset) {
    if (reset) { current = sorted(all.filter(matches)); shown = 0; grid.innerHTML = ""; }
    var slice = current.slice(shown, shown + PAGE);
    grid.insertAdjacentHTML("beforeend", slice.map(card).join(""));
    shown += slice.length;
    countEl.textContent = (current.length === all.length ? all.length : current.length + " of " + all.length) + " plugins";
    moreBtn.hidden = shown >= current.length;
    moreBtn.textContent = "Show " + Math.min(PAGE, current.length - shown) + " more";
    if (!current.length) grid.innerHTML = '<div class="empty">Nothing matches. Remove a filter or change the search.</div>';
    var filtering = !!(active.size || query);
    if (featuredEl) featuredEl.hidden = filtering;
    clearBtn.hidden = !filtering;
    activeEl.innerHTML = Array.from(active).map(function (t) { return '<button type="button" class="tag on" data-tag="' + esc(t) + '">' + esc(TAG_LABEL[t] || t) + "</button>"; }).join("");
    var url = new URL(location.href);
    url.searchParams.delete("tag"); active.forEach(function (t) { url.searchParams.append("tag", t); });
    if (query) url.searchParams.set("q", query); else url.searchParams.delete("q");
    history.replaceState(null, "", url.pathname + (url.search || ""));
  }
  function renderFacets() {
    var counts = {};
    all.forEach(function (x) { (x.tags || []).forEach(function (t) { counts[t] = (counts[t] || 0) + 1; }); });
    var source = ["official", "partner", "community"];
    var topics = Object.keys(counts).filter(function (t) { return source.indexOf(t) < 0; }).sort(function (a, b) { return counts[b] - counts[a]; });
    var row = function (t) { return '<button type="button" class="tag' + (active.has(t) ? " on" : "") + '" data-tag="' + esc(t) + '"><span>' + esc(TAG_LABEL[t] || t) + '</span><span class="n">' + counts[t] + "</span></button>"; };
    facetsEl.innerHTML = '<div class="group">Source</div>' + source.filter(function (t) { return counts[t]; }).map(row).join("") +
      '<div class="group">Topic</div>' + topics.map(row).join("");
  }
  function sync() { facetsEl.querySelectorAll("[data-tag]").forEach(function (b) { b.classList.toggle("on", active.has(b.dataset.tag)); }); }
  function openSheet(open) { rail.classList.toggle("open", open); backdrop.classList.toggle("open", open); document.body.classList.toggle("sheet-open", open); filterBtn.setAttribute("aria-expanded", open ? "true" : "false"); }

  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-tag]");
    if (t) { var tag = t.dataset.tag; if (active.has(tag)) active.delete(tag); else active.add(tag); sync(); render(true); if (!t.closest("#rail")) window.scrollTo({ top: 0 }); return; }
    var c = e.target.closest("[data-copy]");
    if (c && navigator.clipboard) { navigator.clipboard.writeText(c.dataset.copy); c.textContent = "Copied"; setTimeout(function () { c.textContent = "Copy"; }, 1200); }
  });
  searchEl.addEventListener("input", function () { query = searchEl.value.trim().toLowerCase(); render(true); });
  moreBtn.addEventListener("click", function () { render(false); });
  sortEl.addEventListener("change", function () { sort = sortEl.value; render(true); });
  clearBtn.addEventListener("click", function () { active.clear(); query = ""; searchEl.value = ""; sync(); render(true); openSheet(false); });
  filterBtn.addEventListener("click", function () { openSheet(!rail.classList.contains("open")); });
  backdrop.addEventListener("click", function () { openSheet(false); });
  document.getElementById("rail-done").addEventListener("click", function () { openSheet(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") openSheet(false); });

  fetch("data/plugins.json").then(function (r) { return r.json(); }).then(function (d) {
    all = d.items || [];
    var u = new URL(location.href);
    u.searchParams.getAll("tag").forEach(function (t) { active.add(t); });
    query = (u.searchParams.get("q") || "").toLowerCase(); searchEl.value = query;
    var meta = document.getElementById("meta");
    if (meta) meta.textContent = all.length + " entries from the Claude plugin directory, ranked by GitHub stars, refreshed nightly (last: " + (d.meta && d.meta.generated || "") + ").";
    if (featuredEl) {
      var f = all.filter(function (x) { return x.featured; }).sort(function (a, b) { return (b.stars || 0) - (a.stars || 0); }).slice(0, 9);
      featuredEl.innerHTML = f.length ? '<div class="featured-head"><h2>Start here</h2><span class="small">A hand-picked set</span></div><div class="grid">' + f.map(card).join("") + "</div>" : "";
    }
    renderFacets();
    render(true);
  }).catch(function () { grid.innerHTML = '<div class="empty">data/plugins.json could not be loaded.</div>'; });
})();
