// Very lightweight backend memory: a single JSON file on disk. No database.
//
// Each time the feed is built we append a throttled per-person "sample"
// (volume + trend score + status). This gives a real time series across runs —
// the basis for genuine price movement and an OPEN -> SETTLED transition log —
// rather than a single snapshot. For the static GitHub Pages deploy, the
// build commits this file back to the repo so memory survives between runs.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const VERSION = 1;
const MAX_SAMPLES = 240; // cap per person to keep the file small
const MIN_SAMPLE_GAP_MS = 50 * 60 * 1000; // ~hourly throttle

const round = (n) => Math.round(n * 1000) / 1000;

export async function loadMemory(path) {
  try {
    const mem = JSON.parse(await readFile(path, "utf8"));
    if (!mem.people) mem.people = {};
    return mem;
  } catch {
    return { version: VERSION, updatedAt: null, people: {} };
  }
}

export async function saveMemory(path, mem) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(mem));
}

// Record a sample for each current person; returns true if anything changed.
export function recordSnapshot(mem, people, now = Date.now()) {
  let changed = false;
  for (const p of people) {
    let rec = mem.people[p.id];
    if (!rec) {
      rec = mem.people[p.id] = {
        firstObserved: now,
        symbol: p.symbol,
        name: p.name,
        status: p.status,
        samples: [],
      };
      changed = true;
    }

    const last = rec.samples[rec.samples.length - 1];
    const statusChanged = rec.status !== p.status;
    const dueByTime = !last || now - last.t >= MIN_SAMPLE_GAP_MS;

    if (dueByTime || statusChanged) {
      rec.samples.push({
        t: now,
        vol: p.volume,
        score: round(p.trendScore),
        status: p.status,
        age: p.age ?? null,
        le: p.lifeModel && p.lifeModel.status === "open" ? p.lifeModel.adjustedLE : null,
      });
      if (rec.samples.length > MAX_SAMPLES) {
        rec.samples = rec.samples.slice(-MAX_SAMPLES);
      }
      changed = true;
    }

    if (statusChanged) {
      rec.status = p.status;
      if (p.settledAt) rec.settledAt = p.settledAt;
      changed = true;
    }
    rec.name = p.name;
    rec.symbol = p.symbol;
  }
  if (changed) mem.updatedAt = now;
  return changed;
}

// Enrich person objects with their persisted series and derived movement.
export function applyMemory(mem, people) {
  for (const p of people) {
    const rec = mem.people[p.id];
    if (!rec) {
      p.firstObserved = p.firstSeen;
      p.series = [];
      p.volChange = 0;
      p.scoreChange = 0;
      p.sessions = 0;
      continue;
    }
    p.firstObserved = rec.firstObserved;
    p.series = rec.samples;
    p.sessions = rec.samples.length;
    if (rec.samples.length >= 2) {
      const cur = rec.samples[rec.samples.length - 1];
      const prev = rec.samples[rec.samples.length - 2];
      p.volChange = cur.vol - prev.vol;
      p.scoreChange = round(cur.score - prev.score);
    } else {
      p.volChange = 0;
      p.scoreChange = 0;
    }
  }
}
