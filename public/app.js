// AFTERMARKET — front-end controller for the obituaries ticker.

const state = {
  all: [], // full row set from the API
  view: [], // filtered/sorted rows currently rendered
  payload: null, // last API payload (meta)
  selected: null, // selected symbol
  filter: "",
  sort: "tape", // tape | age | sym | name | chg
  refreshTimer: null,
};

const REFRESH_MS = 5 * 60 * 1000;

const $ = (sel) => document.querySelector(sel);

// ---------- formatting helpers ----------
function fmtNum(n, digits = 0) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function signed(n, digits = 2) {
  if (n == null || Number.isNaN(n)) return "—";
  const s = n > 0 ? "+" : "";
  return s + n.toFixed(digits);
}

function arrow(dir) {
  return dir === "up" ? "▲" : dir === "down" ? "▼" : "■";
}

function timeAgo(ts) {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return m + "m";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h";
  const d = Math.floor(h / 24);
  return d + "d";
}

// ---------- clock ----------
function tickClock() {
  const d = new Date();
  $("#clock").textContent = d.toISOString().slice(11, 19);
}

// ---------- data ----------
// Try the live Node API first (local `npm start`); if it isn't there — e.g. on
// GitHub Pages, which is a static host — fall back to the JSON the build Action
// bakes into the site.
async function fetchPayload(force) {
  try {
    const res = await fetch("api/obits" + (force ? "?refresh=1" : ""));
    if (res.ok) return await res.json();
  } catch (_) {
    /* no live server — fall through to static data */
  }
  const res = await fetch("obits.json?t=" + Date.now());
  if (!res.ok) throw new Error("no data source (API " + res.status + ")");
  return await res.json();
}

async function loadFeed({ force = false } = {}) {
  setStatus("FETCHING FEED…", "");
  try {
    const data = await fetchPayload(force);
    state.payload = data;
    state.all = data.rows || [];
    applyView();
    renderMeta();
    renderTickerWall();
    setStatus(
      data.source === "live"
        ? `LIVE FEED · ${data.count} LISTINGS`
        : `SAMPLE DATA · FEED UNREACHABLE`,
      data.source === "live" ? "ok" : "err"
    );
  } catch (e) {
    setStatus("ERROR: " + e.message, "err");
  }
}

// ---------- view (filter + sort) ----------
function applyView() {
  let rows = state.all.slice();
  const f = state.filter.trim().toLowerCase();
  if (f) {
    rows = rows.filter(
      (r) =>
        r.symbol.toLowerCase().includes(f) ||
        r.name.toLowerCase().includes(f) ||
        (r.category || "").toLowerCase().includes(f) ||
        (r.title || "").toLowerCase().includes(f)
    );
  }
  switch (state.sort) {
    case "age":
      rows.sort((a, b) => (b.age ?? -1) - (a.age ?? -1));
      break;
    case "sym":
      rows.sort((a, b) => a.symbol.localeCompare(b.symbol));
      break;
    case "name":
      rows.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "chg":
      rows.sort((a, b) => (b.change ?? -999) - (a.change ?? -999));
      break;
    default: // tape = recency (already sorted by API)
      rows.sort((a, b) => (b.pubTs || 0) - (a.pubTs || 0));
  }
  state.view = rows;
  renderBoard();
}

// ---------- rendering ----------
function renderMeta() {
  const p = state.payload;
  if (!p) return;
  $("#index-val").textContent =
    p.indexValue != null ? fmtNum(p.indexValue, 1) : "—";
  $("#count-val").textContent = fmtNum(p.count);
  const pill = $("#source-pill");
  if (p.source === "live") {
    pill.textContent = "● LIVE";
    pill.className = "live";
  } else {
    pill.textContent = "● SAMPLE";
    pill.className = "sample";
  }
}

// The ticker is the centerpiece: several stacked lanes, each scrolling the
// full feed continuously. Lanes are rotated and run at different speeds (and
// alternating directions) so the wall reads like a busy mechanical board.
const LANE_COUNT = 6;

function tickerItemHtml(r) {
  const dir = r.direction || "flat";
  const chg =
    r.change == null
      ? "·"
      : `${arrow(dir)}${signed(r.change, 1)}`;
  return `<span class="tk-item" data-sym="${r.symbol}"><span class="tk-sym">${
    r.symbol
  }</span><span class="tk-last">${r.age ?? "—"}</span><span class="tk-chg ${dir}">${chg}</span></span>`;
}

function renderTickerWall() {
  const wall = $("#ticker-wall");
  const rows = state.all;
  if (!rows.length) {
    wall.innerHTML = `<div class="ticker-empty">NO DATA.</div>`;
    return;
  }
  let html = "";
  for (let i = 0; i < LANE_COUNT; i++) {
    // Rotate each lane's starting point so adjacent lanes don't line up.
    const off = (i * 3) % rows.length;
    const rot = rows.slice(off).concat(rows.slice(0, off));
    const seq = rot.concat(rot); // doubled => seamless -50% loop
    const dur = 60 + i * 14; // vary speed per lane
    const rev = i % 2 ? " rev" : ""; // alternate scroll direction
    html += `<div class="lane${rev}"><div class="lane-track" style="animation-duration:${dur}s">${seq
      .map(tickerItemHtml)
      .join("")}</div></div>`;
  }
  wall.innerHTML = html;
  wall.querySelectorAll(".tk-item").forEach((el) => {
    el.addEventListener("click", () => selectSymbol(el.dataset.sym, { scroll: true }));
  });
}

function renderBoard() {
  const body = $("#board-body");
  if (!state.view.length) {
    body.innerHTML = `<div class="board-empty">${
      state.all.length ? "NO MATCHES FOR FILTER." : "NO DATA."
    }</div>`;
    return;
  }
  body.innerHTML = state.view
    .map((r) => {
      const dir = r.direction || "flat";
      const sel = r.symbol === state.selected ? " selected" : "";
      return `<div class="board-row${sel}" data-sym="${r.symbol}" tabindex="0">
        <div class="sym">${r.symbol}</div>
        <div class="name" title="${escapeAttr(r.name)}">${escapeHtml(r.name)}</div>
        <div class="cat">${escapeHtml(r.category || "")}</div>
        <div class="col-num last">${r.age ?? "—"}</div>
        <div class="col-num ${dir}">${r.change == null ? "—" : signed(r.change, 1)}</div>
        <div class="col-num ${dir}">${
        r.changePct == null ? "—" : signed(r.changePct, 1) + "%"
      }</div>
        <div class="col-time">${timeAgo(r.pubTs)}</div>
      </div>`;
    })
    .join("");

  body.querySelectorAll(".board-row").forEach((el) => {
    el.addEventListener("click", () => selectSymbol(el.dataset.sym));
  });
}

function selectSymbol(sym, { scroll = false } = {}) {
  state.selected = sym;
  document.querySelectorAll(".board-row").forEach((el) => {
    el.classList.toggle("selected", el.dataset.sym === sym);
    if (scroll && el.dataset.sym === sym) {
      el.scrollIntoView({ block: "nearest" });
    }
  });
  renderDetail(state.all.find((r) => r.symbol === sym));
}

function renderDetail(r) {
  const body = $("#detail-body");
  if (!r) {
    body.innerHTML = `<div class="detail-hint">LISTING NOT FOUND.</div>`;
    return;
  }
  const dir = r.direction || "flat";
  const pub = r.pubTs ? new Date(r.pubTs).toUTCString() : "—";
  body.innerHTML = `
    <div class="d-sym">${r.symbol}</div>
    <div class="d-name">${escapeHtml(r.name)}</div>
    <div class="d-quote">
      <div class="d-last">${r.age ?? "—"}<span class="unit">YRS</span></div>
      <div class="d-chg ${dir}">${arrow(dir)} ${
    r.change == null ? "n/a" : signed(r.change, 1)
  } ${r.changePct == null ? "" : "(" + signed(r.changePct, 1) + "%)"}</div>
    </div>
    <div class="d-stats">
      <div class="d-stat"><div class="k">SECTOR</div><div class="v">${escapeHtml(
        r.category || "—"
      )}</div></div>
      <div class="d-stat"><div class="k">VS INDEX</div><div class="v ${dir}">${
    r.change == null ? "—" : signed(r.change, 1) + " yrs"
  }</div></div>
      <div class="d-stat"><div class="k">DESK</div><div class="v">${escapeHtml(
        r.author || "—"
      )}</div></div>
      <div class="d-stat"><div class="k">TAPED</div><div class="v">${timeAgo(
        r.pubTs
      )} AGO</div></div>
    </div>
    <div class="d-section-label">HEADLINE</div>
    <div class="d-headline">${escapeHtml(r.headline || r.title || "")}</div>
    <div class="d-section-label">SUMMARY</div>
    <div class="d-desc">${escapeHtml(r.description || "No summary available.")}</div>
    <div class="d-section-label">SETTLEMENT · ${pub}</div>
    ${
      r.link
        ? `<a class="d-link" href="${escapeAttr(
            r.link
          )}" target="_blank" rel="noopener">OPEN SOURCE ↗</a>`
        : ""
    }
  `;
}

// ---------- command bar ----------
function setStatus(text, cls) {
  const el = $("#cmd-status");
  el.textContent = text;
  el.className = "cmd-status" + (cls ? " " + cls : "");
}

const HELP =
  "COMMANDS: REFRESH · LIVE · SORT [AGE|SYM|NAME|CHG|TAPE] · CLEAR · HELP · or type any text to filter the board.";

function runCommand(raw) {
  const cmd = raw.trim();
  if (!cmd) {
    state.filter = "";
    applyView();
    setStatus("FILTER CLEARED", "");
    return;
  }
  const upper = cmd.toUpperCase();
  const parts = upper.split(/\s+/);

  if (upper === "HELP" || upper === "?") {
    setStatus(HELP, "");
    return;
  }
  if (upper === "REFRESH" || upper === "LIVE") {
    loadFeed({ force: true });
    return;
  }
  if (upper === "CLEAR") {
    state.filter = "";
    $("#cmd").value = "";
    applyView();
    setStatus("FILTER CLEARED", "");
    return;
  }
  if (parts[0] === "SORT") {
    const key = (parts[1] || "").toLowerCase();
    const valid = ["age", "sym", "name", "chg", "tape"];
    if (valid.includes(key)) {
      state.sort = key;
      applyView();
      setStatus("SORTED BY " + key.toUpperCase(), "ok");
    } else {
      setStatus("SORT KEYS: AGE SYM NAME CHG TAPE", "err");
    }
    return;
  }
  // Otherwise treat as a filter.
  state.filter = cmd;
  applyView();
  const n = state.view.length;
  setStatus(`FILTER "${cmd}" · ${n} MATCH${n === 1 ? "" : "ES"}`, n ? "ok" : "err");
}

// ---------- keyboard nav ----------
function moveSelection(delta) {
  if (!state.view.length) return;
  let idx = state.view.findIndex((r) => r.symbol === state.selected);
  idx = idx === -1 ? 0 : Math.min(state.view.length - 1, Math.max(0, idx + delta));
  selectSymbol(state.view[idx].symbol, { scroll: true });
}

// ---------- escaping ----------
function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

// ---------- init ----------
function init() {
  tickClock();
  setInterval(tickClock, 1000);

  const cmd = $("#cmd");
  cmd.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      runCommand(cmd.value);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      moveSelection(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveSelection(-1);
    } else if (e.key === "Escape") {
      cmd.value = "";
      state.filter = "";
      applyView();
      setStatus("", "");
    }
  });
  // Live-filter as you type (without clobbering explicit commands).
  cmd.addEventListener("input", () => {
    const v = cmd.value;
    const isCommand = /^(refresh|live|help|clear|sort|\?)/i.test(v.trim());
    if (!isCommand) {
      state.filter = v;
      applyView();
    }
  });

  // Global keys: ENTER opens selected source, slash focuses command bar.
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== cmd) {
      e.preventDefault();
      cmd.focus();
    }
    if (e.key === "Enter" && document.activeElement !== cmd && state.selected) {
      const r = state.all.find((x) => x.symbol === state.selected);
      if (r && r.link) window.open(r.link, "_blank", "noopener");
    }
  });

  loadFeed();
  state.refreshTimer = setInterval(() => loadFeed({ force: true }), REFRESH_MS);
}

document.addEventListener("DOMContentLoaded", init);
