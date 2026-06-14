// Name / age / symbol extraction and the normalized key used to unify the same
// person across different sources.

const HONORIFICS = new Set([
  "dr", "mr", "mrs", "ms", "sir", "dame", "col", "colonel", "gen", "general",
  "lt", "lieutenant", "rev", "prof", "professor", "sen", "senator", "rep",
  "gov", "governor", "capt", "captain", "sgt",
]);
const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "phd", "md", "esq"]);

// Role / org tokens that precede a name in a headline and should be skipped to
// reach the actual subject (e.g. "NBA Star James ..." -> "James ...").
const LEAD_SKIP = new Set([
  "nfl", "nba", "nhl", "mlb", "ncaa", "ufc", "wwe", "nascar", "pga", "wnba",
  "star", "singer", "actor", "actress", "rapper", "reality", "former", "ex",
  "model", "comedian", "influencer", "tiktok", "youtube", "youtuber", "dj",
  "chef", "coach", "legend", "icon", "pop", "rock", "teen", "mystery", "sir",
  "olympic", "olympian", "ag", "ny", "la", "dr", "mr", "mrs", "ms", "sen",
  "rep", "gov", "judge", "host", "queen", "king", "prince", "princess",
  // sports positions / descriptors that precede a player's name
  "defensive", "offensive", "end", "receiver", "guard", "tackle", "lineman",
  "quarterback", "qb", "rb", "wr", "te", "linebacker", "cornerback", "safety",
  "pitcher", "forward", "center", "sprinter", "boxer", "fighter", "driver",
  "gymnast", "swimmer", "skater", "wrestler", "player", "champ", "champion",
]);

// Title Case words that are really verbs/connectors and must END a name run,
// even though TMZ capitalizes them.
const STOP_WORDS = new Set([
  // verbs
  "dead", "dies", "died", "passes", "passed", "away", "obituary", "remembered",
  "reacts", "reportedly", "spotted", "seen", "shares", "reveals", "opens",
  "sues", "slams", "calls", "backs", "breaks", "lands", "drops", "announces",
  "debuts", "gets", "says", "talks", "addresses", "claps", "claims", "denies",
  "confirms", "responds", "hits", "posts", "wears", "flaunts", "steps", "fires",
  "joins", "leaves", "returns", "marks", "honors", "mourns", "pays", "recalls",
  "defends", "blasts", "sparks", "faces", "wins", "loses", "celebrates",
  "welcomes", "reflects", "closes", "set", "lost", "final", "dead.",
  "demands", "hopeful", "arrested", "charged", "jailed", "visits", "visit",
  "kicks", "kick", "hot", "best", "scars", "dad", "mom", "twin", "brother",
  "sister", "son", "daughter", "wife", "husband", "girlfriend", "boyfriend",
  "reportedly", "allegedly", "spotted", "addresses", "rocks", "stuns",
  // connectors
  "and", "or", "of", "the", "a", "an", "for", "with", "out", "to", "in", "on",
  "at", "after", "before", "amid", "over", "as", "his", "her", "their", "is",
  "are", "was", "were", "be", "from", "by", "but", "not", "no", "new", "who",
]);

const tokenWord = (t) => t.replace(/[^a-zA-Z.'’-]/g, "");
const lc = (t) => tokenWord(t).toLowerCase().replace(/[.'’-]/g, "");
const isTitleCase = (t) => /^[A-Z][a-zA-Z.'’-]*$/.test(t);
const isAcronym = (t) => /^[A-Z]{2,4}$/.test(t);

// Obituary headlines: "Jane Q. Doe, Who Did X, Dies at 88" -> "Jane Q. Doe".
function nameFromObituary(title) {
  return (title.split(",")[0] || title).trim();
}

// Celebrity headlines: skip leading role/org tokens, then take the leading run
// of Title Case name words, stopping at the first verb/connector.
function nameFromCelebrity(title) {
  const cleaned = title.replace(/[’']s\b/g, ""); // drop possessive
  let tokens = cleaned.split(/\s+/).filter(Boolean);

  // Skip leading role/org/acronym tokens to reach the actual name.
  let skips = 0;
  while (tokens.length && skips < 5 && (LEAD_SKIP.has(lc(tokens[0])) || isAcronym(tokens[0]))) {
    tokens = tokens.slice(1);
    skips++;
  }

  const run = [];
  for (const t of tokens) {
    const w = tokenWord(t); // strip trailing commas etc. before testing
    if (w && isTitleCase(w) && !STOP_WORDS.has(lc(t)) && !isAcronym(w)) {
      run.push(w);
      if (/[,;:]/.test(t)) break; // punctuation after the name ends the subject
      if (run.length >= 3) break;
    } else {
      break;
    }
  }
  if (run.length >= 2) return run.join(" ");
  if (run.length === 1) return run[0];
  return tokens.slice(0, 2).map(tokenWord).join(" ").trim();
}

export function extractPersonName(title, kind) {
  const name = kind === "obituary" ? nameFromObituary(title) : nameFromCelebrity(title);
  return name.replace(/\s+/g, " ").trim();
}

// Age at death from an obituary headline.
export function extractAge(title) {
  const m = title.match(/(?:dies?|dead|died)\s+at\s+(\d{1,3})/i);
  if (m) return parseInt(m[1], 10);
  const m2 = title.match(/\bat\s+(\d{2,3})\b/i);
  if (m2) {
    const n = parseInt(m2[1], 10);
    if (n >= 1 && n <= 120) return n;
  }
  return null;
}

// Strip diacritics so "Tomás" and "Tomas" unify.
function deaccent(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function nameWords(name) {
  return deaccent(name)
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !HONORIFICS.has(w) && !SUFFIXES.has(w));
}

// Normalized key for unifying the same person across sources.
export function nameKey(name) {
  return nameWords(name).join(" ");
}

// URL-ish stable id.
export function slug(name) {
  return nameKey(name).replace(/\s+/g, "-") || "unknown";
}

// Ticker symbol from a name, made unique against `used`.
export function makeSymbol(name, used) {
  const words = nameWords(name).map((w) => w.replace(/[^a-z]/g, "")).filter(Boolean);
  let base = "";
  if (words.length >= 2) {
    const surname = words[words.length - 1];
    const initials = words.slice(0, -1).map((w) => w[0]).join("");
    base = (initials + surname.slice(0, 4 - Math.min(initials.length, 2))).toUpperCase();
  } else if (words.length === 1) {
    base = words[0].slice(0, 4).toUpperCase();
  }
  base = (base || "PSN").replace(/[^A-Z]/g, "").slice(0, 5) || "PSN";

  let sym = base;
  let n = 1;
  while (used.has(sym)) {
    const suffix = String(++n);
    sym = (base.slice(0, Math.max(1, 5 - suffix.length)) + suffix).toUpperCase();
  }
  used.add(sym);
  return sym;
}
