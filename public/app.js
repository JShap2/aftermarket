// aftermarket — lifespan exchange front-end.
// People are unified entities (a "contract"); obituaries settle them.

const state = {
  people: [],
  view: [],
  payload: null,
  filter: "",
  sort: "trend",
  selected: null,
};

const REFRESH_MS = 5 * 60 * 1000;
const $ = (s) => document.querySelector(s);

// ---------- formatting ----------
const fmt = (n, d = 0) =>
  n == null || Number.isNaN(n)
    ? "—"
    : n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

function signed(n, d = 0) {
  if (n == null || Number.isNaN(n)) return "—";
  return (n > 0 ? "+" : "") + n.toFixed(d);
}
const arrow = (dir) => (dir === "up" ? "▲" : dir === "down" ? "▼" : "■");

function timeAgo(ts) {
  if (!ts) return "—";
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return "now";
  if (m < 60) return m + "m";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h";
  return Math.floor(h / 24) + "d";
}
function fmtDate(ts) {
  if (!ts) return "—";
  return new Date(ts).toISOString().slice(0, 10);
}

const SPARK = "▁▂▃▄▅▆▇█";
function spark(values) {
  if (!values.length) return "";
  const max = Math.max(1, ...values);
  return values
    .map((v) => SPARK[Math.min(SPARK.length - 1, Math.round((v / max) * (SPARK.length - 1)))])
    .join("");
}

// ---------- clock ----------
function tickClock() {
  $("#clock").textContent = new Date().toISOString().slice(11, 19);
}

// ---------- data ----------
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
  setStatus("FETCHING FEEDS…", "");
  try {
    const data = await fetchPayload(force);
    state.payload = data;
    state.people = data.people || [];
    applyView();
    renderMeta();
    renderTickerWall();
    const live = (data.sources || []).filter((s) => s.live).length;
    const total = (data.sources || []).length;
    setStatus(
      `${data.count} CONTRACTS · ${live}/${total} SOURCES LIVE` +
        (data.anyLive ? "" : " · SAMPLE DATA"),
      data.anyLive ? "ok" : "err"
    );
    // Keep an open stock ticket fresh after a refresh.
    if (state.selected && !$("#stock").hidden) openStock(state.selected, { keepScroll: true });
  } catch (e) {
    setStatus("ERROR: " + e.message, "err");
  }
}

// ---------- view ----------
function matches(p, f) {
  if (!f) return true;
  if (
    p.symbol.toLowerCase().includes(f) ||
    p.name.toLowerCase().includes(f) ||
    p.sources.join(" ").toLowerCase().includes(f)
  )
    return true;
  return (p.mentions || []).some((m) => (m.title || "").toLowerCase().includes(f));
}

function applyView() {
  const f = state.filter.trim().toLowerCase();
  let rows = state.people.filter((p) => matches(p, f));
  switch (state.sort) {
    case "vol":
      rows.sort((a, b) => b.volume - a.volume);
      break;
    case "settle":
      rows.sort((a, b) => (b.age ?? -1) - (a.age ?? -1));
      break;
    case "sym":
      rows.sort((a, b) => a.symbol.localeCompare(b.symbol));
      break;
    case "name":
      rows.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "status":
      rows.sort((a, b) => a.status.localeCompare(b.status) || b.trendScore - a.trendScore);
      break;
    case "last":
      rows.sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
      break;
    default: // trend
      rows.sort((a, b) => b.trendScore - a.trendScore);
  }
  state.view = rows;
  renderRegister();
}

// ---------- meta ----------
function renderMeta() {
  const p = state.payload;
  if (!p) return;
  const live = (p.sources || []).filter((s) => s.live).length;
  $("#src-val").textContent = `${live}/${(p.sources || []).length}`;
  $("#open-val").textContent = fmt(p.aliveCount);
  $("#settled-val").textContent = fmt(p.settledCount);
  $("#avg-val").textContent = p.avgSettleAge != null ? fmt(p.avgSettleAge, 1) : "—";
}

// ---------- ticker wall ----------
const LANE_COUNT = 3;

function tickerItemHtml(p) {
  const dir = p.direction || "flat";
  const mark = p.status === "settled" ? "†" : "";
  const quote = p.status === "settled" ? p.age ?? "—" : "OPEN";
  return `<span class="tk-item ${p.status}" data-sym="${p.symbol}"><span class="tk-sym">${
    p.symbol
  }${mark}</span><span class="tk-last">${quote}</span><span class="tk-chg ${dir}">${arrow(
    dir
  )}</span></span>`;
}

function renderTickerWall() {
  const wall = $("#ticker-wall");
  const rows = state.people;
  if (!rows.length) {
    wall.innerHTML = `<div class="ticker-empty">NO CONTRACTS.</div>`;
    return;
  }
  let html = "";
  for (let i = 0; i < LANE_COUNT; i++) {
    const off = (i * 5) % rows.length;
    const rot = rows.slice(off).concat(rows.slice(0, off));
    const seq = rot.concat(rot); // doubled => seamless -50% loop
    const dur = 70 + i * 18;
    const rev = i % 2 ? " rev" : "";
    html += `<div class="lane${rev}"><div class="lane-track" style="animation-duration:${dur}s">${seq
      .map(tickerItemHtml)
      .join("")}</div></div>`;
  }
  wall.innerHTML = html;
  wall.querySelectorAll(".tk-item").forEach((el) => {
    el.addEventListener("click", () => openStock(el.dataset.sym));
  });
}

// ---------- register ----------
function renderRegister() {
  const body = $("#reg-body");
  if (!state.view.length) {
    body.innerHTML = `<div class="reg-empty">${
      state.people.length ? "NO MATCHES." : "NO DATA."
    }</div>`;
    return;
  }
  body.innerHTML = state.view
    .map((p) => {
      const dir = p.direction || "flat";
      const chg = p.volChange ? signed(p.volChange) : arrow(dir);
      const sel = p.symbol === state.selected ? " selected" : "";
      return `<div class="reg-row${sel}" data-sym="${p.symbol}" tabindex="0">
        <div class="c-sym sym">${p.symbol}${p.status === "settled" ? "†" : ""}</div>
        <div class="c-name" title="${escAttr(p.name)}">${esc(p.name)}</div>
        <div class="c-status ${p.status}">${p.status === "settled" ? "SETTLED" : "OPEN"}</div>
        <div class="c-src">${esc(p.sources.join(" "))}</div>
        <div class="c-num c-vol">${p.volume}</div>
        <div class="c-num c-chg ${dir}">${chg}</div>
        <div class="c-num c-settle">${p.age ?? "—"}</div>
        <div class="c-time">${timeAgo(p.lastSeen)}</div>
      </div>`;
    })
    .join("");
  body.querySelectorAll(".reg-row").forEach((el) => {
    el.addEventListener("click", () => openStock(el.dataset.sym));
  });
}

// ---------- stock overlay ----------
function openStock(sym, { keepScroll = false } = {}) {
  const p = state.people.find((x) => x.symbol === sym);
  if (!p) return;
  state.selected = sym;
  renderStock(p);
  const overlay = $("#stock");
  overlay.hidden = false;
  if (!keepScroll) $("#stock-body").scrollTop = 0;
  // reflect selection in register
  document.querySelectorAll(".reg-row").forEach((el) =>
    el.classList.toggle("selected", el.dataset.sym === sym)
  );
}
function closeStock() {
  $("#stock").hidden = true;
}

function renderStock(p) {
  const dir = p.direction || "flat";
  const settled = p.status === "settled";
  const hist = (p.history || []).map((h) => h.count);
  const histMax = Math.max(0, ...hist);
  const volSeries = (p.series || []).map((s) => s.vol);

  const mentions = (p.mentions || [])
    .map((m) => {
      const flag = m.isDeath ? `<span class="m-flag">SETTLEMENT</span>` : "";
      const link = m.link
        ? `<a href="${escAttr(m.link)}" target="_blank" rel="noopener">${esc(m.title)}</a>`
        : esc(m.title);
      return `<div class="m-row">
        <div class="m-meta"><span class="m-code">${esc(m.sourceCode)}</span><span class="m-time">${timeAgo(
        m.pubTs
      )}</span>${flag}</div>
        <div class="m-title">${link}</div>
      </div>`;
    })
    .join("");

  $("#stock-body").innerHTML = `
    <div class="st-top">
      <div>
        <div class="st-sym">${p.symbol}${settled ? "†" : ""}</div>
        <div class="st-name">${esc(p.name)}</div>
      </div>
      <div class="st-badge ${p.status}">${settled ? "SETTLED" : "OPEN"}</div>
    </div>

    <div class="st-quote">
      <div class="st-big">${settled ? p.age ?? "—" : "OPEN"}<span class="unit">${
    settled ? "SETTLE AGE" : "POSITION"
  }</span></div>
      <div class="st-trend ${dir}">${arrow(dir)} ${
    p.trendPct == null ? "n/a" : signed(p.trendPct, 0) + "% TREND"
  }</div>
    </div>

    <div class="st-instrument">INSTRUMENT: LIFESPAN CONTRACT. ${
      settled
        ? `SETTLED ${fmtDate(p.settledAt)} AT AGE ${p.age ?? "UNKNOWN"} ON CONFIRMED OBITUARY. NO FURTHER ACTION.`
        : `OPEN POSITION. SETTLES ON PUBLICATION OF A CONFIRMED OBITUARY.`
    }</div>

    <div class="st-stats">
      <div class="st-stat"><div class="k">VOLUME</div><div class="v">${p.volume}</div></div>
      <div class="st-stat"><div class="k">SOURCES</div><div class="v">${esc(
        p.sources.join(" ")
      )}</div></div>
      <div class="st-stat"><div class="k">FIRST SEEN</div><div class="v">${fmtDate(
        p.firstObserved || p.firstSeen
      )}</div></div>
      <div class="st-stat"><div class="k">LAST EVENT</div><div class="v">${timeAgo(
        p.lastSeen
      )} AGO</div></div>
      <div class="st-stat"><div class="k">SESSIONS</div><div class="v">${p.sessions ?? 0}</div></div>
      <div class="st-stat"><div class="k">Δ SESSION</div><div class="v ${dir}">${
    p.volChange ? signed(p.volChange) : "0"
  }</div></div>
    </div>

    <div class="st-section">ACTIVITY · MENTIONS / DAY (14D)</div>
    <div class="st-spark" title="${(p.history || [])
      .map((h) => h.day + ": " + h.count)
      .join("  ")}">${spark(hist)} <span class="st-spark-max">peak ${histMax}/d</span></div>
    ${
      volSeries.length >= 2
        ? `<div class="st-section">VOLUME SERIES · ${volSeries.length} SESSIONS</div>
           <div class="st-spark">${spark(volSeries)}</div>`
        : ""
    }

    <div class="st-section">TAPE · ${p.mentions.length} MENTION${
    p.mentions.length === 1 ? "" : "S"
  }</div>
    <div class="m-list">${mentions}</div>
  `;
}

// ---------- command bar ----------
function setStatus(text, cls) {
  const el = $("#cmd-status");
  el.textContent = text;
  el.className = "cmd-status" + (cls ? " " + cls : "");
}

const HELP =
  "TYPE A NAME TO SEARCH · ENTER OPENS TOP MATCH · SORT [TREND|VOL|SETTLE|NAME|SYM|STATUS|LAST] · OPEN · SETTLED · REFRESH · CLEAR · HELP";

function setFilter(v) {
  state.filter = v;
  applyView();
}

function runCommand(raw) {
  const cmd = raw.trim();
  const upper = cmd.toUpperCase();
  const parts = upper.split(/\s+/);

  if (!cmd) {
    setFilter("");
    setStatus("FILTER CLEARED", "");
    return;
  }
  if (upper === "HELP" || upper === "?") return setStatus(HELP, "");
  if (upper === "REFRESH" || upper === "LIVE") return loadFeed({ force: true });
  if (upper === "CLEAR") {
    $("#cmd").value = "";
    setFilter("");
    return setStatus("FILTER CLEARED", "");
  }
  if (upper === "OPEN" || upper === "SETTLED") {
    // status filter
    const want = upper.toLowerCase();
    state.filter = "";
    state.view = state.people
      .filter((p) => p.status === want)
      .sort((a, b) => b.trendScore - a.trendScore);
    renderRegister();
    return setStatus(`${state.view.length} ${upper} CONTRACTS`, "ok");
  }
  if (parts[0] === "SORT") {
    const key = (parts[1] || "").toLowerCase();
    const valid = ["trend", "vol", "settle", "sym", "name", "status", "last"];
    if (valid.includes(key)) {
      state.sort = key;
      applyView();
      return setStatus("SORTED BY " + key.toUpperCase(), "ok");
    }
    return setStatus("SORT KEYS: " + valid.join(" ").toUpperCase(), "err");
  }

  // Otherwise: a search. Filter, and open the top match.
  setFilter(cmd);
  if (state.view.length) {
    openStock(state.view[0].symbol);
    setStatus(`${state.view.length} MATCH${state.view.length === 1 ? "" : "ES"} · OPENED ${state.view[0].symbol}`, "ok");
  } else {
    setStatus(`NO MATCH FOR "${cmd}"`, "err");
  }
}

// ---------- escaping ----------
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
const escAttr = (s) => esc(s).replace(/"/g, "&quot;");

// ---------- init ----------
function init() {
  tickClock();
  setInterval(tickClock, 1000);

  const cmd = $("#cmd");
  cmd.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runCommand(cmd.value);
    else if (e.key === "Escape") {
      cmd.value = "";
      setFilter("");
      setStatus("", "");
    }
  });
  cmd.addEventListener("input", () => {
    const v = cmd.value;
    if (!/^(refresh|live|help|clear|sort|open|settled|\?)\b/i.test(v.trim())) {
      setFilter(v); // live-filter as you type (the register narrows)
    }
  });

  $("#stock-close").addEventListener("click", closeStock);
  $("#stock-backdrop").addEventListener("click", closeStock);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("#stock").hidden) {
      closeStock();
      e.stopPropagation();
    } else if (e.key === "/" && document.activeElement !== cmd) {
      e.preventDefault();
      cmd.focus();
    }
  });

  loadFeed();
  setInterval(() => loadFeed({ force: true }), REFRESH_MS);
}

document.addEventListener("DOMContentLoaded", init);
