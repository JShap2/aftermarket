// Fetches and parses the NYT Obituaries RSS feed, then transforms each entry
// into a "ticker" record. Dependency-free: a small regex RSS parser is good
// enough for a single, well-formed feed.

import { SAMPLE_RSS_ITEMS } from './sample-data.js';

export const FEED_URL =
  process.env.FEED_URL ||
  'https://rss.nytimes.com/services/xml/rss/nyt/Obituaries.xml';

// ---- XML helpers ----------------------------------------------------------

function stripCdata(s) {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

function decodeEntities(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#160;/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&'); // must be last
}

function clean(s) {
  if (!s) return '';
  return decodeEntities(stripCdata(s))
    .replace(/<[^>]+>/g, '') // drop any stray HTML tags
    .replace(/\s+/g, ' ')
    .trim();
}

function tag(block, name) {
  // Matches <name ...>value</name> including namespaced tags like dc:creator.
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i');
  const m = block.match(re);
  return m ? m[1] : '';
}

function parseItems(xml) {
  const items = [];
  const re = /<item\b[\s\S]*?<\/item>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const block = m[0];
    items.push({
      title: clean(tag(block, 'title')),
      link: clean(tag(block, 'link')),
      description: clean(tag(block, 'description')),
      creator: clean(tag(block, 'dc:creator')) || 'The New York Times',
      category: clean(tag(block, 'category')),
      pubDate: clean(tag(block, 'pubDate')),
    });
  }
  return items;
}

// ---- Ticker transform -----------------------------------------------------

const STOPWORDS = new Set([
  'the', 'who', 'and', 'of', 'a', 'an', 'to', 'in', 'is', 'was', 'her', 'his',
  'dies', 'dead', 'at', 'dr', 'mr', 'mrs', 'ms', 'sir', 'dame',
]);

// Person's name is everything before the first comma in an NYT obit headline:
// "Eleanor Vance, Architect Who ..., Dies at 91"
function extractName(title) {
  const beforeComma = title.split(',')[0].trim();
  return beforeComma || title.trim();
}

// Honorifics and prefixes we don't want polluting a ticker symbol.
const NAME_PREFIXES = new Set(['dr', 'mr', 'mrs', 'ms', 'sir', 'dame', 'col', 'colonel', 'gen', 'lt', 'rev', 'prof']);

function makeSymbol(name, used) {
  const words = name
    .replace(/[^A-Za-z\s'-]/g, '')
    .split(/\s+/)
    .filter((w) => w && !NAME_PREFIXES.has(w.toLowerCase().replace(/\./g, '')));

  let base = '';
  if (words.length >= 2) {
    // Initials of given names + first chars of surname.
    const surname = words[words.length - 1];
    const initials = words.slice(0, -1).map((w) => w[0]).join('');
    base = (initials + surname.slice(0, 4 - Math.min(initials.length, 2))).toUpperCase();
  } else if (words.length === 1) {
    base = words[0].slice(0, 4).toUpperCase();
  }
  base = (base || 'OBIT').replace(/[^A-Z]/g, '').slice(0, 5) || 'OBIT';

  let sym = base;
  let n = 1;
  while (used.has(sym)) {
    const suffix = String(++n);
    sym = (base.slice(0, Math.max(1, 5 - suffix.length)) + suffix).toUpperCase();
  }
  used.add(sym);
  return sym;
}

// Pull the age out of the headline: "Dies at 91", "Is Dead at 78", etc.
function extractAge(title) {
  const m = title.match(/(?:dies?|dead|died)\s+at\s+(\d{1,3})/i);
  if (m) return parseInt(m[1], 10);
  const m2 = title.match(/\bat\s+(\d{2,3})\b/i); // looser fallback
  if (m2) {
    const n = parseInt(m2[1], 10);
    if (n >= 1 && n <= 120) return n;
  }
  return null;
}

function parsePubDate(pubDate) {
  const t = Date.parse(pubDate);
  return Number.isNaN(t) ? null : t;
}

export function toTickerData(items) {
  const used = new Set();

  let rows = items.map((it) => {
    const name = extractName(it.title);
    return {
      symbol: makeSymbol(name, used),
      name,
      title: it.title,
      headline: it.title,
      description: it.description,
      category: it.category || 'Obituary',
      author: it.creator,
      link: it.link,
      age: extractAge(it.title),
      pubTs: parsePubDate(it.pubDate),
    };
  });

  // The "index": average age across entries with a known age. Each row's
  // delta-vs-average drives the green/red ticker coloring. This is a stylistic
  // metric, not a market quote — but it is at least derived from real data.
  const known = rows.filter((r) => r.age != null).map((r) => r.age);
  const avg = known.length
    ? known.reduce((a, b) => a + b, 0) / known.length
    : null;

  rows = rows.map((r) => {
    let change = null;
    let changePct = null;
    if (r.age != null && avg != null) {
      change = r.age - avg;
      changePct = avg ? (change / avg) * 100 : null;
    }
    return {
      ...r,
      change,
      changePct,
      direction: change == null ? 'flat' : change > 0 ? 'up' : change < 0 ? 'down' : 'flat',
    };
  });

  // Most recent first.
  rows.sort((a, b) => (b.pubTs || 0) - (a.pubTs || 0));

  return {
    indexValue: avg,
    count: rows.length,
    rows,
  };
}

// ---- Public API -----------------------------------------------------------

let cache = { ts: 0, payload: null };
const CACHE_MS = 5 * 60 * 1000; // 5 minutes

async function fetchLive() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(FEED_URL, {
      signal: controller.signal,
      headers: { 'User-Agent': 'aftermarket-ticker/1.0 (+https://github.com)' },
    });
    if (!res.ok) throw new Error(`Feed responded ${res.status}`);
    const xml = await res.text();
    const items = parseItems(xml);
    if (!items.length) throw new Error('No items parsed from feed');
    return items;
  } finally {
    clearTimeout(timer);
  }
}

export async function getFeed({ force = false } = {}) {
  const now = Date.now();
  if (!force && cache.payload && now - cache.ts < CACHE_MS) {
    return cache.payload;
  }

  let items;
  let source = 'live';
  let error = null;
  try {
    items = await fetchLive();
  } catch (e) {
    error = e.message || String(e);
    items = SAMPLE_RSS_ITEMS;
    source = 'sample';
  }

  const data = toTickerData(items);
  const payload = {
    source,
    error,
    fetchedAt: new Date(now).toISOString(),
    feedUrl: FEED_URL,
    ...data,
  };
  cache = { ts: now, payload };
  return payload;
}
