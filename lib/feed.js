// Orchestrates the whole pipeline: fetch every registered source, parse items,
// unify them into Person entities, fold in persisted memory (time series), and
// compute the market-style metrics the UI renders.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { SOURCES } from "./sources.js";
import { SAMPLE_BY_SOURCE } from "./sample-data.js";
import { buildPeople } from "./people.js";
import { loadMemory, saveMemory, recordSnapshot, applyMemory } from "./memory.js";
import { enrichPeople, enrichStale } from "./enrich.js";

const ENRICH = process.env.ENRICH !== "0"; // set ENRICH=0 to skip Wikidata lookups

const __dirname = dirname(fileURLToPath(import.meta.url));
const MEMORY_PATH =
  process.env.MEMORY_PATH || join(__dirname, "..", "data", "memory.json");

// ---- XML helpers (small regex parser; feeds are single + well-formed) ----

function stripCdata(s) {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}
function safeChar(code) {
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}
function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => safeChar(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => safeChar(parseInt(h, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&#160;|&nbsp;/g, " ")
    .replace(/&amp;/g, "&"); // last
}
function clean(s) {
  if (!s) return "";
  return decodeEntities(stripCdata(s))
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
function tag(block, name) {
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i");
  const m = block.match(re);
  return m ? m[1] : "";
}
function parseItems(xml) {
  const items = [];
  const re = /<item\b[\s\S]*?<\/item>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const block = m[0];
    const pub = clean(tag(block, "pubDate"));
    const t = Date.parse(pub);
    items.push({
      title: clean(tag(block, "title")),
      link: clean(tag(block, "link")),
      description: clean(tag(block, "description")),
      category: clean(tag(block, "category")),
      pubTs: Number.isNaN(t) ? null : t,
    });
  }
  return items;
}

// ---- Fetch a single source (live, with sample fallback) ----

async function fetchSourceItems(source) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(source.url, {
      signal: controller.signal,
      headers: { "User-Agent": "aftermarket/1.0 (+https://github.com)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const items = parseItems(xml);
    if (!items.length) throw new Error("no items parsed");
    return { items, live: true, error: null };
  } catch (e) {
    const sample = SAMPLE_BY_SOURCE[source.id] || [];
    return {
      items: sample.map((s) => {
        const t = Date.parse(s.pubDate);
        return {
          title: s.title,
          link: s.link,
          description: s.description,
          category: s.category,
          pubTs: Number.isNaN(t) ? null : t,
        };
      }),
      live: false,
      error: e.message || String(e),
    };
  } finally {
    clearTimeout(timer);
  }
}

function tagItems(items, source) {
  return items.map((it) => ({
    ...it,
    sourceId: source.id,
    sourceCode: source.code,
    sourceName: source.name,
    kind: source.kind,
  }));
}

// ---- Public API with a short cache ----

let cache = { ts: 0, payload: null };
const CACHE_MS = 5 * 60 * 1000;

export async function getFeed({ force = false } = {}) {
  const now = Date.now();
  if (!force && cache.payload && now - cache.ts < CACHE_MS) return cache.payload;

  const sourceResults = await Promise.all(
    SOURCES.map(async (s) => ({ source: s, ...(await fetchSourceItems(s)) }))
  );

  const allItems = sourceResults.flatMap((r) => tagItems(r.items, r.source));
  const people = buildPeople(allItems, { now });

  const mem = await loadMemory(MEMORY_PATH);

  // Backfill biographical facts (age/sex/death) from Wikidata, cached in memory
  // so each person is looked up at most once (then re-checked occasionally).
  let enrichChanged = false;
  if (ENRICH) {
    const toFetch = [];
    for (const p of people) {
      const cached = mem.people[p.id] && mem.people[p.id].enrich;
      if (cached && !enrichStale(cached, now)) p._enrich = cached;
      else toFetch.push(p);
    }
    if (toFetch.length) {
      try {
        await enrichPeople(toFetch, { now });
      } catch {
        /* network issue: people keep their unenriched models */
      }
    }
    for (const p of people) if (p._enrich) p.applyEnrichment(p._enrich, now);
  }

  // Lightweight persisted memory: record a sample and fold the series back in.
  const changed = recordSnapshot(mem, people, now);
  applyMemory(mem, people);

  // Persist enrichment onto the (now-created) memory records.
  for (const p of people) {
    if (p._enrich && mem.people[p.id] && mem.people[p.id].enrich !== p._enrich) {
      mem.people[p.id].enrich = p._enrich;
      enrichChanged = true;
    }
  }
  if (changed || enrichChanged) {
    try {
      await saveMemory(MEMORY_PATH, mem);
    } catch {
      /* read-only fs: memory simply won't persist this run */
    }
  }

  const serialized = people.map((p) => p.toJSON());
  const aliveCount = people.filter((p) => p.alive).length;
  const settledCount = people.length - aliveCount;
  const settleAges = people.filter((p) => p.age != null).map((p) => p.age);
  const avgSettleAge = settleAges.length
    ? settleAges.reduce((a, b) => a + b, 0) / settleAges.length
    : null;

  const payload = {
    generatedAt: new Date(now).toISOString(),
    sources: sourceResults.map((r) => ({
      id: r.source.id,
      code: r.source.code,
      name: r.source.name,
      kind: r.source.kind,
      live: r.live,
      error: r.error,
      count: r.items.length,
    })),
    anyLive: sourceResults.some((r) => r.live),
    count: people.length,
    aliveCount,
    settledCount,
    avgSettleAge,
    people: serialized,
  };

  cache = { ts: now, payload };
  return payload;
}
