/* brunofitas.github.io - theme toggle + skills page (filters, search, rank) */
(function () {
  var root = document.documentElement;
  function applyTheme(t) { if (t) root.setAttribute("data-theme", t); else root.removeAttribute("data-theme"); }
  try { applyTheme(localStorage.getItem("theme")); } catch (e) {}
  var btn = document.querySelector(".theme-btn");
  if (btn) btn.addEventListener("click", function () {
    var dark = root.getAttribute("data-theme") === "dark" ||
      (!root.getAttribute("data-theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
    var next = dark ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem("theme", next); } catch (e) {}
  });
})();

(function () {
  var grid = document.getElementById("plugins");
  if (!grid) return;
  var featuredEl = document.getElementById("featured");
  var tagsEl = document.getElementById("tags");
  var countEl = document.getElementById("count");
  var searchEl = document.getElementById("search");
  var moreBtn = document.getElementById("more");
  var sortEl = document.getElementById("sort");
  var clearBtn = document.getElementById("clear");
  var metaEl = document.getElementById("meta");
  var PAGE = 48;
  var all = [], active = new Set(), query = "", shown = 0, sort = "stars";

  var TAG_LABEL = {
    "official": "Official", "partner": "Partner", "community": "Community", "design": "Design", "frontend": "Frontend",
    "code-review": "Code review", "testing": "Testing", "security": "Security", "devops": "DevOps", "data": "Data",
    "productivity": "Productivity", "docs": "Docs", "git": "Git", "workflow": "Workflow", "agents": "Agents",
    "research": "Research", "mcp": "MCP", "ai-ops": "AI ops", "mobile": "Mobile", "marketing": "Marketing",
    "finance": "Finance", "legal": "Legal", "memory": "Memory", "learning": "Learning", "support": "Support",
    "hr": "HR", "sales": "Sales", "bio": "Bio", "game": "Games", "skills": "Skills", "plugin-dev": "Plugin dev",
    "web": "Web", "automation": "Automation"
  };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fmt(n) { if (n == null) return null; return n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k" : String(n); }

  function card(x) {
    var tags = (x.tags || []).map(function (t) {
      return '<button class="tag' + (active.has(t) ? " on" : "") + '" data-tag="' + esc(t) + '">' + esc(TAG_LABEL[t] || t) + "</button>";
    }).join("");
    var img = x.image ? '<a class="cover" href="' + esc(x.url) + '" target="_blank" rel="noopener"><img loading="lazy" decoding="async" src="' + esc(x.image) + '" alt="" onerror="this.parentNode.remove()"></a>' : "";
    var avatar = x.avatar ? '<img class="avatar" loading="lazy" decoding="async" src="' + esc(x.avatar) + '" alt="" width="28" height="28" onerror="this.remove()">' : "";
    var install = x.install ? '<div class="install"><span>' + esc(x.install) + '</span><button type="button" data-copy="' + esc(x.install) + '" title="Copy">copy</button></div>' : "";
    var stars = x.stars != null ? '<span class="stars" title="' + esc(x.stars) + ' GitHub stars">' + fmt(x.stars) + "</span>" : '<span class="small">no stars data</span>';
    var kindCls = (x.tags || []).indexOf("official") >= 0 ? " official" : "";
    return '<article class="card' + (x.featured ? " is-featured" : "") + '" data-slug="' + esc(x.slug) + '">' +
      img +
      '<div class="top"><div class="rank">#' + x.rank + '</div><span class="kind' + kindCls + '">' + esc(x.kind) + "</span></div>" +
      '<h3><a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + avatar + esc(x.name) + "</a></h3>" +
      '<div class="owner small">' + esc(x.repo || x.owner || "") + (x.version ? " · v" + esc(x.version) : "") + "</div>" +
      "<p>" + esc(x.summary) + "</p>" +
      (x.why ? '<p class="why">' + esc(x.why) + "</p>" : "") +
      install +
      '<div class="tags">' + tags + "</div>" +
      '<div class="meta">' + stars + (x.language ? "<span>" + esc(x.language) + "</span>" : "") +
      (x.pushed ? "<span>updated " + esc(x.pushed) + "</span>" : "") + (x.archived ? '<span class="warn">archived</span>' : "") + "</div>" +
      "</article>";
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
    else if (sort === "name") l.sort(function (a, b) { return a.name.localeCompare(b.name); });
    return l;
  }

  var current = [];
  function render(reset) {
    if (reset) { current = sorted(all.filter(matches)); shown = 0; grid.innerHTML = ""; }
    var slice = current.slice(shown, shown + PAGE);
    grid.insertAdjacentHTML("beforeend", slice.map(card).join(""));
    shown += slice.length;
    countEl.textContent = current.length === all.length ? all.length + " plugins" : current.length + " of " + all.length;
    moreBtn.hidden = shown >= current.length;
    moreBtn.textContent = "Show more (" + (current.length - shown) + " left)";
    if (!current.length) grid.innerHTML = '<div class="empty">Nothing matches. Clear a tag or change the search.</div>';
    if (featuredEl) featuredEl.hidden = !!(active.size || query);
    clearBtn.hidden = !(active.size || query);
    var url = new URL(location.href);
    url.searchParams.delete("tag"); active.forEach(function (t) { url.searchParams.append("tag", t); });
    if (query) url.searchParams.set("q", query); else url.searchParams.delete("q");
    history.replaceState(null, "", url.pathname + (url.search || ""));
  }

  function renderTags() {
    var counts = {};
    all.forEach(function (x) { (x.tags || []).forEach(function (t) { counts[t] = (counts[t] || 0) + 1; }); });
    var order = Object.keys(counts).sort(function (a, b) {
      var pa = ["official", "partner", "community"].indexOf(a), pb = ["official", "partner", "community"].indexOf(b);
      if (pa >= 0 || pb >= 0) return (pa < 0 ? 9 : pa) - (pb < 0 ? 9 : pb);
      return counts[b] - counts[a];
    });
    tagsEl.innerHTML = order.map(function (t) {
      return '<button class="tag' + (active.has(t) ? " on" : "") + '" data-tag="' + esc(t) + '">' + esc(TAG_LABEL[t] || t) + ' <span class="n">' + counts[t] + "</span></button>";
    }).join("");
  }

  function syncTagButtons() {
    document.querySelectorAll(".tag[data-tag]").forEach(function (b) { b.classList.toggle("on", active.has(b.dataset.tag)); });
  }

  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-tag]");
    if (t) { var tag = t.dataset.tag; if (active.has(tag)) active.delete(tag); else active.add(tag); syncTagButtons(); render(true); return; }
    var c = e.target.closest("[data-copy]");
    if (c && navigator.clipboard) { navigator.clipboard.writeText(c.dataset.copy); c.textContent = "copied"; setTimeout(function () { c.textContent = "copy"; }, 1200); }
  });
  searchEl.addEventListener("input", function () { query = searchEl.value.trim().toLowerCase(); render(true); });
  moreBtn.addEventListener("click", function () { render(false); });
  sortEl.addEventListener("change", function () { sort = sortEl.value; render(true); });
  clearBtn.addEventListener("click", function () { active.clear(); query = ""; searchEl.value = ""; syncTagButtons(); render(true); });

  fetch("data/plugins.json").then(function (r) { return r.json(); }).then(function (d) {
    all = d.items || [];
    var u = new URL(location.href);
    u.searchParams.getAll("tag").forEach(function (t) { active.add(t); });
    query = (u.searchParams.get("q") || "").toLowerCase(); searchEl.value = query;
    if (metaEl) metaEl.textContent = all.length + " entries from the Claude plugin directory, ranked by GitHub stars. Data " + (d.meta && d.meta.generated || "");
    if (featuredEl) {
      var f = all.filter(function (x) { return x.featured; }).sort(function (a, b) { return (b.stars || 0) - (a.stars || 0); }).slice(0, 12);
      featuredEl.innerHTML = f.length ? '<h2>Featured</h2><p class="muted">A hand-picked dozen to start with.</p><div class="featured">' + f.map(card).join("") + "</div>" : "";
    }
    renderTags();
    render(true);
  }).catch(function () { grid.innerHTML = '<div class="empty">Could not load data/plugins.json.</div>'; });
})();
