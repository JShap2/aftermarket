// Enrich a person with biographical facts from Wikidata (no API key required).
//
// Flow: search the name -> take the first result that is actually a human
// (P31 = Q5) -> read date of birth (P569), date of death (P570), sex (P21).
// Results (including "not found") are meant to be cached in the memory store so
// each person is looked up at most once (then re-checked occasionally).

const API = "https://www.wikidata.org/w/api.php";
const UA = "aftermarket/1.0 (lifespan-exchange; contact via github)";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url, attempt = 0) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": UA } });
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      const retryAfter = parseInt(res.headers.get("retry-after") || "0", 10);
      const wait = retryAfter ? retryAfter * 1000 : 500 * 2 ** attempt; // backoff
      clearTimeout(timer);
      await sleep(wait);
      return fetchJson(url, attempt + 1);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function claimTime(claims, prop) {
  const snak = claims?.[prop]?.[0]?.mainsnak?.datavalue?.value?.time;
  if (!snak) return null;
  // Format: +1956-07-09T00:00:00Z  (or with negative year for BCE)
  const m = String(snak).match(/^([+-]?)(\d{1,})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const sign = m[1] === "-" ? -1 : 1;
  return { year: sign * parseInt(m[2], 10), month: +m[3], day: +m[4], raw: snak };
}

function claimSex(claims) {
  const id = claims?.P21?.[0]?.mainsnak?.datavalue?.value?.id;
  if (id === "Q6581097") return "M"; // male
  if (id === "Q6581072") return "F"; // female
  return null;
}

const isHuman = (claims) =>
  (claims?.P31 || []).some((s) => s?.mainsnak?.datavalue?.value?.id === "Q5");

// Look up one person. Returns a plain record (cacheable) or { notFound: true }.
export async function fetchWikidataPerson(name) {
  const searchUrl =
    `${API}?action=wbsearchentities&format=json&language=en&type=item&limit=5&search=` +
    encodeURIComponent(name);
  const sr = await fetchJson(searchUrl);
  const candidates = sr.search || [];
  if (!candidates.length) return { notFound: true };

  for (const c of candidates.slice(0, 3)) {
    let ent;
    try {
      const er = await fetchJson(
        `${API}?action=wbgetentities&format=json&props=claims|descriptions&ids=${c.id}`
      );
      ent = er.entities?.[c.id];
    } catch {
      continue;
    }
    const claims = ent?.claims || {};
    if (!isHuman(claims)) continue;

    const birth = claimTime(claims, "P569");
    const death = claimTime(claims, "P570");
    return {
      qid: c.id,
      label: c.label || name,
      description: c.description || ent?.descriptions?.en?.value || "",
      birthYear: birth ? birth.year : null,
      birthDate: birth ? birth.raw.replace(/^\+/, "").slice(0, 10) : null,
      deathYear: death ? death.year : null,
      deathDate: death ? death.raw.replace(/^\+/, "").slice(0, 10) : null,
      sex: claimSex(claims),
    };
  }
  return { notFound: true };
}

// Decide whether a cached enrichment record should be refreshed.
const DAY = 86400000;
export function enrichStale(cached, now = Date.now()) {
  if (!cached || !cached.fetchedAt) return true;
  const age = now - cached.fetchedAt;
  if (cached.notFound) return age > 7 * DAY; // retry misses weekly
  if (!cached.deathYear) return age > 30 * DAY; // living people can die; recheck monthly
  return age > 180 * DAY; // settled facts rarely change
}

// Enrich a list of people (concurrency-limited). Sets `person._enrich`.
export async function enrichPeople(people, { concurrency = 3, now = Date.now() } = {}) {
  let i = 0;
  async function worker() {
    while (i < people.length) {
      const p = people[i++];
      try {
        const res = await fetchWikidataPerson(p.name);
        p._enrich = { ...res, fetchedAt: now };
      } catch (e) {
        p._enrich = { notFound: true, error: e.message || String(e), fetchedAt: now };
      }
      await sleep(120); // be polite to the Wikidata API
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, people.length) }, worker));
}
