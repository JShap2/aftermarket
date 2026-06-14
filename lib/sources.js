// Registry of RSS sources. Adding a new feed later is just another entry here
// (plus, optionally, fallback sample items in sample-data.js keyed by `id`).
//
// kind drives how a person's name is extracted from an item title:
//   "obituary"  -> name is the text before the first comma ("Jane Doe, ...")
//   "celebrity" -> name is the leading Proper Noun run in the headline
export const SOURCES = [
  {
    id: "nyt-obits",
    code: "NYT",
    name: "NYT Obituaries",
    kind: "obituary",
    url:
      process.env.NYT_FEED_URL ||
      "https://rss.nytimes.com/services/xml/rss/nyt/Obituaries.xml",
  },
  {
    id: "tmz",
    code: "TMZ",
    name: "TMZ",
    kind: "celebrity",
    url: process.env.TMZ_FEED_URL || "https://www.tmz.com/rss.xml",
  },
];

export function getSource(id) {
  return SOURCES.find((s) => s.id === id);
}
