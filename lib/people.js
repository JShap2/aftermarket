// Person entities: each person is a single object that aggregates "mentions"
// from any number of sources. The conceit is a lifespan prediction market —
// a person is an OPEN contract until an obituary settles it at their age.

import { extractPersonName, extractAge, nameKey, slug, makeSymbol } from "./extract.js";
import { buildLifeModel } from "./lifemodel.js";

const DAY = 24 * 60 * 60 * 1000;
const TREND_TAU_DAYS = 4; // recency decay constant for the "trend" metric
const HISTORY_DAYS = 14; // window for the per-day activity histogram

// Death signals in a non-obituary (celebrity) headline.
const DEATH_RE = /\b(dead|dies|died|passes? away|passed away|obituary|laid to rest|r\.?i\.?p\.?)\b/i;

function isDeathMention(m) {
  if (m.kind === "obituary") return true;
  return DEATH_RE.test(m.title || "");
}

export class Person {
  constructor(name) {
    this.name = name;
    this.mentions = [];
  }

  addMention(m) {
    this.mentions.push(m);
    // Prefer the most complete name variant for display (longest token count).
    if (m.personName && m.personName.split(/\s+/).length > this.name.split(/\s+/).length) {
      this.name = m.personName;
    }
  }

  finalize({ used, now }) {
    this.id = slug(this.name);
    this.symbol = makeSymbol(this.name, used);

    this.mentions.sort((a, b) => (b.pubTs || 0) - (a.pubTs || 0));

    // Settlement: any death mention settles the contract at the obituary age.
    const deaths = this.mentions.filter(isDeathMention);
    this.status = deaths.length ? "settled" : "open";
    this.alive = this.status === "open";

    let settleAge = null;
    let settledAt = null;
    for (const m of deaths) {
      const age = extractAge(m.title);
      if (age != null && settleAge == null) settleAge = age;
      if (m.pubTs && (settledAt == null || m.pubTs > settledAt)) settledAt = m.pubTs;
    }
    this.age = settleAge; // age at death (null if unknown / still open)
    this.settledAt = settledAt;

    // Sources / volume.
    const codes = [...new Set(this.mentions.map((m) => m.sourceCode))];
    this.sources = codes;
    this.sourceCount = codes.length;
    this.volume = this.mentions.length;

    const ts = this.mentions.map((m) => m.pubTs).filter(Boolean);
    this.firstSeen = ts.length ? Math.min(...ts) : null;
    this.lastSeen = ts.length ? Math.max(...ts) : null;

    // Trend: recency-weighted volume (more, and more recent, mentions => hotter).
    this.trendScore = this.mentions.reduce((acc, m) => {
      if (!m.pubTs) return acc + 0.25;
      const ageDays = Math.max(0, (now - m.pubTs) / DAY);
      return acc + Math.exp(-ageDays / TREND_TAU_DAYS);
    }, 0);

    // Per-day activity histogram over the recent window.
    this.history = buildHistory(this.mentions, now);

    // Life-expectancy model (depends on status/age/mentions computed above).
    this.lifeModel = buildLifeModel(
      { name: this.name, age: this.age, status: this.status, mentions: this.mentions },
      now
    );

    return this;
  }

  // Fold in Wikidata facts: real birth year (=> current age / age at death),
  // sex, and an authoritative death (which settles the contract). Recomputes
  // the life model with the better inputs.
  applyEnrichment(en, now = Date.now()) {
    if (!en || en.notFound) {
      this.enrich = en || null;
      return this;
    }
    this.enrich = en;
    this.birthDate = en.birthDate || null;
    this.deathDate = en.deathDate || null;
    this.wikidataQid = en.qid || null;

    // Authoritative death settles the contract even without an obituary.
    if (en.deathYear && this.status !== "settled") {
      this.status = "settled";
      this.alive = false;
      const t = Date.parse(en.deathDate);
      if (!Number.isNaN(t)) this.settledAt = t;
    }

    const nowYear = new Date(now).getFullYear();
    if (this.status === "settled") {
      if (this.age == null && en.birthYear != null) {
        const dYear = en.deathYear != null ? en.deathYear : nowYear;
        const a = dYear - en.birthYear;
        if (a > 0 && a < 130) this.age = a;
      }
    }
    const currentAge =
      en.birthYear != null ? nowYear - en.birthYear : null;

    this.lifeModel = buildLifeModel(
      {
        name: this.name,
        age: this.age,
        status: this.status,
        mentions: this.mentions,
        knownAge: currentAge != null && currentAge > 0 && currentAge < 130 ? currentAge : undefined,
        knownSex: en.sex || undefined,
      },
      now
    );
    return this;
  }

  toJSON() {
    return {
      id: this.id,
      symbol: this.symbol,
      name: this.name,
      status: this.status,
      alive: this.alive,
      age: this.age,
      sources: this.sources,
      sourceCount: this.sourceCount,
      volume: this.volume,
      firstSeen: this.firstSeen,
      lastSeen: this.lastSeen,
      settledAt: this.settledAt,
      trendScore: this.trendScore,
      trendPct: this.trendPct ?? null,
      direction: this.direction ?? "flat",
      // memory-derived (set by applyMemory before serialization)
      firstObserved: this.firstObserved ?? this.firstSeen,
      series: this.series ?? [],
      sessions: this.sessions ?? 0,
      volChange: this.volChange ?? 0,
      scoreChange: this.scoreChange ?? 0,
      lifeModel: this.lifeModel,
      birthDate: this.birthDate ?? null,
      deathDate: this.deathDate ?? null,
      wikidataQid: this.wikidataQid ?? null,
      history: this.history,
      mentions: this.mentions.map((m) => ({
        sourceId: m.sourceId,
        sourceCode: m.sourceCode,
        sourceName: m.sourceName,
        kind: m.kind,
        title: m.title,
        description: m.description,
        category: m.category,
        link: m.link,
        pubTs: m.pubTs,
        isDeath: isDeathMention(m),
      })),
    };
  }
}

function buildHistory(mentions, now) {
  const counts = new Map();
  for (const m of mentions) {
    if (!m.pubTs) continue;
    const day = new Date(m.pubTs).toISOString().slice(0, 10);
    counts.set(day, (counts.get(day) || 0) + 1);
  }
  const out = [];
  for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
    const day = new Date(now - i * DAY).toISOString().slice(0, 10);
    out.push({ day, count: counts.get(day) || 0 });
  }
  return out;
}

// Build unified Person objects from a flat list of tagged items.
// Each item: { title, description, category, link, pubTs, sourceId, sourceCode,
//              sourceName, kind }
export function buildPeople(items, { now = Date.now() } = {}) {
  const byKey = new Map();
  for (const it of items) {
    const personName = extractPersonName(it.title, it.kind);
    const key = nameKey(personName);
    if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, new Person(personName));
    byKey.get(key).addMention({ ...it, personName });
  }

  const used = new Set();
  // Finalize in a stable order (most recent activity first) so symbol
  // assignment is deterministic.
  const people = [...byKey.values()]
    .sort((a, b) => {
      const al = Math.max(...a.mentions.map((m) => m.pubTs || 0));
      const bl = Math.max(...b.mentions.map((m) => m.pubTs || 0));
      return bl - al;
    })
    .map((p) => p.finalize({ used, now }));

  // Trend direction relative to the median, so "trending" is comparative.
  const scores = people.map((p) => p.trendScore).sort((a, b) => a - b);
  const median = scores.length ? scores[Math.floor(scores.length / 2)] : 0;
  for (const p of people) {
    if (median > 0) {
      p.trendPct = ((p.trendScore - median) / median) * 100;
      p.direction = p.trendScore > median ? "up" : p.trendScore < median ? "down" : "flat";
    } else {
      p.trendPct = null;
      p.direction = "flat";
    }
  }

  return people;
}
